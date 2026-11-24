import { useLayoutEffect, useRef, useState } from "react";
import { createEditor, Editor, Range } from "slate";
import { Chapter, ChapterAnnotation, ChapterDraft } from "../../../../shared/types/books";
import { useConfirmation } from "../Modals/useConfirmation";
import { DraftStore } from "./draftStore";
import { validAnchor } from "./annotations";
import { changeChapterDraft, isMainBackup } from "./chapterDrafts";

function NoteCard({ note, index, readOnly, focus, onEdit, onDelete, context }: {
  note: ChapterAnnotation; index: number; readOnly: boolean; focus: boolean;
  context?: { location: string; quote: string };
  onEdit: (content: string) => void; onDelete: () => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    const fit = () => {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    };
    fit();
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      fit();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [note.content]);
  return <article className="cp-note-card">
    <header>
      <label htmlFor={`chapter-note-${note.id}`}><span className="cp-note-number">{String(index + 1).padStart(2, "0")}</span> {context ? "Inline note" : "Note"}</label>
      <button type="button" className="cp-note-delete" aria-label="Delete note" title="Delete note" disabled={readOnly} onClick={onDelete}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg>
      </button>
    </header>
    {context && (
      <div className="cp-note-context">
        <span>{context.location}</span>
        {context.quote && <blockquote dir="auto">{context.quote}</blockquote>}
      </div>
    )}
    <textarea ref={input} id={`chapter-note-${note.id}`} dir="auto" aria-label={`${context ? "Inline note" : "Note"} ${index + 1}`} maxLength={50000}
      autoFocus={focus} placeholder="Write a thought, a question, a reminder…"
      value={note.content} readOnly={readOnly} rows={3} onChange={event => onEdit(event.target.value)} />
  </article>;
}

function inlineNoteContext(editor: Editor, note: ChapterAnnotation) {
  if (!validAnchor(editor, note.anchor)) {
    return { location: "Passage unavailable", quote: note.quote };
  }
  const [start, end] = Range.edges(note.anchor);
  const first = start.path[0] + 1;
  const last = end.path[0] + 1;
  return {
    location: first === last ? `Block ${first}` : `Blocks ${first}–${last}`,
    quote: note.quote,
  };
}

export function ChapterGeneralNotes({ store, chapter, inline = false, draft }: {
  store: DraftStore; chapter: Chapter; inline?: boolean; draft?: ChapterDraft;
}) {
  const { confirm, confirmationDialog } = useConfirmation();
  const [newNote, setNewNote] = useState<string>();
  const version = draft ?? chapter;
  const notes = (version.annotations || []).filter(note => inline ? !note.general : note.general);
  const readOnly = !!store.recovery || (!!draft && isMainBackup(draft));
  const editor = inline ? createEditor() : null;
  if (editor) editor.children = version.text;
  const title = inline ? "Inline notes" : "Notes";
  function change(update: (notes: ChapterAnnotation[]) => ChapterAnnotation[]) {
    store.edit(book => ({ ...book, chapters: book.chapters.map(current => {
      if (current.id !== chapter.id) return current;
      if (!draft) return { ...current, annotations: update(current.annotations || []) };
      const currentDraft = current.drafts?.find(candidate => candidate.id === draft.id);
      if (!currentDraft) return current;
      return changeChapterDraft(current, draft.id, { annotations: update(currentDraft.annotations || []) });
    }) }));
  }
  function addNote() {
    const id = crypto.randomUUID();
    setNewNote(id);
    change(all => [...all, { id, content: "", general: true, anchor: null, quote: "" }]);
  }
  return <section className={inline ? "cp-notes cp-inline-notes" : "cp-notes"} aria-label={inline ? title : "Chapter notes"}>
    {confirmationDialog}
    <header className="cp-notes-heading">
      <div><div className="cp-notes-title"><h2>{title}</h2><span>{notes.length}</span></div>{!inline && <p>Ideas, questions, and reminders for this chapter.</p>}</div>
      {!inline && <button type="button" className="cp-notes-add" disabled={!!store.recovery} onClick={addNote}><span aria-hidden="true">+</span> Add note</button>}
    </header>
    {notes.length ? <div className="cp-notes-grid">{notes.map((note, index) => <NoteCard key={note.id} note={note} index={index} readOnly={readOnly} focus={newNote === note.id}
      context={editor ? inlineNoteContext(editor, note) : undefined}
      onEdit={content => change(all => all.map(current => current.id === note.id ? { ...current, content } : current))}
      onDelete={async () => {
        if (await confirm({ title: "Delete note?", message: inline ? "Delete this note from the chapter and manuscript?" : "Delete this chapter’s note?", confirmLabel: "Delete note" }))
          change(all => all.filter(current => current.id !== note.id));
      }} />)}</div> : inline ? <p className="ws-muted">No inline notes in this chapter.</p> : <div className="cp-notes-empty"><h3>A little space to think.</h3><p>Keep chapter ideas here, alongside your story.</p><button type="button" disabled={!!store.recovery} onClick={addNote}>Write your first note <span aria-hidden="true">↗</span></button></div>}
  </section>;
}
