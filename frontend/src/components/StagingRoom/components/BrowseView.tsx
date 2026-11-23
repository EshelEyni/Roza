import { useEffect, useMemo, useState } from "react";
import type { BrowseOutline, BrowseText, EntityKind } from "../../../../../shared/types/stagingRoom";
import { ReaderSelect } from "../../Reader/ReaderSelect";
import { api, errorText } from "../api";

type Section = "chapters" | EntityKind;
const SECTIONS: { value: Section; label: string }[] = [
  { value: "chapters", label: "Chapters" },
  { value: "characters", label: "Characters" },
  { value: "plotlines", label: "Plotlines" },
  { value: "themes", label: "Themes" },
  { value: "notes", label: "Notes" },
];

type Item = { key: string; name: string; meta: string; waiting: number };
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/** Browse book: the live Writing Studio book, read only, so the author can find what Claude should change. */
export function BrowseView({ slug, header, onShowChanges }: { slug: string; header: React.ReactNode; onShowChanges: () => void }) {
  const [outline, setOutline] = useState<BrowseOutline>();
  const [section, setSection] = useState<Section>("chapters");
  const [selected, setSelected] = useState<string>();
  const [version, setVersion] = useState("main");
  const [search, setSearch] = useState("");
  const [text, setText] = useState<BrowseText>();
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    api.browse(slug).then(
      (o) => {
        if (stop) return;
        setOutline(o);
        setSelected((s) => s ?? o.chapters[0]?.id);
      },
      (e) => !stop && setError(errorText(e)),
    );
    return () => {
      stop = true;
    };
  }, [slug]);

  const items: Item[] = useMemo(() => {
    if (!outline) return [];
    if (section === "chapters")
      return outline.chapters.map((c) => ({
        key: c.id,
        name: c.name,
        meta: plural(c.words, "word") + (c.drafts.length ? ` · ${plural(c.drafts.length, "draft")}` : ""),
        waiting: c.waiting,
      }));
    return outline.elements[section].map((x, i) => ({ key: String(i), name: x.name, meta: plural(x.words, "word"), waiting: 0 }));
  }, [outline, section]);

  const shown = search.trim() ? items.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase())) : items;
  const chapter = section === "chapters" ? outline?.chapters.find((c) => c.id === selected) : undefined;

  useEffect(() => {
    if (!selected) {
      setText(undefined);
      return;
    }
    let stop = false;
    const load =
      section === "chapters" ? api.browseChapter(slug, selected, version) : api.browseElement(slug, section, Number(selected));
    load.then(
      (t) => !stop && (setText(t), setError("")),
      (e) => !stop && setError(errorText(e)),
    );
    return () => {
      stop = true;
    };
  }, [slug, section, selected, version]);

  const pick = (key: string) => {
    setSelected(key);
    setVersion("main");
  };
  const changeSection = (next: Section) => {
    setSection(next);
    setSearch("");
    setVersion("main");
    setSelected(next === "chapters" ? outline?.chapters[0]?.id : outline?.elements[next].length ? "0" : undefined);
  };

  return (
    <section className={`sr-browse ${selected ? "has-item" : ""}`} aria-labelledby="sr-book-title">
      {header}
      {error && (
        <p className="sr-callout danger" role="alert">
          {error}
        </p>
      )}
      {outline && !outline.linked ? (
        <div className="sr-empty">
          <p>This book is not in Writing Studio yet. There is nothing to browse until you approve its first change.</p>
        </div>
      ) : (
        <div className="sr-browse-body">
          <nav className="sr-browse-nav" aria-label="Book contents">
            <span id="sr-browse-section" className="sr-visually-hidden">
              Section
            </span>
            <ReaderSelect id="sr-browse-section-select" labelId="sr-browse-section" value={section} options={SECTIONS} onChange={changeSection} />
            <input type="search" aria-label="Search titles" placeholder="Search titles…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <ul className="sr-browse-list">
              {shown.map((item) => (
                <li key={item.key}>
                  <button aria-current={item.key === selected ? "page" : undefined} onClick={() => pick(item.key)}>
                    {section === "chapters" && <span className="sr-browse-number">{String(items.indexOf(item) + 1).padStart(2, "0")}</span>}
                    <span className="sr-browse-label">
                      <strong dir="auto">{item.name}</strong>
                      <small>{item.meta}</small>
                    </span>
                    {item.waiting > 0 && <span className="sr-waiting">{item.waiting} waiting</span>}
                  </button>
                </li>
              ))}
              {outline && !shown.length && <li className="sr-muted small sr-pad">{search ? "Nothing matches." : "Nothing here yet."}</li>}
            </ul>
          </nav>
          <article className="sr-browse-text" aria-label={text?.title ?? "Text"}>
            {selected && (
              <header className="sr-browse-text-head">
                <button className="sr-back sr-mobile-only" onClick={() => setSelected(undefined)}>
                  ← Contents
                </button>
                <div className="sr-browse-title">
                  <h2 dir="auto">{text?.title ?? "…"}</h2>
                  {text && (
                    <span className="sr-muted small">
                      {text.subtitle} · {plural(text.words, "word")} · read only
                    </span>
                  )}
                </div>
                {chapter && chapter.drafts.length > 0 && (
                  <div className="sr-browse-version">
                    <span id="sr-browse-version" className="sr-muted small">
                      Version
                    </span>
                    <ReaderSelect
                      id="sr-browse-version-select"
                      labelId="sr-browse-version"
                      value={version}
                      options={[{ value: "main", label: "Main" }, ...chapter.drafts.map((d) => ({ value: d.id, label: d.name }))]}
                      onChange={setVersion}
                    />
                  </div>
                )}
                {chapter && chapter.waiting > 0 && (
                  <button className="sr-btn sr-btn-line sm" onClick={onShowChanges}>
                    See waiting change{chapter.waiting === 1 ? "" : "s"}
                  </button>
                )}
              </header>
            )}
            {text && (
              <div className="sr-page" dir="auto">
                {text.paragraphs.map((p, i) => (
                  <p key={i} style={p.align ? { textAlign: p.align as "left" } : undefined}>
                    {p.text || <br />}
                  </p>
                ))}
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
