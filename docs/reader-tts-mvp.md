# Audiobook Mode — System and OpenAI voices

The UI follows the supplied `roza_audiobook_follow_along_footer_v3.html` reference: slim mode header, warm paper/serif reading area, sentence and word highlights, automatic follow-along scrolling, and a fixed transport footer. The narrator picker follows `roza_audiobook_voice_modal_fixed.html`. The reading reference is a simulated timer-only preview. Roza uses real EPUB text and real `window.speechSynthesis` speech.

The narrator modal offers **System voices** and **OpenAI voices**. Kokoro, its worker, model downloads and package dependency remain removed. There is no Generate step: press Play and narration advances automatically through the book.

## Behavior

Open Reader menu → Audiobook Mode. The menu order remains Go to page, Review later, Sentence Mode, RSVP, Audiobook Mode, Settings.

- **Play/Pause:** starts at the current sentence/word from the existing reader CFI anchor. Reads continuously across sentences and linear EPUB sections. Long sentences are spoken in bounded chunks.
- **Previous/Next sentence:** moves within the current section or across section boundaries. Playing continues; paused navigation stays paused.
- **Seek:** the footer bar moves to a word within the displayed EPUB section. Dragging commits on release; keyboard changes also work.
- **Speed:** opens the reference-style popover, 0.5×–2.5×. System speech restarts at the last reported word. OpenAI changes the decoded audio's playback rate locally without regenerating it (Web Audio also changes pitch).
- **Voice:** the footer button opens the reference-style **Choose a narrator** modal (centered desktop dialog / mobile bottom sheet). It lists installed system voices, updates on asynchronous `voiceschanged` events, searches voice names/languages, and offers an English-only filter. Select a card, optionally preview it using real system speech, then **Use this voice** to apply; Cancel/close/backdrop/Escape discard the staged choice. Browser-default narration remains available even if no voices are enumerated.
- **Exit:** stops speech, restores focus/normal reader controls and returns the EPUB reader to the current sentence CFI.
- **Keyboard:** Space toggles playback when focus is in the reading area; arrow keys move by word. Escape dismisses a popover first, then exits the mode. Focus stays within the open mode.

Text extraction reuses the existing sentence and CFI helpers, preserves paragraph grouping and inline text, and excludes scripts, hidden content and note-reference text. One spine section is rendered at a time; titles come from existing Contents navigation rather than invented chapter numbers. Non-linear/empty sections are skipped during continuous reading.

The narrator modal pauses book narration before any preview. Closing it resumes from the same reading position only if the book was playing before opening; applying while already paused keeps it paused. Previews are stopped on close, replacement, errors or app hide, and stale preview events cannot cancel resumed narration. Hiding the app also suppresses automatic resume when the modal closes. Native dialog semantics, keyboard focus wrapping/return, viewport-height limits and 16px mobile search input support touch and keyboard use.

## Bounded text rendering

The complete current section remains in the document as ordinary paragraph text: no virtual-scroll placeholders, estimated heights, hidden text or scroll-triggered loading. The text subtree and each paragraph are memoized, so opening the voice modal or changing player status does not re-render the chapter. Only the active sentence receives individual word elements, capped at a stable 64-word window around the current spoken position; text before and after that window remains exact plain text. Highlighting and seeking retain the original sentence/word offsets and CFI source. This preserves native full-section scrolling and copy/find text while reducing modal/layout work.

## Real synchronization and timing limits

Sentence highlighting and advancement use real speech events. Dark word highlights use native word-boundary events only; no timer animates or guesses spoken words. If a voice does not emit boundaries, sentence follow-along still works. The footer indicates sentence or word follow-along.

Native mobile pause/resume behavior varies, so Pause cancels the current utterance and retains the last real word boundary. Play resumes there. Without boundary events, it repeats the current short speech chunk. Voice/speed/seek changes also cancel the old utterance; stale callbacks cannot advance playback.

Web Speech has no exact recording duration or audio seek timeline. Elapsed/remaining values are explicitly **estimated section timing**, based on text progress and 180 words/minute adjusted by speed. They are not measured audio timestamps or whole-book duration. The progress bar seeks through text within the current section; Previous/Next and automatic playback cross sections.

