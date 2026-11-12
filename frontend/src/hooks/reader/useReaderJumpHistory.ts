import {useCallback,useEffect,useRef,useState} from "react";
import type {Location} from "epubjs";
import {ReaderJumpHistory, type ReaderPageInfo, type ReaderReturnPoint} from "../../services/readerJumpHistory";
import type {EpubRuntime} from "./useEpubRuntime";
export function useReaderJumpHistory(runtime: EpubRuntime, location: Location | null,
  describe: (cfi: string) => Promise<ReaderPageInfo | null>, navigate: (cfi: string) => Promise<void>, onError: () => void) {
  const [returnPoint,setReturnPoint] = useState<ReaderReturnPoint | null>(null);
  const tracker = useRef<ReaderJumpHistory>();
  if (!tracker.current) tracker.current = new ReaderJumpHistory(setReturnPoint);
  useEffect(() => {
    if (location?.start.cfi) void tracker.current!.visit(location.start.cfi,describe).catch(() => {});
  }, [location,describe]);
  useEffect(() => {
    runtime.linkObserver.current = () => tracker.current!.markLink(location?.start.cfi);
    return () => { runtime.linkObserver.current = undefined; };
  }, [runtime,location]);
  useEffect(() => {
    const dismiss = () => { tracker.current?.cancel(); tracker.current?.dismiss(); };
    const outside = (event: Event) => {
      if (event.target instanceof Node && !runtime.shell.current?.contains(event.target)) dismiss();
    };
    const blur = () => {
      // Focusing the EPUB iframe also emits window blur; it remains reader context.
      if (!document.hasFocus()) dismiss();
    };
    const visibility = () => { if (document.hidden) dismiss(); };
    document.addEventListener("focusin", outside);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("focusin", outside);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
    };
  }, [runtime]);
  useEffect(() => () => tracker.current?.cancel(), []);
  const goBack = useCallback(async () => {
    try { await tracker.current!.goBack(navigate); } catch { onError(); }
  }, [navigate,onError]);
  return {returnPoint,goBack};
}
