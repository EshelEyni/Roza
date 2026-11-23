import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StagedBookSummary, StagedBookView, StagingPrefs } from "../../../../shared/types/stagingRoom";
import { api, errorText } from "./api";
import { importProjects } from "./importProjects";
import "./staging-room.scss";
import { BookList } from "./components/BookList";
import { BookTabs } from "./components/BookTabs";
import { BrowseView } from "./components/BrowseView";
import { ChangesView } from "./components/ChangesView";
import { ReadingView } from "./components/ReadingView";
import { StagingEditor } from "./components/StagingEditor";
import { SidebarIcon } from "./components/SidebarIcon";
import { useConfirmation } from "../Modals/useConfirmation";

/*
 * Staging Room v2 (docs/staging-room-prd.md): Claude's changes wait here as a list.
 * Read them, edit them, then approve or discard. Nothing reaches the live book before you approve.
 */

type Screen = { kind: "changes" } | { kind: "browse" } | { kind: "read"; id: string } | { kind: "edit"; id: string };
type Notice = { tone: "ok" | "danger"; text: string; lines?: string[] };
type Confirm = { ids: string[]; titles: string[] };

const REFRESH_MS = 5000;
const DEFAULT_PREFS: StagingPrefs = { order: [], pinned: [], filter: "pinned" };
const BOOKS_CLOSED_KEY = "roza.stagingRoom.booksClosed";

