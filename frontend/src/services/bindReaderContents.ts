import type { Contents } from "epubjs";
import { bindReaderTouch } from "./readerTouch";
import type { EpubRuntime } from "../hooks/reader/useEpubRuntime";
import type { ReaderSelection } from "../hooks/reader/useReaderSelection";
export function bindReaderContents(
  contents: Contents,
  runtime: EpubRuntime,
  selection: Pick<ReaderSelection, "onSelectionChange" | "closeLookup">,
  {
    onKey,
    enabled,
    move,
    title,
  }: {
    onKey: (event: KeyboardEvent) => void;
    enabled: () => boolean;
    move: (direction: "next" | "prev") => void;
    title: string;
  },
) {
  const { mobileRef, stateRef, panelRef, selectionRef } = runtime;
  const cleanups: (() => void)[] = [];
  contents.document.addEventListener("keydown", onKey);
  const onSelectionChange = () =>
    selection.onSelectionChange(contents.document);
  contents.document.addEventListener("selectionchange", onSelectionChange);
  cleanups.push(() =>
    contents.document.removeEventListener("selectionchange", onSelectionChange),
  );
  const onPointerDown = () => {
    if (!mobileRef.current) selection.closeLookup();
  };
  contents.document.addEventListener("pointerdown", onPointerDown);
  cleanups.push(() => {
    contents.document.removeEventListener("keydown", onKey);
    contents.document.removeEventListener("pointerdown", onPointerDown);
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
