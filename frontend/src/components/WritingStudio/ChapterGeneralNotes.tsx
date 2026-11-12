import { useLayoutEffect, useRef, useState } from "react";
import { Chapter, ChapterAnnotation } from "../../../../shared/types/books";
import { useConfirmation } from "../Modals/useConfirmation";
import { DraftStore } from "./draftStore";

function NoteCard({ note, index, readOnly, focus, onEdit, onDelete }: {
  note: ChapterAnnotation; index: number; readOnly: boolean; focus: boolean;
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
      <label htmlFor={`chapter-note-${note.id}`}><span className="cp-note-number">{String(index + 1).padStart(2, "0")}</span> Note</label>
      <button type="button" className="cp-note-delete" aria-label="Delete note" title="Delete note" disabled={readOnly} onClick={onDelete}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg>
      </button>
    </header>
    <textarea ref={input} id={`chapter-note-${note.id}`} dir="auto" aria-label={`Note ${index + 1}`} maxLength={50000}
      autoFocus={focus} placeholder="Write a thought, a question, a reminder…"
      value={note.content} readOnly={readOnly} rows={3} onChange={event => onEdit(event.target.value)} />
  </article>;
}

export function ChapterGeneralNotes({ store, chapter }: { store: DraftStore; chapter: Chapter }) {
  const { confirm, confirmationDialog } = useConfirmation();
  const [newNote, setNewNote] = useState<string>();
  const notes = (chapter.annotations || []).filter(note => note.general);
  function change(update: (notes: ChapterAnnotation[]) => ChapterAnnotation[]) {
    store.edit(book => ({ ...book, chapters: book.chapters.map(current =>
      current.id === chapter.id ? { ...current, annotations: update(current.annotations || []) } : current,
    ) }));
  }
  function addNote() {
    const id = crypto.randomUUID();
    setNewNote(id);
    change(all => [...all, { id, content: "", general: true, anchor: null, quote: "" }]);
  }
  return <section className="cp-notes" aria-label="Chapter notes">
    {confirmationDialog}
    <header className="cp-notes-heading">
      <div><div className="cp-notes-title"><h2>Notes</h2><span>{notes.length}</span></div><p>Ideas, questions, and reminders for this chapter.</p></div>
      <button type="button" className="cp-notes-add" disabled={!!store.recovery} onClick={addNote}><span aria-hidden="true">+</span> Add note</button>
    </header>
    {notes.length ? <div className="cp-notes-grid">{notes.map((note, index) => <NoteCard key={note.id} note={note} index={index} readOnly={!!store.recovery} focus={newNote === note.id}
      onEdit={content => change(all => all.map(current => current.id === note.id ? { ...current, content } : current))}
      onDelete={async () => {
        if (await confirm({ title: "Delete note?", message: "Delete this chapter’s note?", confirmLabel: "Delete note" }))
          change(all => all.filter(current => current.id !== note.id));
      }} />)}</div> : <div className="cp-notes-empty"><h3>A little space to think.</h3><p>Keep chapter ideas here, alongside your story.</p><button type="button" disabled={!!store.recovery} onClick={addNote}>Write your first note <span aria-hidden="true">↗</span></button></div>}
  </section>;
}
