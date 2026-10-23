# EPUB Reader — Product Requirements Document

Status: Draft for review
Date: 2026-10-23
Product: Roza
Scope: Desktop personal preview

## 1. Purpose

Add a reader to Roza that lets the user read English EPUB books, look up Hebrew meanings, hear English pronunciation, and discuss passages or the book through typed AI chat without leaving the reading experience.

The first release is for the owner's personal use on a PC. It stores data per user and restricts the feature through a backend feature flag and user allowlist. This document defines the intended product; implementation has not started.

## 2. Goals

- Read an uploaded EPUB comfortably with familiar Kindle-style controls.
- Understand unfamiliar English words quickly, without paying for an AI request for every dictionary lookup.
- Automatically collect looked-up words for later review and future learning features.
- Ask questions about a selected passage or the book and revisit saved conversations.
- Resume reading with the same position and reader preferences.

## 3. First-release scope

| Included | Deferred |
| --- | --- |
| Desktop browser experience | Phone, tablet, and Kindle-browser optimization |
| Private per-user EPUB library | Shared libraries and public book distribution |
| DRM-free reflowable EPUBs, including EPUB 2 | DRM handling, PDF, comics, and fixed-layout EPUB support |
| Adjustable typography, pagination, and scrolling | Full Kindle feature parity |
| English-to-Hebrew dictionary lookup | Automatic AI translation on every lookup |
| English word pronunciation | Full-book narration and voice chat |
| Saved words and a basic vocabulary screen | Vocabulary export, flashcards, quizzes, and proficiency scoring |
| Typed AI chat with saved conversations | Autonomous AI agents and web research |
| Saved reading state and preferences | Guaranteed offline reading, synchronization, or chat |

## 4. Users and access

The initial user is the Roza owner reading English books and learning unfamiliar words.

- A backend feature flag enables or disables Reader functionality.
- Separate development and production allowlists identify permitted Roza user IDs. The owner will provide those IDs before environment rollout.
- Unauthorized users do not see Reader navigation and cannot access its API endpoints, book files, vocabulary, or conversations through direct requests.
- Every uploaded file and saved record belongs to a user. Access is checked on the backend, including when IDs are supplied directly.
- EPUB reading projects remain separate from Roza's existing book-writing and review entities.

## 5. Primary journeys

### Upload and read

1. Open Reader from Roza navigation.
2. Upload an EPUB to a private library.
3. See the available title, author, and cover metadata, with usable filename/text fallbacks when metadata is missing.
4. Open the book, navigate its contents, and adjust the reading presentation.
5. Leave and return to the saved position with the previous preferences restored.

### Look up a word

1. Select a word in the reading text.
2. Choose the Hebrew dictionary lookup action from a compact selection menu.
3. See the English word, Hebrew meanings, and a pronunciation button.
4. Expand available additional dictionary information, such as alternative meanings, explanations, or examples.
5. The successful lookup is saved to vocabulary automatically, or updates the existing word's counter.

### Discuss a passage or book

1. Select a sentence or passage and choose Ask AI, or open chat directly for a general book question.
2. A side panel shows the selected passage when applicable and accepts a typed question.
3. The AI responds in the language of the question using bounded relevant book context.
4. Continue the conversation, start another conversation, or reopen a saved one later.

### Review vocabulary

1. Open Words from the Reader library or reader toolbar.
2. Review saved English words, Hebrew meanings, and lookup counts.
3. Use pronunciation and view available book/context information.

The vocabulary screen is not an item inside the text-selection dropdown.

## 6. Functional requirements

### 6.1 Library and EPUB upload

- Accept DRM-free, reflowable EPUB files and validate the upload before making it available.
- Preserve the original file and associate it with the uploading user.
- Display upload/processing progress or status, success, and actionable failure messages.
- List the user's books and allow opening and deleting them.
- Detect malformed, unsupported, or encrypted content and explain when the book cannot be opened.
- Enforce a documented upload size limit. The exact limit is an implementation decision; it must comfortably support the 2.34 MiB sample EPUB.
- Do not execute scripts or trust active content embedded in uploaded EPUBs.

### 6.2 Reader presentation and navigation

