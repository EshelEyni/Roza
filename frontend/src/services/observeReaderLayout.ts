import { EpubCFI, type Location, type Rendition } from "epubjs";
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
    layoutVersion,
    requestLayout,
  } = runtime;
  let disposed = false;
  const live = () => !disposed && active();
  const paint = () =>
    new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

  const schedule = () => {
    if (!live()) return;
    if (explicitNavigation.current) {
      // Navigation owns its destination. Retry afterwards, using its accepted
      // location rather than dropping a resize that happened during the seek.
      clearTimeout(pendingResize.current);
      pendingResize.current = setTimeout(schedule, 100);
      return;
    }
    // Capture once for the whole resize burst, before any reflow can be saved.
    fullscreenResizeAnchor.current ??= stateRef.current.location;
    changingLayout.current = true;
    const version = ++layoutVersion.current;
    clearTimeout(pendingResize.current);
    pendingResize.current = setTimeout(() => {
      const previous = layoutTask.current;
      const owns = () =>
        live() &&
        !explicitNavigation.current &&
        version === layoutVersion.current;
      layoutTask.current = previous
        .catch(() => undefined)
        .then(async () => {
          if (!owns()) return;
          const cfi =
            fullscreenResizeAnchor.current ?? stateRef.current.location;
          if (!element.clientWidth || !element.clientHeight) return;
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
          await rendition.display(cfi || undefined);
          await paint();
          await paint();
          if (!owns()) return;
          // Continuous views can move while neighboring sections are inserted.
          await rendition.display(cfi || undefined);
          if (!owns()) return;
          // reportLocation's promise finishes before its animation-frame event.
          let onLocation: (location: Location) => void;
          const reported = new Promise<Location>(resolve => {
            onLocation = resolve;
            rendition.once("relocated", onLocation);
          });
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            void rendition.reportLocation();
            const location = await Promise.race([
              reported,
              new Promise<never>((_, reject) => {
                timeout = setTimeout(
                  () => reject(new Error(errorMessage)),
                  3000,
                );
              }),
            ]);
            if (!owns()) return;
            // The old passage must still be visible, even if its page boundary moved.
            if (
              cfi &&
              (new EpubCFI().compare(location.start.cfi, cfi) > 0 ||
                new EpubCFI().compare(location.end.cfi, cfi) < 0)
            ) {
              throw new Error(errorMessage);
            }
            fullscreenResizeAnchor.current = null;
            changingLayout.current = false;
            void rendition.reportLocation();
          } finally {
            clearTimeout(timeout);
            rendition.off("relocated", onLocation!);
          }
        })
        .catch(() => {
          if (!owns()) return;
          // Keep the last accepted position; a retry or explicit navigation can recover.
          setError(errorMessage);
        });
    }, 100);
  };
  requestLayout.current = schedule;
  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(element);
  // Guard browser/Escape exits before the next ResizeObserver delivery.
  window.addEventListener("resize", schedule);
  document.addEventListener("fullscreenchange", schedule);
  return () => {
    disposed = true;
    if (requestLayout.current === schedule) requestLayout.current = null;
    clearTimeout(pendingResize.current);
    resizeObserver.disconnect();
    window.removeEventListener("resize", schedule);
    document.removeEventListener("fullscreenchange", schedule);
  };
}
