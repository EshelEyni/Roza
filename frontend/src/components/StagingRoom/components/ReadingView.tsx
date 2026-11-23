import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FiArrowLeft, FiEdit2, FiSearch, FiTrash2 } from "react-icons/fi";
import type { ReadView } from "../../../../../shared/types/stagingRoom";
import { ManuscriptFind } from "../../WritingStudio/ManuscriptFind";
import { findTextMatches, type ManuscriptFindOptions, type TextMatch } from "../../WritingStudio/manuscriptFindText";
import "../../WritingStudio/writingStudio.css";
import { api, errorText } from "../api";

const REFRESH_MS = 4000;

type Paragraph = ReadView["paragraphs"][number];

/** Splits a paragraph's segments at match edges. New text stays green; matches are marked inside it. */
function renderParagraph(p: Paragraph, matches: TextMatch[], current: number, firstMatch: number) {
  let offset = 0;
  return p.segments.map((s, j) => {
    const start = offset;
    const end = (offset += s.text.length);
    const pieces: ReactNode[] = [];
    let at = start;
    matches.forEach((m, k) => {
      if (m.end <= start || m.start >= end) return;
      const from = Math.max(m.start, start);
      const to = Math.min(m.end, end);
      if (from > at) pieces.push(s.text.slice(at - start, from - start));
      const index = firstMatch + k;
      pieces.push(
        <mark key={from} className="ws-manuscript-match" data-ws-find-match={index} data-current={index === current}>
          {s.text.slice(from - start, to - start)}
        </mark>,
      );
      at = to;
    });
    if (at < end) pieces.push(s.text.slice(at - start));
    const text = pieces.length > 1 || typeof pieces[0] !== "string" ? pieces : s.text;
    return s.isNew ? <mark key={j}>{text}</mark> : <span key={j}>{text}</span>;
  });
}