- Provide adjustable font size, a small choice of readable fonts, line spacing, and reading width/margins.
- Provide light, dark, and sepia presentation options.
- Support both continuous vertical scrolling and paginated reading.
- In paginated mode, provide visible previous/next controls and keyboard navigation. Navigation must not interfere with text selection or typing in chat.
- Show the book's table of contents when available and allow section navigation.
- Support full-screen reading and an indication of reading progress.
- Preserve readable text, embedded images, and meaningful document structure while allowing typography overrides.
- Display English text and Hebrew results correctly together, including right-to-left Hebrew content.
- Save reading position on navigation and at sensible intervals; do not rely exclusively on closing the tab.
- Save a stable content location rather than only a visual page number, so font-size and layout changes do not lose the place.
- Restore the book's last saved position and the user's saved reader preferences on reopening.

These are a bounded set of Kindle-style reading controls, not a commitment to reproduce every Kindle function.

### 6.3 Dictionary lookup

- Use a downloaded English-to-Hebrew dictionary as the default source, without an AI request or paid translation call per lookup.
- Normalize capitalization and surrounding punctuation, and resolve common inflected forms where possible while preserving the original selected word.
- Show multiple meanings when available; do not imply that a static dictionary has identified the correct contextual meaning.
- Show Hebrew meaning immediately after lookup completes. Offer expandable alternatives, explanations, and examples only when available in the dataset.
- If the word is missing or more contextual explanation is needed, offer an explicit Ask AI action. Never silently fall back to a paid API.
- Dataset selection depends on verified English-to-Hebrew coverage, literary vocabulary, redistribution terms, attribution, size, and support for inflected forms.
- Treat unavailable dictionary details honestly rather than inventing examples or definitions.

### 6.4 Pronunciation

- Put a speaker/play button next to the English word in lookup results and vocabulary entries.
- Start playback only after a user action and support replay.
- Use an English voice, with a clear message if pronunciation is unavailable.
- Begin by evaluating browser/device speech synthesis on the target PC. Choose a different speech service only if that quality is inadequate.
- No requirement for paid speech generation or sentence/book narration in this release.

### 6.5 Saved words and learning foundation

- Automatically record each successful dictionary or explicit AI word-translation lookup.
- Maintain one vocabulary entry per normalized English headword per user, shared across that user's books. Inflected forms should map to the headword when reliably resolved.
- Retain the original encountered forms, Hebrew meanings, and useful book/passage references within that entry. Preserve distinct contextual meanings rather than overwriting them.
- Increment the lookup counter once per deliberate successful lookup, including repeated lookups. Retries, re-rendering, expanding details, and pronunciation replay do not increment it.
- Store first and most recent lookup timestamps and source provenance.
- Provide a basic vocabulary screen with search and sorting by recent lookup, word, and lookup count.
- Do not display an English proficiency level inferred solely from word lookups. The saved data supports later learning and assessment features.
- Structure the data so future export of all saved words is possible. An export button is outside this release.

### 6.6 AI conversations

- Use OpenAI through the backend for typed chat. API keys must never be exposed to the browser.
- Support both passage-anchored conversations and general conversations about the currently open book.
- Keep the quoted selection visible when starting from selected text.
- Associate each conversation with its user and book. Save user and assistant messages, timestamps, passage anchors when applicable, and spoiler preference in the database.
- Allow creating, listing, reopening, and deleting conversations for a book.
- Respond in the language used for the current question, including Hebrew or English.
- Provide visible generating, error, and retry states. Failed requests must not appear as successful answers or duplicate saved messages on retry.
- Keep the reader available while chat is open and preserve its position when chat is opened or closed.

### 6.7 Book context and spoilers

- Do not assume title/author recognition gives the model reliable knowledge of the uploaded edition.
- For passage questions, provide the selected text and a bounded amount of surrounding context.
- For general questions, retrieve a small number of relevant excerpts rather than sending the entire EPUB with each message.
- Limit request context, answer size, and conversation-history payload. Older conversation history can be summarized when necessary.
- By default, avoid spoilers beyond the user's current reading position at the time of the question, regardless of previously reached positions or earlier reading history.
- Restrict automatically selected book context to that current position, and instruct the AI accordingly. If available context is insufficient, ask for clarification or acknowledge the limitation.
- If the user explicitly says spoilers are acceptable, permit discussion of later content for that conversation. This permission does not change other conversations.
- No furthest-read tracking, mark-as-read workflow, or elaborate spoiler controls are required.
- Spoiler avoidance is best effort because the model may have prior knowledge. Previously saved conversation messages remain visible when reopening a chat; moving backward does not erase earlier answers.

## 7. Data and storage

Use the existing MongoDB deployment for the first release. Store original EPUB binaries through GridFS, with ordinary collections for metadata and user state. S3 is not required initially. Do not store an EPUB as base64 inside an ordinary book document.

