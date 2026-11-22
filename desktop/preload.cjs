// Sandboxed preload: exposes a small, fixed API for local Kokoro voices to the Roza page.
// It must stay one file with no local require() (sandboxed preloads can only load "electron").
const { contextBridge, ipcRenderer } = require("electron");

const call = async (channel, input) => {
  const result = await ipcRenderer.invoke(channel, input);
  if (!result || !result.ok) throw new Error(result?.error || "Local voices are unavailable.");
  return result.data;
};

const devBoardMethods = [
  "readImport", "chooseImport", "readImportAttachment", "chooseAttachments", "readChosenAttachment",
  "cacheAttachment", "revealAttachment", "copy", "paste",
];

contextBridge.exposeInMainWorld("rozaDesktop", {
  devBoard: Object.fromEntries(devBoardMethods.map(method => [
    method, (...args) => ipcRenderer.invoke("dev-board:" + method, ...args),
  ])),
  taskbar: {
    // Switches the taskbar badge to headphones while an audiobook plays.
    setAudioPlaying: (playing) => ipcRenderer.send("taskbar:audio-playing", playing === true),
  },
  kokoro: {
    // Speaks whole paragraphs; the page adds the pauses between them (Ticket #64).
    passages: true,
    status: () => call("kokoro:status"),
    install: () => call("kokoro:install"),
    cancelInstall: () => call("kokoro:cancel-install"),
    remove: () => call("kokoro:remove"),
    start: () => call("kokoro:start"),
    sentence: (input) => call("kokoro:sentence", input),
    preview: (voice) => call("kokoro:preview", { voice }),
    hasScript: (bookId) => call("kokoro:has-script", { bookId }),
    saveScript: (script) => call("kokoro:save-script", script),
    offline: (input) => call("kokoro:offline", input),
    chooseFolder: () => call("kokoro:choose-folder"),
    startExport: (input) => call("kokoro:export-start", input),
    getExport: (id) => call("kokoro:export-get", { id }),
    stopExport: (id) => call("kokoro:export-stop", { id }),
    revealExport: (id) => call("kokoro:export-reveal", { id }),
    onInstallStatus: (listener) => {
      const wrapped = (_event, status) => listener(status);
      ipcRenderer.on("kokoro:install-status", wrapped);
      return () => ipcRenderer.removeListener("kokoro:install-status", wrapped);
    },
    // Voice add-ons installed on top of the local voices: Chatterbox Turbo expressive voices (Ticket #66).
    addons: ["chatterbox"],
    installAddon: (addon) => call("kokoro:addon-install", { addon }),
    cancelAddonInstall: (addon) => call("kokoro:addon-cancel", { addon }),
    removeAddon: (addon) => call("kokoro:addon-remove", { addon }),
    onAddonStatus: (listener) => {
      const wrapped = (_event, status) => listener(status);
      ipcRenderer.on("kokoro:addon-status", wrapped);
      return () => ipcRenderer.removeListener("kokoro:addon-status", wrapped);
    },
  },
});
