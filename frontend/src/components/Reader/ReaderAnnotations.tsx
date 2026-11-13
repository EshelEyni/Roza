import { FiSearch, FiChevronDown } from "react-icons/fi";
import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { annotationColors } from "../../../../shared/types/readerAnnotations";
import type { EpubReaderController } from "../../hooks/reader/useEpubReader";

function previewText(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  const words = normalized.split(" ");
  const preview = words.slice(0, 40).join(" ");
  return preview + (preview.length < normalized.length ? "…" : "");
}

export function ReaderAnnotations({
  annotations: a,
  onNavigate,
  getPage,
  totalPages,
}: {
  annotations: EpubReaderController["annotations"];
  onNavigate: (cfi: string) => void;
  getPage: EpubReaderController["describeLocation"];
  totalPages: number;
}) {
  const { t } = useTranslation();
  const draft = a.draft;
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<[number, number | null]>([1, null]);
  const [pages, setPages] = useState<Record<string, { page: number; label: string }>>({});
  const [resolving, setResolving] = useState(false);
  const passages = JSON.stringify(a.items.map(item => [item.id, item.cfi]));
  useEffect(() => {
    let active = true;
    setPages({});
    setResolving(false);
    if (!totalPages) return;
    setResolving(true);
    const entries = JSON.parse(passages) as [string, string][];
    void Promise.all(entries.map(async ([id, cfi]) => {
      try { const page = await getPage(cfi); return page ? [id, page] as const : null; }
      catch { return null; }
    })).then(results => {
      if (active) setPages(Object.fromEntries(results.filter(result => result !== null)));
    }).finally(() => { if (active) setResolving(false); });
    return () => { active = false; };
  }, [passages, getPage, totalPages]);
  const first = Math.min(range[0], Math.max(1, totalPages));
  const last = Math.max(first, Math.min(range[1] ?? totalPages, Math.max(1, totalPages)));
  const term = search.trim().toLocaleLowerCase();
  const filtered = a.items.filter(item => {
    const matches = !term || item.text.toLocaleLowerCase().includes(term) || item.note.toLocaleLowerCase().includes(term);
    const page = pages[item.id]?.page;
    const allPages = !totalPages || (first === 1 && last === totalPages);
    return matches && (allPages || (page !== undefined && page >= first && page <= last));
  });
  return (
    <section className="reader-annotations" aria-busy={a.busy || a.loading}>
      {a.error && (
        <p role="alert">
          {t("reader.annotations." + a.error)}{" "}
          {a.error === "loadError" && (
            <button
              className="reader-button"
              onClick={a.retry}
              disabled={a.busy}
            >
              {t("reader.retry")}
            </button>
          )}
        </p>
      )}
      {a.loading && <p role="status">{t("reader.annotations.loading")}</p>}
      {draft ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void a.save(draft);
          }}
        >
          <blockquote dir="auto">{previewText(draft.text)}</blockquote>
          <p>{draft.chapter}</p>
          <fieldset disabled={a.busy}>
            <legend>{t("reader.annotations.color")}</legend>
            {annotationColors.map((color) => (
              <button
                type="button"
                key={color}
                className={
                  "reader-button reader-annotation-color color-" + color
                }
                aria-pressed={draft.color === color}
                onClick={() => a.setDraft({ ...draft, color })}
              >
                {t("reader.annotations." + color)}
              </button>
            ))}
          </fieldset>
          <label htmlFor="reader-annotation-note">
            {t("reader.annotations.note")}
          </label>
          <textarea
            id="reader-annotation-note"
            dir="auto"
            value={draft.note}
            maxLength={10000}
            disabled={a.busy}
            onChange={(event) =>
              a.setDraft({ ...draft, note: event.target.value })
            }
          />
          <div className="reader-annotation-actions">
            <button className="reader-button" disabled={a.busy || (!draft.id && draft.color === "none" && !draft.note.trim())} type="submit">
              {t("reader.annotations.save")}
            </button>
            <button
              className="reader-button"
              disabled={a.busy}
              type="button"
              onClick={() => a.setDraft(null)}
            >
              {t("reader.annotations.cancel")}
            </button>
            {draft.id && (
              <button
                className="reader-button"
                disabled={a.busy}
                type="button"
                onClick={() => void a.remove(draft.id!)}
              >
                {t("reader.annotations.remove")}
              </button>
            )}
          </div>
        </form>
      ) : (
        <>
          <div className="reader-annotation-filters">
            <h2>{t("reader.annotations.title")}</h2>
            <label className="reader-sr-only" htmlFor="reader-annotation-search">{t("reader.annotations.search")}</label>
            <div className="reader-search-form reader-annotation-search-field">
              <input id="reader-annotation-search" type="search" value={search}
                placeholder={t("reader.annotations.search")}
                onChange={event => setSearch(event.target.value)} />
              <FiSearch aria-hidden="true" />
            </div>
            <details className="reader-annotation-page-filter">
              <summary>{t("reader.annotations.pageRange")}<FiChevronDown aria-hidden="true" /></summary>
              <fieldset disabled={!totalPages || resolving}>
                <legend className="reader-sr-only">{t("reader.annotations.pageRange")}</legend>
              <div className="reader-annotation-range-labels"><span>{t("reader.annotations.page", { page: first })}</span><span>{t("reader.annotations.page", { page: last })} / {totalPages || "—"}</span></div>
              <div className="reader-annotation-range" style={{
                "--range-start": ((first - 1) / Math.max(1, totalPages - 1)) * 100 + "%",
                "--range-end": ((last - 1) / Math.max(1, totalPages - 1)) * 100 + "%",
              } as CSSProperties}>
                <input type="range" min={1} max={Math.max(1, totalPages)} step={1} value={first}
                  aria-label={t("reader.annotations.fromPage")} aria-valuetext={t("reader.annotations.page", {page:first})}
                  style={{ zIndex: first === totalPages ? 3 : 1 }}
                  onChange={event => setRange([Math.min(Number(event.target.value), last), range[1]])} />
                <input type="range" min={1} max={Math.max(1, totalPages)} step={1} value={last}
                  aria-label={t("reader.annotations.toPage")} aria-valuetext={t("reader.annotations.page", {page:last})}
                  onChange={event => setRange([first, Math.max(first, Number(event.target.value))])} />
              </div>
              </fieldset>
            </details>
            {(term || first !== 1 || (totalPages > 0 && last !== totalPages)) && <button className="reader-button" onClick={() => { setSearch(""); setRange([1, null]); }}>{t("reader.annotations.resetFilters")}</button>}
            {(!totalPages || resolving) && <small role="status">{t("reader.countingPages")}</small>}
          </div>
          {!a.loading && !filtered.length && (
            <p role="status">{t(a.items.length ? "reader.annotations.noMatches" : "reader.annotations.empty")}</p>
          )}
          <ol>
            {filtered.map((item) => (
              <li
                key={item.id}
                className={"reader-annotation-card" + (item.color === "none" ? "" : " color-" + item.color)}
              >
                <div className="reader-annotation-card-heading"><small>
                  {item.chapter}{item.color !== "none" && <> · {t("reader.annotations." + item.color)}</>}
                </small><small className="reader-annotation-page">{t("reader.annotations.page", { page: pages[item.id]?.label || "—" })}</small></div>
                <button
                  className="reader-annotation-passage"
                  onClick={() => onNavigate(item.cfi)}
                >
                  <blockquote dir="auto">{previewText(item.text)}</blockquote>
                </button>
                {item.note && <p dir="auto">{previewText(item.note)}</p>}
                <div className="reader-annotation-actions">
                  <button
                    className="reader-button"
                    disabled={a.busy}
                    onClick={() => a.setDraft(item)}
                  >
                    {t("reader.annotations.edit")}
                  </button>
                  <button
                    className="reader-button"
                    disabled={a.busy}
                    onClick={() => void a.remove(item.id)}
                  >
                    {t("reader.annotations.remove")}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
