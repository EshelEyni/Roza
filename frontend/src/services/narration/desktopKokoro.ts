// Typed access to local Kokoro voices, which only the Roza desktop app provides
// (desktop/preload.cjs exposes window.rozaDesktop.kokoro). On the website this is null.
import type { DesktopTaskbar } from "../desktopTaskbar";

export type KokoroInstallStatus = {
  installed: boolean;
  needsUpdate: boolean;
  installing: boolean;
  progress: { stage: string; message: string; percent: number } | null;
  error: string | null;
  formats: KokoroExportFormat[];
  neededBytes: number;
};

export type KokoroEngineStatus = { state: "missing" | "stopped" | "loading" | "ready" | "error"; message?: string; device?: string };

/** A voice add-on installed on top of the local voices (Chatterbox Turbo: "Expressive voices"). */
export type KokoroAddon = "chatterbox";

export type KokoroAddonStatus = KokoroInstallStatus & {
  /** False where the add-on cannot run (an Intel Mac). */
  supported: boolean;
  /** Where the add-on speaks, found by its self-test: "cuda" (NVIDIA), "mps" (Apple Silicon) or "cpu". */
  device?: string;
  engine: KokoroEngineStatus;
};

export type KokoroStatus = KokoroInstallStatus & {
  engine: KokoroEngineStatus;
  exportFolder: string;
  /** Older desktop apps have no add-ons. */
  addons?: Partial<Record<KokoroAddon, KokoroAddonStatus>>;
};

/** `passage`: sentences with the same number are spoken together (paragraph narration). */
export type KokoroSentenceInput = { text: string; words: string[]; pause: number; speed: number; passage?: number };

/** `pause`: seconds of silence to add after the clip (paragraph narration leaves it out of the audio). */
export type KokoroClip = { url: string; duration: number; words: { start: number; end: number }[]; pause?: number };

export type KokoroOffline = {
  state: "missing" | "partial" | "downloading" | "ready" | "error";
  completed: number;
  total: number;
  chaptersReady: number;
  chapters: number;
  section?: number;
  error?: string;
  needsScript?: boolean;
};

export type KokoroBookScript = {
  bookId: string;
  title: string;
  author: string;
  sections: { section: number; title: string; sentences: KokoroSentenceInput[] }[];
};

export type KokoroExportFormat = "m4a" | "mp4" | "mp3";

export type KokoroExportJob = {
  id: string;
  state: "running" | "done" | "error" | "stopped";
  progress: number;
  stage: string;
  filePath?: string;
  error?: string;
};

export type DesktopKokoro = {
  /** True when the desktop app speaks whole passages (paragraphs) and the page adds the pauses. */
  passages?: boolean;
  status(): Promise<KokoroStatus>;
  install(): Promise<KokoroStatus>;
  cancelInstall(): Promise<KokoroStatus>;
  remove(): Promise<KokoroStatus>;
  start(): Promise<KokoroStatus>;
  sentence(input: {
    bookId: string; voice: string; section: number; index: number; sentence: KokoroSentenceInput; priority: "high" | "low";
    /** The passage holding the sentence; `first` is the index of its first sentence. */
    passage?: { first: number; sentences: KokoroSentenceInput[] };
  }): Promise<KokoroClip>;
  preview(voice: string): Promise<{ url: string }>;
  hasScript(bookId: string): Promise<boolean>;
  saveScript(script: KokoroBookScript): Promise<{ sections: number; sentences: number }>;
  offline(input: { bookId: string; voice: string; section: number | null; action: "get" | "start" | "stop" | "delete" }): Promise<KokoroOffline>;
  chooseFolder(): Promise<{ folder: string }>;
  startExport(input: { bookId: string; voice: string; section: number | null; format: KokoroExportFormat }): Promise<KokoroExportJob>;
  getExport(id: string): Promise<KokoroExportJob | null>;
  stopExport(id: string): Promise<KokoroExportJob | null>;
  revealExport(id: string): Promise<null>;
  onInstallStatus(listener: (status: KokoroInstallStatus) => void): () => void;
  /** Voice add-ons this desktop app can install (missing in older desktop apps). */
  addons?: KokoroAddon[];
  installAddon?(addon: KokoroAddon): Promise<KokoroStatus>;
  cancelAddonInstall?(addon: KokoroAddon): Promise<KokoroStatus>;
  removeAddon?(addon: KokoroAddon): Promise<KokoroStatus>;
  onAddonStatus?(listener: (status: KokoroInstallStatus & { addon: KokoroAddon }) => void): () => void;
};

/** True when this local voice can speak now: Kokoro voices need the local voices, expressive ones the add-on too. */
export function localVoiceInstalled(status: KokoroStatus | null | undefined, model: "kokoro" | "chatterbox") {
  if (!status?.installed) return false;
  return model === "kokoro" || !!(status.addons?.[model]?.installed && !status.addons[model]?.installing);
}

declare global {
  interface Window {
    rozaDesktop?: {
      kokoro?: DesktopKokoro;
      taskbar?: DesktopTaskbar;
      devBoard?: import("../../../../shared/types/devBoard").DevBoardFiles;
      stagingRoom?: import("../../../../shared/types/stagingRoom").StagingRoomApi;
    };
  }
}

export function desktopKokoro(): DesktopKokoro | null {
  return typeof window !== "undefined" ? window.rozaDesktop?.kokoro || null : null;
}

/** Kokoro voices speak English only. Unknown language counts as English (most EPUBs omit it). */
export function isEnglishBook(language: string | undefined | null) {
  const value = (language || "").trim().toLowerCase();
  return !value || value === "und" || /^en(?:[-_]|$)/.test(value);
}
