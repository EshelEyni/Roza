import { readerAiLimits } from "../../services/readerAiLimits";
import { useCallback, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import type { ReaderPanel, ReaderTextSelection } from "../../types/reader";
import type { useReaderChat } from "../useReaderChat";

export function useReaderPanels() {
  const [panel, setPanel] = useState<ReaderPanel | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  return { panel, setPanel, closePanel };
}
export function useReaderPanelActions({
  mobile,
  shell,
  closeLookup,
  setPanel,
  chat,
  textSelection,
}: {
  mobile: boolean;
  shell: RefObject<HTMLDivElement>;
  closeLookup: () => void;
  setPanel: React.Dispatch<React.SetStateAction<ReaderPanel | null>>;
  chat: ReturnType<typeof useReaderChat>;
  textSelection: ReaderTextSelection | null;
}) {
  function focusChatInput() {
    shell.current
      ?.querySelector<HTMLTextAreaElement>("#reader-chat-question")
      ?.focus({ preventScroll: true });
  }
  function updatePanel(update: () => void, focus: boolean) {
    if (mobile && focus) {
      // Keep focus inside the user gesture so iOS opens the software keyboard.
      flushSync(update);
      focusChatInput();
    } else update();
  }
  function togglePanel(next: ReaderPanel) {
    updatePanel(() => {
      closeLookup();
      setPanel(current => (current === next ? null : next));
    }, next === "chat");
  }
  function askAi() {
    if (!textSelection || textSelection.text.length > readerAiLimits.passage) return;
    updatePanel(() => {
      chat.start({
        cfi: textSelection.cfi,
        text: textSelection.text,
        endCfi: textSelection.endCfi,
      });
      setPanel("chat");
      closeLookup();
    }, true);
  }
  return { togglePanel, askAi };
}
