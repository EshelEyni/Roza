import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GiBookCover } from "react-icons/gi";
import { ReaderBook } from "../../../../shared/types/reader";

export function ReaderBookPreview({ book }: { book: ReaderBook }) {
  const { t } = useTranslation();
  return (
    <Link className="reader-book-card" to={"/reader/" + book.id}>
      <div className="reader-book-cover">
        {book.cover ? (
          <img src={book.cover} alt="" loading="lazy" />
        ) : (
          <GiBookCover aria-hidden="true" />
        )}
        <span className="reader-book-badge">EPUB</span>
      </div>
      <div className="reader-book-info">
        <h2>{book.title}</h2>
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