/** Reads one change in full. New text is marked green. Removed text is not shown. */
export function ReadingView({
  slug,
  id,
  bookName,
  busy,
  onBack,
  onEdit,
  onApprove,
  onDiscard,
}: {
  slug: string;
  id: string;
  bookName: string;
  busy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onDiscard: () => void;
}) {
  const [view, setView] = useState<ReadView>();
  const [error, setError] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findOptions, setFindOptions] = useState<ManuscriptFindOptions>({ matchCase: false, wholeWord: false });
  const [findIndex, setFindIndex] = useState(0);
  const [findFocus, setFindFocus] = useState(0);
  const [findTop, setFindTop] = useState(84);
  const page = useRef<HTMLElement>(null);
  const head = useRef<HTMLElement>(null);

  // Reload now and then, so Claude's saves show while you read.
  useEffect(() => {
    let stop = false;
    const load = () =>
      api.readChange(slug, id).then(
        (v) => !stop && (setView(v), setError("")),
        (e) => !stop && setError(errorText(e)),
      );
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [slug, id]);

  const openFind = () => {
    const bottom = head.current?.getBoundingClientRect().bottom;
    if (bottom !== undefined) setFindTop(Math.max(8, Math.round(bottom) + 8));
    setFindOpen(true);
    setFindFocus((n) => n + 1);
  };

  // Ctrl+Alt+F, the same shortcut as Writing Studio.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.code !== "KeyF" || !event.ctrlKey || !event.altKey ||
          event.shiftKey || event.metaKey || event.getModifierState("AltGraph")) return;
      if (event.defaultPrevented || (event.target instanceof Element && event.target.closest("dialog[open]"))) return;
      event.preventDefault();
      if (!event.repeat) openFind();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const texts = useMemo(() => view?.paragraphs.map((p) => p.segments.map((s) => s.text).join("")) ?? [], [view]);
  const matches = useMemo(
    () => findTextMatches(texts, findOpen ? findQuery : "", findOptions),
    [texts, findOpen, findQuery, findOptions],
  );
  const currentMatch = Math.min(findIndex, matches.length - 1);
  const byParagraph = useMemo(() => {
    const groups = new Map<number, { first: number; list: TextMatch[] }>();
    matches.forEach((m, i) => {
      const group = groups.get(m.paragraph) ?? { first: i, list: [] };
      group.list.push(m);
      groups.set(m.paragraph, group);
    });
    return groups;
  }, [matches]);

  // Scroll to the current match when it changes, not on every reload.
  const currentKey = currentMatch < 0 ? "" : `${matches[currentMatch].paragraph}:${matches[currentMatch].start}`;
  useEffect(() => {
    if (currentMatch < 0) return;
    page.current
      ?.querySelector(`[data-ws-find-match="${currentMatch}"]`)
      ?.scrollIntoView({ block: "center", inline: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, findFocus]);

  const marks = view?.paragraphs.some((p) => p.segments.some((s) => s.isNew));

  return (
    <section className="sr-read" aria-labelledby="sr-read-title">
      <header ref={head} className="sr-read-head">
        <div className="sr-head-bar">
          <button className="sr-icon-btn sm sr-head-back" onClick={onBack} aria-label={`Back to ${bookName} changes`} title={`Back to ${bookName} · Changes`}>
            <FiArrowLeft aria-hidden="true" />
          </button>
          <div className="sr-read-actions">
            <button
              className="sr-icon-btn sm"
              onClick={openFind}
              aria-label="Find in text"
              title="Find in text (Ctrl+Alt+F)"
              aria-pressed={findOpen}
            >
              <FiSearch aria-hidden="true" />
            </button>
            {view?.editable && (
              <button className="sr-btn sr-btn-line sm sr-btn-shrink" onClick={onEdit} aria-label="Edit" title="Edit">
                <FiEdit2 aria-hidden="true" />
                <span className="sr-btn-label">Edit</span>
              </button>
            )}
            <button className="sr-btn sr-btn-quiet sm sr-btn-shrink" disabled={busy} onClick={onDiscard} aria-label="Discard" title="Discard">
              <FiTrash2 aria-hidden="true" />
              <span className="sr-btn-label">Discard</span>
            </button>
            <button className="sr-btn sr-btn-primary sm" disabled={busy} onClick={onApprove}>
              Approve
            </button>
          </div>
        </div>
        <h1 id="sr-read-title" className="sr-head-title" dir="auto" title={view?.title}>
          {view?.title ?? "…"}
        </h1>
        {view && (
          <p className="sr-head-meta sr-muted" dir="auto">
            {view.subtitle}
            {view.words ? ` · ${view.words.toLocaleString()} words` : ""}
          </p>
        )}
      </header>
      {error && (
        <p className="sr-callout danger" role="alert">
          {error}
        </p>
      )}
      <div className="sr-sheet">
      {marks && (
        <p className="sr-legend">
          <mark>green</mark> = new compared with Writing Studio
        </p>
      )}
      <article ref={page} className="sr-page" dir="auto">
        {view?.paragraphs.map((p, i) => {
          const found = byParagraph.get(i);
          return (
            <p key={i} dir="auto" style={p.align ? { textAlign: p.align as "left" } : undefined}>
              {found
                ? renderParagraph(p, found.list, currentMatch, found.first)
                : p.segments.map((s, j) =>
                    s.isNew ? <mark key={j}>{s.text}</mark> : <span key={j}>{s.text}</span>,
                  )}
              {!p.segments.some((s) => s.text) && <br />}
            </p>
          );
        })}
      </article>
      </div>
      {findOpen && (
        // The find bar uses Writing Studio's tokens and button styles from .ws.
        // It opens just below the reading header, so Approve and the search button stay visible.
        <div className="ws sr-find-host" style={{ "--sr-find-top": `${findTop}px` } as React.CSSProperties}>
          <ManuscriptFind
            query={findQuery}
            count={matches.length}
            current={currentMatch}
            focusRequest={findFocus}
            options={findOptions}
            onOptions={(options) => {
              setFindOptions(options);
              setFindIndex(0);
            }}
            onQuery={(query) => {
              setFindQuery(query);
              setFindIndex(0);
            }}
            onStep={(direction) => {
              if (matches.length) setFindIndex((currentMatch + direction + matches.length) % matches.length);
            }}
            onClose={() => setFindOpen(false)}
          />
        </div>
      )}
    </section>
  );
}
