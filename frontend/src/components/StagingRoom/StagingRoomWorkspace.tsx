import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BookDetail,
  BookListPrefs,
  BookSummary,
  ConnectionInfo,
  LogLine,
  ProdStatus,
  RevertTarget,
  UploadResult,
} from "../../../../shared/types/stagingRoom";
import { api, errorText } from "./api";
import { importProjects } from "./importProjects";
import "./staging-room.scss";
import { TopBar, Tab } from "./components/TopBar";
import { BookList } from "./components/BookList";
import { BookTab, BookView } from "./components/BookView";
import { ConnectionView } from "./components/ConnectionView";
import { LogPanel } from "./components/LogPanel";
import { ChapterPreviewModal } from "./components/ChapterPreviewModal";
import { SyncDialog } from "./components/SyncDialog";
import { StagingEditor } from "./components/StagingEditor";
import { HistoryView } from "./components/review/HistoryView";
import { ReviewView } from "./components/review/ReviewView";
import { BOOK_KEY, ReviewEntry, reviewEntries } from "./components/review/reviewModel";

type Busy = "" | "status" | "upload" | "load" | "pull" | "revert";

/** Sets the accepted flag on one item of a Compare result. */
function withAccepted(status: ProdStatus, key: string, accepted: boolean): ProdStatus {
  return {
    ...status,
    chapters: status.chapters.map((c) => (c.key === key ? { ...c, accepted } : c)),
    entityChanges: status.entityChanges?.map((e) => (`${e.kind}:${e.name}` === key ? { ...e, accepted } : e)),
    bookChange: status.bookChange && key === BOOK_KEY ? { ...status.bookChange, accepted } : status.bookChange,
  };
}

export function StagingRoomWorkspace() {
  const [tab, setTab] = useState<Tab>("books");
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [bookLoadError, setBookLoadError] = useState("");
  const [importing, setImporting] = useState(false);
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
  const [bookTab, setBookTab] = useState<BookTab>("overview");
  const [reviewKey, setReviewKey] = useState<string>();
  const [editing, setEditing] = useState<string>();
  /** goes up whenever Staging changes, so History reloads */
  const [historyVersion, setHistoryVersion] = useState(0);
  const entries = useMemo(() => reviewEntries(status, book), [status, book]);

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
    setReviewKey(undefined);
    setEditing(undefined);
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

  async function importFolder(files: File[]) {
    if (!files.length || importing) return;
    setImporting(true);
    try {
      const { created, existing, failures } = await importProjects(files);
      addLog("info", `Imported ${created} project(s). ${existing} already existed.`);
      for (const failure of failures) addLog("error", failure);
      await refreshBooks();
    } catch (error) {
      addLog("error", errorText(error));
    } finally {
      setImporting(false);
    }
  }

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

  const run = async (kind: "upload" | "pull" | "revert", action: () => Promise<void>) => {
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
      setHistoryVersion((v) => v + 1);
      await compare(slug, true);
    }
  };

  const doReject = (targets: RevertTarget[]) =>
    run("revert", async () => {
      const result = await api.revert(slug!, { targets, reviewToken: status?.reviewToken });
      addLog("ok", `Rejected ${result.reverted} change(s). Staging now has Writing Studio's version.`);
    });

  const accept = async (entry: ReviewEntry, accepted: boolean) => {
    if (!slug || !entry.print) return;
    setStatus((s) => s && withAccepted(s, entry.key, accepted));
    try {
      await api.setReview(slug, entry.key, entry.print, accepted);
    } catch (error) {
      setStatus((s) => s && withAccepted(s, entry.key, !accepted));
      addLog("error", `Could not save the review mark: ${errorText(error)}`);
    }
  };

  const review = (key: string) => {
    setReviewKey(key);
    setBookTab("changes");
  };

  const closeEditor = (then?: () => void) => {
    setEditing(undefined);
    setHistoryVersion((v) => v + 1);
    if (slug) compare(slug, true);
    then?.();
  };

  /** Readable names for History. */
  const keyName = (key: string) => {
    if (key === BOOK_KEY) return "Book settings";
    if (key === "book:edits") return "Book edits";
    const chapter = book?.chapters.find((c) => c.file === key);
    if (chapter) return `${chapter.number} · ${chapter.name}`;
    const entry = entries.find((e) => e.key === key);
    if (entry) return entry.title;
    const colon = key.indexOf(":");
    return colon > 0 && !key.startsWith("prod:") ? key.slice(colon + 1) : key.endsWith(".json") ? key : "Removed chapter";
  };

  const doPush = (chapterKeys: string[], entityKeys: string[]) =>
    run("upload", async () => {
      setLastResult(
        await api.upload(slug!, {
          overwriteChapters: chapterKeys.filter((k) => k.endsWith(".json")),
          updateEntities: entityKeys,
          reviewToken: status?.reviewToken,
        }),
      );
    });

  const doPull = (chapterKeys: string[], entityKeys: string[]) =>
    run("pull", async () => {
      setLastResult(undefined);
      await api.pull(slug!, { chapters: chapterKeys, entities: entityKeys, reviewToken: status?.reviewToken });
    });

  return (
    <div className="roza-staging-room" dir="ltr">
      <TopBar tab={tab} onTab={setTab} connection={connection} />
      {tab === "books" && editing && slug ? (
        <StagingEditor
          slug={slug}
          file={editing}
          changedFiles={new Set(entries.filter((e) => e.kind === "chapter" && e.file).map((e) => e.file!))}
          onOpen={setEditing}
          onClose={() => closeEditor()}
          onReview={() => closeEditor(() => review(editing))}
        />
      ) : tab === "books" ? (
        <div className="workspace">
          <BookList
            books={books}
            prefs={listPrefs}
            onPrefsChange={changeListPrefs}
            selected={slug}
            onSelect={setSlug}
            onRefresh={refreshBooks}
            onImport={importFolder}
            importing={importing}
          />
          <main className={`main ${bookTab === "changes" ? "review-mode" : ""}`}>
            {book && slug ? (
              <BookView
                book={book}
                status={status}
                entries={entries}
                busy={busy}
                lastResult={lastResult}
                tab={bookTab}
                onTab={setBookTab}
                onCompare={() => slug && compare(slug)}
                onPull={() => open("pull")}
                onPush={() => open("push")}
                onPreview={setPreview}
                onReview={review}
                onEdit={setEditing}
              >
                {bookTab === "changes" ? (
                  status ? (
                    <ReviewView
                      entries={entries}
                      selectedKey={reviewKey}
                      busy={busy !== ""}
                      onSelect={setReviewKey}
                      onAccept={accept}
                      onReject={doReject}
                      onEdit={setEditing}
                      onHistory={() => setBookTab("history")}
                    />
                  ) : (
                    <p className="muted">{busy ? "Comparing with Writing Studio…" : "Compare with Writing Studio to see the changes."}</p>
                  )
                ) : (
                  <HistoryView
                    slug={slug}
                    version={historyVersion}
                    keyName={keyName}
                    busy={busy !== ""}
                    onRestored={() => {
                      setHistoryVersion((v) => v + 1);
                      addLog("ok", "Restored Staging from a backup.");
                      compare(slug, true);
                    }}
                  />
                )}
              </BookView>
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
          Choose <strong>Import folder</strong> to bring existing projects into Staging Room.
        </p>
      )}
    </div>
  );
}
