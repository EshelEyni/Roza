// Sandboxed preload: exposes a small, fixed API for local Kokoro voices to the Roza page.
// It must stay one file with no local require() (sandboxed preloads can only load "electron").
const { contextBridge, ipcRenderer } = require("electron");

const call = async (channel, input) => {
  const result = await ipcRenderer.invoke(channel, input);
  if (!result || !result.ok) throw new Error(result?.error || "Local voices are unavailable.");
  return result.data;
};

contextBridge.exposeInMainWorld("rozaDesktop", {
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
  },
});
