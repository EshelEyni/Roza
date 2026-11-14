import { ItemMenu } from "../WritingStudio/ItemMenu";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FiMoreHorizontal,
  FiBookOpen,
  FiMapPin,
  FiChevronDown,
  FiChevronRight,
  FiCheck,
  FiTrash2,
  FiAlignLeft,
} from "react-icons/fi";
import { readerFlagContext } from "../../services/readerFlagContext";

export function ReaderReviewCard({
  text,
  vocabulary = false,
  location,
  date,
  status,
  passage = false,
  context,
  translation,
  reviewed,
  busy,
  onOpen,
  onReview,
  onRemove,
  onAskAi,
  aiDisabled,
}: {
  text: string;
  vocabulary?: boolean;
  location: string;
  date?: string;
  status: string;
  passage?: boolean;
  context?: string;
  translation?: ReactNode;
  reviewed: boolean;
  busy: boolean;
  onOpen?: () => void;
  onReview: () => void;
  onRemove: () => void;
  onAskAi?: () => void;
  aiDisabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const excerpt = context ? readerFlagContext(context, text) : null;
  return (
    <article
      className={
        "reader-review-card" +
        (passage ? " is-passage" : "") +
        (vocabulary ? " is-vocabulary" : "")
      }
    >
      <div className="reader-review-card-content">
        {vocabulary && (
          <div className="reader-vocabulary-menu">
            <ItemMenu>
              <summary role="button"
                className="reader-icon-button"
                aria-label={t("reader.review.vocabularyActions")}
                title={t("reader.review.vocabularyActions")}
              >
                <FiMoreHorizontal aria-hidden="true" />
              </summary>
              <div className="reader-book-menu-popover">
                <button onClick={onRemove} disabled={busy}>
                  <FiTrash2 aria-hidden="true" />
                  {t("reader.review.remove")}
                </button>
              </div>
            </ItemMenu>
          </div>
        )}
        {!vocabulary && (
          <header className="reader-review-card-meta">
            <span>
              <FiMapPin aria-hidden="true" />
              {location}
            </span>
            {date && (
              <time dateTime={date}>
                {t("reader.review.savedOn", {
                  date: new Date(date).toLocaleDateString(i18n.language, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }),
                })}
              </time>
            )}
          </header>
        )}
        <h2 className="reader-review-card-title" dir="auto">
          {text}
        </h2>
        <p className="reader-review-card-status">{status}</p>
        {translation}
        {excerpt && context !== text && (
          <details className="reader-review-card-context">
            <summary>
              <FiAlignLeft aria-hidden="true" />
              <span>{t("reader.review.readContext")}</span>
              <FiChevronDown aria-hidden="true" />
            </summary>
            <p dir="auto">
              {excerpt.before}
              <mark>{excerpt.marked}</mark>
              {excerpt.after}
            </p>
          </details>
        )}
        {onAskAi && (
          <button
            className="reader-button reader-review-card-ai"
            onClick={onAskAi}
            disabled={aiDisabled}
            title={aiDisabled ? t("reader.chat.selectionLimit") : undefined}
          >
            {t("reader.review.askAi")}
          </button>
        )}
      </div>
      <footer className="reader-review-actions">
        <button
          className="reader-button reader-review-card-open"
          onClick={onOpen}
          disabled={!onOpen}
        >
          {vocabulary ? (
            <FiBookOpen aria-hidden="true" />
          ) : (
            <FiChevronRight aria-hidden="true" />
          )}
          {t("reader.review.open")}
        </button>
        <button className="reader-button" onClick={onReview} disabled={busy}>
          <FiCheck aria-hidden="true" />
          {t(
            reviewed
              ? "reader.review.markPending"
              : "reader.review.markReviewed",
          )}
        </button>
        {!vocabulary && (
          <button
            className="reader-icon-button reader-review-card-remove"
            onClick={onRemove}
            disabled={busy}
            aria-label={t("reader.review.remove")}
            title={t("reader.review.remove")}
          >
            <FiTrash2 aria-hidden="true" />
          </button>
        )}
      </footer>
    </article>
  );
}
