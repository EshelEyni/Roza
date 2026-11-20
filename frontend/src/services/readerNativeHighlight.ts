type NativeMark = { range: Range; element: SVGElement };
type Annotation = { mark?: NativeMark; on: (event: string, callback: (mark: NativeMark) => void) => void; off: (event: string, callback: (mark: NativeMark) => void) => void };
let sequence = 0;
export function paintNativeHighlight(
  range: Range,
  background: string,
  foreground: string | undefined,
  priority = 0,
): (() => void) | undefined {
  const doc = range.startContainer.ownerDocument;
  const view = doc?.defaultView as (Window & typeof globalThis) | null;
  if (!doc || !view?.CSS?.highlights || !view.Highlight) return;
  const name = "reader-mark-" + ++sequence;
  const style = doc.createElement("style");
  style.textContent = "::highlight(" + name + "){background-color:" + background + (foreground ? ";color:" + foreground + ";text-shadow:none" : "") + ";}";
  const highlight = new view.Highlight(range);
  highlight.priority = priority;
  doc.head.append(style);
  view.CSS.highlights.set(name, highlight);
  return () => { view.CSS.highlights.delete(name); style.remove(); };
}
/** Paint opaque background and foreground without modifying EPUB text or its CFIs. */
export function bindNativeHighlight(value: unknown, background: string, foreground: string): () => void {
  const annotation = value as Annotation | undefined;
  if (!annotation?.on) return () => {};
  const paints = new Map<Document, () => void>();
  const clear = () => { paints.forEach(cleanup => cleanup()); paints.clear(); };
  const attach = (mark: NativeMark) => {
    const doc = mark?.range?.startContainer.ownerDocument;
    const element = mark.element;
    if (!doc || !element) return;
    paints.get(doc)?.();
    const remove = paintNativeHighlight(mark.range, background, foreground);
    if (!remove) return;
    // Retain epub.js range bookkeeping; native highlights supply the visible paint.
    element.style.fill = "transparent";
    element.dataset.readerNativeHighlight = "reader-mark-" + sequence;
    paints.set(doc, () => { remove(); element.style.removeProperty("fill"); delete element.dataset.readerNativeHighlight; });
  };
  annotation.on("attach", attach);
  annotation.on("detach", clear);
  if (annotation.mark) attach(annotation.mark);
  return () => { clear(); annotation.off("attach", attach); annotation.off("detach", clear); };
}
