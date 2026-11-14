/** Compact context around a flag, retaining the selected text as a distinct segment. */
export function readerFlagContext(context: string, text: string) {
  const clean = (value: string) => value.trim().replace(/\s+/g, " ");
  const selected = clean(text),
    source = clean(context);
  const index = source
    .toLocaleLowerCase()
    .indexOf(selected.toLocaleLowerCase());
  const marked =
    selected.length > 120 ? selected.slice(0, 119) + "…" : selected;
  if (index < 0) return { before: "", marked, after: "" };
  const room = Math.max(0, 234 - marked.length),
    left = Math.floor(room / 2);
  const start = Math.max(0, index - left),
    end = Math.min(source.length, index + selected.length + room - left);
  return {
    before: (start ? "…" : "") + source.slice(start, index),
    marked,
    after:
      source.slice(index + selected.length, end) +
      (end < source.length ? "…" : ""),
  };
}
