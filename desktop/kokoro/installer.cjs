// Installs a local voices runtime on first use, entirely inside one folder:
//   uv (pinned, checksum-verified) → Python 3.11 → the recipe's packages → the recipe's own steps
//   (model downloads, ffmpeg, voice files) → self-test.
// Nothing goes to PATH or the user's global caches, so removing the folder removes everything.
// The Kokoro recipe is the default; desktop/kokoro/chatterbox.cjs is the expressive-voices add-on.
const { execFileSync, spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const { createWriteStream, existsSync } = require("node:fs");
const { mkdir, readdir, readFile, rm, statfs, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createInterface } = require("node:readline");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { kokoroVoices } = require("./voices.cjs");

const UV_VERSION = "0.13.1";
const UV_RELEASE = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}`;

/** Where uv and Python come from and live, per platform. Checksums are from uv's release page. */
const PLATFORMS = {
  win32: {
    id: "win32",
    uvUrl: `${UV_RELEASE}/uv-x86_64-pc-windows-msvc.zip`,
    uvSha256: "3b2661a463a5baea7f5076ea2b25ab71d77f36a6c0d809e5350651792f80a672",
    uvArchive: "uv.zip",
    uvName: "uv.exe",
    venvPython: [".venv", "Scripts", "python.exe"],
    pythonFolder: /^cpython-3\.11\.\d+-windows-x86_64-none$/,
    pythonInFolder: ["python.exe"],
  },
  "darwin-arm64": {
    id: "darwin-arm64",
    uvUrl: `${UV_RELEASE}/uv-aarch64-apple-darwin.tar.gz`,
    uvSha256: "cfe454573412ff7380d15fc7dae5997ab53ffce72fce0a78e91ddbc84001acd2",
    uvArchive: "uv.tar.gz",
    uvName: "uv",
    venvPython: [".venv", "bin", "python"],
    pythonFolder: /^cpython-3\.11\.\d+-macos-aarch64-none$/,
    pythonInFolder: ["bin", "python3.11"],
  },
  "darwin-x64": {
    id: "darwin-x64",
    uvUrl: `${UV_RELEASE}/uv-x86_64-apple-darwin.tar.gz`,
    uvSha256: "bb7b805bdcf3d0bc8c74ceb94569e6b3e8aa35bd492acdbb9d46bf46d9d4ff6b",
    uvArchive: "uv.tar.gz",
    uvName: "uv",
    venvPython: [".venv", "bin", "python"],
    pythonFolder: /^cpython-3\.11\.\d+-macos-x86_64-none$/,
    pythonInFolder: ["bin", "python3.11"],
  },
};
const isWindows = process.platform === "win32";
const PLATFORM = isWindows ? PLATFORMS.win32 : PLATFORMS[`${process.platform}-${process.arch}`];
const MARKER = "installed.json";

const KOKORO_PREFETCH = `
import sys
from huggingface_hub import hf_hub_download
files = ["config.json", "kokoro-v1_0.pth"] + [f"voices/{v}.pt" for v in sys.argv[1].split(",")]
for index, name in enumerate(files, 1):
    hf_hub_download("hexgrad/Kokoro-82M", name)
    print(f"{index}/{len(files)}", flush=True)
