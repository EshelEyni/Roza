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
  useEffect(() => () => tracker.current?.cancel(), []);
  const goBack = useCallback(async () => {
    try { await tracker.current!.goBack(navigate); } catch { onError(); }
  }, [navigate,onError]);
  return {returnPoint,goBack};
}
