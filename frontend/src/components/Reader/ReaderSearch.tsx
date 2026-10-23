import { FormEvent, useEffect, useRef, useState } from "react";
import type { Book } from "epubjs";
import { FiSearch, FiArrowRight } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useReaderSearch } from "../../hooks/useReaderSearch";

export function ReaderSearch({
  book,
  locationsReady,
  onNavigate,
}: {
  book: Book | null;
  locationsReady: boolean;
  onNavigate: (cfi: string) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const search = useReaderSearch(book);
  const { hasMore, searching, loadingMore, error, loadMore, results } = search;

  useEffect(() => {
    const root = list.current;
    const target = sentinel.current;
    if (!root || !target || !hasMore || searching || loadingMore || error)
      return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) void loadMore();
      },
      { root, rootMargin: "0px 0px 120px 0px", threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, searching, loadingMore, error, loadMore, results.length]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    list.current?.scrollTo({ top: 0 });
    setSelected("");
    void search.search(input);
  }

  return (
    <section className="reader-search" aria-label={t("reader.search")}>
      <div className="reader-search-heading">
        <h2>{t("reader.search")}</h2>
        <form onSubmit={onSubmit} className="reader-search-form">
          <label className="reader-sr-only" htmlFor="reader-search-input">
            {t("reader.searchPlaceholder")}
          </label>
          <input
            id="reader-search-input"
            type="search"
            value={input}
            onChange={event => {
              setInput(event.target.value);
              if (!event.target.value) void search.search("");
            }}
            placeholder={t("reader.searchPlaceholder")}
            maxLength={200}
            autoFocus
            autoComplete="off"
            disabled={!book}
          />
          <button
            type="submit"
            className="reader-icon-button"
            aria-label={t("reader.submitSearch")}
            disabled={!book || !input.trim()}
          >
            <FiSearch />
          </button>
        </form>
        <p className="reader-search-count" role="status" aria-live="polite">
          {search.searching
            ? t("reader.searching", { count: search.total })
            : search.hasSearched
              ? t("reader.searchResultCount", { count: search.total })
              : t("reader.searchHint")}
        </p>
      </div>
      <div
        className="reader-search-results"
        ref={list}
        aria-busy={searching || search.loadingMore}
      >
        {!search.searching &&
          search.hasSearched &&
          !search.error &&
          !search.total && (
            <p className="reader-search-empty">
              {t("reader.noSearchResults", { query: search.query })}
            </p>
          )}
        {search.results.map((result, index) => {
          const page = book?.pageList.pageFromCfi(result.cfi) ?? -1;
          const location =
            locationsReady && book
              ? Number(book.locations.locationFromCfi(result.cfi)) + 1
              : 0;
          return (
            <button
              key={result.cfi}
              className={
                "reader-search-result " +
                (selected === result.cfi ? "is-active" : "")
              }
              onClick={() => {
                setSelected(result.cfi);
                onNavigate(result.cfi);
              }}
            >
              <span className="reader-search-result-location">
                {page > 0
                  ? t("reader.pageNumber", { number: page })
                  : location > 0
                    ? t("reader.locationNumber", { number: location })
                    : t("reader.matchNumber", { number: index + 1 })}
                <FiArrowRight aria-hidden="true" />
              </span>
              {result.sectionTitle && (
                <span className="reader-search-result-chapter">
                  {result.sectionTitle}
                </span>
              )}
              <span className="reader-search-excerpt" dir="auto">
                {result.before}
                <mark>{result.match}</mark>
                {result.after}
              </span>
            </button>
          );
        })}
        {search.loadingMore && (
          <p className="reader-search-empty" role="status">
            {t("reader.loadingMore")}
          </p>
        )}
        {search.error && (
          <div className="reader-search-empty" role="alert">
            <p>{t("reader.searchError")}</p>
            <button
              className="reader-button"
              onClick={() =>
                void (search.results.length
                  ? search.loadMore()
                  : search.search(input))
              }
            >
              {t("reader.retry")}
            </button>
          </div>
        )}
        {search.hasMore && !search.searching && !search.error && (
          <div
            ref={sentinel}
            className="reader-search-sentinel"
            aria-hidden="true"
          />
        )}
      </div>
    </section>
  );
}