Hiding the app pauses speech. Background/locked-screen playback is not guaranteed. There are no offline downloads, database changes or separate persistent audiobook progress. Normal EPUB position saving is reused when exiting.

## OpenAI playback

The existing Node backend calls OpenAI; EC2 performs no model inference and needs no Python service or second container. See [backend setup and API contract](../backend/docs/audiobook-openai-api.md). Install both frontend/backend dependencies. Enable `READER_AUDIOBOOK_ENABLED=true` in the backend's normal environment and configure `OPENAI_API_KEY` (or `READER_AUDIOBOOK_OPENAI_API_KEY`). Restart only your local development backend after configuring it. No key belongs in a frontend/Vite environment variable. The capability endpoint checks configuration, not OpenAI account permissions or credit.

Open Reader menu → Audiobook Mode → Choose narrator → OpenAI voices → choose a voice → Use this voice → Play. The picker discloses AI-generated speech and API charges. Choosing a voice does not make a paid preview request. With the feature disabled or configuration unavailable, System voices remain usable and the picker explains why OpenAI is unavailable.

The frontend sends precise source CFIs, never arbitrary text or a provider key. The server extracts the passage from the owned EPUB and returns authenticated WAV audio. Long sentences are split automatically at at most 600 UTF-16 characters, preserving inline-node/whitespace offsets and Unicode boundaries. A resumed/seeked passage begins at the selected word. The browser verifies returned source text before playback; unusual EPUB source differences (for example, embedded note references excluded by the reader) stop with an explanation and a System voices option.

Web Audio is unlocked in the Play/apply user gesture before fetching. Adjacent short sentences and paragraphs are grouped into passages of at most 600 characters. While the current audio plays, the next passage is generated and decoded, including the first passage of the next linear section. Normal advancement consumes that prepared audio (or waits for the same in-flight request), rather than starting generation after every sentence. Only one provider request runs at a time; no full chapters/books are generated. Initial loading is still required, and a buffer underrun can occur if generation/network latency exceeds the current audio's remaining duration. This is bounded look-ahead, not a gapless playback guarantee.

OpenAI supplies no word or sentence timestamps, so the actual multi-sentence passage is highlighted as a whole, without invented word/sentence timing. Text and native scrolling remain complete, and individual word elements remain capped at 64. The section progress bar remains a text-based estimate and advances at passage boundaries.

Pause retains the current decoded buffer and its actual playback offset; resume and speed changes do not require regeneration of that passage. Pause, seeking, changing narrator, hiding the app, or exiting aborts outstanding look-ahead requests and cancels the corresponding server job. Opening the narrator modal pauses playback; Cancel resumes the same buffer if narration had been playing. At most two decoded passages (current and next) are retained in memory. Look-ahead may incur a charge for one passage the user stops before hearing. The backend also has a bounded, temporary, per-owner audio cache; there is no persistent browser audio cache. Prefetch failures let current audio finish and surface when playback reaches the failed passage, without an automatic paid retry. The user can retry Play or explicitly choose System voices.

Manual listening should compare the same passage using Previous sentence and each engine at 1×. Check initial playback, automatic advancement, seek into a long sentence, pause/resume, voice changes, speed, network failures, hide/return and exit. OpenAI requires internet and server-side account/model access. No model download is required on the phone.

## Local verification

1. `npm ci --prefix frontend`, then start Roza using its usual local backend/frontend setup.
2. Open an EPUB at a known position and enter Audiobook Mode from the reader menu.
3. Select an installed voice and press Play. Listen for actual speech. Check sentence/word follow-along, automatic scrolling, Pause/Play, Previous/Next, seeking, speed, and crossing a section.
4. Test a voice without word-boundary support: sentence highlights should continue without fabricated word motion.
5. Exit and confirm the normal reader returns to the current sentence. Check app hide/return, voice errors, rotation, safe areas, and narrow/landscape viewports.

Automated checks:

