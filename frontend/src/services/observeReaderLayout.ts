import type { Rendition } from "epubjs";
import type { EpubRuntime } from "../hooks/reader/useEpubRuntime";
export function observeReaderLayout(
  element: HTMLElement,
  rendition: Rendition,
  runtime: EpubRuntime,
  active: () => boolean,
  setError: (message: string) => void,
  errorMessage: string,
) {
  const {
    explicitNavigation,
    changingLayout,
    pendingResize,
    fullscreenResizeAnchor,
    stateRef,
    layoutTask,
  } = runtime;
  const resizeObserver = new ResizeObserver(() => {
    if (!active() || explicitNavigation.current) return;
    changingLayout.current = true;
    clearTimeout(pendingResize.current);
    pendingResize.current = setTimeout(() => {
      if (active() && !explicitNavigation.current) {
        const cfi = fullscreenResizeAnchor.current ?? stateRef.current.location;
        changingLayout.current = true;
        const resize = rendition.resize as (
          width: number,
          height: number,
          cfi?: string,
        ) => void;
        resize.call(
          rendition,
          element.clientWidth,
          element.clientHeight,
          cfi || undefined,
        );
        layoutTask.current = rendition
          .display(cfi || undefined)
          .then(() => {
            if (!active()) return;
            fullscreenResizeAnchor.current = null;
            changingLayout.current = false;
            void rendition?.reportLocation();
          })
          .catch(() => {
            if (!active()) return;
            fullscreenResizeAnchor.current = null;
            changingLayout.current = false;
            setError(errorMessage);
          });
      }
    }, 100);
  });
  resizeObserver.observe(element);
  return () => {
    clearTimeout(pendingResize.current);
    resizeObserver.disconnect();
  };
}
