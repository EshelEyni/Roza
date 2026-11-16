# Audiobook Mode — system-voice follow-along

The UI follows the supplied `roza_audiobook_follow_along_footer_v3.html` reference: slim mode header, warm paper/serif reading area, sentence and word highlights, automatic follow-along scrolling, and a fixed transport footer. The reference is a simulated timer-only preview. Roza uses real EPUB text and real `window.speechSynthesis` speech.

**System voices only.** Kokoro, its worker, model downloads and package dependency have been removed for now. There is no engine selector or Generate step.

## Behavior

Open Reader menu → Audiobook Mode. The menu order remains Go to page, Review later, Sentence Mode, RSVP, Audiobook Mode, Settings.

- **Play/Pause:** starts at the current sentence/word from the existing reader CFI anchor. Reads continuously across sentences and linear EPUB sections. Long sentences are spoken in bounded chunks.
- **Previous/Next sentence:** moves within the current section or across section boundaries. Playing continues; paused navigation stays paused.
- **Seek:** the footer bar moves to a word within the displayed EPUB section. Dragging commits on release; keyboard changes also work.
- **Speed:** opens the reference-style popover, 0.5×–2.5×. A change restarts speech at the last reported word using the new native speech rate.
- **Voice:** the existing ReaderSelect lists installed/available system voices and responds to asynchronous `voiceschanged` events. Browser default is available even if no voices are enumerated. Long names truncate in the footer and wrap in the upward-opening menu.
- **Exit:** stops speech, restores focus/normal reader controls and returns the EPUB reader to the current sentence CFI.
- **Keyboard:** Space toggles playback when focus is in the reading area; arrow keys move by word. Escape dismisses a popover first, then exits the mode. Focus stays within the open mode.

Text extraction reuses the existing sentence and CFI helpers, preserves paragraph grouping and inline text, and excludes scripts, hidden content and note-reference text. One spine section is rendered at a time; titles come from existing Contents navigation rather than invented chapter numbers. Non-linear/empty sections are skipped during continuous reading.

## Real synchronization and timing limits

Sentence highlighting and advancement use real speech events. Dark word highlights use native word-boundary events only; no timer animates or guesses spoken words. If a voice does not emit boundaries, sentence follow-along still works. The footer indicates sentence or word follow-along.

Native mobile pause/resume behavior varies, so Pause cancels the current utterance and retains the last real word boundary. Play resumes there. Without boundary events, it repeats the current short speech chunk. Voice/speed/seek changes also cancel the old utterance; stale callbacks cannot advance playback.

Web Speech has no exact recording duration or audio seek timeline. Elapsed/remaining values are explicitly **estimated section timing**, based on text progress and 180 words/minute adjusted by speed. They are not measured audio timestamps or whole-book duration. The progress bar seeks through text within the current section; Previous/Next and automatic playback cross sections.

Hiding the app pauses speech. Background/locked-screen playback is not guaranteed. There is no audio download/cache, server, paid TTS API, database change, or separate persistent audiobook progress. Normal EPUB position saving is reused when exiting.

## Local verification

1. `npm ci --prefix frontend`, then start Roza using its usual local backend/frontend setup.
2. Open an EPUB at a known position and enter Audiobook Mode from the reader menu.
3. Select an installed voice and press Play. Listen for actual speech. Check sentence/word follow-along, automatic scrolling, Pause/Play, Previous/Next, seeking, speed, and crossing a section.
4. Test a voice without word-boundary support: sentence highlights should continue without fabricated word motion.
5. Exit and confirm the normal reader returns to the current sentence. Check app hide/return, voice errors, rotation, safe areas, and narrow/landscape viewports.

Automated checks:

- `node --test scripts/reader-tts.test.cjs`: UTF-16 word offsets, bounded long-sentence chunks, Unicode-safe continuation, seeking and estimate formatting.
- `node --test --test-force-exit scripts/reader-tts.browser.test.cjs`: real EPUB source, paragraph grouping, starting position, actual Web Speech calls via a mocked browser speech API, delayed voices, boundary-driven highlights, pause/resume, stale callback rejection, sentence/section navigation, seek/speed, errors, exit cleanup, and desktop/375px/320px/landscape layout.
- Optional `TTS_SCREENSHOT=/absolute/path/example.png` saves desktop/mobile screenshots and speed popovers. Tests accept `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHANNEL` (default `msedge`).
- `npm run build --prefix frontend` and focused ESLint checks validate the production bundle and new component/hook/services.
- Existing RSVP, annotations, mobile toolbar and sentence-navigation checks cover nearby reader behavior.

Screenshots and automated behavior checks use desktop Edge/Chromium, with speech APIs mocked to provide deterministic boundary/error events. They do not verify audible OS output or physical iPhone Safari/PWA behavior. Those require manual device listening. The inherited Sentence Mode width assertion was previously reproduced identically on untouched main and is outside this change.

Validated on 2026-11-16: production build, focused ESLint and all 21 selected audiobook/RSVP/mobile-toolbar/annotations/sentence-navigation/content-security checks passed. Desktop and mobile screenshots were visually reviewed; 320px and landscape footer/control bounds passed. OS voices may require installed voice downloads or network depending on the platform; Roza adds no TTS server or model download.