- `node --test scripts/reader-tts.test.cjs`: UTF-16 word offsets, bounded long-sentence chunks, Unicode-safe continuation, seeking and estimate formatting.
- `node --test scripts/reader-openai-audio.test.cjs`: bounded source ranges, audio pause/resume, local speed changes, cancellation races, stale generation rejection, source-text mismatches, quota errors and audio-context interruptions.
- `node --test --test-force-exit scripts/reader-tts.browser.test.cjs`: real EPUB source, paragraph grouping, starting position, actual Web Speech calls via a mocked browser speech API, delayed voices, boundary-driven highlights, pause/resume, stale callback rejection, sentence/section navigation, seek/speed, errors, exit cleanup, and desktop/375px/320px/landscape layout.
- Optional `TTS_SCREENSHOT=/absolute/path/example.png` saves desktop/mobile screenshots and speed popovers. Tests accept `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHANNEL` (default `msedge`).
- `npm run build --prefix frontend` and focused ESLint checks validate the production bundle and new component/hook/services.
- Existing RSVP, annotations, mobile toolbar and sentence-navigation checks cover nearby reader behavior.

Screenshots and automated behavior checks use desktop Edge/Chromium, with speech APIs mocked to provide deterministic boundary/error events. They do not verify audible OS output or physical iPhone Safari/PWA behavior. Those require manual device listening. The inherited Sentence Mode width assertion was previously reproduced identically on untouched main and is outside this change.

OpenAI integration validation on 2026-11-17 uses mocked HTTP/audio in desktop and mobile-sized Edge, plus local backend HTTP/WebSocket fixtures. It verifies engine selection, source CFIs, AI disclosure, no paid preview on selection, automatic passage advancement, real buffer offset bookkeeping, local speed changes, engine switching, quota errors and cleanup. No live paid OpenAI call or physical iPhone Safari/PWA listening has been verified. Test screen-active playback on an iPhone before relying on it; no background/lock-screen guarantee is made.

Buffered-flow update on 2026-11-17: production build, focused lint and 21 focused unit/browser checks passed. Tests verify multi-sentence/cross-paragraph grouping, exact source endpoints, complete text across long-sentence splits, generation starting before current audio ends, consuming a ready or in-flight request without regeneration, chapter look-ahead, pause cancellation, failed-prefetch behavior, native speech regression and the 64-word-element rendering bound. Desktop/mobile screenshots were reviewed. Audio/provider calls are mocked; live generation speed and physical iPhone playback still require listening tests.

Validated on 2026-11-16: production build, focused ESLint and all 21 selected audiobook/RSVP/mobile-toolbar/annotations/sentence-navigation/content-security checks passed. Desktop and mobile screenshots were visually reviewed; 320px and landscape footer/control bounds passed. OS voices may require installed voice downloads or network depending on the platform; Roza adds no TTS server or model download.

Narrator-modal update validated on 2026-11-16: build, focused ESLint and all 21 selected checks passed, including asynchronous voices, staged Apply/Cancel, search/language filtering, actual preview API calls, preview cancellation/error/late events, narration resume, background handling, focus wrapping/return, search-field Escape, backdrop dismissal, and 320px/landscape bounds. Desktop/mobile screenshots were visually reviewed. Preview audio remains unverified on a physical iPhone.

Bounded-rendering update validated on 2026-11-16: build and focused lint passed. Long-chapter checks preserve every sentence, exact paragraph text, native scroll height/end reachability and modal scroll position; the word-element count stays at or below 64, including a 2,000-word sentence, and modal open/close causes no chapter DOM mutations. A parallel regression run passed 22/24 checks; its annotation parent/desktop color assertion failed once, and the annotation suite passed unchanged when rerun alone.

Local development Edge profiling with 4× CPU throttling, 7,135 words and 60 visible voices reduced word elements from 7,135 to 19 at the initial position. Text SHA-256 and scroll height (55,119px) matched exactly. Warm click-to-next-paint opportunities changed from 479–535ms to 107–146ms (cold: 569ms to 229ms). Speech was mocked; this isolates rendering/layout and is not an iPhone or native speech-cancellation measurement.
