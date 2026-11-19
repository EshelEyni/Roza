// Exports a chapter or a whole book as one audio file with chapter markers, through ffmpeg.
// Ported from RozaReader's server/focus/exporter.ts. ffmpeg comes from the local voices runtime.
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { existsSync } = require("node:fs");
const { mkdir, rm, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { createInterface } = require("node:readline");

// 64 kbps is plenty for one voice and keeps a whole book small.
const CODEC_ARGS = {
  m4a: ["-c:a", "aac", "-b:a", "64k", "-f", "ipod"],
  mp4: ["-c:a", "aac", "-b:a", "64k", "-f", "mp4"],
  mp3: ["-c:a", "libmp3lame", "-b:a", "64k", "-id3v2_version", "3"],
};

const safeName = (text) => text.replace(/[/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Audiobook";

function uniquePath(folder, name, extension) {
  let candidate = path.join(folder, `${name}.${extension}`);
  for (let copy = 2; existsSync(candidate); copy++) candidate = path.join(folder, `${name} (${copy}).${extension}`);
  return candidate;
}

const escapeMetadata = (text) => String(text).replace(/([=;#\\\n])/g, "\\$1");

/**
 * @param {{ tempDir: string, ffmpeg: () => string | null, ensureSentence: Function }} options
 */
function createExporter({ tempDir, ffmpeg: ffmpegPath, ensureSentence }) {
  const jobs = new Map();
  const stops = new Map();
  const children = new Set();

  async function run(job, script, request) {
    let isStopped = false;
    let child = null;
    stops.set(job.id, () => {
      isStopped = true;
      child?.kill();
    });

    const parts = request.section === null ? script.sections : script.sections.filter((part) => part.section === request.section);
    const total = parts.reduce((sum, part) => sum + part.sentences.length, 0);
    const files = [];
    const markers = [];
    let done = 0;
    let elapsed = 0;

    for (const part of parts) {
      const start = elapsed;
      for (let index = 0; index < part.sentences.length; index++) {
        if (isStopped) return;
        const audio = await ensureSentence({
          bookId: script.bookId, voice: request.voice, section: part.section, index, sentence: part.sentences[index], priority: "low",
        });
        files.push(audio.file);
        elapsed += audio.duration;
        done += 1;
        job.progress = Math.floor((done / total) * 85);
        job.stage = `Generating speech… ${done} of ${total} sentences`;
      }
      markers.push({ title: part.title || `Chapter ${part.section + 1}`, start, end: elapsed });
    }

    const workDir = path.join(tempDir, job.id);
    await mkdir(workDir, { recursive: true });
    try {
      const listFile = path.join(workDir, "list.txt");
      const metadataFile = path.join(workDir, "chapters.txt");
      await writeFile(listFile, files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
      const single = request.section === null ? null : parts[0];
      const metadata = [
        ";FFMETADATA1",
        `title=${escapeMetadata(single ? `${script.title}: ${single.title}` : script.title)}`,
        `artist=${escapeMetadata(script.author)}`,
        `album=${escapeMetadata(script.title)}`,
        ...markers.flatMap((marker) => [
          "[CHAPTER]", "TIMEBASE=1/1000",
          `START=${Math.round(marker.start * 1000)}`, `END=${Math.round(marker.end * 1000)}`,
          `title=${escapeMetadata(marker.title)}`,
        ]),
      ];
      await writeFile(metadataFile, `${metadata.join("\n")}\n`);

      await mkdir(request.folder, { recursive: true });
      const chapterPart = single ? ` - ${String(single.section + 1).padStart(2, "0")} ${single.title}` : "";
      const output = uniquePath(request.folder, safeName(`${script.title}${chapterPart}`), request.format);
      const executable = ffmpegPath();
      if (!executable) throw new Error("ffmpeg is missing. Reinstall local voices.");

      job.stage = `Encoding ${request.format.toUpperCase()}…`;
      await new Promise((resolve, reject) => {
        const args = [
          "-y", "-hide_banner", "-loglevel", "error", "-progress", "pipe:1",
          "-f", "concat", "-safe", "0", "-i", listFile,
          "-i", metadataFile, "-map", "0:a", "-map_metadata", "1", "-map_chapters", "1",
          ...CODEC_ARGS[request.format], output,
        ];
        child = spawn(executable, args, { windowsHide: true });
        children.add(child);
        let errorText = "";
        child.stderr.on("data", (chunk) => { errorText += chunk; });
        createInterface({ input: child.stdout }).on("line", (line) => {
          const microseconds = Number(line.match(/^out_time_us=(\d+)/)?.[1]);
          if (microseconds && elapsed) job.progress = 85 + Math.min(14, Math.floor((microseconds / 1e6 / elapsed) * 14));
        });
        child.on("error", (error) => reject(new Error(`ffmpeg could not start (${error.message}).`)));
        child.on("exit", (code) => {
          children.delete(child);
          if (code === 0) resolve();
          else reject(new Error(isStopped ? "Stopped." : errorText.trim() || `ffmpeg exit code ${code}`));
        });
      });

      job.state = "done";
      job.progress = 100;
      job.stage = "Saved";
      job.filePath = output;
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /** @param {{ section: number | null, format: "m4a"|"mp4"|"mp3", voice: string, folder: string }} request */
  function start(script, request) {
    if (!CODEC_ARGS[request.format]) throw new Error("Unknown export format.");
    const job = { id: randomUUID(), state: "running", progress: 0, stage: "Starting…" };
    jobs.set(job.id, job);
    run(job, script, request)
      .catch((error) => {
        if (job.state !== "running") return;
        job.state = "error";
        job.error = error.message;
      })
      .finally(() => stops.delete(job.id));
    return { ...job };
  }

  function stop(jobId) {
    const job = jobs.get(jobId);
    if (!job || job.state !== "running") return job ? { ...job } : null;
    job.state = "stopped";
    job.stage = "Stopped";
    stops.get(jobId)?.();
    return { ...job };
  }

  const get = (jobId) => {
    const job = jobs.get(jobId);
    return job ? { ...job } : null;
  };

  const filePath = (jobId) => jobs.get(jobId)?.filePath || null;

  const stopAll = () => {
    for (const stopJob of stops.values()) stopJob();
    for (const child of children) child.kill();
  };

  return { start, stop, get, filePath, stopAll };
}

module.exports = { createExporter, EXPORT_FORMATS: Object.keys(CODEC_ARGS) };