| Record | Main information |
| --- | --- |
| Reader book | Owner, original file reference, title, author, cover reference, import status, file size |
| Reading state | Owner, book, stable current location, progress, update timestamp |
| Reader preferences | Owner, typography, theme, layout/navigation mode |
| Vocabulary entry | Owner, normalized word, encountered forms, meanings, lookup count, timestamps, source and book contexts |
| AI conversation | Owner, book, optional selection/location anchor, spoiler permission, timestamps |
| AI message | Conversation, role, content, timestamp, request/status information |
| Book context/index | Book association, ordered text sections and locations needed for bounded retrieval |

The precise schemas and indexing strategy belong to technical design. EPUBs, words, and chats must remain private per user even if a shared dictionary dataset is used.

Proposed deletion behavior: deleting a book removes its original file, derived book data, reading state, and book conversations. Saved vocabulary remains, with its former book reference marked unavailable. Confirm this behavior in the UI before deleting a book.

## 8. Reliability, privacy, and cost

- Render EPUB content in an isolated/sanitized environment; reject unsafe archive paths and enforce extraction/resource limits.
- Keep uploads private and avoid logging full book passages, chat content, or secrets unnecessarily.
- Send only the context needed for the explicit AI action to the provider; uploading a book must not automatically send the whole file to OpenAI.
- Display actionable errors for upload, dictionary, pronunciation, chat, and save failures without losing the reading position.
- Keep AI calls behind backend authorization and reasonable request/rate/context limits. No calls should be triggered simply by opening a book or selecting text.
- Dictionary lookup should feel immediate after dictionary initialization. Exact performance budgets will be established during the reader prototype and tested on the sample book.
- Full offline functionality is not promised. Browser-local dictionary lookup may work offline, while saving and AI require connectivity.

## 9. Acceptance criteria

1. An allowlisted user uploads the sample EPUB, sees it in their private library, and opens readable content with images and contents navigation.
2. A non-allowlisted user cannot use Reader endpoints, and another user cannot fetch the owner's file or records by ID.
3. Font-size changes and switching between pagination and scrolling preserve the content location. Reopening restores the saved place and preferences.
4. Selecting an English word opens Hebrew dictionary results without making an AI request. Missing words show a clear fallback action.
5. Clicking the speaker plays English pronunciation without adding another vocabulary lookup.
6. Looking up the same word twice produces one vocabulary entry with a count of two; the Words screen is accessible outside the selection menu.
7. Selecting a passage starts a typed conversation with that passage attached. General chat also works without a selection.
8. Chat messages survive a refresh and can be reopened for the same book. Conversation and message ownership is enforced.
9. Requests normally use context up to the current reading position. Explicit spoiler permission applies only to the relevant conversation.
10. AI requests contain bounded context and do not resend the whole book on every question.
11. English reader text, Hebrew meanings, and Hebrew chat render in the correct directions.
12. Malformed or unsupported EPUBs and provider failures yield understandable messages without corrupting existing reading state.

## 10. Sample and validation

Use the owner's supplied copy of *In the Shadow of Young Girls in Flower* as the initial compatibility fixture without committing or distributing it.

Initial inspection found EPUB 2.0, English metadata, approximately 2.34 MiB, 15 XHTML documents, 3 images, and no EPUB encryption manifest. Reflowable layout appears likely; actual rendering still needs verification.

Validate dictionary coverage against representative literary vocabulary from the file, including uncommon words, inflections, punctuation, and words with several meanings. Dictionary quality is a dependency to resolve before promising coverage.

## 11. Proposed delivery sequence

1. Establish backend access gating, private library storage, upload validation, and a reader prototype using the sample EPUB.
2. Add reading controls, stable position persistence, and preferences.
3. Evaluate and integrate the dictionary and pronunciation; add vocabulary persistence and the Words screen.
4. Add typed AI chat, bounded book-context retrieval, persistence, and the simple spoiler rule.
5. Verify ownership boundaries, failures, rendering, usability, and the complete acceptance criteria.

## 12. Decisions pending technical validation

These do not block PRD review:

- EPUB renderer choice and the exact supported browser baseline.
- Dictionary dataset, coverage, licensing, download size, and whether lookup runs locally in the browser or on the server.
- English speech voice quality on the owner's PC.
- OpenAI model, API billing configuration, context limits, and spending budget.
- Book-context retrieval/indexing method and upload size limit.
- Development and production allowlisted user IDs.

The added reader control defaults, conversation deletion, vocabulary search/sorting, and book deletion behavior above are proposed usability defaults for review. No implementation, commit, or push is authorized by writing this PRD alone.
