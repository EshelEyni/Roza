# Staging Room rethink — handoff

Written 2026-11-22. This is the starting brief for a product session. The plan is to rethink Staging Room from the user's need, write a PRD, design the screens (mobile included), and then rebuild the feature.

Read this whole file before you start. Then work as a product manager first and an engineer second. Do not write code until the author approves the PRD and the screens.

---

## 1. The one sentence

> "I use Claude to quickly edit my book. I want a staging ground where I can check if the changes are good, and where they can't delete good work I did by hand."

That is the main value of the feature. Everything else is secondary. A rule for this session: if a screen, button or concept does not serve that sentence, it should not exist.

## 2. What the author said (2026-11-22)

1. **Mobile is terrible.** It needs a real mobile layout, not a squeezed desktop one.
2. **Too much.** "I hadn't thought exactly what I need and added too many things." What they wanted: a place where an agent can edit the book safely. Nothing touches real data until they go through the changes by hand and approve them. "All the changes and buttons are too much for me."
3. **Writing Studio changes should always be in Staging.** "Is there a case we need to reject changes from Writing Studio to Staging? It's weird. I think always pull." (Section 5 answers this.)
4. **Start from scratch, PM style.** Decide the user's needs together, write a PRD, design screens, and rebuild. "This was supposed to help me smoothly add changes, but now I can't understand anything here."

Who the user is: the author is the only user and also the developer. They write books in ROZA's Writing Studio. They edit with Claude through the ROZA connector (MCP) from claude.ai, and sometimes ChatGPT/Codex. They review on desktop (ROZA Desktop, an Electron app) and want to review on mobile too.

## 3. How it works today

### 3.1 The data model: two full copies that sync both ways

- **Live book:** the real book in Writing Studio (`books` collection).
- **Staged project:** a full copy of the whole book (`staging_room_projects`). It holds the book settings, every chapter (text, notes, drafts, planning links, task board) and every story element (characters, themes, plotlines, notes).
- **Sync state:** after each Push or Pull, the project stores a fingerprint (hash) of each item. Compare uses these fingerprints to guess which side changed since the last sync:
  - Only Staging changed → direction `push`.
  - Only Writing Studio changed → direction `pull`.
  - Both changed → `conflict`.
  - Code: `directionOf` and `decide` in `backend/src/services/stagingRoom/sync.ts`.
- **No base text is kept.** Staging stores only a hash of the last synced version, not the text itself. So the app can tell *that* both sides changed. It cannot tell *what* each side changed. A three-way merge is impossible today.
- **Sync works on whole items.** Push and Pull replace a whole chapter, a whole story element, or all of "Book settings".
- **Backups:** Push backs up the live book first (`staging_room_backups`). Reject, Pull, Restore and connector writes back up Staging.

### 3.2 The core problem in this model

This is the most important finding. It ties straight to the author's main fear.

Here is how good work gets lost:

1. Claude edits chapter 3 in Staging.
2. Meanwhile, the author fixes a typo in chapter 3 in Writing Studio.
3. Compare marks chapter 3 as a `conflict`. The author has to choose a whole side.
4. If they Push, the whole live chapter is replaced, so the manual fix is gone. A backup exists, but nobody looks at backups.
5. If they Pull, Claude's edits are gone.

So today "safe" means "you can undo by restoring a backup". It does not mean "your manual work is never overwritten". The rebuild should make the second one true.

### 3.3 Screens today (after the 2026-11-22 redesign, commits f67290d and 40d3751)

- **Top bar:** Books / Connection tabs and the database badge (`prod_roza_db`).
- **Book list** (left column): staged books, "In prod" status, Import folder, Show hidden.
- **Book view**, with header buttons Compare / Pull / Push and three tabs:
  - **Overview:** chapter rows, story elements, Edit links, a "Review changes" callout.
  - **Changes:** a tree of changed items with filters (All / To review / Accepted) and a legend (A/M/D/!).
    - The right side shows one item: a source line, direction callouts, and part tabs (Text, Notes, Drafts, Chapter info, Planning, Tasks).
    - It has a Side-by-side / Inline toggle, a diff with folded context, and per-change Reject.
    - Header buttons: Edit in Staging, Reject…, Accept.
  - **History:** a timeline of every write to Staging, with its source and Undo/Restore.
