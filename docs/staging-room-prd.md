# Staging Room v2 — PRD

Status: draft for approval, 2026-11-22. Decided with the author in a product session. The background is in `docs/staging-room-rethink-handoff.md`.

## 1. Goal

The author edits their book with Claude through the ROZA connector. Staging Room is the safe place for those edits:

- Claude's work never touches the live book until the author approves it.
- Approving never overwrites manual work in Writing Studio.
- The author sees *what was added* at a glance. They never have to hunt for changes.

Success: the author reviews a typical Claude edit in under two minutes, without confusion, and nothing they wrote by hand is ever lost.

## 2. The model in one paragraph

Staging is **a basket of additions on top of the live book**. It is not a second copy. The live book in Writing Studio is always the truth, so there is no Pull and no "reject Writing Studio changes". Claude only adds things:
- a new draft for a chapter (the default for chapter text),
- an edit to Main (only when the author asks for it),
- new chapters,
- new or changed story elements, tasks, notes and settings.

Claude never deletes. Each item can be approved on its own or all together. Approval is final: the item goes live at once and leaves Staging.

## 3. What Claude can add (the change set)

Each staged book holds a list of pending changes. Every change records what it was based on, so it can never overwrite newer manual work.

| Change | Based on | On approve |
| --- | --- | --- |
| **New draft** for a chapter (default for text) | The chapter's Main text when Claude started | Added to the live chapter as a normal draft. It is not promoted; the author promotes it in Writing Studio. |
| **Main edit** (only when the author asks Claude for it) | The hash of the Main text when Claude started | If live Main is unchanged since then → Main is replaced. If the author changed Main meanwhile → it is added as a draft named "Claude · <date>" instead. Nothing is overwritten. |
| **New chapter** | — | Added to the live book. Its text becomes the chapter's Main. |
| **Story element** (character, theme, plotline, note): new or changed | The live value when Claude read it (for changes) | Created or updated. If the live value changed meanwhile, the item shows "Changed in Writing Studio since Claude read it", and approval asks for a confirmation. |
| **Chapter notes** (annotations) | — | Added to the chapter (or to the draft they belong to). |
| **Tasks** (book or chapter task board) | — | Added to the board. |
| **Book settings** (word goal, etc.) | Live value | *Later — not in the first build.* |
| **Planning links** (chapter ↔ character/theme/plotline) | — | *Later — not in the first build.* |

Rules:
- **Repeated saves merge.** While the author works with Claude ("change this paragraph, save… now this one, save"), every save updates *the same* pending draft. The list shows one row: "Chapter 3 · new draft". On approval it goes to Writing Studio as one draft. Claude keeps editing that draft until it is approved. A second draft only appears if the author asks for one.
- **No deletes.** There is no connector tool that removes anything live, and no change type for deletion.
- **Discard.** Every pending item can be discarded, which removes it from Staging only. "Approve" and "Discard" are the only two decisions.
- **Backup.** Before each approval, the live book is backed up silently, as Push does today. There is no Undo button. Approval is final.

## 4. Screens

### 4.1 Book list (left column on desktop, first screen on mobile)
- Staged books, each with its count of pending changes.
- **Pin / unpin** replaces Hide. Filter: Pinned · Unpinned · All.
- **Import folder** stays (see 6.3).
- **Start staging for a live book:** a picker of the author's Writing Studio books.

### 4.2 Book: "Changes" (the main screen)
A plain summary, grouped by chapter, then story elements, then book-level:

```
Ann and Allan                         Approve all (6)
─────────────────────────────────────────────────────
Chapter 3 · Design at the Speed of Dial-Up
   New draft "Claude · 22 Nov"  · 1,240 words   [Open] [Approve] [Discard]
   2 notes                                       [Approve] [Discard]
Chapter 9 · (new chapter) The Reboot            [Open] [Approve] [Discard]
Characters
   Dona — new                                    [Open] [Approve] [Discard]
   Priya — description changed                   [Open] [Approve] [Discard]
Tasks
   3 new tasks                                   [Open] [Approve] [Discard]
```

