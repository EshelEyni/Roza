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
  let width = element.clientWidth;
  let height = element.clientHeight;
  const resizeObserver = new ResizeObserver(() => {
    const nextWidth = element.clientWidth;
    const nextHeight = element.clientHeight;
    if (width === nextWidth && height === nextHeight) return;
    if (!active() || explicitNavigation.current) return;
    width = nextWidth;
    height = nextHeight;
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