- **Reject dialog:** reject one change, one item, one part, the whole item, everything from one source, or all of Staging.
- **Push / Pull dialogs:** checklists of items. Accepted items are pre-ticked.
- **Staging editor:** the Writing Studio editor with AI Edit, a striped "STAGING COPY" banner, and autosave to Staging.
- **Activity log** bar at the bottom.

Concepts the author must hold in their head today: Staging vs Roza vs Writing Studio, Compare, Push, Pull, direction, conflict, Accept, Reject (6 scopes), parts, hunks, source, History, Restore, backups, Edit in Staging, hidden books, Import folder, Connection.

That is far too many concepts for "let me check Claude's edits".

### 3.4 Code map (about 6,100 lines)

| Area | Files |
| --- | --- |
| Router (all HTTP routes) | `backend/src/routers/stagingRoom/stagingRoomRouter.ts` (544) |
| Compare / Push | `backend/src/services/stagingRoom/sync.ts` (787) |
| Pull | `backend/src/services/stagingRoom/pull.ts` |
| Full-field comparison | `backend/src/services/stagingRoom/fullData.ts` (522) |
| Diff and review parts | `backend/src/services/stagingRoom/review.ts` |
| Reject | `backend/src/services/stagingRoom/revert.ts` |
| History | `backend/src/services/stagingRoom/history.ts` |
| Book validation / files | `bookFiles.ts`, `planningValidation.ts`, `rozaSchema.ts`, `slate.ts`, `prodEdits.ts` |
| Connector writes | `backend/src/mcp/stagingStore.ts` (525), tools in `backend/src/mcp/mcpServer.ts` |
| Shared types | `shared/types/stagingRoom.ts` |
| Frontend | `frontend/src/components/StagingRoom/**`, `frontend/src/pages/StagingRoomPage.tsx` |
| Styles | `frontend/src/components/StagingRoom/staging-room.scss` (1,700+ lines; only one breakpoint, 1100px) |
| Docs | `docs/staging-room.md`, `docs/claude-connector.md` |

HTTP routes (`/api/staging-room`):
- Projects: `projects` list, `projects/import`, `projects/:slug`, `projects/:slug/draft` (GET/PUT, used by agents).
- Chapters: `projects/:slug/chapter`, `projects/:slug/chapters/:file` (GET/PUT, the editor).
- Editing and review: `ai-edit`, `compare`, `push`, `pull`, `revert`, `review`, `history`, `restore`.
- Settings: `preferences`, `connection`, `connection/test`.

Connector tools (what Claude uses):
- Reading: `staging_list_projects`, `staging_get_project`, `staging_get_chapter`.
- Projects: `staging_create_project`, `staging_import_project`.
- Chapters: `staging_save_chapter`, `staging_update_chapter`, `staging_remove_chapter`, `staging_set_chapter_order`.
- Book and settings: `staging_update_book`, `staging_set_preferences`.
- Backups: `staging_list_backups`, `staging_restore_backup`.

The connector can only write Staging. It cannot write the live book. That is a good safety property. Keep it.

### 3.5 Why mobile is bad (from the code; not yet audited on a phone)

- The page uses fixed side columns: `300px 1fr` for the book list and `290px 1fr` for the changes tree.
- The diff is a 4-column table (`48px 1fr 48px 1fr`). Side by side cannot work on a phone.
- There is only one responsive rule (1100px). Nothing is designed for widths under about 700px.
- Header actions (Compare, Pull, Push, Edit, Reject, Accept) don't fit in one row.

Ask the author for phone screenshots in the session. Design mobile first, not as an afterthought.

## 4. Diagnosis: why the feature got confusing

1. **Wrong mental model.** The code treats Staging and the live book as two equal copies that sync like Git remotes, with push, pull and conflicts. The author's model is different. To them the live book is the truth, and Staging holds *suggestions* from an agent. Those two models need very different UIs.
2. **Whole-item sync.** It forces all-or-nothing choices and makes conflicts dangerous (section 3.2).
3. **Features piled on to patch the confusion.** Source tracking, history, six reject scopes, accept marks and the editor were all added to explain or fix the sync model. Each makes sense alone. Together they are a lot.
4. **Two kinds of "review state".** "Accepted" and "pushed" are different things. Users expect Accept to mean "apply it".
5. **Developer words in the UI:** push, pull, hunk, direction, compare, prod, slug, `prod_roza_db`.

## 5. Answer to question 3: should Writing Studio changes ever be rejected in Staging?

