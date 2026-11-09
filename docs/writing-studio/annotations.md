# Contextual chapter annotations

Implemented on `codex/inline-annotations-dev`, based on the current development checkout. No merge or deployment is included.

## Author experience

The manuscript is the only primary editor. Its gutter numbers logical paragraphs (including headings, block quotes and list items). Hovering a paragraph or its gutter reveals **+**. The button is always available on touch layouts and through keyboard focus. **+ Note** in the toolbar annotates a selected passage, or the current paragraph when the selection is collapsed. An indicator marks annotated paragraphs. Only the gutter indicator or a note card opens an existing note; clicking manuscript text leaves notes unchanged.

Notes appear in the right margin. Their collapsed previews keep the text prominent; selecting one expands it and highlights its text. Only one note is expanded at a time. Notes autosave through the same serialized, conflict-protected DraftStore as the manuscript. There is no separate Save button; failures and draft recovery use the existing manuscript controls. **Delete** opens an app-styled confirmation dialog with Cancel and Escape support. Existing rich-text chapter descriptions remain intact and editable through **Summary**, a separate chapter summary view; no arbitrary passage is assigned to old notes. Summary formatting and autosave preserve the manuscript and its annotations.

On narrow screens, previews follow the manuscript and the selected card opens at the bottom of the viewport. It can be closed using the minus button. Existing light and dark appearance variables style all annotation surfaces.

## Anchors and document edits

Each chapter optionally contains `annotations: [{ id, content, quote, anchor }]`. The anchor is a Slate range with two `{ path, offset }` points. The editor wraps Slate's `apply` and transforms these ranges using `Range.transform` for every operation, before Slate mutates the document. Text and transformed annotations are submitted together in one chapter update. Inward range affinity keeps adjacent inserted text outside the original selection. Empty (collapsed) anchors use backward affinity so Enter leaves their note on the original paragraph. Inserting blocks, splitting/merging paragraphs, marked leaves, list nesting and moving nodes use Slate's operation semantics rather than guessed offsets.

A range removed by an operation, or an originally expanded range reduced to nothing, becomes unattached. Content and its original quotation remain available. Invalid loaded ranges are treated as unattached. Select replacement text and use **Attach to selected text** to reconnect one.

Slate does not model browser-wrapped visual lines as persistent document nodes. The gutter therefore counts logical text blocks, rather than assigning unstable numbers to every visual wrap. A selected-passage note can identify a more precise range within a paragraph. Browser DOM ranges locate the actual range start, and DOM block bounds align the gutter. ResizeObserver, font readiness and animation-frame measurement keep positions accurate after edits and reflow. Text and the margin share a scrolling surface, so scrolling does not require competing scroll listeners or per-scroll React updates.

## Layout and temporary dragging

An expanded card reserves its measured height at its anchor. Other cards collapse to a compact preview and flow around that reserved space with a small gap. The selected card has a higher stacking order; a dragged card is higher still. Measurements of deleted cards are filtered before rendering to avoid a stale-layout crash. Anchor/line maps and a sorted layout avoid pairwise collision calculations.

The drag grip uses pointer capture, disables text selection on the grip, and leaves the textarea and manuscript scrolling alone. Floating coordinates live only in mounted React state. Nothing in the API or database stores them. Refreshing or switching chapters recreates the default anchored positions. **Return to margin** resets one note immediately. The grip also supports arrow keys and Escape, and resize handling keeps floating cards inside viewport bounds.

## Storage and compatibility

The shared Chapter type and Mongoose chapter schema gain the optional annotations field. Structured subdocuments validate nonnegative integer paths and offsets and bound content/quotation length. The existing book update API and compare-and-swap save behavior remain in use; no endpoint or database migration is required. Older chapters omit the field and load normally. Legacy descriptions retain their original Slate formatting. No drag coordinates are allowed by the annotation schema. Deploy the matching backend schema before using the new frontend against a server.

## Verification

Commands from this worktree:

```powershell
node --test scripts/writing-annotations.test.cjs scripts/writing-annotations-schema.test.cjs scripts/writing-studio.test.cjs
$env:PLAYWRIGHT_MODULE = 'C:/Users/אריק/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node --test --test-force-exit scripts/writing-annotations.browser.test.cjs scripts/writing-studio.browser.test.cjs
cd frontend
npm run build
npm run lint
cd ../backend
npm run build
```

The browser fixture uses real Studio/Slate components and a local in-memory API; it requires no production data or credentials. Coverage includes hover/touch alternatives, creation, selected-passage notes, manuscript clicks preserving collapsed notes, autosave, switching notes, insertion before anchors, temporary dragging, chapter reopen/refresh resets, deletion, chapter summary editing, formatting and persistence, reattachment, viewport reflow, dark appearance and a 180-paragraph chapter with 81 annotations. Unit tests cover split/merge/undo, deleted anchors, invalid loaded positions, empty paragraphs, 500 crowded cards and schema round trips. Existing save/recovery/export tests remain included.

Screenshots are in `annotation-screenshots/` (desktop, floating, crowded, mobile and dark). Lint has seven existing warnings outside the changed components, with no errors. The frontend build retains its existing Browserslist age and bundle-size warnings.

## Limits and tradeoffs

- Numbers identify logical paragraphs, not every browser-wrapped line. Changing width preserves their meaning.
- Note edits and manual reattachment are outside manuscript undo/redo history. Undoing a deletion does not silently reconnect an unattached note; authors can reattach it explicitly.
- Collapsed notes may move down from their exact text position to avoid collisions; the active card returns to its anchor. Text highlights and gutter indicators retain the association.
- Mobile uses a selected bottom card rather than compressing a second column beside the text.
- The browser fixture validates API payload persistence and the schema tests validate Mongoose casting/round trips; these checks do not run a live MongoDB server.
- The editor and annotation list are rendered without virtualization. The tests cover 180 paragraphs / 81 notes and a 500-card layout calculation, rather than a measured upper performance limit.
