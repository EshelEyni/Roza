import { useCallback, useEffect, useRef, useState } from "react";
import { ReaderBook, ReaderState } from "../../../shared/types/reader";
import readerApiService from "../services/readerApiService";

type PendingState = { state: ReaderState; savedAt: number };

export function useReaderState(book: ReaderBook, userId: string) {
  const cacheKey = "roza-reader:" + userId + ":" + book.id;
  const [initial] = useState(() => {
    try {
      const cached = JSON.parse(
        localStorage.getItem(cacheKey) || "null",
      ) as PendingState | null;
      if (cached?.state && cached.savedAt > new Date(book.updatedAt).getTime())
        return cached.state;
    } catch {
      /* Browser storage may be unavailable. Server state remains usable. */
    }
    return book.state;
  });
  const [state, setState] = useState<ReaderState>(initial);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const current = useRef(initial);
  const dirty = useRef(initial !== book.state);
  const mounted = useRef(true);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const revision = useRef(0);
  const flushRef = useRef<() => Promise<void>>();

  const flush = useCallback(async () => {
    if (!dirty.current || saving.current) return;
    saving.current = true;
    const savingRevision = revision.current;
    const snapshot = current.current;
    if (mounted.current) setSaveStatus("saving");
    try {
      await readerApiService.updateState(book.id, snapshot);
      if (savingRevision === revision.current) {
        dirty.current = false;
        try {
          const cached = JSON.parse(
            localStorage.getItem(cacheKey) || "null",
          ) as PendingState | null;
          if (cached?.state.savedAt === snapshot.savedAt)
            localStorage.removeItem(cacheKey);
        } catch {
          /* Optional recovery cache. */
        }
        if (mounted.current) setSaveStatus("saved");
      }
    } catch {
      if (mounted.current) setSaveStatus("error");
    } finally {
      saving.current = false;
      if (
        dirty.current &&
        savingRevision !== revision.current &&
        mounted.current
      )
        void flushRef.current?.();
    }
  }, [book.id, cacheKey]);
  flushRef.current = flush;

  const updateState = useCallback(
    (changes: Partial<ReaderState>) => {
      current.current = {
        ...current.current,
        ...changes,
        savedAt: Math.max(Date.now(), (current.current.savedAt || 0) + 1),
      };
      revision.current += 1;
      dirty.current = true;
      setState(current.current);
      setSaveStatus("saving");
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ state: current.current, savedAt: Date.now() }),
        );
      } catch {
        /* Saving to the server still works when local storage is full. */
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flushRef.current?.(), 500);
    },
    [cacheKey],
  );

  useEffect(() => {
    mounted.current = true;
    if (dirty.current) void flushRef.current?.();
    const save = () => {
      if (dirty.current)
        void readerApiService.saveOnLeave(book.id, current.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onVisibility);
      save();
    };
  }, [book.id]);

  return { state, updateState, saveStatus, retrySave: flush };
}
