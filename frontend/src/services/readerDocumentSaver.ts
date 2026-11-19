export type ReaderDocumentSaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Debounced, strictly ordered autosave: at most one request is in flight and
 * only the newest edit is sent next. A failed save keeps that edit pending,
 * so retry() or any later edit sends it again.
 */
export function createReaderDocumentSaver<T>({
  save,
  onStatus,
  delay = 800,
  setTimer = (callback, ms) => setTimeout(callback, ms),
  clearTimer = timer => clearTimeout(timer as ReturnType<typeof setTimeout>),
}: {
  save: (value: T) => Promise<unknown>;
  onStatus: (status: ReaderDocumentSaveStatus) => void;
  delay?: number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}) {
  let pending: { value: T } | null = null;
  let timer: unknown;
  let inflight: Promise<boolean> | null = null;

  function cancelTimer() {
    if (timer === undefined) return;
    clearTimer(timer);
    timer = undefined;
  }

  function run(): Promise<boolean> {
    cancelTimer();
    if (inflight) return inflight.then(() => (pending ? run() : true));
    if (!pending) return Promise.resolve(true);
    const sent = pending;
    pending = null;
    onStatus("saving");
    inflight = save(sent.value).then(
      () => {
        inflight = null;
        if (pending) {
          // Newer edits arrived mid-save; their debounce timer may already be gone.
          if (timer === undefined) return run();
          onStatus("pending");
          return true;
        }
        onStatus("saved");
        return true;
      },
      () => {
        inflight = null;
        // A newer edit keeps its own debounce timer and is sent as usual.
        pending ||= sent;
        onStatus("error");
        return false;
      },
    );
    return inflight;
  }

  return {
    schedule(value: T) {
      pending = { value };
      cancelTimer();
      if (!inflight) onStatus("pending");
      timer = setTimer(() => {
        timer = undefined;
        void run();
      }, delay);
    },
    /** Saves any pending edit now; resolves false if the latest attempt failed. */
    flush: run,
    retry: run,
    get dirty() {
      return !!pending || !!inflight;
    },
  };
}
