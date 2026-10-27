import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReaderPassage } from "../../../../shared/types/readerChat";

export function ReaderChatQuote({ passage, sourceId, draft = false }: {
  passage: ReaderPassage; sourceId?: string; draft?: boolean;
}) {
  const { t } = useTranslation();
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
      <div className="reader-chat-quote-label">
        <span aria-hidden="true">❝</span>
        <span>{t(draft ? "reader.chat.quoteDraft" : "reader.chat.quoteSource")}</span>
      </div>
      <blockquote
        ref={content}
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