**Short answer: no.** In the right model, the author's manual work in Writing Studio is the truth, and Staging should always build on top of it. "Rejecting a Writing Studio change" only exists today because of the two-copy sync model.

**The longer answer.** There is one real case to design for: a conflict. That is when Claude and the author changed *the same passage*. Here is how it plays out:

1. Claude reads chapter 3 and proposes a new version of paragraph 12.
2. Before the author reviews it, they rewrite paragraph 12 by hand in Writing Studio.
3. Now Claude's proposal is based on text that no longer exists.

Always pulling is correct here too. The manual rewrite must stay. But Claude's proposal for paragraph 12 can't be applied blindly anymore. It should be marked "outdated: you changed this passage after Claude suggested it". The author can then:
- drop the suggestion,
- look at it next to their own version, or
- ask Claude to redo it.

That is not "rejecting the Writing Studio change". It is "this suggestion no longer fits".

**Other edge cases to think about:**
- **Deleted in Writing Studio:** you delete a chapter, but Claude edited it in Staging. Most likely the suggestion becomes outdated, not the chapter coming back.
- **Agent mid-work:** Claude is writing several chapters while you edit in Writing Studio. Each suggestion needs to remember which version it was based on, so nothing is applied on top of the wrong text.
- **Book-level fields** (name, word goal, task board): the same rule applies. Live wins, and a suggestion based on an old value is outdated.

**What this means for the design.** Staging stops being a second copy of the book. It becomes a list of *proposed changes*, each tied to the version it was based on. The author's live book always shows through. This is how Google Docs "suggesting" mode and GitHub pull requests work. A PR is based on a commit, and the reviewer sees exactly what the PR changes, not a two-way sync.

Treat this as the starting recommendation, not a decision. Decide it with the author in the session.

## 6. Possible directions (for the session to choose from)

### A. "Suggestions" model (recommended starting point)

- Claude's connector writes **proposals**, not a copy of the book. Each proposal is based on a specific version of a chapter, element or setting.
- Staging always shows the live book plus the open proposals. There is no Pull, because the live book is always current.
- The review screen is a list of proposals. Each one has **Apply** and **Discard**, and maybe **Edit before applying**.
- Applying a proposal changes only what it touches (for example paragraphs 12–14), never the whole chapter. Your other manual edits stay.
- If the live text under a proposal has changed since Claude read it, the proposal is marked outdated and cannot be applied blindly.
- Grouping: by Claude session or "batch", e.g. "Claude, Nov 21: tightened chapter 3 dialogue (7 changes)". This matches how the author works: one request to Claude, one batch to review.

### B. Keep the copy, fix the sync

- Keep the full staged copy, but store the base text at each sync. Then a real three-way merge becomes possible: manual changes are kept automatically, and only overlapping edits need a choice.
- Auto-pull live changes into Staging when they don't overlap.
- Cut the UI down to one review list with Apply/Discard.
- Less rewrite work, but the "two books" mental model stays.

### C. Minimal: review inside Writing Studio

- No separate Staging Room page. Claude's proposals appear inside Writing Studio as tracked changes (like Word's track changes) that the author accepts or rejects in place.
- This is the most natural for a writer. It is also the most work in the editor (Slate) and the hardest on mobile.

## 7. Product questions to ask the author

Ask these in small groups, not all at once. Each answer should change the design. Mark the ones that do not.

**The workflow**
1. Walk me through the last time you used Claude on your book. What did you ask for? How big was the change: one paragraph, one chapter, the whole book?
2. How often do you edit the same chapter by hand while Claude's changes are waiting for review? Minutes apart, or days?
3. Do you review right after Claude finishes, or later in a batch? On which device?
4. Do you ever start several Claude edits on different chapters before you review any of them?
5. Do you use the staged copy for anything other than reviewing Claude? Bulk imports, experiments, old filesystem projects?

**What "review" means to you**

6. When you look at a Claude change, what decides yes or no? Reading the new text alone, seeing the old next to the new, or reading it in context of the chapter?
7. Do you want to approve paragraph by paragraph, or chapter by chapter? Or both?
8. Do you often want *most* of a change but to tweak a word first? (That decides if "edit before applying" is needed.)
9. Do you want to know *why* Claude made a change? (Claude could attach a short reason to each proposal.)
10. After you approve, should it go live immediately, or should there still be one final "publish" step?

**Safety**

