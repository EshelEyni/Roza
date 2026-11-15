import { useEffect, useRef } from "react";

const panels = ".reader-sheet, .reader-dictionary";
const controls = 'button, input, textarea, select, a[href], summary, [tabindex], [contenteditable="true"]';

/** Share editor submission behavior between Page Mode and Sentence Mode panels. */
export function submitReaderPanelInput(event: KeyboardEvent) {
  if (event.defaultPrevented || event.key !== "Enter" || event.isComposing || event.keyCode === 229 || event.altKey) return false;
  const editor = event.target instanceof Element ? event.target.closest('textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=color])') : null;
  if (!editor) return false;
  if (event.shiftKey) {
    if (editor.matches('textarea')) return false;
    event.preventDefault(); event.stopPropagation(); return true;
  }
  const form = editor.closest('form');
  if (!form) return false;
  const submit = form.querySelector<HTMLButtonElement | HTMLInputElement>('button[type="submit"], input[type="submit"], button:not([type])');
  if (!submit) return false;
  event.preventDefault(); event.stopPropagation();
  if (!event.repeat && !submit.matches(':disabled') && submit.getAttribute('aria-disabled') !== 'true') form.requestSubmit(submit);
  return true;
}

/** DOM order follows the panels' reading order; Tab remains entirely native. */
export function installSentencePanelKeyboard(panel: HTMLElement) {
  // No shared platform utility exists in the reader. Safari exposes navigator.platform.
  const mac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
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
    if (element.matches('button, a[href], summary, [role="option"]') && !element.matches('[role="combobox"]')) selected = element;
  };
  const onKey = (event: KeyboardEvent) => {
    if (submitReaderPanelInput(event)) return;
    if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey) return;
    const target = event.target as HTMLElement;
    if (target.closest(panels) && target.closest(panels) !== panel) return;
    const modifier = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    if ((event.ctrlKey || event.metaKey) && !modifier) return;
    if (["Enter", " "].includes(event.key) && target.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const editing = target.isContentEditable || !!target.closest('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, [role="textbox"]');
    if (modifier && event.key === "Enter" && editing) {
      const items = available();
      // Prefer this editor's form action over unrelated panel chrome (e.g. Close).
      const form = target.closest("form");
      const submit = (form || panel).querySelector<HTMLElement>('button[type="submit"], input[type="submit"]');
      const action = submit || (selected && items.includes(selected) ? selected : null);
      if (!action || !items.includes(action) || action.getAttribute("aria-disabled") === "true") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      action.click();
      return;
    }
    if (!event.key.startsWith("Arrow")) return;
    if (!modifier && (editing || target.closest('select, input[type="range"], input[type="radio"], [role="combobox"], [role="listbox"], [role="slider"], [role="spinbutton"], [role="radio"], [role="tablist"]'))) return;
    const items = available();
    if (!items.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const direction = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    const index = items.findIndex(element => element === target || element.contains(target));
    focus(items[(index + direction + items.length) % items.length]);
  };
  panel.addEventListener("keydown", onKey, true);
  panel.addEventListener("focusin", onFocus);
  // Run after existing panel focus effects, preferring the editor over chrome.
  const focusInitial = () => focus(available().find(element =>
    element.matches('textarea, input:not([type="checkbox"]):not([type="range"])')) || available()[0]);
  const recoverFocus = () => {
    const current = document.activeElement;
    if (current && current !== document.body && current !== document.documentElement && current.isConnected && current.getClientRects().length && !current.closest('[inert], [hidden], [aria-hidden="true"]')) return;
    const top = document.querySelector<HTMLElement>('.reader-dictionary') || document.querySelector<HTMLElement>('.reader-sheet');
    if (top && top !== panel) return;
    const items = available();
    if (focused && items.includes(focused)) focus(focused); else focusInitial();
  };
  window.addEventListener("focus", recoverFocus);
  focusInitial();
  const timer = window.setTimeout(focusInitial, 0);
  const observer = new MutationObserver(() => {
    if (focused && !focused.isConnected && document.activeElement === document.body) focusInitial();
  });
  observer.observe(panel, { childList: true, subtree: true });
  return () => {
    window.removeEventListener("focus", recoverFocus);
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
