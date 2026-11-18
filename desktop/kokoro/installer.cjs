// Installs the local voices runtime on first use, entirely inside one folder:
//   uv (pinned, checksum-verified) → Python 3.11 → kokoro + spaCy English + ffmpeg → model + all voices → self-test.
// Nothing goes to PATH or the user's global caches, so "Remove local voices" removes everything.
const { spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const { createWriteStream, existsSync } = require("node:fs");
const { mkdir, readFile, rm, statfs, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { createInterface } = require("node:readline");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { kokoroVoices } = require("./voices.cjs");

const UV_VERSION = "0.13.1";
const UV_URL = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-pc-windows-msvc.zip`;
const UV_SHA256 = "3b2661a463a5baea7f5076ea2b25ab71d77f36a6c0d809e5350651792f80a672";
const PACKAGES = [
  "kokoro==0.9.4",
  "misaki[en]==0.9.4",
  "soundfile==0.14.0",
  "imageio-ffmpeg==0.8.1",
  "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl",
];
// Bump when the runtime recipe changes, so older installs are offered a reinstall.
const RUNTIME_VERSION = 1;
const NEEDED_BYTES = 3 * 1024 ** 3;
const MARKER = "installed.json";

const PREFETCH = `
import sys
from huggingface_hub import hf_hub_download
files = ["config.json", "kokoro-v1_0.pth"] + [f"voices/{v}.pt" for v in sys.argv[1].split(",")]
for index, name in enumerate(files, 1):
    hf_hub_download("hexgrad/Kokoro-82M", name)
    print(f"{index}/{len(files)}", flush=True)
`;

/**
 * @param {{ runtimeDir: string, script: string, onProgress: (status: object) => void }} options
 */
function createInstaller({ runtimeDir, script, onProgress }) {
  const venvPython = path.join(runtimeDir, ".venv", "Scripts", "python.exe");
  const uvExe = path.join(runtimeDir, "uv", "uv.exe");
  let marker = null;
  let job = null;

  const env = (extra = {}) => ({
    ...process.env,
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
    PYTHONIOENCODING: "utf-8",
    UV_PYTHON_INSTALL_DIR: path.join(runtimeDir, "python"),
    UV_CACHE_DIR: path.join(runtimeDir, "uv-cache"),
    UV_NO_CONFIG: "1",
    HF_HOME: path.join(runtimeDir, "hf"),
    HF_HUB_DISABLE_TELEMETRY: "1",
    ...extra,
  });

  /** The environment Kokoro runs with once installed: offline, so it never waits on the network. */
  const runtimeEnv = () => env({ HF_HUB_OFFLINE: "1", VIRTUAL_ENV: path.join(runtimeDir, ".venv") });

  async function loadMarker() {
    try {
      marker = JSON.parse(await readFile(path.join(runtimeDir, MARKER), "utf8"));
    } catch {
      marker = null;
    }
    return marker;
  }

  const isInstalled = () => Boolean(marker && marker.version === RUNTIME_VERSION && existsSync(venvPython));
  const needsUpdate = () => Boolean(marker && marker.version !== RUNTIME_VERSION);

  let lastError = null;
  const status = () => ({
    installed: isInstalled(),
    needsUpdate: needsUpdate(),
    installing: Boolean(job),
    progress: job ? { ...job.progress } : null,
    error: job ? null : lastError,
    formats: marker?.formats || [],
    neededBytes: NEEDED_BYTES,
  });

  function report(stage, message, percent) {
    if (!job) return;
    job.progress = { stage, message, percent: Math.max(0, Math.min(100, Math.round(percent))) };
    onProgress(status());
  }

  /** Runs a program; streams its output lines to `onLine`; rejects on a non-zero exit. */
  function run(command, args, { onLine, extraEnv, cwd } = {}) {
    return new Promise((resolve, reject) => {
      if (job?.cancelled) return reject(new Error("Cancelled."));
      const child = spawn(command, args, { env: env(extraEnv), cwd: cwd || runtimeDir, windowsHide: true });
      job.child = child;
      let tail = [];
      const take = (line) => {
        tail = [...tail, line].slice(-8);
        onLine?.(line);
      };
      createInterface({ input: child.stdout }).on("line", take);
      createInterface({ input: child.stderr }).on("line", take);
      child.on("error", reject);
      child.on("exit", (code) => {
        if (job) job.child = null;
        if (job?.cancelled) return reject(new Error("Cancelled."));
        if (code === 0) resolve(tail);
        else reject(new Error(tail.filter((line) => line.trim()).slice(-3).join(" ") || `${path.basename(command)} exit code ${code}`));
      });
    });
  }

  async function download(url, file, onBytes) {
    const controller = new AbortController();
    job.abort = () => controller.abort();
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}).`);
    const total = Number(response.headers.get("content-length")) || 0;
    const hash = createHash("sha256");
    let received = 0;
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        hash.update(chunk);
        onBytes(received, total);
        callback(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(response.body), counter, createWriteStream(file));
    job.abort = null;
    return hash.digest("hex");
  }

  async function install() {
    if (job) return status();
    job = { cancelled: false, child: null, abort: null, progress: { stage: "start", message: "Starting…", percent: 0 } };
    lastError = null;
    onProgress(status());
    (async () => {
      await mkdir(runtimeDir, { recursive: true });
      const disk = await statfs(runtimeDir).catch(() => null);
      if (disk && disk.bavail * disk.bsize < NEEDED_BYTES) {
        throw new Error(`Not enough free disk space. Local voices need about ${(NEEDED_BYTES / 1024 ** 3).toFixed(0)} GB.`);
      }
      await rm(path.join(runtimeDir, MARKER), { force: true });
      marker = null;

      // 1. uv
      if (!existsSync(uvExe)) {
        await mkdir(path.dirname(uvExe), { recursive: true });
        const zip = path.join(runtimeDir, "uv", "uv.zip");
        const digest = await download(UV_URL, zip, (received, total) =>
          report("uv", "Downloading the installer…", total ? (received / total) * 5 : 2));
        if (digest !== UV_SHA256) throw new Error("The installer download was damaged. Try again.");
        const tar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
        await run(tar, ["-xf", zip, "-C", path.dirname(uvExe)]);
        await rm(zip, { force: true });
      }

      // 2. Python
      report("python", "Setting up Python…", 6);
      if (!existsSync(venvPython)) {
        await run(uvExe, ["venv", "--python", "3.11", "--python-preference", "only-managed", path.join(runtimeDir, ".venv")]);
      }

      // 3. Packages (torch is the big one)
      report("packages", "Installing the speech engine (this is the longest step)…", 15);
      let seen = 0;
      await run(uvExe, ["pip", "install", "--python", venvPython, ...PACKAGES], {
        onLine: (line) => {
          seen += 1;
          const match = line.match(/(Downloading|Installed|Prepared|Built)\s+(.+)/);
          report("packages", match ? `${match[1]} ${match[2].slice(0, 60)}` : "Installing the speech engine…", 15 + Math.min(40, seen * 0.4));
        },
      });

      // 4. Model and every voice, so narration works offline.
      report("model", "Downloading the voice model and voices…", 56);
      await run(venvPython, ["-c", PREFETCH, kokoroVoices.join(",")], {
        onLine: (line) => {
          const [done, total] = line.split("/").map(Number);
          if (total) report("model", `Downloading voices… ${done} of ${total}`, 56 + (done / total) * 36);
        },
      });

      // 5. ffmpeg (for export) and its encoders.
      report("test", "Checking audio export…", 93);
      const [ffmpeg] = (await run(venvPython, ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]))
        .filter((line) => line.trim().toLowerCase().endsWith(".exe"));
      const encoders = ffmpeg ? await encoderList(ffmpeg.trim()) : "";
      const formats = [
        ...(/\baac\b/.test(encoders) ? ["m4a", "mp4"] : []),
        ...(/libmp3lame/.test(encoders) ? ["mp3"] : []),
      ];

      // 6. Self-test: real speech written to a path with Hebrew letters (the user profile may have them).
      report("test", "Testing a voice…", 96);
      await selfTest();

      marker = { version: RUNTIME_VERSION, installedAt: new Date().toISOString(), ffmpeg: ffmpeg ? ffmpeg.trim() : null, formats };
      await writeFile(path.join(runtimeDir, MARKER), JSON.stringify(marker, null, 2));
    })()
      .then(() => {
        job = null;
        onProgress(status());
      })
      .catch((error) => {
        const cancelled = job?.cancelled;
        job = null;
        lastError = cancelled ? null : error.message;
        onProgress(status());
      });
    return status();
  }

  /** ffmpeg -encoders prints a long list; read all of it, not just the tail. */
  function encoderList(ffmpeg) {
    return new Promise((resolve) => {
      const child = spawn(ffmpeg, ["-hide_banner", "-encoders"], { windowsHide: true });
      let text = "";
      child.stdout.on("data", (chunk) => { text += chunk; });
      child.on("error", () => resolve(""));
      child.on("exit", () => resolve(text));
    });
  }

  function selfTest() {
    return new Promise((resolve, reject) => {
      const folder = path.join(runtimeDir, "self-test", "בדיקה");
      const out = path.join(folder, "בדיקה.wav");
      mkdir(folder, { recursive: true }).then(() => {
        const child = spawn(venvPython, [script], { env: runtimeEnv(), cwd: runtimeDir, windowsHide: true });
        job.child = child;
        let tail = [];
        let done = false;
        const timer = setTimeout(() => finish(new Error("The voice test took too long.")), 5 * 60 * 1000);
        const finish = (error) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          child.stdin.end();
          child.kill();
          rm(path.join(runtimeDir, "self-test"), { recursive: true, force: true }).catch(() => {});
          if (error) reject(error); else resolve();
        };
        child.stdin.on("error", () => {});
        createInterface({ input: child.stderr }).on("line", (line) => { tail = [...tail, line].slice(-3); });
        createInterface({ input: child.stdout }).on("line", (line) => {
          let message;
          try { message = JSON.parse(line); } catch { return; }
          if (message.event === "ready") {
            child.stdin.write(`${JSON.stringify({ id: "test", text: "Hello from Roza.", words: ["Hello", "from", "Roza."], voice: "af_heart", out })}\n`);
          } else if (message.id === "test") {
            if (message.ok && existsSync(out)) finish();
            else finish(new Error(`The voice test failed: ${message.error || "no audio"}`));
          }
        });
        child.on("error", finish);
        child.on("exit", (code) => finish(new Error(job?.cancelled ? "Cancelled." : `The voice test stopped: ${tail.join(" ") || `exit code ${code}`}`)));
      }, reject);
    });
  }

  function cancel() {
    if (!job) return status();
    job.cancelled = true;
    job.abort?.();
    job.child?.kill();
    return status();
  }

  async function remove() {
    cancel();
    await rm(runtimeDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
    marker = null;
    lastError = null;
    onProgress(status());
    return status();
  }

  return {
    load: loadMarker,
    install,
    cancel,
    remove,
    status,
    isInstalled,
    python: () => venvPython,
    env: runtimeEnv,
    ffmpeg: () => marker?.ffmpeg || null,
    formats: () => marker?.formats || [],
  };
}

module.exports = { createInstaller, RUNTIME_VERSION };
