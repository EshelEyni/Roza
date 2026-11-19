import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ReaderMode } from "../../../../shared/types/reader";
import {
  parseReaderMode,
  readerSearchWithMode,
  resolveInitialReaderMode,
} from "../../services/readerMode";
import type { EpubReaderController } from "./useEpubReader";

type ModeSource = Pick<EpubReaderController, "sentenceMode" | "panel">;

/** Sentence Mode owns the screen; the full Audiobook view is the tts panel; everything else is Page Mode. */
export function readerModeOf(reader: ModeSource): ReaderMode {
  if (reader.sentenceMode.active) return "sentence";
  return reader.panel === "tts" ? "audiobook" : "page";
}

/**
 * Keeps `?mode=` and the per-book stored mode in step with the reader.
 * Initializes once, when the book (and any URL destination) is ready, then mirrors
 * mode changes into the URL with history replacement so modes never add entries.
 */
export function useReaderModeSync(reader: EpubReaderController, ready: boolean, resumeCfi?: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const urlMode = new URLSearchParams(location.search).get("mode");
  const mode = readerModeOf(reader);
  const readerRef = useRef(reader);
  readerRef.current = reader;
  const initialized = useRef(false);
  // Mode being entered; sync waits for it so a transition never writes the old mode.
  const pending = useRef<ReaderMode | null>(null);
  // URL mode value last written or consumed here; any other value is an explicit request.
  const handledUrlMode = useRef<string | null>(null);
  const [settled, setSettled] = useState(0);

  async function apply(target: ReaderMode, initial: boolean) {
    pending.current = target;
    try {
      const current = () => readerRef.current;
      if (target !== "sentence" && current().sentenceMode.active) {
        await current().sentenceMode.toggle();
        if (current().sentenceMode.active) return;
      }
      // On load, resume at the saved sentence rather than the first sentence of its page.
      if (target === "sentence" && !current().sentenceMode.active)
        await current().sentenceMode.toggle(initial ? resumeCfi : undefined);
      // On first load a panel opened by the URL (e.g. ?action=ai) keeps priority over Audiobook Mode.
      if (target === "audiobook" && current().panel !== "tts" && !(initial && current().panel))
        current().togglePanel("tts");
      if (target === "page" && current().panel === "tts") current().closePanel();
    } finally {
      if (pending.current === target) {
        pending.current = null;
        setSettled(value => value + 1);
      }
    }
  }

  useEffect(() => {
    if (initialized.current || !ready) return;
    initialized.current = true;
    handledUrlMode.current = urlMode;
    const target = resolveInitialReaderMode(urlMode, readerRef.current.state.mode);
    if (target !== readerModeOf(readerRef.current)) void apply(target, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!initialized.current) return;
    if (pending.current && pending.current !== mode) return;
    pending.current = null;
    if (urlMode !== null && urlMode !== handledUrlMode.current) {
      handledUrlMode.current = urlMode;
      const requested = parseReaderMode(urlMode) ?? "page";
      if (requested !== mode) {
        void apply(requested, false);
        return;
      }
    }
    if (urlMode !== mode) {
      handledUrlMode.current = mode;
      navigate(
        { pathname: location.pathname, search: readerSearchWithMode(location.search, mode), hash: location.hash },
        { replace: true, state: location.state },
      );
    }
    if ((readerRef.current.state.mode ?? "page") !== mode) readerRef.current.updateState({ mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode, urlMode, settled]);

  return mode;
}
