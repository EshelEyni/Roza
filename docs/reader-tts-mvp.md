# Ticket 47: Audiobook Mode

Open **Reader menu → Audiobook Mode**, choose an engine/voice, and press **Play**. Speech starts from the current rendered EPUB position or selected/keyboard word. Both engines continue through paragraphs and linear EPUB sections to the end of the book. No Generate button or advance book conversion is required.

The menu order is Go to page, Review later, Sentence Mode, RSVP, Audiobook Mode, Settings. Mobile Reload remains on the toolbar. The existing full-height phone panel keeps playback controls visible.

## Playback

- **Play** starts or restarts the displayed passage and automatically continues.
- **Pause/Resume** holds playback, including while the next Kokoro passage is being prepared.
- **Stop** cancels playback and pending preparation; Play restarts the current passage.
- Engine/voice changes stop playback and retain the current passage for comparison.
- **Use current position** stops playback and reads the current visual reading position again.
- Changing System speed stops speech; Play restarts the current passage at the new speed. Kokoro speed updates the active and subsequent Web Audio sources; this changes playback rate and pitch.

Text extraction reuses the existing RSVP DOM/CFI mapping. Each request is bounded to one paragraph or 400 characters; exact word/character continuation prevents lost text in long paragraphs. The loader caches one section's mapped words and skips empty/non-linear spine resources, such as standalone footnotes. Audio does not advance visual pages, add highlighting, or persist listening progress.

Kokoro automatically prepares one passage ahead while the current one plays. It keeps the model loaded for the listening session and holds at most the current and next audio chunks. It never converts the entire book in advance. On slow devices, generation can fall behind playback and cause gaps. Closing the panel, switching engines/modes, leaving the book, Stop, or hiding the app terminates the worker and releases audio resources.

## Kokoro voices and model

This uses upstream [kokoro-js](https://github.com/hexgrad/kokoro/tree/main/kokoro.js) 1.2.1, the free `onnx-community/Kokoro-82M-v1.0-ONNX` model, q8 WASM, and a module worker. The voice dropdown comes directly from the library's supported catalog: **all 28 English voices**, rather than the earlier five-voice subset. Names, language, and gender come from that catalog. Additional multilingual voice files shipped in the package are not automatically usable: this library version exposes/validates only its English catalog. Choosing a different engine/library would be needed to support those other languages.

Inference runs on the device; EPUB text is not sent to a TTS endpoint. Initial use needs internet for model/tokenizer/voice files from Hugging Face and runtime assets from jsDelivr. Expect roughly 100+ MB of downloads, significant RAM, and a first-use delay. Later passages reuse the loaded model. Upstream libraries may cache model/voice files in browser storage; Roza adds no generated-audio cache, downloads, cloud TTS, database changes, or server infrastructure.

The AudioContext is created/resumed directly in the Play gesture, before asynchronous downloads or generation. Generated WAVs are decoded and played automatically through that unlocked context, so there is no second Play/Generate gesture. The worker/WASM bundle remains outside the PWA's default precache size limit; offline operation is not promised.

## Local testing

1. Install with `npm ci --prefix frontend`, configure the existing backend, and run Roza using the normal local setup (`npm run dev`).
2. Open an English EPUB and choose Reader menu → Audiobook Mode.
3. Choose System Voices and press Play. Confirm continuous paragraph/section transitions, delayed voice enumeration, voice choice, Pause/Resume/Stop, and speed. OS/browser voice availability varies; an OS voice may itself use network services.
4. Switch to Kokoro, choose a voice, and press Play once. Allow the initial model download. Confirm playback starts automatically, the next passages follow without interaction, and Stop cancels preparation. Try a long paragraph and crossing a chapter/spine boundary.
5. Compare voices/engines from the same displayed passage. Test panel switching, leaving the reader, Home/return, and an audio interruption.

## iPhone / PWA limits

Physical iPhone Safari and installed iPhone PWA behavior remain **untested**. Narrow Chromium viewports validate layout/interaction, not iOS audio policy, memory limits, or performance. The synchronous Web Audio unlock is intended for Safari but is not a device verification. WASM requires neither WebGPU nor new cross-origin-isolation headers, but memory pressure or slow inference may make Kokoro impractical on some phones; use System Voices on those devices.

Keep the screen active. Hiding the app stops playback/preparation; after returning, Play continues from the displayed passage. Background/lock-screen playback, call/Bluetooth interruption recovery, gapless output, persisted audiobook position and automatic text/page following are not guaranteed.

## Automated validation

- `node --test scripts/reader-tts.test.cjs`: paragraph limits, exact continuation through long paragraphs/oversized tokens, no skipped or repeated words.
- `node --test --test-force-exit scripts/reader-tts.browser.test.cjs`: real EPUB extraction, section/footnote/end-of-book handling, menu order, desktop/375px layouts, delayed system voices, continuation, errors, Pause/Resume while buffering, one-chunk lookahead, Stop/close/hide cancellation and ignored late callbacks. Default speech/audio/worker APIs are mocked.
- Set `TTS_REAL_KOKORO=1` for genuine worker/model inference, all 28 library voices, decoded non-silent audio, one-click automatic playback, Pause/Resume/rate changes and continuous playback through the test EPUB to its end. This still mocks system speech. Requires network and sufficient memory.
- Browser tests accept `PLAYWRIGHT_MODULE` for an external Playwright installation and `PLAYWRIGHT_CHANNEL` (default `msedge`). Optional `TTS_SCREENSHOT` saves a mobile screenshot.
- `npm run build --prefix frontend`: TypeScript, production bundle and PWA generation.
- Focused ESLint checks cover the new TTS component/services; existing RSVP and reader-content-security tests cover nearby reader behavior.

Automated decoded samples and playback checks establish a working audio path, not subjective voice quality. Audible OS speech and physical iPhone testing still require manual listening.

Verified on 2026-11-16: production build, focused ESLint and 12 focused/security/RSVP checks passed. Genuine Kokoro in desktop Edge at desktop and 375px viewports started automatically from one Play click and reached the end of the five-passage EPUB across sections. Decoded first audio was 2.875 seconds with peak amplitude 0.477; pause/resume and 1.5× rate also passed. This is desktop Chromium evidence, not physical iPhone verification. Build warnings note large chunks and the intentionally non-precached Kokoro assets.
