import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LuHighlighter } from "react-icons/lu";
import { ReaderPassageMarks } from "./ReaderPassageMarks";
import { useTranslation } from "react-i18next";
import type { ReaderPassage } from "../../../../shared/types/readerChat";

export function ReaderChatQuote({ passage, sourceId, onReveal, draft = false, markingActive = true }: {
  passage: ReaderPassage; sourceId?: string; draft?: boolean; markingActive?: boolean;
  onReveal?: (passage: ReaderPassage) => void;
}) {
  const { t } = useTranslation();
  const marks = useContext(ReaderPassageMarks);
  const register = marks?.register;
  const { cfi, endCfi, text } = passage;
  const markingPassage = useMemo(() => ({ cfi, endCfi, text }), [cfi, endCfi, text]);
  useEffect(() => markingActive ? register?.(markingPassage) : undefined, [register, markingPassage, markingActive]);
  const marked = marks?.enabled(passage) ?? false;
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const content = useRef<HTMLQuoteElement>(null);
  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => {
      if (!expanded) setCanExpand(element.scrollHeight > element.clientHeight + 1);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [expanded, passage.text]);
  return (
    <div className="reader-chat-quote" data-reader-chat-source={sourceId} tabIndex={-1}>
      <div className="reader-chat-quote-heading">
      <button type="button" className="reader-chat-quote-label reader-chat-quote-reveal"
        disabled={!onReveal} onClick={() => onReveal?.(passage)}
        title={t("reader.chat.showInBook")}>
        <span aria-hidden="true">❝</span>
        <span>{t(draft ? "reader.chat.quoteDraft" : "reader.chat.quoteSource")}</span>
      </button>
      {marks && <button type="button" className="reader-passage-mark-toggle"
        aria-pressed={marked} aria-label={t(marked ? "reader.chat.hideMark" : "reader.chat.showMark")}
        title={t(marked ? "reader.chat.hideMark" : "reader.chat.showMark")}
        onClick={() => marks.toggle(passage)}><LuHighlighter aria-hidden="true" /></button>}
      </div>
      <blockquote
        ref={content}
        onClick={() => onReveal?.(passage)}
        dir="auto"
        className={"reader-chat-quote-text" + (expanded ? " is-expanded" : "")}
      >{passage.text}</blockquote>
      {canExpand && (
        <button type="button" className="reader-chat-quote-toggle" aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}>
          {t(expanded ? "reader.chat.quoteLess" : "reader.chat.quoteMore")}
        </button>
      )}
    </div>
  );
}
