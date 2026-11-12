import type { Contents } from "epubjs";
import { readerSelectionEdge } from "./readerSelectionEdge";
import { bindReaderTouch } from "./readerTouch";
import type { EpubRuntime } from "../hooks/reader/useEpubRuntime";
import type { ReaderSelection } from "../hooks/reader/useReaderSelection";
export function bindReaderContents(
  contents: Contents,
  runtime: EpubRuntime,
  selection: Pick<ReaderSelection, "onSelectionChange" | "closeLookup"> &
    Partial<Pick<ReaderSelection, "isExtending" | "copySelection" | "onSelectionKey" | "togglePopup" | "beginSelection" | "isPageTurnBlocked">>,
  {
    onKey,
    enabled,
    move,
    title,
    extend,
  }: {
    onKey: (event: KeyboardEvent) => void;
    enabled: () => boolean;
    move: (direction: "next" | "prev") => void;
    title: string;
    extend?: (direction: "next" | "prev") => Promise<void>;
  },
) {
  const { mobileRef, stateRef, panelRef, selectionRef } = runtime;
  const cleanups: (() => void)[] = [];
  const resetLocalDrag = (wasExtending: boolean | undefined) => {
    if (wasExtending && selection.isPageTurnBlocked?.()) {
      dragAnchor = undefined;
      restartLocalDrag = true;
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const wasExtending = selection.isExtending?.();
    selection.onSelectionKey?.(event, dragging || !!contents.document.getSelection()?.toString().trim());
    resetLocalDrag(wasExtending);
    if (!event.defaultPrevented) onKey(event);
  };
  contents.document.addEventListener("keydown", onKeyDown);
  const onSelectionChange = () =>
    selection.onSelectionChange(contents.document);
  contents.document.addEventListener("selectionchange", onSelectionChange);
  cleanups.push(() =>
    contents.document.removeEventListener("selectionchange", onSelectionChange),
  );
  const onPointerDown = (event: PointerEvent) => {
    if (event.button === 2 && (event.buttons & 1) && dragging && dragButton === 1) {
      return;
    }
    contents.document.documentElement.dataset.readerSelectionMode = event.button === 2 ? "right" : "left";
    if (!mobileRef.current && !selection.isExtending?.())
      selection.closeLookup();
    selection.beginSelection?.(event.button === 2);
  };
  contents.document.addEventListener("pointerdown", onPointerDown);
  const onCopy = (event: ClipboardEvent) => selection.copySelection?.(event);
  contents.document.addEventListener("copy", onCopy);
  let dragging = false;
  let dragAnchor: Range | undefined;
  let dragButton = 1;
  let restartLocalDrag = false;
  const caretAt = (event: MouseEvent) => {
    const doc = contents.document as Document & {
      caretPositionFromPoint?: (x: number, y: number) =>
        { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const position = doc.caretPositionFromPoint?.(event.clientX, event.clientY);
    if (position) {
      const range = doc.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
    return doc.caretRangeFromPoint?.(event.clientX, event.clientY) ?? null;
  };
  const updateRightSelection = (event: MouseEvent) => {
    if (!dragAnchor || selection.isExtending?.()) return;
    const focus = caretAt(event);
    if (!focus || !dragAnchor.startContainer.isConnected) return;
    contents.document.getSelection()?.setBaseAndExtent(
      dragAnchor.startContainer, dragAnchor.startOffset,
      focus.startContainer, focus.startOffset,
    );
  };
  const onContextMenu = (event: MouseEvent) => {
    if (!mobileRef.current) event.preventDefault();
  };
  contents.document.addEventListener("contextmenu", onContextMenu);
  let edge: "next" | "prev" | undefined;
  let dragPosition: { x: number; y: number } | undefined;
  const currentEdge = () => {
    const frame = contents.document.defaultView?.frameElement?.getBoundingClientRect();
    const host = runtime.host.current?.getBoundingClientRect();
    return frame && host && dragPosition ? readerSelectionEdge(contents.document, frame, host, dragPosition) : undefined;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopEdge = () => {
    clearTimeout(timer);
    timer = undefined;
    edge = undefined;
  };
  const schedule = () => {
    timer = setTimeout(async () => {
      timer = undefined;
      if (!edge || !dragging || !enabled() || (mobileRef.current && panelRef.current) || !extend)
        return;
      if (currentEdge() !== edge) { stopEdge(); return; }
      if (
        !contents.document.getSelection()?.toString().trim() &&
        !selection.isExtending?.()
      )
        return;
      if (!selection.isPageTurnBlocked?.()) await extend(edge);
      if (!contents.document.defaultView?.frameElement?.isConnected) {
        dragging = false;
        stopEdge();
      }
      if (dragging && edge) schedule();
    }, 750);
  };
  const onMouseDown = (event: MouseEvent) => {
    // A right click during a left drag changes only the popup for this selection.
    if (event.button === 2 && (event.buttons & 1) && dragging && dragButton === 1) {
      event.preventDefault();
      const wasExtending = selection.isExtending?.();
      selection.togglePopup?.();
      resetLocalDrag(wasExtending);
      return;
    }
    stopEdge();
    dragAnchor = undefined;
    restartLocalDrag = false;
    dragging = event.button === 0;
    dragButton = event.button === 2 ? 2 : 1;
    if (event.button !== 2 || mobileRef.current || !enabled())
      return;
    event.preventDefault();
    dragAnchor = caretAt(event) ?? undefined;
    dragging = !!dragAnchor;
    if (dragAnchor) updateRightSelection(event);
  };
  const onMouseUp = (event?: MouseEvent | FocusEvent) => {
    if (event && "buttons" in event && (event.buttons & dragButton)) return;
    dragging = false;
    dragPosition = undefined;
    dragAnchor = undefined;
    stopEdge();
  };
  const onMouseMove = (event: MouseEvent) => {
    if (dragging && event.buttons === 0) {
      onMouseUp();
      return;
    }
    if (dragging && dragButton === 1 && !dragAnchor && (restartLocalDrag || selection.isPageTurnBlocked?.())) {
      const native = contents.document.getSelection();
      if (!restartLocalDrag && native?.anchorNode && native.anchorNode.isConnected) {
        dragAnchor = contents.document.createRange();
        dragAnchor.setStart(native.anchorNode, native.anchorOffset);
        dragAnchor.collapse(true);
      } else {
        dragAnchor = caretAt(event) ?? undefined;
      }
      restartLocalDrag = false;
    }
    if (dragAnchor) {
      if (!(event.buttons & dragButton)) {
        onMouseUp();
        return;
      }
      event.preventDefault();
      updateRightSelection(event);
    }
    if (
      !dragging ||
      mobileRef.current ||
      stateRef.current.preferences.flow !== "paginated"
    )
      return;
    const frame = contents.document.defaultView?.frameElement;
    if (!frame) return;
    // clientX is relative to the full chapter iframe, which can be many columns wide.
    const host = runtime.host.current?.getBoundingClientRect();
    if (!host) return;
    const offset = frame.getBoundingClientRect();
    dragPosition = { x: offset.left + event.clientX, y: offset.top + event.clientY };
    const nextEdge = readerSelectionEdge(contents.document, offset, host, dragPosition);
    if (!nextEdge) {
      stopEdge();
      return;
    }
    if (nextEdge === edge) return;
    stopEdge();
    edge = nextEdge;
    if (edge) schedule();
  };
  contents.document.addEventListener("mousedown", onMouseDown);
  contents.document.addEventListener("mousemove", onMouseMove);
  contents.document.addEventListener("mouseup", onMouseUp);
  const hostDocument = runtime.host.current?.ownerDocument;
  hostDocument?.addEventListener("mouseup", onMouseUp);
  contents.document.defaultView?.addEventListener?.("blur", onMouseUp);
  cleanups.push(() => {
    contents.document.removeEventListener("keydown", onKeyDown);
    contents.document.removeEventListener("pointerdown", onPointerDown);
    contents.document.removeEventListener("copy", onCopy);
    contents.document.removeEventListener("contextmenu", onContextMenu);
    contents.document.removeEventListener("mousedown", onMouseDown);
    contents.document.removeEventListener("mousemove", onMouseMove);
    contents.document.removeEventListener("mouseup", onMouseUp);
    hostDocument?.removeEventListener("mouseup", onMouseUp);
    contents.document.defaultView?.removeEventListener?.("blur", onMouseUp);
    stopEdge();
  });
  // iOS owns long-press selection and its draggable native handles.
  contents.addStylesheetRules(
    {
      "html, body": {
        "-webkit-touch-callout": "none",
        "-webkit-user-select": "text",
        "user-select": "text",
        "touch-action": "pan-y pinch-zoom",
      },
    },
    "reader-touch",
  );
  cleanups.push(
    bindReaderTouch(contents.document, {
      enabled: () => mobileRef.current && enabled(),
      paginated: () => stateRef.current.preferences.flow === "paginated",
      blocked: () => !!panelRef.current,
      selected: () => !!selectionRef.current,
      dismissSelection: () => selection.closeLookup(),
      move: direction => move(direction),
    }),
  );
  // Never navigate the app or open remote links from an uploaded document.
  const onClick = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest?.("a");
    if (
      anchor &&
      /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(anchor.getAttribute("href") || "")
    )
      event.preventDefault();
    else if (anchor && anchor.getAttribute("href")) runtime.linkObserver?.current?.();
  };
  contents.document.addEventListener("click", onClick, true);
  cleanups.push(() =>
    contents.document.removeEventListener("click", onClick, { capture: true }),
  );
  const iframe = contents.document.defaultView?.frameElement;
  iframe?.setAttribute("title", title);
  return () => cleanups.forEach(cleanup => cleanup());
}
