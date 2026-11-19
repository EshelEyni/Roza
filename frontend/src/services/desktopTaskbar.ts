// Taskbar badge bridge for the Windows desktop app (desktop/preload.cjs exposes window.rozaDesktop.taskbar).
// On the website, and in older desktop builds without it, these calls do nothing.
export type DesktopTaskbar = {
  setAudioPlaying(playing: boolean): void;
};

export function setDesktopAudioPlaying(playing: boolean) {
  if (typeof window === "undefined") return;
  window.rozaDesktop?.taskbar?.setAudioPlaying(playing);
}
