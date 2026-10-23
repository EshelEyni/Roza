interface TouchOptions {
  enabled: () => boolean;
  paginated: () => boolean;
  blocked: () => boolean;
  selected: () => boolean;
  dismissSelection: () => void;
  move: (direction: "next" | "prev") => void;
}

/** Native selection owns long presses/handles; only short, single-finger gestures navigate. */
export function bindReaderTouch(doc: Document, options: TouchOptions) {
  let gesture:
    | { x: number; y: number; time: number; selected: boolean; moved: boolean }
    | undefined;
  let suppressClickUntil = 0;
  const consume = (event: TouchEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClickUntil = Date.now() + 500;
  };
  const suppressClick = (event: MouseEvent) => {
    if (event.detail !== 0 && Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const hasSelection = () => !!doc.getSelection()?.toString().trim();
  const start = (event: TouchEvent) => {
    gesture = undefined;
    if (!options.enabled() || options.blocked() || event.touches.length !== 1)
      return;
    if (
      (event.target as Element | null)?.closest?.(
        "a, button, input, textarea, select",
      )
    )
      return;
    const touch = event.touches[0];
    gesture = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      selected: hasSelection() || options.selected(),
      moved: false,
    };
  };
  const move = (event: TouchEvent) => {
    if (!gesture) return;
    if (event.touches.length !== 1) {
      gesture = undefined;
      return;
    }
    const touch = event.touches[0];
    if (Math.hypot(touch.clientX - gesture.x, touch.clientY - gesture.y) > 10)
      gesture.moved = true;
  };
  const end = (event: TouchEvent) => {
    const current = gesture;
    gesture = undefined;
    if (
      !current ||
      !options.enabled() ||
      options.blocked() ||
      event.changedTouches.length !== 1
    )
      return;
    if (current.selected) {
      if (!current.moved && !hasSelection()) options.dismissSelection();
      return;
    }
    if (hasSelection()) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - current.x;
    const dy = touch.clientY - current.y;
    const elapsed = Date.now() - current.time;
    if (
      elapsed < 650 &&
      Math.abs(dx) >= 50 &&
      Math.abs(dx) > Math.abs(dy) * 1.5 &&
      options.paginated()
    ) {
      consume(event);
      options.move(dx < 0 ? "next" : "prev");
    }
  };
  const cancel = () => {
    gesture = undefined;
  };
  doc.addEventListener("touchstart", start, { passive: true });
  doc.addEventListener("touchmove", move, { passive: true });
  doc.addEventListener("touchend", end, { passive: false, capture: true });
  doc.addEventListener("click", suppressClick, true);
  doc.addEventListener("touchcancel", cancel);
  return () => {
    doc.removeEventListener("touchstart", start);
    doc.removeEventListener("touchmove", move);
    doc.removeEventListener("touchend", end, true);
    doc.removeEventListener("click", suppressClick, true);
    doc.removeEventListener("touchcancel", cancel);
  };
}
