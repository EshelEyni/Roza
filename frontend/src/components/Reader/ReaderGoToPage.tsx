import { useId, useState } from "react";
import { FiCornerDownRight } from "react-icons/fi";
import { ConfirmDialog } from "./ReaderArchiveDialog";
import type { EpubReaderController } from "../../hooks/reader/useEpubReader";

export function ReaderGoToPage({ navigation, onClose }: {
  navigation: EpubReaderController["pageNavigation"]; onClose: () => void;
}) {
  const [kind, setKind] = useState<"book" | "screen">(navigation.defaultKind);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const range = kind === "book" ? navigation.bookRange : navigation.total ? { min: 1, max: navigation.total } : null;
  const unavailable = !range;
  const clampPage = (input: string) => {
    if (!range || !input.trim()) return "";
    const number = Number(input);
    if (!Number.isFinite(number)) return "";
    return String(Math.max(range.min, Math.min(range.max, Math.trunc(number))));
  };
  const go = async () => {
    if (pending || unavailable || !value.trim()) return;
    const page = clampPage(value);
    setValue(page);
    if (!page) return;
    setPending(true); setError("");
    try { await navigation.go(page, kind); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not go to this page."); }
    finally { setPending(false); }
  };
  return <ConfirmDialog heading="Go to page" message="Choose a page numbering system and enter the page you want."
    confirmLabel="Go to page" icon={<FiCornerDownRight />} pending={pending}
    confirmDisabled={unavailable || !value.trim()} onCancel={onClose} onConfirm={() => void go()}>
    <div className="reader-go-to-page">
      <div className="reader-page-kind" role="group" aria-label="Page numbering">
        {(["book", "screen"] as const).map(option => <button key={option} type="button" className="reader-button"
          aria-pressed={kind === option} disabled={pending} onClick={() => { setKind(option); setValue(""); setError(""); }}>
          {option === "book" ? "Book page" : "Screen page"}
        </button>)}
      </div>
      <label htmlFor={id}>{kind === "book" ? "Book-page number" : "Screen-page number"}</label>
      <input id={id} type="number" min={range?.min} max={range?.max} step={1}
        aria-describedby={id + "-range"} value={value} disabled={pending || unavailable} onChange={event => { setValue(event.target.value); setError(""); }}
        onBlur={event => setValue(clampPage(event.target.value))}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void go(); } }} />
      <p id={id + "-range"} role="status">{kind === "screen" ? (navigation.total ? "1–" + navigation.total + " screen pages" : "Counting screen pages…") :
        navigation.bookPagesAvailable === null ? "Loading book pages…" : range ? range.min + "–" + range.max + " book pages" : "This book has no numbered book pages. Use screen page instead."}</p>
      {error && <p role="alert">{error}</p>}
    </div>
  </ConfirmDialog>;
}
