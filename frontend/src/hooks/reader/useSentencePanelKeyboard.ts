import { useEffect, useRef } from "react";

const panels = ".reader-sheet, .reader-dictionary";
const controls = 'button, input, textarea, select, a[href], summary, [tabindex], [contenteditable="true"]';

/** DOM order follows the panels' reading order; Tab remains entirely native. */
export function installSentencePanelKeyboard(panel: HTMLElement) {
  panel.classList.add("reader-sentence-keyboard-panel");
  const available = () => Array.from(panel.querySelectorAll<HTMLElement>(controls))
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') &&
      !element.closest('[inert], [hidden]') && element.getClientRects().length > 0);
  let selected: HTMLElement | null = null;
  let focused: HTMLElement | null = null;
  const focus = (element?: HTMLElement) => {
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const onFocus = (event: FocusEvent) => {
    const element = event.target as HTMLElement;
    focused = element;
    if (element.matches('button, a[href], summary, [role="option"]')) selected = element;
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.metaKey || event.shiftKey) return;
    const target = event.target as HTMLElement;
    if (["Enter", " "].includes(event.key) && target.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const editing = target.matches('input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable="true"], [role="textbox"]');
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const items = available();
      const action = selected && items.includes(selected) ? selected :
        items.find(element => element.matches('button[type="submit"]'));
      if (action?.getAttribute("aria-disabled") !== "true") action?.click();
      return;
    }
    if (!event.key.startsWith("Arrow")) return;
    if (!event.ctrlKey && (editing || target.closest('select, [role="combobox"], [role="listbox"], [role="slider"], [role="spinbutton"], [role="radio"], [role="tablist"]'))) return;
    const items = available();
    if (!items.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const direction = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    const index = items.indexOf(target);
    focus(items[(index + direction + items.length) % items.length]);
  };
  panel.addEventListener("keydown", onKey, true);
  panel.addEventListener("focusin", onFocus);
  // Run after existing panel focus effects, preferring the editor over chrome.
  const focusInitial = () => focus(available().find(element =>
    element.matches('textarea, input:not([type="checkbox"]):not([type="range"])')) || available()[0]);
  focusInitial();
  const timer = window.setTimeout(focusInitial, 0);
  const observer = new MutationObserver(() => {
    if (focused && !focused.isConnected && document.activeElement === document.body) focusInitial();
  });
  observer.observe(panel, { childList: true, subtree: true });
  return () => {
    clearTimeout(timer);
    observer.disconnect();
    panel.removeEventListener("keydown", onKey, true);
    panel.removeEventListener("focusin", onFocus);
    panel.classList.remove("reader-sentence-keyboard-panel");
  };
}

/** Panels opened in Sentence Mode retain navigation until they close, even after mode exit. */
export function useSentencePanelKeyboard(active: boolean) {
  const enabled = useRef(active);
  enabled.current = active;
  const refresh = useRef<(() => void) | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const installed = new Map<HTMLElement, () => void>();
    const remember = (event: MouseEvent) => {
      const button = (event.target as Element).closest<HTMLElement>(".reader-sentence-actions button");
      if (button) trigger.current = button;
    };
    const sync = () => {
      const current = new Set(document.querySelectorAll<HTMLElement>(panels));
      let removed = false;
      for (const [panel, cleanup] of installed) if (!current.has(panel)) {
        cleanup();
        installed.delete(panel);
        removed = true;
      }
      for (const panel of current) if (enabled.current && !installed.has(panel)) installed.set(panel, installSentencePanelKeyboard(panel));
      if (removed && !installed.size && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
    };
    refresh.current = sync;
    document.addEventListener("click", remember, true);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => {
      refresh.current = null;
      observer.disconnect();
      document.removeEventListener("click", remember, true);
      installed.forEach(cleanup => cleanup());
    };
  }, []);
  useEffect(() => { refresh.current?.(); }, [active]);
}
