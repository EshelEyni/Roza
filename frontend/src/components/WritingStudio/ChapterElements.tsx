import { useState } from "react";
import { FiPlus, FiSearch, FiTrash2, FiChevronDown } from "react-icons/fi";
import {
  Chapter,
  StoryKind,
  SlateCustomElement,
} from "../../../../shared/types/books";
import { DraftStore } from "./draftStore";
import { ManuscriptEditor } from "./ManuscriptEditor";
import { getDefaultBookDataItem } from "../../services/bookUtilService";
import { newId, plainText } from "./manuscript";

export function ChapterElements({
  store,
  chapter,
  kind,
  link,
  onEntity,
  onChapter,
}: {
  store: DraftStore;
  chapter: Chapter;
  kind: StoryKind;
  link: (kind: StoryKind, id: string, remove?: boolean, note?: string) => void;
  onEntity: (kind: StoryKind, id: string) => void;
  onChapter: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const book = store.book;
  const singular =
    kind === "characters"
      ? "character"
      : kind === "themes"
        ? "theme"
        : "plotline";
  const associations = chapter.planning?.[kind] || [];
  const linked = book[kind].filter(
    e => !e.isArchived && associations.some(a => a.entityId === e.id),
  );
  const available = book[kind].filter(
    e => !e.isArchived && !associations.some(a => a.entityId === e.id),
  );
  const matches = linked.filter(e =>
    `${e.name} ${plainText(e.description)} ${associations.find(a => a.entityId === e.id)?.note || ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  function update(
    id: string,
    patch: { name?: string; description?: SlateCustomElement[] },
  ) {
    store.edit(b => ({
      ...b,
      [kind]: b[kind].map(e => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }
  return (
    <div className={`cp-elements cp-elements-${kind}`}>
      <header className="cp-elements-header">
        <h2>
          {kind[0].toUpperCase() + kind.slice(1)} <small>{linked.length}</small>
        </h2>
        <button
          className="ws-primary"
          onClick={() => setCreating(value => !value)}
          aria-expanded={creating}
        >
          <FiPlus aria-hidden="true" /> Add new {singular}
        </button>
      </header>
      <div className="cp-elements-tools">
        <label className="cp-elements-search">
          <FiSearch aria-hidden="true" />
          <input
            type="search"
            aria-label={`Search ${kind}`}
            placeholder={`Search ${kind}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
        {!!available.length && (
          <select
            aria-label={`Associate ${kind} with chapter`}
            value=""
            onChange={e => {
              if (e.target.value) {
                link(kind, e.target.value);
                setOpened(e.target.value);
                setSearch("");
              }
            }}
          >
            <option value="">Link existing {singular}…</option>
            {available.map(e => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {creating && (
        <form
          className="cp-element-create"
          onSubmit={e => {
            e.preventDefault();
            const name = String(
              new FormData(e.currentTarget).get("name") || "",
            ).trim();
            if (!name) return;
            const entity = {
              ...getDefaultBookDataItem({ bookId: book.id, type: kind }),
              id: newId(),
              name,
            };
            store.edit(b => ({ ...b, [kind]: [...b[kind], entity] }));
            link(kind, entity.id);
            setOpened(entity.id);
            setSearch("");
            setCreating(false);
          }}
        >
          <input
            autoFocus
            dir="auto"
            name="name"
            aria-label={`New ${kind} name`}
            placeholder={`${singular[0].toUpperCase() + singular.slice(1)} name`}
            required
            maxLength={500}
          />
          <button type="submit">Create & link</button>
          <button type="button" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      )}
      <div className="cp-element-list" aria-label={`Chapter ${kind}`}>
        {matches.map(entity => {
          const association = associations.find(a => a.entityId === entity.id)!;
          const expanded = opened === entity.id;
          return (
            <article
              key={entity.id}
              className={`cp-element ${expanded ? "is-open" : ""}`}
            >
              <header className="cp-element-header">
                <button
                  className="cp-element-open"
                  aria-expanded={expanded}
                  aria-controls={`cp-element-${entity.id}`}
                  onClick={() => setOpened(expanded ? null : entity.id)}
                >
                  <span className="cp-element-name" dir="auto">
                    {"color" in entity && entity.color && (
                      <i
                        aria-hidden="true"
                        style={{ background: entity.color }}
                      />
                    )}
                    {entity.name}
                  </span>
                  {!expanded && (
                    <span className="cp-element-excerpt" dir="auto">
                      {association.note ||
                        plainText(entity.description) ||
                        `Add ${singular} details…`}
                    </span>
                  )}
                  <FiChevronDown
                    className="cp-element-chevron"
                    aria-hidden="true"
                  />
                </button>
                <button
                  className="cp-element-delete"
                  aria-label={`Remove ${entity.name} from chapter`}
                  title="Remove from this chapter"
                  onClick={() => link(kind, entity.id, true)}
                >
                  <FiTrash2 aria-hidden="true" size={16} />
                </button>
              </header>
              {expanded && (
                <div className="cp-element-body" id={`cp-element-${entity.id}`}>
                  <label>
                    Name
                    <input
                      dir="auto"
                      value={entity.name}
                      maxLength={500}
                      onChange={e => {
                        if (e.target.value.trim())
                          update(entity.id, { name: e.target.value });
                      }}
                    />
                  </label>
                  <p className="ws-muted">
                    {kind === "characters" ? "Biography" : "Description"} ·
                    shared across the book
                  </p>
                  <ManuscriptEditor
                    key={entity.id}
                    value={entity.description}
                    label={`${entity.name} description`}
                    onChange={description => update(entity.id, { description })}
                  />
                  {kind !== "themes" && (
                    <label>
                      In this chapter
                      <textarea
                        dir="auto"
                        aria-label={`${entity.name} chapter contribution`}
                        value={association.note || ""}
                        maxLength={50000}
                        placeholder="Role or development in this chapter…"
                        onChange={e =>
                          link(kind, entity.id, false, e.target.value)
                        }
                      />
                    </label>
                  )}
                  <footer>
                    <button onClick={() => onEntity(kind, entity.id)}>
                      Open profile
                    </button>
                    <div className="cp-related">
                      {book.chapters
                        .filter(
                          c =>
                            !c.isArchived &&
                            c.id !== chapter.id &&
                            c.planning?.[kind].some(
                              a => a.entityId === entity.id,
                            ),
                        )
                        .map(c => (
                          <button
                            key={c.id}
                            dir="auto"
                            onClick={() => onChapter(c.id)}
                          >
                            {c.name}
                          </button>
                        ))}
                    </div>
                  </footer>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!matches.length && (
        <p className="cp-elements-empty">
          {search
            ? `No ${kind} match “${search}”.`
            : `No ${kind} linked yet. Add a new ${singular} or link one from your book.`}
        </p>
      )}
      <p className="cp-elements-hint">
        Removing a {singular} here only unlinks it from this chapter.
      </p>
    </div>
  );
}
