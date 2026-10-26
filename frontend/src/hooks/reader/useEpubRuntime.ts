import { useMemo, useRef } from "react";
import type { Book, Rendition } from "epubjs";
import type { ReaderState } from "../../../../shared/types/reader";
import type { ReaderPanel, ReaderTextSelection } from "../../types/reader";

export function useEpubRuntime(
  state: ReaderState,
  updateState: (changes: Partial<ReaderState>) => void,
  mobile: boolean,
  panel: ReaderPanel | null,
  selection: ReaderTextSelection | null,
) {
  const host = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const updateRef = useRef(updateState);
  const mobileRef = useRef(mobile);
  const panelRef = useRef(panel);
  const selectionRef = useRef(selection);
  stateRef.current = state;
  updateRef.current = updateState;
  mobileRef.current = mobile;
  panelRef.current = panel;
  selectionRef.current = selection;
  const epubRef = useRef<Book>();
  const renditionRef = useRef<Rendition>();
  const changingLayout = useRef(false);
  const fullscreenResizeAnchor = useRef<string | null>(null);
  const pendingResize = useRef<ReturnType<typeof setTimeout>>();
  const layoutTask = useRef<Promise<void>>(Promise.resolve());
  const explicitNavigation = useRef(false);
  const navigationVersion = useRef(0);
  const highlightedCfi = useRef("");
  const readingBoundary = useRef("");
  return useMemo(
    () => ({
      host,
      shell,
      stateRef,
      updateRef,
      mobileRef,
      panelRef,
      selectionRef,
      epubRef,
      renditionRef,
      changingLayout,
      fullscreenResizeAnchor,
      pendingResize,
      layoutTask,
      explicitNavigation,
      navigationVersion,
      highlightedCfi,
      readingBoundary,
    }),
    [],
  );
}
export type EpubRuntime = ReturnType<typeof useEpubRuntime>;
