type Bounds = Pick<DOMRect, "left" | "right" | "top" | "bottom">;
/** Edge extension belongs to the first/last visible text row, not every line end. */
export function readerSelectionEdge(doc: Document, frame: Bounds, host: Bounds, point: { x: number; y: number }): "next" | "prev" | undefined {
  if (!doc.body || point.y < host.top || point.y > host.bottom) return;
  const direction = point.x <= host.left + 28 ? "prev" : point.x >= host.right - 28 ? "next" : undefined;
  if (!direction) return;
  const walker = doc.createTreeWalker(doc.body, 4); // SHOW_TEXT
  const range = doc.createRange();
  let firstBottom = Infinity;
  let lastTop = -Infinity;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      const left = frame.left + rect.left, right = frame.left + rect.right;
      const top = frame.top + rect.top, bottom = frame.top + rect.bottom;
      if (right <= host.left || left >= host.right || bottom <= host.top || top >= host.bottom) continue;
      firstBottom = Math.min(firstBottom, bottom);
      lastTop = Math.max(lastTop, top);
    }
  }
  if (direction === "next" && lastTop !== -Infinity && point.y >= lastTop - 2) return "next";
  if (direction === "prev" && firstBottom !== Infinity && point.y <= firstBottom + 2) return "prev";
}
