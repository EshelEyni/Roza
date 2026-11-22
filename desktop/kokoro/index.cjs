// Local Kokoro voices for the Roza desktop app: wires the installer, engine, audio cache, offline
// saves and export to the renderer (through preload.cjs) and serves audio on the app's own origin.
const { dialog, ipcMain, shell } = require("electron");
const { existsSync } = require("node:fs");
const { mkdir, readFile, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chatterboxRecipe } = require("./chatterbox.cjs");
const { createEngine } = require("./engine.cjs");
const { createExporter } = require("./exporter.cjs");
const { createInstaller } = require("./installer.cjs");
const { serveKokoroAudio } = require("./audioRoute.cjs");
const { createStore, passageIn } = require("./store.cjs");
const { chatterboxVoices, isChatterboxVoice, isLocalVoice } = require("./voices.cjs");

const PREVIEW_TEXT = "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.";
// Add-ons install on top of the Kokoro local voices. Only one for now: Chatterbox Turbo (Ticket #66).
const ADDONS = ["chatterbox"];
// The Chatterbox service holds most of the graphics memory; free it after 10 minutes without work.
const CHATTERBOX_IDLE_MS = 10 * 60 * 1000;

/**
 * @param {{ app: Electron.App, origin: string, getWindow: () => Electron.BrowserWindow | null, checkAccess: () => Promise<boolean> }} options
 */
