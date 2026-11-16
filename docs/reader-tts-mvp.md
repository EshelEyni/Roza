# Ticket 47: Read aloud experiment

The speaker button in the EPUB toolbar opens the existing reader sheet (full-height on phones so the controls are visible). Mobile Reload moves into the reader menu to preserve 44px touch targets. The sheet captures the current rendered position (or selected/keyboard word via the existing position helper), reuses RSVP's DOM/CFI extraction, and reads from that word to the paragraph end, capped at 400 characters. Long paragraphs stop early; this experiment does not advance automatically.

The passage stays fixed when changing engines or voices. **Use current position** explicitly refreshes it. Closing the sheet, opening another panel/mode, leaving the book, stopping generation, or hiding the app cancels playback/work. There is no persisted audio or audiobook progress, chapter generation, highlighting, or server/database change.

## Local use

1. Install dependencies with `npm ci --prefix frontend` and the existing backend setup. Start Roza using its usual local environment (`npm run dev` from the repository root).
2. Open an English EPUB at a paragraph and tap the speaker button.
3. Choose **System Voices**, choose a voice, and tap **Play**. Voices update on `voiceschanged`; Browser default remains usable when the browser does not enumerate voices. Test Pause, Resume, Stop, and speed. Changing system speed stops the utterance; Play restarts the same passage at the new speed. Voice availability, pronunciation, and pause support depend on the OS/browser; an OS voice may itself use network services.
4. Switch to **Kokoro · Local AI**, select one of the five bundled English voice choices, and tap **Generate**. Wait for **Audio ready. Tap Play.**, then tap **Play**. Generation and playback deliberately use separate gestures to accommodate Safari's autoplay policy. Pause/Resume/Stop use the generated WAV through HTML audio; speed changes its playback rate. Generating again, changing voice/engine/passage, or closing discards the in-memory audio.

Kokoro uses upstream [`kokoro-js`](https://github.com/hexgrad/kokoro/tree/main/kokoro.js) 1.2.1 with `onnx-community/Kokoro-82M-v1.0-ONNX`, q8, WASM, in a module worker. Inference stays on the device; EPUB text is not sent to a TTS endpoint. Initial use needs internet for model/tokenizer/voice assets from Hugging Face and runtime assets from jsDelivr. Expect roughly 100+ MB of downloads and substantial RAM/initialization time. Upstream libraries may cache model/voice files using browser storage; Roza adds no generated-audio cache or download feature. Stop terminates an in-flight worker. Model resources are released when the sheet is closed or the engine changes. The large worker/WASM assets are intentionally outside the PWA's default precache size limit; offline Kokoro is not promised.

## iPhone / PWA limitations

No physical iPhone Safari or installed iPhone PWA validation was available. Mobile Chromium emulation checks layout and interaction only. WASM is used without requiring WebGPU or cross-origin-isolation/server changes, but iPhone memory pressure or slow inference may prevent Kokoro from completing. If generation fails, the sheet explains the failure and offers System Voices as the minimal same-device alternative; desktop Edge/Chrome is the comparison path for genuine Kokoro. No browser voice is presented as Kokoro audio.

Keep the screen active. Hiding the app stops speech/audio and in-flight inference; Play restarts the passage after returning. Background, lock-screen, Bluetooth/call interruption recovery and OS audio routing are not guaranteed. On a physical iPhone, test Safari and installed PWA separately: voice enumeration, a cold Kokoro download, ready-to-Play gesture, both engines' Pause/Resume/Stop, speed, rotation, panel switching, Home/return, and call/audio interruption. If native Pause/Resume is ineffective, use Stop then Play.

## Validation

Verified on 2026-11-16: production build and focused ESLint passed; 10 focused/security/RSVP regression checks passed. Real Kokoro inference in desktop Edge at desktop and narrow viewports produced a 2.875-second WAV (peak amplitude 0.477), decoded to non-silent samples, advanced HTML audio playback, paused/resumed/stopped and accepted 1.5× speed. This verifies a media path, not a human listening evaluation. Audible OS voice output and physical iPhone behavior remain unverified. Build warnings note large chunks and the intentionally non-precached Kokoro assets.

- `node --test scripts/reader-tts.test.cjs`: paragraph/length bounds and starting-word behavior.
- `node --test --test-force-exit scripts/reader-tts.browser.test.cjs`: real EPUB fixture and rendered selection/CFI extraction; 375px and desktop layouts; identical passage for both engines; delayed voices, voice choice, system error, Pause/Resume/Stop, worker cancellation, generation errors and panel cleanup. Speech/audio/worker APIs are mocked in this default run, so this does not verify audible OS speech.
- Set `TTS_REAL_KOKORO=1` for real worker/model generation and WAV decoding/playback checks in desktop Edge (including a narrow viewport). This still mocks system speech. Requires internet and enough memory. The test accepts `PLAYWRIGHT_MODULE` for an external Playwright installation and `PLAYWRIGHT_CHANNEL` (default `msedge`).
- `npm run build --prefix frontend`: TypeScript, production bundle and PWA generation.

Automated media playback cannot establish subjective voice quality. Listen manually on the target devices before deciding whether to develop Stage 2.
