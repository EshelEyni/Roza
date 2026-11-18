// Local Kokoro voices for the Roza desktop app: wires the installer, engine, audio cache, offline
// saves and export to the renderer (through preload.cjs) and serves audio on the app's own origin.
const { dialog, ipcMain, shell } = require("electron");
const { existsSync } = require("node:fs");
const { mkdir, readFile, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createEngine } = require("./engine.cjs");
const { createExporter } = require("./exporter.cjs");
const { createInstaller } = require("./installer.cjs");
const { serveKokoroAudio } = require("./audioRoute.cjs");
const { createStore } = require("./store.cjs");
const { isKokoroVoice } = require("./voices.cjs");

const PREVIEW_TEXT = "The morning arrived quietly, and the world seemed full of possibility.";

/**
 * @param {{ app: Electron.App, origin: string, getWindow: () => Electron.BrowserWindow | null }} options
 */
function createKokoroDesktop({ app, origin, getWindow }) {
  const root = path.join(app.getPath("userData"), "kokoro");
  const runtimeDir = path.join(root, "runtime");
  const audioDir = path.join(root, "audio");
  const booksDir = path.join(root, "books");
  const settingsFile = path.join(root, "settings.json");
  const script = app.isPackaged
    ? path.join(process.resourcesPath, "kokoro", "service.py")
    : path.join(__dirname, "service.py");

  const send = (channel, payload) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
  };

  const installer = createInstaller({ runtimeDir, script, onProgress: (status) => send("kokoro:install-status", status) });
  const engine = createEngine({
    python: installer.python, script, cwd: runtimeDir, env: installer.env, isInstalled: installer.isInstalled,
  });
  const store = createStore({ audioDir, booksDir, engine });
  const exporter = createExporter({ tempDir: path.join(os.tmpdir(), "roza-kokoro-export"), ffmpeg: installer.ffmpeg, ensureSentence: store.ensureSentence });
  const ready = installer.load();

  async function settings() {
    try { return JSON.parse(await readFile(settingsFile, "utf8")); } catch { return {}; }
  }
  async function exportFolder() {
    const saved = (await settings()).exportFolder;
    return saved || path.join(app.getPath("music"), "Roza Audiobooks");
  }

  async function status() {
    await ready;
    return { ...installer.status(), engine: engine.status(), exportFolder: await exportFolder() };
  }

  // Only the app's own top-level page may call these; book iframes (same origin) may not.
  const allowed = (event) => {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame) return false;
    try { return new URL(frame.url).origin === origin; } catch { return false; }
  };

  const handle = (channel, fn) => ipcMain.handle(channel, async (event, input) => {
    if (!allowed(event)) return { ok: false, error: "Not allowed." };
    try {
      await ready;
      return { ok: true, data: await fn(input ?? {}, event) };
    } catch (error) {
      return { ok: false, error: error?.message || "Something went wrong." };
    }
  });

  function register() {
    handle("kokoro:status", status);
    handle("kokoro:install", async () => {
      engine.stop();
      installer.install();
      return status();
    });
    handle("kokoro:cancel-install", async () => { installer.cancel(); return status(); });
    handle("kokoro:remove", async () => {
      engine.stop();
      exporter.stopAll();
      await store.clearAudio();
      await installer.remove();
      return status();
    });
    handle("kokoro:start", async () => { engine.start(); return status(); });
    handle("kokoro:sentence", (input) => {
      if (!installer.isInstalled()) throw new Error("Local voices are not installed.");
      return store.sentence(input);
    });
    handle("kokoro:preview", (input) => {
      if (!installer.isInstalled()) throw new Error("Local voices are not installed.");
      return store.preview(input.voice, PREVIEW_TEXT);
    });
    handle("kokoro:has-script", (input) => store.hasScript(input.bookId));
    handle("kokoro:save-script", (input) => store.saveScript(input));
    handle("kokoro:offline", (input) => {
      if (input.action === "start" && !installer.isInstalled()) throw new Error("Local voices are not installed.");
      return store.offline(input);
    });
    handle("kokoro:choose-folder", async () => {
      const window = getWindow();
      const result = await dialog.showOpenDialog(window, {
        title: "Choose where to save audiobooks",
        defaultPath: await exportFolder(),
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled || !result.filePaths[0]) return { folder: await exportFolder() };
      await mkdir(root, { recursive: true });
      await writeFile(settingsFile, JSON.stringify({ ...(await settings()), exportFolder: result.filePaths[0] }));
      return { folder: result.filePaths[0] };
    });
    handle("kokoro:export-start", async (input) => {
      if (!installer.isInstalled()) throw new Error("Local voices are not installed.");
      if (!isKokoroVoice(input.voice)) throw new Error("Unknown Kokoro voice.");
      if (!installer.formats().includes(input.format)) throw new Error("This format is not available.");
      const bookScript = await store.loadScript(String(input.bookId || ""));
      if (!bookScript) throw new Error("Prepare the book first.");
      const section = input.section === null || input.section === undefined ? null : Number(input.section);
      if (section !== null && !bookScript.sections.some((part) => part.section === section)) throw new Error("Chapter not found.");
      // The folder is always one the user picked in the system dialog (or the default), never a renderer path.
      return exporter.start(bookScript, { section, format: input.format, voice: input.voice, folder: await exportFolder() });
    });
    handle("kokoro:export-get", (input) => exporter.get(String(input.id || "")));
    handle("kokoro:export-stop", (input) => exporter.stop(String(input.id || "")));
    handle("kokoro:export-reveal", (input) => {
      const file = exporter.filePath(String(input.id || ""));
      if (file && existsSync(file)) shell.showItemInFolder(file);
      return null;
    });
  }

  /** Serves a saved clip with byte ranges, so <audio> can seek. Returns null for other paths. */
  const handleAudio = (request, url) => serveKokoroAudio(request, url, audioDir);

  function shutdown() {
    installer.cancel();
    exporter.stopAll();
    engine.stop();
  }

  return { register, handleAudio, shutdown };
}

module.exports = { createKokoroDesktop };