- Rows with text (a draft, a new chapter, a Main edit) have **Read** and **Edit** buttons, so the editor opens straight from the list.
- A draft is approved as one whole. There is no per-passage approval and no passage navigation.
- Each chapter group also has **Approve chapter**.
- Nothing about Push, Pull, direction, conflict, hunks or parts.
- An empty state: "Nothing waiting. Ask Claude to edit a chapter in Staging."

### 4.3 Reading a draft (Open)
- The full draft text reads like the chapter. **Text that is new compared with Main is marked green.** Removed text is **not** shown.
- Notes are hidden.
- The header shows: chapter name, draft name, word count, and **Approve**, **Discard** and **Edit**.
- The same view works for a new chapter (all of it is new, so nothing is marked) and for a Main edit.

### 4.4 Editor (Edit)
- The Writing Studio editor on the pending draft, with AI Edit, under a clear "STAGING" banner.
- Notes are hidden.
- **Live:** while the editor is open, Claude's saves appear within a few seconds. If the author has unsaved typing when Claude saves, they get a bar: "Claude saved a newer version — Load it / Keep mine".
- Autosave goes to the pending draft only.

### 4.5 Story element / tasks / settings (Open)
- The new value, with new text marked green. For a changed item, only the new version is shown.
- The warning from section 3 when the live value changed meanwhile.

### 4.6 Mobile
The goal on mobile is to read and approve quickly, for example on a train.
- **Navigation:** one column. Book list → Changes → Read.
- **Actions:** each change card on the Changes screen has Edit, Discard and Approve. "Approve all" sits at the bottom of the Changes screen. The reading screen is for reading only, with no action bar.
- **Text:** a single column, with green new text and comfortable reading type.
- **Editor:** reachable, but not optimized.

### Removed from today's build
Compare, Pull, Push dialog, the Accept-without-push mark, the six Reject scopes, part tabs, the side-by-side diff, the History tab, the Connection tab, the Activity bar, Hide.

## 5. Connector (MCP) tools for Claude

Reading:
- `staging_list_projects`
- `staging_get_project`: the live book merged with pending changes, so Claude sees the latest.
- `staging_get_chapter`: Main text, drafts, and Claude's pending draft.

Writing (all of them only add to the change set):
- `staging_create_project` (link a live book).
- `staging_write_draft(chapter, text, name?, newDraft?)`: creates or updates Claude's pending draft for the chapter. This is the default for text.
- `staging_edit_main(chapter, text)`: only when the author asks for Main.
- `staging_add_chapter(name, position, text)`.
- `staging_set_element(kind, name, value)`: for characters, themes, plotlines and notes; new or changed.
- `staging_add_notes(chapter, notes[])`, `staging_add_tasks(tasks[])`. Planning links and book settings come later.

Removed: `staging_remove_chapter`, `staging_restore_backup`, `staging_import_project` for Claude (import stays in the UI), and whole-project overwrite.

Tool descriptions must say: "Text edits go into a new draft unless the author explicitly asks to edit Main. You cannot delete anything."

## 6. Data and migration

### 6.1 Storage
- Keep `staging_room_projects` (one row per staged book; the connector already has access). Each row holds: owner, linked live book id, pinned, the **change set** (a list of pending changes, each with id, type, target, base hash or value, payload, createdAt, updatedAt, source), and a revision number for live refresh.
- Keep `staging_room_backups`.

### 6.2 Migration (existing staged books)
- Every existing row stays: same slug, same live link.
- The old full copy is saved once to `staging_room_backups`. That is a backup, not a delete. Then it is removed from the row, and the change set starts empty. The author confirmed that everything was already uploaded, and that the live book wins on any difference.
- Hidden books become unpinned. Visible books become pinned.

### 6.3 Import folder
Import compares the folder with the live book and turns the differences into pending changes:
- a chapter whose text differs becomes a new draft,
- a missing chapter becomes a new chapter,
- new or changed story elements become element changes.

Nothing is deleted. If the book is not live yet, approving creates it.

## 7. Out of scope (for now)
- A reason attached to each change.
- Undo after approval (backups exist, with no UI).
- Showing deleted text.
- Claude deleting anything.

## 8. Rules
- No production deploy without the author's explicit instruction.
- Backend shared imports are `import type` only. Verify that the backend dev runtime starts.
- Reuse existing ROZA components and styles.
- Work on `main` in `C:\dev\Roza`.