11. What would "lost work" look like for you? Text, notes, drafts, planning links, task boards?
12. If you and Claude changed the same paragraph, what should happen by default?
13. Do you need Undo after applying a change? For how long?
14. Should Claude be allowed to delete things (chapters, notes, drafts, characters), or only propose a deletion you approve?

**Scope: what to cut**

15. Which of these did you actually use? Compare, Pull, Push, Accept, Reject scopes, History, Restore, Staging editor, AI Edit in Staging, Import folder, hidden books, Connection tab.
16. Is editing inside Staging needed? Or is "discard and ask Claude again" or "apply and fix it in Writing Studio" enough?
17. Which fields does Claude really change? Probably chapter text, maybe notes and planning. If Claude never touches task boards or publishing settings, review can ignore them at first.
18. Do you need several staged books at once, or one at a time?

**Mobile**

19. What do you want to do on the phone: only approve/discard, or full review with the diff?
20. Inline diff (one column, deleted text crossed out) or "before / after" cards?

**Success**

21. How will we know the rebuild worked? Suggested measure: you can review a typical Claude edit in under 2 minutes, without reading any help, and nothing you wrote by hand is ever lost.

## 8. Suggested session plan

1. **Discovery (talk, no code).** Go through section 7. Watch the author do a real Claude edit if possible. Write down the core jobs-to-be-done.
2. **Decide the model.** A, B or C (section 6). Write it in plain words, with a "what Staging is / is not" list.
3. **PRD.** Save it as a markdown file in `docs/`, like `docs/epub-reader-prd.md`. Include: goal, user, jobs, user stories, scope in/out, data model, connector (MCP) changes, safety rules, mobile, success criteria, migration of existing staged books.
4. **Screens.** Design desktop and mobile together, as an Artifact with artboards (the 2026-11-22 design was https://claude.ai/artifact/RvJA2T8Y7yf1Avswcaf87W; it shows what *not* to do in scope). Keep to 3–4 screens if possible: inbox/list → review one change → done. Reuse ROZA's existing components and styles (AGENTS.md rule).
5. **Review with the author.** Cut until it feels obvious.
6. **Build plan.** Decide what to delete and what to keep. The backend guards are worth keeping: Mongo storage, backups, validation, connector auth, the revision and lease locks. Then build in small steps, each one shippable.

## 9. Constraints and rules to respect

- **Production:** the app runs against `prod_roza_db`. Never deploy or restart production without the author's explicit instruction (AGENTS.md). Commit/push ("CP"/"CCP") do not include deploying.
- **Where to work:** work on `main` in `C:\dev\Roza` ("DRM"). The author prefers no feature branches or worktrees.
- **Backend runtime:** CommonJS via ts-node. Use `import type` for anything from `shared/types`, and verify the backend dev runtime actually starts (AGENTS.md, ticket #23).
- **Connector:** least-privilege DB access. History is stored on the project row because the connector may not have rights to new collections. Changing what the connector can write needs care, plus updates to `docs/claude-connector.md`.
- **Same schema as Writing Studio:** staged data uses Writing Studio's own book schema (`docs/staging-room.md`).
- **Existing data:** the author has staged books in production (e.g. "Ann and Allan"). The rebuild needs a migration or a clean cut-over. Ask which.
- **Studio actions** go in the ••• menu as dialogs, not new pages (author preference). Ask whether that applies to the new review entry point.
- **Writing style:** simple, clear English (see the author's global CLAUDE.md).

## 10. What to keep from the current build

Worth reusing, whichever direction is chosen:
- Diff engine: `review.ts` `diffBlocks`, `changeRuns`, `align`. It is paragraph diff with word marks, and it is tested.
- `revert.ts` logic for splicing one text change and shifting note anchors (`shiftNotes`, `reattachNotes`). This is the core of "apply only paragraphs 12–14".
- Change-source recording (`history.ts`). Knowing a change came from "Claude" vs "you" is useful for grouping into batches.
- The Staging editor's AI Edit endpoint override (`AiEdit.tsx` `endpoint`), if editing stays.
- Backups before every write.

Likely to remove: Pull, Compare as a separate action, direction/conflict labels, Accept marks separate from applying, the six reject scopes, part tabs for rarely changed fields, the Connection tab, the bottom Activity log.

## 11. Opening prompt for the next session

Paste this to start:

> Read `docs/staging-room-rethink-handoff.md`. Act as my product manager. Don't write code yet. Start discovery with me using the questions in section 7, a few at a time. Then help me pick the model, write the PRD, and design desktop + mobile screens.
