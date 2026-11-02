import type { Contents } from "epubjs";
import { bindReaderTouch } from "./readerTouch";
import type { EpubRuntime } from "../hooks/reader/useEpubRuntime";
import type { ReaderSelection } from "../hooks/reader/useReaderSelection";
export function bindReaderContents(
  contents: Contents,
  runtime: EpubRuntime,
  selection: Pick<ReaderSelection, "onSelectionChange" | "closeLookup"> &
    Partial<Pick<ReaderSelection, "isExtending" | "copySelection" | "onSelectionKey">>,
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
  const onKeyDown = (event: KeyboardEvent) => {
    selection.onSelectionKey?.(event, dragging || !!contents.document.getSelection()?.toString().trim());
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
    contents.document.documentElement.dataset.readerSelectionMode = event.button === 2 ? "right" : "left";
    if (!mobileRef.current && !selection.isExtending?.())
      selection.closeLookup();
  };
  contents.document.addEventListener("pointerdown", onPointerDown);
  const onCopy = (event: ClipboardEvent) => selection.copySelection?.(event);
  contents.document.addEventListener("copy", onCopy);
  let dragging = false;
  let rightAnchor: Range | undefined;
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
    if (!rightAnchor || selection.isExtending?.()) return;
    const focus = caretAt(event);
    if (!focus || !rightAnchor.startContainer.isConnected) return;
    contents.document.getSelection()?.setBaseAndExtent(
      rightAnchor.startContainer, rightAnchor.startOffset,
      focus.startContainer, focus.startOffset,
    );
  };
  const onContextMenu = (event: MouseEvent) => {
    if (!mobileRef.current) event.preventDefault();
  };
  contents.document.addEventListener("contextmenu", onContextMenu);
  let edge: "next" | "prev" | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let edgeConsumed = false;
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
      if (
        !contents.document.getSelection()?.toString().trim() &&
        !selection.isExtending?.()
      )
        return;
      // One turn per edge visit. Only moving back into the page rearms it.
      edgeConsumed = true;
      await extend(edge);
      if (!contents.document.defaultView?.frameElement?.isConnected) {
        dragging = false;
        stopEdge();
      }
    }, 750);
  };
  const onMouseDown = (event: MouseEvent) => {
    stopEdge();
    edgeConsumed = false;
    rightAnchor = undefined;
    dragging = event.button === 0;
    if (event.button !== 2 || mobileRef.current || !enabled())
      return;
    event.preventDefault();
    rightAnchor = caretAt(event) ?? undefined;
    dragging = !!rightAnchor;
    if (rightAnchor) updateRightSelection(event);
  };
  const onMouseUp = () => {
    dragging = false;
    rightAnchor = undefined;
    stopEdge();
  };
  const onMouseMove = (event: MouseEvent) => {
    if (dragging && event.buttons === 0) {
      onMouseUp();
      return;
    }
    if (rightAnchor) {
      if (!(event.buttons & 2)) {
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
    const x = frame.getBoundingClientRect().left + event.clientX;
    const nextEdge =
      x <= host.left + 28 ? "prev" : x >= host.right - 28 ? "next" : undefined;
    if (!nextEdge) {
      stopEdge();
      edgeConsumed = false;
      return;
    }
    if (edgeConsumed || nextEdge === edge) return;
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
  };
  contents.document.addEventListener("click", onClick, true);
  cleanups.push(() =>
    contents.document.removeEventListener("click", onClick, { capture: true }),
  );
  const iframe = contents.document.defaultView?.frameElement;
  iframe?.setAttribute("title", title);
  return () => cleanups.forEach(cleanup => cleanup());
}
