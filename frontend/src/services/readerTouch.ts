interface TouchOptions {
  enabled: () => boolean;
  paginated: () => boolean;
  blocked: () => boolean;
  selected: () => boolean;
  tapPosition: (x: number, y: number) => number | undefined;
  dismissSelection: () => void;
  move: (direction: "next" | "prev") => void;
}

/** Native selection owns long presses/handles; only short, single-finger gestures navigate. */
export function bindReaderTouch(doc: Document, options: TouchOptions) {
  let gesture:
    | {
        id: number;
        x: number;
        y: number;
        time: number;
        selected: boolean;
        moved: boolean;
        axis?: "horizontal" | "vertical";
      }
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
  const suppressContextMenu = (event: Event) => {
    if (options.enabled() && !options.blocked()) event.preventDefault();
  };
  const hasSelection = () => !!doc.getSelection()?.toString().trim();
  const start = (event: TouchEvent) => {
    gesture = undefined;
    if (!options.enabled() || options.blocked() || event.touches.length !== 1)
      return;
    if (
      (event.target as Element | null)?.closest?.(
        "a, button, input, textarea, select, [contenteditable], [role=button], .reader-saved-annotation",
      )
    )
      return;
    const touch = event.touches[0];
    gesture = {
      id: touch.identifier,
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
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (touch.identifier !== gesture.id) { gesture = undefined; return; }
    if (Math.hypot(dx, dy) >= 10) {
      gesture.moved = true;
      gesture.axis ??= Math.abs(dx) > Math.abs(dy) * 1.5
        ? "horizontal"
        : "vertical";
    }
    // Safari must be stopped during movement, before it takes over the gesture.
    // Leave long presses, selection handles, vertical scrolling and zoom native.
    if (
      gesture.axis === "horizontal" &&
      !gesture.selected &&
      !hasSelection() &&
      Date.now() - gesture.time < 650 &&
      options.enabled() &&
      !options.blocked() &&
      options.paginated() &&
      event.cancelable
    ) {
      event.preventDefault();
    }
  };
  const end = (event: TouchEvent) => {
    const current = gesture;
    gesture = undefined;
    if (
      !current ||
      !options.enabled() ||
      options.blocked() ||
      event.touches.length !== 0 ||
      event.changedTouches.length !== 1
    )
      return;
    if (current.selected) {
      if (!current.moved && !hasSelection()) options.dismissSelection();
      return;
    }
    if (hasSelection() || options.selected()) return;
    const touch = event.changedTouches[0];
    if (touch.identifier !== current.id) return;
    const dx = touch.clientX - current.x;
    const dy = touch.clientY - current.y;
    const elapsed = Date.now() - current.time;
    if (!current.moved && elapsed < 250 && Math.hypot(dx, dy) < 10 && options.paginated()) {
      const position = options.tapPosition(touch.clientX, touch.clientY);
      if (position !== undefined && position >= 0 && position <= 1 &&
          (position < 0.25 || position > 0.75)) {
        consume(event);
        options.move(position < 0.25 ? "prev" : "next");
      }
      return;
    }
    if (
      current.axis !== "vertical" &&
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
  const scroll = () => { if (gesture) gesture.moved = true; };
  doc.addEventListener("scroll", scroll, true);
  doc.addEventListener("touchstart", start, { passive: true, capture: true });
  doc.addEventListener("touchmove", move, { passive: false, capture: true });
  doc.addEventListener("touchend", end, { passive: false, capture: true });
  doc.addEventListener("click", suppressClick, true);
  doc.addEventListener("contextmenu", suppressContextMenu, true);
  doc.addEventListener("touchcancel", cancel);
  return () => {
    doc.removeEventListener("scroll", scroll, true);
    doc.removeEventListener("touchstart", start, true);
    doc.removeEventListener("touchmove", move, true);
    doc.removeEventListener("touchend", end, true);
    doc.removeEventListener("click", suppressClick, true);
    doc.removeEventListener("contextmenu", suppressContextMenu, { capture: true });
    doc.removeEventListener("touchcancel", cancel);
  };
}