function createKokoroDesktop({ app, origin, getWindow, checkAccess }) {
  const root = path.join(app.getPath("userData"), "kokoro");
  const runtimeDir = path.join(root, "runtime");
  const audioDir = path.join(root, "audio");
  const booksDir = path.join(root, "books");
  const settingsFile = path.join(root, "settings.json");
  const script = app.isPackaged
    ? path.join(process.resourcesPath, "kokoro", "service.py")
    : path.join(__dirname, "service.py");
  const chatterboxDir = app.isPackaged
    ? path.join(process.resourcesPath, "chatterbox")
    : path.join(__dirname, "..", "chatterbox");
  const chatterboxRuntime = path.join(root, "chatterbox");

  const send = (channel, payload) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
  };

  let warmup;
  const installer = createInstaller({
    runtimeDir, script,
    onProgress: (status) => {
      send("kokoro:install-status", status);
      if (status.installed && !status.installing && !status.error) warmPreviews();
    },
  });
  const engine = createEngine({
    python: installer.python, script, cwd: runtimeDir, env: installer.env, isInstalled: installer.isInstalled,
  });

  const chatterboxScript = path.join(chatterboxDir, "service.py");
  const chatterbox = createInstaller({
    runtimeDir: chatterboxRuntime, script: chatterboxScript,
    recipe: chatterboxRecipe({ voiceRefs: path.join(chatterboxDir, "voices") }),
    onProgress: (status) => {
      send("kokoro:addon-status", { addon: "chatterbox", ...status });
      if (status.installed && !status.installing && !status.error) warmPreviews();
    },
  });
  const chatterboxEngine = createEngine({
    python: chatterbox.python, script: chatterboxScript, cwd: chatterboxRuntime, env: chatterbox.env,
    isInstalled: chatterbox.isInstalled, label: "Chatterbox", idleMs: CHATTERBOX_IDLE_MS,
  });
  const addons = { chatterbox: { installer: chatterbox, engine: chatterboxEngine } };

  const engineFor = (voice) => {
    if (!isChatterboxVoice(voice)) return engine;
    if (!chatterbox.isInstalled()) throw new Error("Expressive voices are not installed.");
    return chatterboxEngine;
  };
  const store = createStore({ audioDir, booksDir, engine, engineFor, engines: () => [engine, chatterboxEngine] });
  const exporter = createExporter({ tempDir: path.join(os.tmpdir(), "roza-kokoro-export"), ffmpeg: installer.ffmpeg, ensureSentence: store.ensureSentence, passageIn });
  const ready = Promise.all([installer.load(), chatterbox.load()]).then(() => { warmPreviews(); });

  /** Kokoro previews first; then, once the add-on is installed, its voices (one GPU load, low priority). */
  function warmPreviews() {
    if (warmup || !installer.isInstalled()) return;
    const controller = new AbortController();
    const withAddon = chatterbox.isInstalled();
    const done = store.warmPreviews(PREVIEW_TEXT, controller.signal)
      .then(() => (withAddon ? store.warmPreviews(PREVIEW_TEXT, controller.signal, chatterboxVoices) : null))
      .catch(() => {
      // A preview can still be generated on demand if background preparation fails.
    }).finally(() => {
      if (warmup?.controller === controller) warmup = undefined;
    });
    warmup = { controller, done };
  }

  async function settings() {
    try { return JSON.parse(await readFile(settingsFile, "utf8")); } catch { return {}; }
  }
  async function exportFolder() {
    const saved = (await settings()).exportFolder;
    return saved || path.join(app.getPath("music"), "Roza Audiobooks");
  }

  const addonStatus = (name) => ({ ...addons[name].installer.status(), engine: addons[name].engine.status() });

  async function status() {
    await ready;
    return {
      ...installer.status(), engine: engine.status(), exportFolder: await exportFolder(),
      addons: Object.fromEntries(ADDONS.map((name) => [name, addonStatus(name)])),
    };
  }

  const addonOf = (input) => {
    if (!ADDONS.includes(input.addon)) throw new Error("Unknown voice add-on.");
    return addons[input.addon];
  };

  /** Stops the add-on and removes its runtime and its voices' saved audio. */
  async function removeAddon(addon, voices) {
    const pending = warmup;
    pending?.controller.abort();
    addon.engine.stop();
    exporter.stopAll();
    await pending?.done;
    await store.clearVoices(voices);
    await addon.installer.remove();
  }

  // Only the app's own top-level page may call these; book iframes (same origin) may not.
  const allowed = (event) => {
    const frame = event.senderFrame;
    if (!frame || event.sender !== getWindow()?.webContents || frame !== event.sender.mainFrame) return false;
    try { return new URL(frame.url).origin === origin; } catch { return false; }
  };

  const handle = (channel, fn) => ipcMain.handle(channel, async (event, input) => {
    if (!allowed(event) || !await checkAccess() || !allowed(event)) return { ok: false, error: "Not allowed." };
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
      warmup?.controller.abort();
      engine.stop();
      installer.install();
      return status();
    });
    handle("kokoro:cancel-install", async () => { installer.cancel(); return status(); });
    handle("kokoro:remove", async () => {
      // Add-ons run on top of the local voices, so removing the local voices removes them too.
      await removeAddon(addons.chatterbox, chatterboxVoices);
      const pending = warmup;
      pending?.controller.abort();
      engine.stop();
      exporter.stopAll();
      await pending?.done;
      await store.clearAudio();
      await installer.remove();
      return status();
    });
    handle("kokoro:start", async () => { engine.start(); return status(); });
    handle("kokoro:addon-install", async (input) => {
      const addon = addonOf(input);
      if (!installer.isInstalled()) throw new Error("Install the local voices first.");
      addon.engine.stop();
      addon.installer.install();
      return status();
    });
    handle("kokoro:addon-cancel", async (input) => { addonOf(input).installer.cancel(); return status(); });
    handle("kokoro:addon-remove", async (input) => {
      await removeAddon(addonOf(input), chatterboxVoices);
      return status();
    });
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
      if (!isLocalVoice(input.voice)) throw new Error("Unknown Kokoro voice.");
      if (isChatterboxVoice(input.voice) && !chatterbox.isInstalled()) throw new Error("Expressive voices are not installed.");
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
    warmup?.controller.abort();
    installer.cancel();
    chatterbox.cancel();
    exporter.stopAll();
    engine.stop();
    chatterboxEngine.stop();
  }

  return { register, handleAudio, shutdown };
}

module.exports = { createKokoroDesktop };
