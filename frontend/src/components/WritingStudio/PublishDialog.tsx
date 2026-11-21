import { ChangeEvent, FormEvent, useEffect, useId, useRef, useState } from "react";
import type {
  Book,
  BookLanguage,
  BookPublishing,
  BookPublishingRequest,
} from "../../../../shared/types/books";
import readerApiService from "../../services/readerApiService";
import { ReaderSelect } from "../Reader/ReaderSelect";
import { plainText, words } from "./manuscript";
import "../Modals/confirmDialog.css";

const maxCoverWidth = 1200;
const maxCoverHeight = 1800;
const maxCoverBytes = 1.9 * 1024 * 1024;

function detectLanguage(book: Book): BookLanguage {
  const sample = book.chapters
    .filter(chapter => !chapter.isArchived)
    .map(chapter => chapter.name + " " + plainText(chapter.text))
    .join(" ");
  const hebrew = (sample.match(/[֐-׿]/g) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  return hebrew > latin ? "he" : "en";
}

/** The chapters to tick when the dialog opens. */
function initialChapters(book: Book, chapters: Book["chapters"]) {
  const saved = book.publishing;
  if (!saved) return chapters.filter(chapter => words(chapter.text) > 0).map(chapter => chapter.id);
  const publishedAt = saved.publishedAt ? new Date(saved.publishedAt).getTime() : 0;
  // Keep the last choice, and include chapters written since the last save.
  return chapters
    .filter(
      chapter =>
        saved.chapterIds.includes(chapter.id) ||
        (new Date(String(chapter.createdAt)).getTime() > publishedAt && words(chapter.text) > 0),
    )
    .map(chapter => chapter.id);
}

/** Scales a picked image down and stores it as JPEG, so the cover stays small. */
async function readCover(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type))
    throw new Error("Choose a PNG, JPEG or WebP image.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, maxCoverWidth / image.naturalWidth, maxCoverHeight / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot prepare the image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.78, 0.66, 0.5]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if ((data.length - 23) * 0.75 <= maxCoverBytes) return data;
    }
    throw new Error("This image is too large. Choose a smaller one.");
  } catch (error) {
    if (error instanceof Error && /image|browser/i.test(error.message)) throw error;
    throw new Error("This image could not be read.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function formatDate(value?: string) {
  return value
    ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "";
}

export function PublishDialog({
  book,
  author,
  prepare,
  onPublished,
  onOpenReader,
  onClose,
}: {
  book: Book;
  author: string;
  /** Saves pending edits. Resolves false when the manuscript could not be saved. */
  prepare: () => Promise<boolean>;
  onPublished: (publishing: BookPublishing) => void;
  onOpenReader: (readerBookId: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useId();
  const languageLabel = useId();
  const chapters = book.chapters.filter(chapter => !chapter.isArchived);
  const saved = book.publishing;
  const [title, setTitle] = useState(saved?.title || book.name);
  const [authorName, setAuthorName] = useState(saved?.author ?? author);
  const [language, setLanguage] = useState<BookLanguage>(saved?.language || detectLanguage(book));
  const [includeTitlePage, setIncludeTitlePage] = useState(saved?.includeTitlePage ?? true);
  const [includeToc, setIncludeToc] = useState(saved?.includeToc ?? true);
  const [chapterIds, setChapterIds] = useState(() => initialChapters(book, chapters));
  const [cover, setCover] = useState(saved?.cover || "");
  const [busy, setBusy] = useState<"" | "save" | "download">("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [publishing, setPublishing] = useState(saved);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  const outdated =
    !!publishing?.sourceUpdatedAt &&
    new Date(book.updatedAt).getTime() > new Date(publishing.sourceUpdatedAt).getTime();
  const includedWords = chapters
    .filter(chapter => chapterIds.includes(chapter.id))
    .reduce((total, chapter) => total + words(chapter.text), 0);
  const request = (): BookPublishingRequest => ({
    title: title.trim(),
    author: authorName.trim(),
    language,
    includeTitlePage,
    includeToc,
    chapterIds,
    cover,
  });
  const invalid = !title.trim()
    ? "Enter a title."
    : !chapterIds.length
      ? "Choose at least one chapter."
      : "";

  async function run(kind: "save" | "download") {
    if (invalid) return setError(invalid);
    setBusy(kind);
    setError("");
    setStatus("");
    try {
      if (!(await prepare()))
        throw new Error("Your latest edits are not saved yet. Save the manuscript, then try again.");
      if (kind === "download") {
        const blob = await readerApiService.downloadStudioEpub(book.id, request());
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = (title.trim().replace(/[\\/:*?"<>|]/g, "") || "book") + ".epub";
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        setStatus("EPUB downloaded.");
      } else {
        const result = await readerApiService.publishStudioBook(book.id, request());
        setPublishing({ ...result, cover });
        onPublished({ ...result, cover });
        setStatus(publishing?.readerBookId ? "EPUB updated in the Reading Room." : "EPUB saved to the Reading Room.");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function pickCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      setCover(await readCover(file));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This image could not be read.");
    }
  }

  function toggleChapter(id: string, checked: boolean) {
    setChapterIds(current =>
      checked ? chapters.map(chapter => chapter.id).filter(entry => entry === id || current.includes(entry)) : current.filter(entry => entry !== id),
    );
  }

  return (
    <dialog
      ref={dialog}
      className="app-confirm-dialog ws-publish-dialog"
      aria-labelledby={heading}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onKeyDown={event => event.stopPropagation()}
    >
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void run("save");
        }}
      >
        <header className="ws-publish-head">
          <div>
            <h2 id={heading}>Publish EPUB</h2>
            {publishing?.readerBookId ? (
              <p className={outdated ? "ws-publish-state is-outdated" : "ws-publish-state"}>
                Saved {formatDate(publishing.publishedAt)}
                {outdated ? " · the manuscript changed since" : " · up to date"}
              </p>
            ) : (
              <p className="ws-publish-state">Not published yet</p>
            )}
          </div>
          <button type="button" disabled={!!busy} onClick={onClose}>
            Close
          </button>
        </header>

        <div className="ws-publish-body">
          <section className="ws-publish-meta" aria-label="Book details">
            <div className="ws-publish-fields">
              <label>
                Title
                <input dir="auto" required maxLength={300} value={title} onChange={event => setTitle(event.target.value)} />
              </label>
              <label>
                Author
                <input dir="auto" maxLength={300} value={authorName} onChange={event => setAuthorName(event.target.value)} />
              </label>
              <div className="ws-publish-field">
                <span id={languageLabel}>Language</span>
                <ReaderSelect
                  id="ws-publish-language"
                  labelId={languageLabel}
                  value={language}
                  options={[
                    { value: "he", label: "Hebrew · right to left" },
                    { value: "en", label: "English · left to right" },
                  ]}
                  onChange={setLanguage}
                />
              </div>
            </div>
            <div className="ws-publish-cover">
              {cover ? (
                <img src={cover} alt="Cover preview" />
              ) : (
                <div className="ws-publish-cover-empty" dir="auto">
                  <span>{title.trim() || book.name}</span>
                  <small>No cover</small>
                </div>
              )}
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => void pickCover(event)} />
              <div className="ws-publish-cover-actions">
                <button type="button" onClick={() => fileInput.current?.click()}>
                  {cover ? "Change cover" : "Add cover"}
                </button>
                {cover && (
                  <button type="button" onClick={() => setCover("")}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </section>

          <fieldset className="ws-publish-chapters">
            <legend>
              Chapters
              <span>
                {chapterIds.length} of {chapters.length} · {includedWords.toLocaleString()} words
              </span>
            </legend>
            <ul>
              {chapters.map((chapter, index) => {
                const count = words(chapter.text);
                return (
                  <li key={chapter.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={chapterIds.includes(chapter.id)}
                        onChange={event => toggleChapter(chapter.id, event.target.checked)}
                      />
                      <span className="ws-publish-chapter-name" dir="auto">
                        {index + 1}. {chapter.name.trim() || "Untitled"}
                        {chapter.format === "screenplay" && <small className="ws-publish-tag">Screenplay</small>}
                      </span>
                      <span className="ws-publish-words">{count ? count.toLocaleString() : "Empty"}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <fieldset className="ws-publish-options">
            <legend>Include</legend>
            <label>
              <input type="checkbox" checked={includeTitlePage} onChange={event => setIncludeTitlePage(event.target.checked)} />
              Title page
            </label>
            <label>
              <input type="checkbox" checked={includeToc} onChange={event => setIncludeToc(event.target.checked)} />
              Table of contents
            </label>
          </fieldset>
        </div>

        <div className="ws-publish-messages" aria-live="polite">
          {error && <p role="alert" className="ws-publish-error">{error}</p>}
          {status && <p className="ws-publish-status">{status}</p>}
        </div>

        <footer className="ws-publish-actions">
          {publishing?.readerBookId && (
            <button type="button" className="ws-publish-open" disabled={!!busy} onClick={() => onOpenReader(publishing.readerBookId!)}>
              Open in Reading Room
            </button>
          )}
          <span className="ws-publish-spacer" />
          <button type="button" disabled={!!busy} onClick={() => void run("download")}>
            {busy === "download" ? "Building…" : "Download .epub"}
          </button>
          <button type="submit" className="app-confirm-action" disabled={!!busy}>
            {busy === "save" ? "Saving…" : publishing?.readerBookId ? "Update EPUB" : "Save EPUB"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
