import { useEffect, type MutableRefObject } from "react";

export function useAudiobookSpaceShortcut(
  enabled: boolean,
  canToggle: boolean,
  toggle: () => void,
  keydownRef?: MutableRefObject<((event: KeyboardEvent) => void) | null>,
) {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
        (event.code !== "Space" && event.key !== " ")) return;
      const target = event.target as Element | null;
      const editable = target?.closest?.("[contenteditable]")?.getAttribute("contenteditable");
      if (target?.closest?.("input, textarea, select, dialog[open], [role=dialog], [role=textbox]:not([contenteditable=false])") ||
        (editable != null && editable.toLowerCase() !== "false")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat && canToggle) toggle();
    }
    // The EPUB document has its own event tree and forwards keys through this ref.
    if (keydownRef) keydownRef.current = onKeyDown;
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      if (keydownRef) keydownRef.current = null;
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [canToggle, enabled, keydownRef, toggle]);
}
