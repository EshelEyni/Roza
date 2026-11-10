import { Book, Chapter, StoryKind, TaskCard } from "../../../../shared/types/books";
import { useState } from "react";
import { DraftStore } from "./draftStore";
import { ManuscriptEditor } from "./ManuscriptEditor";
import { getDefaultBookDataItem } from "../../services/bookUtilService";
import { newId } from "./manuscript";
import { emptyBoard, uid } from "./taskBoardModel";
import "./chapterPlanning.css";

export const storyKinds: StoryKind[] = ["characters", "themes", "plotlines"];
export const chapterTasks = (book: Book, id: string) =>
  (book.taskBoard?.lists || []).flatMap(list => list.cards).filter(card => card.chapterId === id);
export function PlanningBadges({ book, chapter }: { book: Book; chapter: Chapter }) {
  const tasks = chapterTasks(book, chapter.id);
  return <div className="cp-badges">
    {!!tasks.length && <span>{tasks.filter(t => t.completed).length}/{tasks.length} completed</span>}
    {(chapter.planning?.themes || []).map(link => {
      const theme = book.themes.find(t => t.id === link.entityId && !t.isArchived);
      return theme && <span key={theme.id} style={{ borderColor: theme.color }} dir="auto">{theme.name}</span>;
    })}
    {!!chapter.planning?.plotlines.length && <span>{chapter.planning.plotlines.length} plotlines</span>}
    {!!chapter.planning?.characters.length && <span>{chapter.planning.characters.length} characters</span>}
  </div>;
}
export type PlanningNavigation = {
  onChapter: (id: string) => void;
  onEntity: (kind: StoryKind, id: string) => void;
  onTask: (id: string) => void;
};
export function ChapterPlanning({ store, chapter, onChapter, onEntity, onTask }: { store: DraftStore; chapter: Chapter } & PlanningNavigation) {
  const book = store.book;
  const tasks = chapterTasks(book, chapter.id);
  function patchTask(id: string, patch: Partial<TaskCard>) {
    store.edit(b => ({ ...b, taskBoard: { lists: (b.taskBoard?.lists || []).map(l => ({ ...l, cards: l.cards.map(c => c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c) })) } }));
  }
  function link(kind: StoryKind, entityId: string, remove = false, note?: string) {
    store.edit(b => ({ ...b, chapters: b.chapters.map(c => {
      if (c.id !== chapter.id) return c;
      const planning = c.planning || { themes: [], plotlines: [], characters: [] };
      const links = planning[kind].filter(l => l.entityId !== entityId);
      return { ...c, planning: { ...planning, [kind]: remove ? links : [...links, { entityId, note: note || "" }] } };
    }) }));
  }
  return <details className="cp-inspector">
    <summary>Chapter Planning <small>{tasks.length ? `${tasks.filter(t => t.completed).length}/${tasks.length} completed` : ""}</small></summary>
    <div className="cp-content">
      <p className="ws-muted" role="status">{store.state === "error" ? "Not saved · retry using Save" : store.state === "saved" ? "All changes saved" : "Saving…"}</p>
      <fieldset disabled={!!store.recovery}>
        <details><summary>Summary</summary><ManuscriptEditor key={chapter.id} value={chapter.description} label="Planning summary" onChange={description => store.edit(b => ({ ...b, chapters: b.chapters.map(c => c.id === chapter.id ? { ...c, description } : c) }))} /></details>
        <details><summary>Tasks · {tasks.filter(t => t.completed).length}/{tasks.length} completed</summary>
          {tasks.map(task => <div className="cp-task" key={task.id}>
            <input type="checkbox" aria-label={`Complete ${task.title}`} checked={!!task.completed} onChange={e => patchTask(task.id, { completed: e.target.checked })} />
            <input dir="auto" aria-label="Chapter task title" maxLength={500} value={task.title} onChange={e => { if (e.target.value.trim()) patchTask(task.id, { title: e.target.value }); }} />
            <button onClick={() => onTask(task.id)}>Open in board</button>
            <button aria-label={`Delete task ${task.title}`} onClick={() => { if (window.confirm(`Delete “${task.title}”?`)) store.edit(b => ({ ...b, taskBoard: { lists: (b.taskBoard?.lists || []).map(l => ({ ...l, cards: l.cards.filter(c => c.id !== task.id) })) } })); }}>×</button>
          </div>)}
          <form className="cp-create" onSubmit={e => {
            e.preventDefault(); const form = e.currentTarget; const title = String(new FormData(form).get("title") || "").trim(); if (!title) return;
            store.edit(b => { const board = structuredClone(b.taskBoard || emptyBoard()); if (!board.lists.length) board.lists.push({ id: uid(), title: "To Do", cards: [] }); const now = new Date().toISOString(); board.lists[0].cards.push({ id: uid(), title, chapterId: chapter.id, completed: false, description: "", dueDate: "", checklist: [], labels: [], createdAt: now, updatedAt: now }); return { ...b, taskBoard: board }; }); form.reset();
          }}><input dir="auto" name="title" aria-label="New chapter task" maxLength={500} placeholder="What needs doing?" required /><button>Add task</button></form>
          <label>Associate existing task<select value="" onChange={e => { if (e.target.value) patchTask(e.target.value, { chapterId: chapter.id }); }}><option value="">Choose a task…</option>{(book.taskBoard?.lists || []).flatMap(l => l.cards).filter(c => c.chapterId !== chapter.id).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        </details>
        {storyKinds.map(kind => <details key={kind}><summary>{kind[0].toUpperCase() + kind.slice(1)} · {chapter.planning?.[kind].length || 0}</summary>
          {(chapter.planning?.[kind] || []).map(association => {
            const entity = book[kind].find(v => v.id === association.entityId && !v.isArchived); if (!entity) return null;
            return <div className="cp-link" key={entity.id}>
              <div className="cp-link-heading"><button dir="auto" onClick={() => onEntity(kind, entity.id)}>{entity.name}</button><button aria-label={`Remove ${entity.name} from chapter`} onClick={() => link(kind, entity.id, true)}>×</button></div>
              {kind !== "themes" && <textarea dir="auto" aria-label={`${entity.name} chapter contribution`} maxLength={50000} placeholder="Development in this chapter…" value={association.note || ""} onChange={e => link(kind, entity.id, false, e.target.value)} />}
              <div className="cp-related">{book.chapters.filter(c => !c.isArchived && c.id !== chapter.id && c.planning?.[kind].some(l => l.entityId === entity.id)).map(c => <button key={c.id} dir="auto" onClick={() => onChapter(c.id)}>{c.name}</button>)}</div>
            </div>;
          })}
          <label>Add {kind === "themes" ? "theme" : kind === "plotlines" ? "plotline" : "character"}<select value="" onChange={e => { if (e.target.value) link(kind, e.target.value); }}><option value="">Choose existing…</option>{book[kind].filter(v => !v.isArchived && !chapter.planning?.[kind].some(l => l.entityId === v.id)).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <form className="cp-create" onSubmit={e => {
            e.preventDefault(); const form = e.currentTarget; const name = String(new FormData(form).get("name") || "").trim(); if (!name) return;
            const entity = { ...getDefaultBookDataItem({ bookId: book.id, type: kind }), id: newId(), name };
            store.edit(b => ({ ...b, [kind]: [...b[kind], entity] })); link(kind, entity.id); form.reset();
          }}><input dir="auto" name="name" aria-label={`New ${kind} name`} maxLength={500} placeholder="Create a new story element…" required /><button>Create & link</button></form>
        </details>)}
      </fieldset>
    </div>
  </details>;
}
export function PlanningFilter({ book, value, onChange }: { book: Book; value: string; onChange: (value: string) => void }) {
  return <label className="cp-filter">Focus chapters <select aria-label="Filter chapter planning" value={value} onChange={e => onChange(e.target.value)}><option value="">All chapters</option><option value="unfinished">Unfinished tasks</option>{storyKinds.map(kind => <optgroup key={kind} label={kind}>{book[kind].filter(e => !e.isArchived).map(e => <option key={e.id} value={`${kind}:${e.id}`}>{e.name}</option>)}</optgroup>)}</select></label>;
}
export function matchesPlanning(book: Book, chapter: Chapter, filter: string) {
  if (!filter) return true;
  if (filter === "unfinished") return chapterTasks(book, chapter.id).some(t => !t.completed);
  const [kind, id] = filter.split(":");
  return chapter.planning?.[kind as StoryKind]?.some(l => l.entityId === id) || false;
}
export function StoryBible({ store, onChapter, selectedKind = "characters", selectedId = "" }: { store: DraftStore; onChapter: (id: string) => void; selectedKind?: StoryKind; selectedId?: string }) {
  const [kind, setKind] = useState<StoryKind>(selectedKind);
  const [id, setId] = useState(selectedId);
  const book = store.book;
  const entities = book[kind].filter(e => !e.isArchived);
  const entity = entities.find(e => e.id === id) || entities[0];
  function update(patch: Record<string, unknown>) { if (entity) store.edit(b => ({ ...b, [kind]: b[kind].map(e => e.id === entity.id ? { ...e, ...patch } : e) })); }
  return <section className="cp-bible" aria-label="Story Bible"><span className="ws-eyebrow">THE PEOPLE & THREADS OF YOUR STORY</span><h1>Story Bible</h1>
    <div className="cp-bible-nav">{storyKinds.map(k => <button key={k} aria-pressed={kind === k} onClick={() => { setKind(k); setId(""); }}>{k[0].toUpperCase() + k.slice(1)}</button>)}</div>
    <fieldset disabled={!!store.recovery}>
      <div className="cp-create"><select aria-label="Story element" value={entity?.id || ""} onChange={e => setId(e.target.value)}><option value="" disabled>Select a story element</option>{entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><button onClick={() => { const entry = { ...getDefaultBookDataItem({ bookId: book.id, type: kind }), id: newId(), name: "Untitled" }; store.edit(b => ({ ...b, [kind]: [...b[kind], entry] })); setId(entry.id); }}>＋ Create</button></div>
      {entity ? <div key={entity.id} className="cp-profile">
        <label>Name<input dir="auto" maxLength={500} value={entity.name} onChange={e => { if (e.target.value.trim()) update({ name: e.target.value }); }} /></label>
        {"color" in entity || kind !== "characters" ? <label>Color <input type="color" value={("color" in entity && entity.color) || "#a4775a"} onChange={e => update({ color: e.target.value })} /><button onClick={() => update({ color: "" })}>Clear color</button></label> : null}
        {kind === "characters" && <><label>Role<input dir="auto" maxLength={500} value={"role" in entity ? entity.role || "" : ""} onChange={e => update({ role: e.target.value })} /></label><label>General notes<textarea dir="auto" maxLength={50000} value={"notes" in entity ? entity.notes || "" : ""} onChange={e => update({ notes: e.target.value })} /></label></>}
        <p className="ws-muted">{kind === "characters" ? "Biography & description" : "Description"}</p><ManuscriptEditor key={entity.id} label="Story element description" value={entity.description} onChange={description => update({ description })} />
        <h2>Across the manuscript</h2><ol className="cp-timeline">{book.chapters.filter(c => !c.isArchived && c.planning?.[kind].some(l => l.entityId === entity.id)).map(c => <li key={c.id}><button dir="auto" onClick={() => onChapter(c.id)}>{book.chapters.filter(v => !v.isArchived).indexOf(c) + 1}. {c.name}</button><p dir="auto">{c.planning?.[kind].find(l => l.entityId === entity.id)?.note}</p></li>)}</ol>
        <button onClick={() => { if (window.confirm(`Archive “${entity.name}”? Chapter references are preserved for recovery.`)) update({ isArchived: true }); }}>Archive story element</button>
      </div> : <p className="ws-muted">Create your first {kind === "characters" ? "character" : kind === "themes" ? "theme" : "plotline"}.</p>}
    </fieldset>
  </section>;
}
