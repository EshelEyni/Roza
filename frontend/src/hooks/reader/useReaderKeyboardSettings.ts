import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultReaderKeyboardSettings,
  isReaderKeyboardSettings,
  type ReaderKeyboardSettings,
} from "../../services/readerKeyboardSettings";
import api from "../../services/readerApiService";

export function useReaderKeyboardSettings(userId: string) {
  const cacheKey = "roza-reader-keyboard:" + userId;
  const readCached = () => {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(cacheKey) || "null",
      );
      if (isReaderKeyboardSettings(value)) return value;
    } catch {
      /* Server settings still work without browser storage. */
    }
    return { ...defaultReaderKeyboardSettings };
  };
  const [stored, setStored] = useState(() => ({ userId, value: readCached() }));
  const settings = stored.userId === userId ? stored.value : readCached();
  const [status, setStatus] = useState<
    "loading" | "saved" | "saving" | "error"
  >("loading");
  const current = useRef(settings);
  const revision = useRef(0);
  const queue = useRef(Promise.resolve());
  const mounted = useRef(false);
  const changed = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const scope = useRef(userId);
  if (scope.current !== userId) {
    scope.current = userId;
    revision.current++;
    changed.current = false;
    current.current = settings;
  }
  const cache = useCallback(
    (value: ReaderKeyboardSettings) => {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(value));
      } catch {
        /* Optional offline cache. */
      }
    },
    [cacheKey],
  );
  useEffect(() => {
    let active = true;
    mounted.current = true;
    const request = revision.current;
    api
      .request<ReaderKeyboardSettings>("GET", "/keyboard-settings")
      .then((value) => {
        if (!active || request !== revision.current) return;
        if (!isReaderKeyboardSettings(value))
          throw new Error("Invalid keyboard settings");
        current.current = value;
        setStored({ userId, value });
        cache(value);
        setStatus("saved");
      })
      .catch(() => {
        if (active && request === revision.current) setStatus("error");
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [userId, cache, attempt]);
  const update = useCallback(
    (value: ReaderKeyboardSettings) => {
      if (!isReaderKeyboardSettings(value)) return;
      const request = ++revision.current;
      current.current = value;
      changed.current = true;
      setStored({ userId, value });
      setStatus("saving");
      cache(value);
      queue.current = queue.current
        .catch(() => undefined)
        .then(async () => {
          if (scope.current !== userId) return;
          try {
            await api.request("PATCH", "/keyboard-settings", value);
            if (
              mounted.current &&
              scope.current === userId &&
              request === revision.current
            )
              setStatus("saved");
          } catch {
            if (
              mounted.current &&
              scope.current === userId &&
              request === revision.current
            )
              setStatus("error");
          }
        });
    },
    [cache, userId],
  );
  const retry = () => {
    if (changed.current) update(current.current);
    else {
      setStatus("loading");
      setAttempt((value) => value + 1);
    }
  };
  return {
    keyboardSettings: settings,
    updateKeyboardSettings: update,
    keyboardSaveStatus: status,
    retryKeyboardSettings: retry,
  };
}