function readBooksClosed() {
  try {
    return window.localStorage.getItem(BOOKS_CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function StagingRoomWorkspace() {
  const { t } = useTranslation();
  const [books, setBooks] = useState<StagedBookSummary[]>([]);
  const [prefs, setPrefs] = useState<StagingPrefs>(DEFAULT_PREFS);
  const [selected, setSelected] = useState<string>();
  const [book, setBook] = useState<StagedBookView>();
  const [screen, setScreen] = useState<Screen>({ kind: "changes" });
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const [confirm, setConfirm] = useState<Confirm>();
  const [booksClosed, setBooksClosed] = useState(readBooksClosed);
  const { confirm: ask, confirmationDialog } = useConfirmation();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const loadBooks = useCallback(async () => {
    try {
      const [list, p] = await Promise.all([api.listBooks(), api.getPrefs()]);
      setBooks(list);
      setPrefs(p);
      return list;
    } catch (e) {
      setNotice({ tone: "danger", text: errorText(e) });
      return [];
    }
  }, []);

  const loadBook = useCallback(async (slug: string) => {
    try {
      const view = await api.getBook(slug);
      if (selectedRef.current === slug) setBook(view);
    } catch (e) {
      setNotice({ tone: "danger", text: errorText(e) });
    }
  }, []);

  useEffect(() => {
    loadBooks().then((list) => {
      // Desktop opens the first book with waiting changes; the phone starts on the list.
      if (window.matchMedia("(min-width: 900px)").matches) {
        const first = list.find((b) => b.pending > 0) ?? list[0];
        if (first) setSelected(first.slug);
      }
    });
  }, [loadBooks]);

  useEffect(() => {
    setBook(undefined);
    setScreen({ kind: "changes" });
    if (selected) loadBook(selected);
  }, [selected, loadBook]);

  // Claude may add changes at any time: keep the list fresh while the Changes screen is open.
  useEffect(() => {
    if (!selected || screen.kind !== "changes") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadBook(selected);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [selected, screen.kind, loadBook]);

  const afterChange = async (slug: string) => {
    await Promise.all([loadBook(slug), loadBooks()]);
  };

  const approve = async (ids: string[], force = false) => {
    if (!selected) return;
    setBusy(true);
    setConfirm(undefined);
    try {
      const result = await api.approve(selected, ids, force);
      if (result.conflicts?.length) {
        setConfirm({ ids, titles: result.conflicts.map((c) => c.title) });
        return;
      }
      setNotice({ tone: "ok", text: `Approved ${result.approved} change${result.approved === 1 ? "" : "s"}. They are in Writing Studio now.`, lines: result.messages });
      setScreen({ kind: "changes" });
      await afterChange(selected);
    } catch (e) {
      setNotice({ tone: "danger", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const discard = async (ids: string[]) => {
    if (!selected) return;
    const one = ids.length === 1 ? book?.changes.find((c) => c.id === ids[0]) : undefined;
    const ok = await ask({
      title: ids.length === 1 ? "Discard this change?" : `Discard ${ids.length} changes?`,
      message:
        ids.length === 1
          ? `${one ? `“${one.title}”` : "This change"} is removed from Staging. Writing Studio is not changed.`
          : "These changes are removed from Staging. Writing Studio is not changed.",
      confirmLabel: "Discard",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.discard(selected, ids);
      setNotice({ tone: "ok", text: `Discarded ${ids.length} change${ids.length === 1 ? "" : "s"}.` });
      setScreen({ kind: "changes" });
      await afterChange(selected);
    } catch (e) {
      setNotice({ tone: "danger", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const savePrefs = async (next: Partial<StagingPrefs>) => {
    setPrefs((p) => ({ ...p, ...next }));
    try {
      setPrefs(await api.setPrefs(next));
      setBooks(await api.listBooks());
    } catch (e) {
      setNotice({ tone: "danger", text: errorText(e) });
    }
  };

  const onImport = async (files: File[]) => {
    setImporting(true);
    try {
      const r = await importProjects(files);
      setNotice({
        tone: r.failures.length ? "danger" : "ok",
        text: `Imported ${r.created} book(s)${r.existing ? `, ${r.existing} already in Staging` : ""}. Differences from Writing Studio are waiting as changes.`,
        lines: r.failures,
      });
      await loadBooks();
    } catch (e) {
      setNotice({ tone: "danger", text: errorText(e) });
    } finally {
      setImporting(false);
    }
  };

  const toggleBooks = () => {
    setBooksClosed((closed) => {
      try {
        window.localStorage.setItem(BOOKS_CLOSED_KEY, closed ? "0" : "1");
      } catch {
        /* the choice is kept for this visit only */
      }
      return !closed;
    });
  };

  const tabs = book && (
    <BookTabs tab={screen.kind === "browse" ? "browse" : "changes"} waiting={book.changes.length} onChange={(tab) => setScreen({ kind: tab })} />
  );

  const closeEditor = () => {
    setScreen({ kind: "changes" });
    if (selected) loadBook(selected);
  };

  if (screen.kind === "edit" && selected)
    return (
      <div className="roza-staging-room sr-editing">
        <StagingEditor slug={selected} id={screen.id} busy={busy} onClose={closeEditor} onApprove={() => approve([screen.id])} />
        {confirm && <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(undefined)} onConfirm={() => approve(confirm.ids, true)} />}
        {confirmationDialog}
      </div>
    );

  return (
    <div className={`roza-staging-room ${selected ? "has-book" : ""} ${booksClosed ? "books-closed" : ""}`}>
      <header className="sr-topbar">
        <img src="/images/icon-512X512.png" alt="" />
        <span className="sr-brand">Roza</span>
        <span className="sr-brand-sub" dir="auto">
          {t("stagingRoom.title")}
        </span>
        <span className="sr-topbar-note">Nothing here is live until you approve it</span>
      </header>
      {notice && (
        <div className={`sr-notice ${notice.tone}`} role={notice.tone === "danger" ? "alert" : "status"}>
          <div>
            <strong>{notice.text}</strong>
            {notice.lines && notice.lines.length > 0 && (
              <ul>
                {notice.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
          </div>
          <button className="sr-btn sr-btn-quiet sm" onClick={() => setNotice(undefined)} aria-label="Close message">
            ✕
          </button>
        </div>
      )}
      <div className="sr-workspace">
        {booksClosed && (
          <aside className="sr-books-rail" aria-label="Staged books">
            <button className="sr-icon-btn" onClick={toggleBooks} aria-label="Open books sidebar" title="Open books sidebar">
              <SidebarIcon open={false} />
            </button>
            <span className="sr-eyebrow sr-rail-label" aria-hidden="true">
              Books
            </span>
          </aside>
        )}
        <BookList
          onClose={toggleBooks}
          books={books}
          prefs={prefs}
          selected={selected}
          importing={importing}
          onSelect={setSelected}
          onImport={onImport}
          onPrefs={savePrefs}
          onStaged={async (slug) => {
            await loadBooks();
            setSelected(slug);
          }}
        />
        <main className="sr-main">
          {!selected ? (
            <div className="sr-empty sr-desktop-only">
              <p>Choose a book to see Claude’s waiting changes.</p>
            </div>
          ) : !book ? (
            <p className="sr-muted sr-pad">Loading…</p>
          ) : screen.kind === "read" ? (
            <ReadingView
              slug={selected}
              id={screen.id}
              bookName={book.bookName}
              busy={busy}
              onBack={() => setScreen({ kind: "changes" })}
              onEdit={() => setScreen({ kind: "edit", id: screen.id })}
              onApprove={() => approve([screen.id])}
              onDiscard={() => discard([screen.id])}
            />
          ) : screen.kind === "browse" ? (
            <BrowseView
              slug={selected}
              onShowChanges={() => setScreen({ kind: "changes" })}
              header={
                <>
                  <button className="sr-back sr-mobile-only" onClick={() => setSelected(undefined)}>
                    ← Books
                  </button>
                  <h1 id="sr-book-title" className="sr-title" dir="auto">
                    {book.bookName}
                  </h1>
                  {tabs}
                </>
              }
            />
          ) : (
            <ChangesView
              tabs={tabs}
              book={book}
              busy={busy}
              onBack={() => setSelected(undefined)}
              onRead={(id) => setScreen({ kind: "read", id })}
              onEdit={(id) => setScreen({ kind: "edit", id })}
              onApprove={approve}
              onDiscard={discard}
            />
          )}
        </main>
      </div>
      {confirm && <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(undefined)} onConfirm={() => approve(confirm.ids, true)} />}
      {confirmationDialog}
    </div>
  );
}

function ConfirmDialog({ confirm, onCancel, onConfirm }: { confirm: Confirm; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="sr-overlay" onClick={onCancel}>
      <div className="sr-modal" role="alertdialog" aria-modal="true" aria-labelledby="sr-confirm-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="sr-confirm-title">Changed in Writing Studio</h2>
        <p>These were changed in Writing Studio after Claude read them. Approving replaces your version:</p>
        <ul>
          {confirm.titles.map((title) => (
            <li key={title} dir="auto">
              {title}
            </li>
          ))}
        </ul>
        <div className="sr-modal-actions">
          <button className="sr-btn sr-btn-quiet" onClick={onCancel}>
            Cancel
          </button>
          <button className="sr-btn sr-btn-primary" onClick={onConfirm}>
            Approve anyway
          </button>
        </div>
      </div>
    </div>
  );
}
