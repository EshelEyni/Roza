import type { MouseEventHandler, TouchEventHandler } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GiBookCover } from "react-icons/gi";
import { ReaderBook } from "../../../../shared/types/reader";

export function ReaderBookPreview({ book, onMouseDown, onTouchStart }: {
  book: ReaderBook;
  onMouseDown?: MouseEventHandler<HTMLAnchorElement>;
  onTouchStart?: TouchEventHandler<HTMLAnchorElement>;
}) {
  const { t } = useTranslation();
  return (
    <Link className="reader-book-card" to={"/reader/" + book.id} draggable={false}
      onMouseDown={onMouseDown} onTouchStart={onTouchStart}>
      <div className="reader-book-cover">
        {book.cover ? (
          <img src={book.cover} alt="" loading="lazy" draggable={false} />
        ) : (
          <GiBookCover aria-hidden="true" />
        )}
        <span className="reader-book-badge">EPUB</span>
      </div>
      <div className="reader-book-info">
        <h2>{book.title}</h2>
        {book.pinned && <span className="reader-book-pinned">{t("reader.pinnedBook")}</span>}
        <p>{book.author || t("reader.unknownAuthor")}</p>
        <div className="reader-book-progress">
          <progress
            max={1}
            value={book.state.progress}
            aria-label={t("reader.progress")}
          />
          <span>
            {book.state.location
              ? t("reader.percentRead", {
                  percent: Math.round(book.state.progress * 100),
                })
              : t("reader.notStarted")}
          </span>
        </div>
        <span className="reader-book-open">
          {book.state.location
            ? t("reader.continueReading")
            : t("reader.startReading")}{" "}
          <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}
