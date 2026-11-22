# Staging Room

Staging Room is a safe place for edits that Claude (or ChatGPT, through the same connector) makes to your books. Claude adds **pending changes**. Nothing reaches the live book in Writing Studio until you approve it. The product decisions are in [staging-room-prd.md](staging-room-prd.md).

Sign in to ROZA as an administrator and open **Staging Room** from the main navigation. It works in the browser, in ROZA Desktop and on the phone.

## How it works

- **Writing Studio is always the truth.** Staging is not a copy of your book. It is a list of additions on top of it.
- **Claude only adds.** It can add new drafts (the default for chapter text), Main edits (only when you ask), new chapters, characters, themes, plotlines, notes and tasks. It cannot delete anything.
- **Your manual work is safe.** A draft never touches Main. A Main edit replaces Main only if you didn't change Main since Claude read it; otherwise it is added as a draft. A story element you changed since Claude read it asks before it is replaced.
- **Approve is final.** The change goes to Writing Studio at once and leaves Staging. The live book is backed up first (`staging_room_backups`).

## Screens

- **Books:** your staged books with how many changes wait. Pin the ones you work on and filter Pinned, Unpinned or All. **Stage a book** adds a Writing Studio book. **Import folder** reads an old staged project folder (see below).
- **Changes:** the waiting changes, grouped by chapter, then story elements, then tasks. Each has **Read**, **Edit** (for text), **Discard** and **Approve**. Chapters with several changes have **Approve chapter**, and the page has **Approve all**. While Claude is saving, a line shows what it is working on.
- **Read:** the full text, with what is new compared with Writing Studio marked green. Removed text is not shown. Notes are hidden.
- **Edit:** the Writing Studio editor with AI Edit, on the pending text, under a "STAGING COPY" banner. Claude's saves show up within a few seconds. If you are typing when Claude saves, you choose: load Claude's version or keep yours.

## Where the data lives

- `staging_room_projects`: one row per staged book: the live book it belongs to, the pending changes, and a read-only copy of the live book. The connector can't read the live books, so Claude reads that copy. The backend refreshes it when you open the book in Staging Room, after every approval, and after every Writing Studio save.
- `staging_room_backups`: the live book before each approval, discarded changes, and the old full copies of books staged before v2.
- `staging_room_preferences`: list order, pins and the filter.

## Import folder

Select **Import folder** and choose the old `books` folder or one project folder. ROZA reads `book.json`, the JSON chapter files and `.publish-state.json`, and compares them with the live book:

- a chapter whose text differs becomes a new draft,
- a chapter the live book doesn't have becomes a new chapter,
- a new or different story element becomes an element change.

Nothing is removed. A project name that is already staged is skipped.

## Upgrading from the old Staging Room

Books staged before v2 held a full copy of the book. The first time Staging Room opens, each one is upgraded: the old copy is saved to `staging_room_backups`, and the book starts with no pending changes, because Writing Studio already has everything. A staged book that was never uploaded keeps its content as pending changes instead. Until a book is upgraded, Claude's tools ask you to open Staging Room once.