`;

/** "3/7" progress lines from a helper script → percent between `from` and `to`. */
const fraction = (line) => {
  const [done, total] = line.split("/").map(Number);
  return total ? { done, total } : null;
};

/** Kokoro: the light default. Every voice is downloaded so narration works offline. */
const KOKORO_RECIPE = {
  name: "kokoro",
  label: "Kokoro",
  // Bump when the runtime recipe changes, so older installs are offered a reinstall.
  version: 1,
  neededBytes: 3 * 1024 ** 3,
  supported: () => Boolean(PLATFORM),
  packages: () => [
    "kokoro==0.9.4",
    "misaki[en]==0.9.4",
    "soundfile==0.14.0",
    "imageio-ffmpeg==0.8.1",
    "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl",
  ],
  env: () => ({}),
  selfTestRequest: (out) => ({ id: "test", text: "Hello from Roza.", words: ["Hello", "from", "Roza."], voice: "af_heart", out }),
  /** Model and voices, then ffmpeg (for export) and its encoders. Returns extra marker fields. */
  async steps({ run, report, venvPython, encoderList }) {
    report("model", "Downloading the voice model and voices…", 56);
    await run(venvPython, ["-c", KOKORO_PREFETCH, kokoroVoices.join(",")], {
      onLine: (line) => {
        const part = fraction(line);
        if (part) report("model", `Downloading voices… ${part.done} of ${part.total}`, 56 + (part.done / part.total) * 36);
      },
    });
    report("test", "Checking audio export…", 93);
    const [ffmpeg] = (await run(venvPython, ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]))
      .filter((line) => existsSync(line.trim()));
    const encoders = ffmpeg ? await encoderList(ffmpeg.trim()) : "";
    const formats = [
      ...(/\baac\b/.test(encoders) ? ["m4a", "mp4"] : []),
      ...(/libmp3lame/.test(encoders) ? ["mp3"] : []),
    ];
    return { ffmpeg: ffmpeg ? ffmpeg.trim() : null, formats };
  },
};

const isAscii = (text) => /^[ -~]+$/.test(text);

/**
 * The 8.3 short form of an existing folder ("C:\Users\D0EF~1\…"). uv cannot set up Python inside a
 * folder whose path has non-ASCII letters (a Hebrew user name, say), and the short form is also shorter,
 * which helps packages that build from source stay under Windows' 260-character limit.
 * Returns null when the drive has short names turned off.
 */
function windowsShortPath(folder) {
  if (process.platform !== "win32") return folder;
  if (isAscii(folder)) return folder;
  try {
    const out = execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `"for %A in ("${folder}") do @echo %~sA"`], {
      encoding: "utf8", windowsHide: true, windowsVerbatimArguments: true,
    }).trim();
    return isAscii(out) && existsSync(out) ? out : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ runtimeDir: string, script: string, onProgress: (status: object) => void, recipe?: typeof KOKORO_RECIPE }} options
 */
function createInstaller({ runtimeDir, script, onProgress, recipe = KOKORO_RECIPE }) {
  // An unsupported platform still loads; installing then says why it can't.
  const platform = PLATFORM || PLATFORMS.win32;
  const venvPython = path.join(runtimeDir, ...platform.venvPython);
  const uvExe = path.join(runtimeDir, "uv", platform.uvName);
  let marker = null;
  let job = null;
  // uv works inside the runtime folder by its short ASCII path when the drive has short names
  // (shorter paths, and no surprises from non-ASCII user names).
  let uvRoot = null;
  const pythonDir = () => path.join(uvRoot || runtimeDir, "python");
  // uv's download cache lives in Temp only while installing. With the cache and Python both under the
  // roaming profile, uv 0.13 fails to set up Python ("Missing expected target directory"); a short
  // Temp path also keeps packages that build from source under Windows' 260-character limit.
  const uvCache = path.join(windowsShortPath(os.tmpdir()) || os.tmpdir(), `roza-${recipe.name}-uv`);

  const env = (extra = {}) => ({
    ...process.env,
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
    PYTHONIOENCODING: "utf-8",
    UV_PYTHON_INSTALL_DIR: pythonDir(),
    UV_CACHE_DIR: uvCache,
    UV_NO_CONFIG: "1",
    HF_HOME: path.join(runtimeDir, "hf"),
    HF_HUB_DISABLE_TELEMETRY: "1",
    ...recipe.env(runtimeDir),
    ...extra,
  });

  /** The environment the service runs with once installed: offline, so it never waits on the network. */
  const runtimeEnv = () => env({ HF_HUB_OFFLINE: "1", VIRTUAL_ENV: path.join(runtimeDir, ".venv") });

  async function loadMarker() {
    try {
      marker = JSON.parse(await readFile(path.join(runtimeDir, MARKER), "utf8"));
    } catch {
      marker = null;
    }
    return marker;
  }

  const isInstalled = () => Boolean(marker && marker.version === recipe.version && existsSync(venvPython));
  const needsUpdate = () => Boolean(marker && marker.version !== recipe.version);

  let lastError = null;
  const status = () => ({
    installed: isInstalled(),
    needsUpdate: needsUpdate(),
    installing: Boolean(job),
    progress: job ? { ...job.progress } : null,
    error: job ? null : lastError,
    formats: marker?.formats || [],
    neededBytes: recipe.neededBytes,
    supported: recipe.supported(),
    ...(marker?.device ? { device: marker.device } : {}),
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
      if (!PLATFORM || !recipe.supported()) throw new Error(`${recipe.label} voices are not available on this computer yet.`);
      await mkdir(runtimeDir, { recursive: true });
      const disk = await statfs(runtimeDir).catch(() => null);
      if (disk && disk.bavail * disk.bsize < recipe.neededBytes) {
        throw new Error(`Not enough free disk space. ${recipe.label} voices need about ${(recipe.neededBytes / 1024 ** 3).toFixed(0)} GB.`);
      }
      await rm(path.join(runtimeDir, MARKER), { force: true });
      marker = null;
      uvRoot = windowsShortPath(runtimeDir);

      // 1. uv
      if (!existsSync(uvExe)) {
        await mkdir(path.dirname(uvExe), { recursive: true });
        const archive = path.join(runtimeDir, "uv", platform.uvArchive);
        const digest = await download(platform.uvUrl, archive, (received, total) =>
          report("uv", "Downloading the installer…", total ? (received / total) * 5 : 2));
        if (digest !== platform.uvSha256) throw new Error("The installer download was damaged. Try again.");
        // The Windows zip holds uv.exe at its top; the Mac archive holds it inside one folder.
        const tar = isWindows ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "/usr/bin/tar";
        const unpackArgs = isWindows ? [] : ["--strip-components", "1"];
        await run(tar, ["-xf", archive, "-C", path.dirname(uvExe), ...unpackArgs]);
        await rm(archive, { force: true });
      }

      // 2. Python
      report("python", "Setting up Python…", 6);
      if (!existsSync(venvPython)) {
        // On some Windows profiles uv 0.13 installs Python correctly but then fails its own check of the
        // "minor version" link ("Missing expected target directory"). The venv is made from the exact
        // interpreter instead, so that link is never needed.
        await run(uvExe, ["python", "install", "3.11", "--no-bin"]).catch((error) => {
          if (!/minor version link/i.test(error.message)) throw error;
        });
        const installed = (await readdir(pythonDir()).catch(() => []))
          .filter((name) => platform.pythonFolder.test(name)).sort().pop();
        const interpreter = installed && path.join(pythonDir(), installed, ...platform.pythonInFolder);
        if (!interpreter || !existsSync(interpreter)) throw new Error("Python could not be installed.");
        await run(uvExe, ["venv", "--python", interpreter, path.join(uvRoot || runtimeDir, ".venv")]);
      }

      // 3. Packages (torch is the big one)
      report("packages", "Installing the speech engine (this is the longest step)…", 15);
      let seen = 0;
      await run(uvExe, ["pip", "install", "--python", venvPython, ...recipe.packages(platform.id)], {
        onLine: (line) => {
          seen += 1;
          const match = line.match(/(Downloading|Installed|Prepared|Built)\s+(.+)/);
          report("packages", match ? `${match[1]} ${match[2].slice(0, 60)}` : "Installing the speech engine…", 15 + Math.min(40, seen * 0.4));
        },
      });

      // 4. The recipe's own steps: models, voices, ffmpeg.
      const extra = await recipe.steps({ run, report, venvPython, runtimeDir, encoderList, script });

      // 5. Self-test: real speech written to a path with Hebrew letters (the user profile may have them).
      report("test", "Testing a voice…", 96);
      const ready = await selfTest();

      await rm(uvCache, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
      marker = {
        version: recipe.version, installedAt: new Date().toISOString(), ffmpeg: null, formats: [],
        ...extra, ...(ready?.device ? { device: ready.device } : {}),
      };
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

  /** Starts the service, speaks one sentence, and resolves to its "ready" message. */
  function selfTest() {
    return new Promise((resolve, reject) => {
      const folder = path.join(runtimeDir, "self-test", "בדיקה");
      const out = path.join(folder, "בדיקה.wav");
      mkdir(folder, { recursive: true }).then(() => {
        const child = spawn(venvPython, [script], { env: runtimeEnv(), cwd: runtimeDir, windowsHide: true });
        job.child = child;
        let tail = [];
        let done = false;
        let ready = null;
        const timer = setTimeout(() => finish(new Error("The voice test took too long.")), 5 * 60 * 1000);
        const finish = (error) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          child.stdin.end();
          child.kill();
          rm(path.join(runtimeDir, "self-test"), { recursive: true, force: true }).catch(() => {});
          if (error) reject(error); else resolve(ready);
        };
        child.stdin.on("error", () => {});
        createInterface({ input: child.stderr }).on("line", (line) => { tail = [...tail, line].slice(-3); });
        createInterface({ input: child.stdout }).on("line", (line) => {
          let message;
          try { message = JSON.parse(line); } catch { return; }
          if (message.event === "ready") {
            ready = message;
            child.stdin.write(`${JSON.stringify(recipe.selfTestRequest(out))}\n`);
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
    await rm(uvCache, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
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

module.exports = { createInstaller, KOKORO_RECIPE, RUNTIME_VERSION: KOKORO_RECIPE.version };
