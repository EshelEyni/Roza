import { useCallback, useEffect, useRef, useState } from "react";
import type { BookDetail, BookListPrefs, BookSummary, ConnectionInfo, LogLine, ProdStatus, UploadResult } from "../../../../shared/types/stagingRoom";
import { api, errorText } from "./api";
import "./staging-room.scss";
import { TopBar, Tab } from "./components/TopBar";
import { BookList } from "./components/BookList";
import { BookView } from "./components/BookView";
import { ConnectionView } from "./components/ConnectionView";
import { LogPanel } from "./components/LogPanel";
import { ChapterPreviewModal } from "./components/ChapterPreviewModal";
import { SyncDialog } from "./components/SyncDialog";

type Busy = "" | "status" | "upload" | "load" | "pull";

export function StagingRoomWorkspace() {
  const [tab, setTab] = useState<Tab>("books");
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [bookLoadError, setBookLoadError] = useState("");
  const [listPrefs, setListPrefs] = useState<BookListPrefs>({ order: [], hidden: [], showHidden: false });
  const [slug, setSlug] = useState<string>();
  const [book, setBook] = useState<BookDetail>();
  const [status, setStatus] = useState<ProdStatus>();
  const [connection, setConnection] = useState<ConnectionInfo>();
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState<Busy>("");
  const [dialog, setDialog] = useState<"" | "push" | "pull">("");
  const [preview, setPreview] = useState<string>();
  const [lastResult, setLastResult] = useState<UploadResult>();

  // Refs so the window-focus handler sees the current values.
  const busyRef = useRef<Busy>("");
  const dialogRef = useRef("");
  const lastCompare = useRef(0);
  busyRef.current = busy;
  dialogRef.current = dialog || preview || "";

  const addLog = useCallback((level: LogLine["level"], text: string) => {
    setLogs((l) => [...l.slice(-300), { at: new Date().toISOString(), level, text }]);
  }, []);

  useEffect(() => api.onLog((line) => setLogs((l) => [...l.slice(-300), line])), []);

  const refreshBooks = useCallback(async () => {
    try {
      const [list, prefs] = await Promise.all([api.listBooks(), api.getListPrefs()]);
      setBooks(list);
      setBookLoadError("");
      setListPrefs(prefs);
      const firstVisible = list.find((b) => prefs.showHidden || !prefs.hidden.includes(b.slug)) ?? list[0];
      setSlug((s) => s ?? firstVisible?.slug);
    } catch (e) {
      const message = errorText(e);
      setBookLoadError(message);
      addLog("error", message);
    }
  }, [addLog]);

  useEffect(() => {
    refreshBooks();
    api.connectionInfo().then(setConnection, (error) => addLog("error", errorText(error)));
  }, [refreshBooks, addLog]);

  /** Re-read the local files and compare with Roza (read-only). Quiet = no busy state, no flicker. */
  const compare = useCallback(
    async (s: string, quiet = false): Promise<ProdStatus | undefined> => {
      lastCompare.current = Date.now();
      if (!quiet) setBusy("status");
      try {
        const loaded = await api.getBook(s);
        setBook(loaded);
        if (loaded.errors.length || !(await api.connectionInfo()).configured) {
          setStatus(undefined);
          return undefined;
        }
        const st = await api.prodStatus(s);
        setStatus(st);
        return st;
      } catch (e) {
        if (!quiet) addLog("error", errorText(e));
        return undefined;
      } finally {
        if (!quiet) setBusy("");
      }
    },
    [addLog],
  );

  // Opening a book: show it, then compare with Roza.
  useEffect(() => {
    if (!slug) return;
    setStatus(undefined);
    setLastResult(undefined);
    setBook(undefined);
    setBusy("load");
    compare(slug).finally(() => setBusy(""));
  }, [slug, compare]);

  // Coming back to the window: fetch from Roza again (at most every 10 seconds, never mid-action).
  useEffect(() => {
    const onFocus = () => {
      if (!slug || busyRef.current || dialogRef.current) return;
      if (Date.now() - lastCompare.current < 10_000) return;
      compare(slug, true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [slug, compare]);

  const changeListPrefs = async (next: BookListPrefs) => {
    // Update the screen right away, then save to books/_list.json.
    setListPrefs(next);
    if (next.order !== listPrefs.order) {
      const rank = new Map(next.order.map((s, i) => [s, i]));
      setBooks((list) => [...list].sort((a, b) => (rank.get(a.slug) ?? Infinity) - (rank.get(b.slug) ?? Infinity)));
    }
    try {
      setListPrefs(await api.setListPrefs(next));
    } catch (e) {
      addLog("error", `Could not save the book list: ${errorText(e)}`);
    }
  };

  const open = async (mode: "push" | "pull") => {
    if (!slug) return;
    const st = await compare(slug);
    if (st) setDialog(mode);
  };

  const run = async (kind: "upload" | "pull", action: () => Promise<void>) => {
    if (!slug) return;
    setDialog("");
    setBusy(kind);
    try {
      await action();
      await refreshBooks();
    } catch (error) {
      addLog("error", errorText(error));
    } finally {
      setBusy("");
      await compare(slug, true);
    }
  };

  const doPush = (chapterKeys: string[], entityKeys: string[]) =>
    run("upload", async () => {
      setLastResult(
        await api.upload(slug!, {
          overwriteChapters: chapterKeys.filter((k) => k.endsWith(".json")),
          updateEntities: entityKeys,
        }),
      );
    });

  const doPull = (chapterKeys: string[], entityKeys: string[]) =>
    run("pull", async () => {
      setLastResult(undefined);
      await api.pull(slug!, { chapters: chapterKeys, entities: entityKeys });
    });

  return (
    <div className="roza-staging-room" dir="ltr">
      <TopBar tab={tab} onTab={setTab} connection={connection} />
      {tab === "books" ? (
        <div className="workspace">
          <BookList
            books={books}
            prefs={listPrefs}
            onPrefsChange={changeListPrefs}
            selected={slug}
            onSelect={setSlug}
            onRefresh={refreshBooks}
            onOpenFolder={() => { void api.openBooksFolder().catch((error) => addLog("error", errorText(error))); }}
          />
          <main className="main">
            {book ? (
              <BookView
                book={book}
                status={status}
                busy={busy}
                lastResult={lastResult}
                onCompare={() => slug && compare(slug)}
                onPull={() => open("pull")}
                onPush={() => open("push")}
                onPreview={setPreview}
              />
            ) : (
              bookLoadError
                ? <p className="empty" role="alert">{bookLoadError}</p>
                : <EmptyState loading={busy === "load"} hasBooks={books.length > 0} />
            )}
          </main>
        </div>
      ) : (
        <ConnectionView connection={connection} onTest={() => api.testConnection()} />
      )}
      <LogPanel logs={logs} onClear={() => setLogs([])} />
      {preview && slug && <ChapterPreviewModal slug={slug} file={preview} onClose={() => setPreview(undefined)} />}
      {dialog && status && (
        <SyncDialog
          mode={dialog}
          status={status}
          onCancel={() => setDialog("")}
          onConfirm={dialog === "push" ? doPush : doPull}
        />
      )}
    </div>
  );
}

function EmptyState({ loading, hasBooks }: { loading: boolean; hasBooks: boolean }) {
  return (
    <div className="empty">
      <h2>{loading ? "Loading…" : hasBooks ? "Pick a book" : "No books yet"}</h2>
      {!loading && !hasBooks && (
        <p>
          Put a book in <code>books/&lt;name&gt;/book.json</code> with chapters in <code>books/&lt;name&gt;/chapters/</code>.
        </p>
      )}
    </div>
  );
}
