import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiEdit2, FiFileText, FiPlus, FiTrash2 } from "react-icons/fi";
import type { ReaderDocument, ReaderDocumentSummary } from "../../../../shared/types/readerDocuments";
import api from "../../services/readerDocumentsApiService";
import { ConfirmDialog } from "./ReaderArchiveDialog";
import { ReaderDocumentEditor } from "./ReaderDocumentEditor";

type Management = { kind: "rename" | "delete"; document: ReaderDocumentSummary } | null;

const byRecent = (items: ReaderDocumentSummary[]) =>
  [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

/** Book-level long-form writing, independent of passage annotations. */
export function ReaderDocuments({ bookId, userId }: { bookId: string; userId: string }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ReaderDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<ReaderDocument | null>(null);
  const [management, setManagement] = useState<Management>(null);
  const [title, setTitle] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setOpen(null);
    api.list(bookId)
      .then(data => {
        if (!Array.isArray(data)) throw new Error("Invalid documents response");
        if (active) setItems(byRecent(data));
      })
      .catch(() => { if (active) setError("loadError"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookId, userId, attempt]);

  const patchItem = useCallback((id: string, change: Partial<ReaderDocumentSummary>) => {
    setItems(current => byRecent(current.map(item => item.id === id ? { ...item, ...change } : item)));
    setOpen(current => current?.id === id ? { ...current, ...change } : current);
  }, []);

  async function run<T>(action: () => Promise<T>, failure: string) {
    setBusy(true);
    setError("");
    try { return await action(); }
    catch { setError(failure); return undefined; }
    finally { setBusy(false); }
  }

  async function create() {
    const created = await run(() => api.create(bookId, t("reader.documents.untitled")), "createError");
    if (!created) return;
    setItems(current => byRecent([created, ...current]));
    setOpen(created);
  }

  async function openDocument(id: string) {
    const document = await run(() => api.get(bookId, id), "openError");
    if (document) setOpen(document);
  }

  async function rename(id: string, next: string) {
    const saved = await run(() => api.update(bookId, id, { title: next }), "renameError");
    if (saved) patchItem(id, { title: saved.title, updatedAt: saved.updatedAt });
    return !!saved;
  }

  async function confirmManagement() {
    if (!management) return;
    const { kind, document } = management;
    if (kind === "rename") {
      if (await rename(document.id, title.trim())) setManagement(null);
      return;
    }
    const removed = await run(() => api.remove(bookId, document.id).then(() => true), "deleteError");
    if (!removed) return;
    setItems(current => current.filter(item => item.id !== document.id));
    setManagement(null);
  }

  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section className="reader-documents" aria-busy={loading || busy}>
      {error && (
        <p role="alert" className="reader-documents-error">
          {t("reader.documents." + error)}{" "}
          {error === "loadError" && <button className="reader-button" onClick={() => setAttempt(value => value + 1)}>{t("reader.retry")}</button>}
        </p>
      )}
      {open ? (
        <ReaderDocumentEditor key={open.id} bookId={bookId} document={open}
          onBack={() => setOpen(null)}
          onRename={next => rename(open.id, next)}
          onSaved={(preview, updatedAt) => patchItem(open.id, { preview, updatedAt })} />
      ) : (
        <>
          <header className="reader-documents-heading">
            <div>
              <h2>{t("reader.documents.title")}</h2>
              <p>{t("reader.documents.subtitle")}</p>
            </div>
            <button type="button" className="reader-button" disabled={busy || loading} onClick={() => void create()}>
              <FiPlus aria-hidden="true" />{t("reader.documents.new")}
            </button>
          </header>
          {loading && <p role="status">{t("reader.documents.loading")}</p>}
          {!loading && !error && !items.length && (
            <div className="reader-documents-empty">
              <FiFileText aria-hidden="true" />
              <p>{t("reader.documents.empty")}</p>
            </div>
          )}
          <ol>
            {items.map(item => (
              <li key={item.id} className="reader-annotation-card reader-document-card">
                <button type="button" className="reader-annotation-passage" disabled={busy}
                  onClick={() => void openDocument(item.id)}>
                  <strong dir="auto">{item.title}</strong>
                  {item.preview && <span dir="auto">{item.preview}</span>}
                </button>
                <div className="reader-annotation-actions">
                  <small>{t("reader.documents.edited", { date: date.format(new Date(item.updatedAt)) })}</small>
                  <button type="button" className="reader-icon-button" disabled={busy}
                    aria-label={t("reader.documents.renameTitle", { title: item.title })} title={t("reader.documents.rename")}
                    onClick={() => { setTitle(item.title); setManagement({ kind: "rename", document: item }); }}>
                    <FiEdit2 aria-hidden="true" />
                  </button>
                  <button type="button" className="reader-icon-button reader-annotation-remove" disabled={busy}
                    aria-label={t("reader.documents.deleteTitle", { title: item.title })} title={t("reader.documents.delete")}
                    onClick={() => setManagement({ kind: "delete", document: item })}>
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {management && (
        <ConfirmDialog
          heading={t(management.kind === "rename" ? "reader.documents.rename" : "reader.documents.delete")}
          message={management.kind === "delete" ? t("reader.documents.confirmDelete", { title: management.document.title }) : ""}
          confirmLabel={t(busy ? "reader.bookSaving" : management.kind === "rename" ? "reader.documents.saveTitle" : "reader.documents.delete")}
          icon={management.kind === "rename" ? <FiEdit2 aria-hidden="true" /> : <FiTrash2 aria-hidden="true" />}
          pending={busy}
          confirmDisabled={management.kind === "rename" && !title.trim()}
          onCancel={() => setManagement(null)}
          onConfirm={() => void confirmManagement()}
        >
          {management.kind === "rename" && (
            <label className="reader-book-title-field">
              {t("reader.documents.titleLabel")}
              <input value={title} maxLength={200} disabled={busy} dir="auto"
                onChange={event => setTitle(event.target.value)}
                onKeyDown={event => { if (event.key === "Enter" && title.trim()) { event.preventDefault(); void confirmManagement(); } }} />
            </label>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
