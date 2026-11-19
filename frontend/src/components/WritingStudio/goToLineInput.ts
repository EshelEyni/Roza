/** Line number typed into Read Mode's Go to line dialog, or `undefined` when it is not 1–`total`. */
export function parseGoToLine(input: string, total: number): number | undefined {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return undefined;
  const line = Number(text);
  return line >= 1 && line <= total ? line : undefined;
}

/** Ctrl+Shift+G by physical key, so it also works on non-Latin keyboard layouts. */
export function isGoToLineShortcut(event: {
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  getModifierState?: (key: string) => boolean;
}) {
  return event.code === "KeyG" && event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey &&
    !event.getModifierState?.("AltGraph");
}
