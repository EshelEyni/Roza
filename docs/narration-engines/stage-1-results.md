# Ticket #66 — Stage 1 results (2026-11-20)

## Decision

- **Low-compute default:** Kokoro (unchanged).
- **Expressive option:** Chatterbox Turbo, as the "Expressive voices" add-on in the desktop app. It installs on
  top of the local voices (Kokoro) and is grouped as "Expressive" in the voice picker. Voices: `cb_default`
  (Turbo's built-in voice) and `cb_heart`, `cb_emma`, `cb_michael`, `cb_george`, cloned from the Kokoro
  voices of the same name (reference clips in `desktop/chatterbox/voices/`).
- **Word timing:** a local wav2vec2 forced aligner (`torchaudio` `WAV2VEC2_ASR_BASE_960H`, 360 MB, CPU).
  Checked against Kokoro's own word times on the test passages (421 words): word starts are off by a median of
  21 ms (after a fixed 60 ms correction), 90% within 52 ms, all but one within 100 ms; word ends within 5 ms.
- **Not chosen:** Qwen3-TTS 0.6B (too slow here, no style instructions). Qwen 1.7B is still to be measured on
  the MacBook ([macbook-qwen-handoff.md](macbook-qwen-handoff.md)).

## Desktop app check (development app, this PC, 2026-11-20)

- Add-on install: 4 min 54 s (packages, model and aligner download, voice files, self-test); device found: `cuda`.
- First expressive preview: 5.2 s, including loading the model on the GPU.
- A three-sentence paragraph: 9.2 s; one clip per sentence, every word timed and in order.
- Offline save (stop, resume, finish), m4a export through Kokoro's ffmpeg, and Kokoro narration beside it all
  worked. A Kokoro clip saved the day before still played and seeked.
- Not yet checked: saving an expressive narrator against a backend with this change, generation with the
  network actually turned off (the service runs with `HF_HUB_OFFLINE=1` and the aligner loads from its local
  cache), and a long chapter played through the reader UI.

Machine: i7-9700K, 16 GB RAM, GTX 1650 4 GB, Windows 11. One engine at a time.
"Gen per min" = seconds to generate 1 minute of audio. Under 60 = faster than real time.

## Speed and memory

| Engine | Device | Gen per min | Load | Peak RAM | Peak VRAM | Download |
|---|---|---|---|---|---|---|
| Kokoro (af_heart, as in app) | CPU, 4 threads | 21 s short / 20 s Ch. 1 | 10–17 s | 1.7 GB | — | (existing) |
| Chatterbox Turbo, built-in voice | GPU fp32 | 43 s short / 39 s Ch. 1 | 18 s | 4.8 GB | 4.0 of 4.0 GB | ~5 GB packages + 2.8 GB model |
| Chatterbox Turbo, 4 Kokoro clones | GPU fp32 | 35–38 s | 20–23 s | 4.4–4.8 GB | 3.7–4.0 GB | +166 KB per voice |
| Chatterbox Turbo, built-in voice | CPU | 147 s | 42 s | 6.2 GB | — | same |
| Qwen3-TTS 0.6B CustomVoice (Ryan) | GPU fp32 | 346 s | 9 s | 4.0 GB | 4.0 GB (torch wanted 5.1, spilled to RAM) | ~1 GB packages + 2.3 GB model |
| Qwen3-TTS 0.6B CustomVoice (Aiden) | GPU fp32 | 210 s | 16 s | 2.7 GB | 4.0 GB (torch 4.2) | same |
| Qwen3-TTS 0.6B CustomVoice (Ryan) | CPU | 389 s | 12 s | 4.7 GB | — | same |
| Qwen3-TTS 0.6B | GPU fp16 | fails: CUDA assert (fp16 overflow on GTX 1650) | | | | |

First-play delay (first paragraph of a passage):

| Passage | Kokoro CPU | Turbo GPU | Turbo CPU | Qwen 0.6B GPU |
|---|---|---|---|---|
| quiet dialogue (short line) | 0.7 s | 1.6 s | 5.9 s | 8.9 s |
| tense exchange | 0.5 s | 1.2 s | 6.0 s | 9.0 s |
| Moby opening (one ~64 s paragraph) | 20 s | 37 s | 141 s | 691 s |

## Findings

**Chatterbox Turbo**
- The only new engine that is faster than real time here, and only on the GPU. It fills the whole 4 GB card.
- CPU is 2.5x slower than real time: offline pre-generation only.
- At most ~40 s of audio per call. Passages are split at sentence ends into chunks of ≤60 words. No chunk hit the cap.
- One built-in voice. New voices are cloned from a ≥5 s clip into a 166 KB file. Four Kokoro voices cloned fine.
- Inaudible Perth watermark. Needs `setuptools<81` (the watermark library imports `pkg_resources`).
- Loads and runs with `HF_HUB_OFFLINE=1`. Not yet tested with the network actually disabled.
- License MIT (code and weights). Repo active (pushed 2026-11-04), not archived.
- "Chatterbox Nano" does not exist on Hugging Face.
- User listening (2026-11-20): "sounds very good"; PC did not slow down.

**Qwen3-TTS 0.6B CustomVoice**
- Not usable on this PC: 3.5–6x slower than real time on GPU, worse on CPU.
- fp16 crashes on the GTX 1650. fp32 needs more than 4 GB, so Windows spills into RAM and it slows down.
- **No style instructions on 0.6B.** `qwen_tts` drops `instruct` for the 0.6B model (qwen3_tts_model.py line 799), and Qwen's own table marks 0.6B CustomVoice without instruction control.
- 9 speakers; only Ryan and Aiden are native English (both male).
- Loading by repo id calls the Hub even with `HF_HUB_OFFLINE=1`. Loading from the local snapshot folder works offline.
- Up to 2048 tokens (~170 s) per call: a full ROZA passage fits, no chunking needed.
- Ryan's audio runs much longer than the others' (tense exchange 39 s vs 17–21 s; ~25 s of it silence). Listen for added pauses or repeated words. Aiden is normal.
- License Apache-2.0.

**Dropped:** Chatterbox Multilingual (Hebrew not needed). Qwen 1.7B on this PC (weights alone are 3.6 GB). Qwen 1.7B goes to the MacBook test ([macbook-qwen-handoff.md](macbook-qwen-handoff.md)).

Bench scripts and passages: `tools/tts-bench/`. Samples stay outside the repo.

## Listening sheet

Files: `samples\<engine>\<engine>__<passage>.wav`. Compare the same passage across engines.
Note skipped / repeated / added words, voice drift, harsh joins, odd pauses, overall preference.

| Passage | Kokoro | Turbo built-in | Turbo af_heart | Turbo bf_emma | Turbo am_michael | Turbo bm_george | Qwen Ryan | Qwen Aiden |
|---|---|---|---|---|---|---|---|---|
| descriptive | | | | | | | | — |
| quiet_dialogue | | | | | | | | |
| tense_exchange | | | | | | | | |
| scene_break | | | | | | | | — |
| moby_opening | | | | | | | | — |
| moby_chapter1 (≥5 min) | | | — | — | — | — | — | — |
