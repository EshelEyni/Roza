# Handoff: test Qwen3-TTS 1.7B (and Chatterbox) on the MacBook

**Ticket:** #66, add more offline narrator models to the desktop app
**Written:** 2026-11-20 on the Windows PC (i7-9700K, 16 GB RAM, GTX 1650 4 GB)
**Results so far:** [stage-1-results.md](stage-1-results.md)
**Bench scripts:** [`tools/tts-bench/`](../../tools/tts-bench/)

## Why

Roza's desktop app reads books aloud offline. Kokoro is the light default. Ticket #66 looks for a
more expressive local voice. On the Windows PC:

- **Chatterbox Turbo** runs on the GPU at ~38 s per minute of audio and sounds very good. It is the
  chosen expressive engine and is being added to the desktop app (branch `worktree-chatterbox-engine`).
- **Qwen3-TTS 0.6B** is far too slow there (210–390 s per minute of audio) and has **no style
  instructions** (`qwen_tts` drops `instruct` for 0.6B).
- **Qwen3-TTS 1.7B** cannot run there: its weights alone are 3.6 GB.

The 1.7B models add what 0.6B lacks:

1. **Style instructions** (1.7B CustomVoice): "read as a calm audiobook narrator", separate from the book text.
2. **Voice Design** (1.7B VoiceDesign): describe a voice in words, and the model makes it.
3. Probably higher quality than 0.6B.

**The questions for the Mac:**

1. Is Qwen 1.7B faster than real time on the Mac?
2. Does it sound clearly better than Chatterbox Turbo? Do style instructions help?
3. Does VoiceDesign keep one stable voice across paragraphs?
4. How fast is Chatterbox Turbo on the Mac (MPS)? This decides whether Roza can offer Turbo to Mac users.

## Rules

- **Ask before each large download** and state its size.
- Keep everything the bench downloads or makes inside `tools/tts-bench/`. Its `.gitignore` already
  excludes `envs/`, `hf/`, `samples/`, `results/` and `voices-cache/`. Do not commit them.
- Change no app code for this test.
- No production deployment of anything (`AGENTS.md`).

## Layout

```
tools/tts-bench/
  passages/passages.json      test passages; each paragraph is one generation call
  passages/moby_chapter1.txt  Moby-Dick ch. 1, public domain (~14 min, continuous listening test)
  scripts/bench.py            harness: timings, first-play delay, peak RAM (Windows and macOS)
  scripts/eng_qwen.py         Qwen CustomVoice (BENCH_QWEN_SIZE, BENCH_SPEAKER, BENCH_INSTRUCT, BENCH_DTYPE, BENCH_DEVICE)
  scripts/eng_qwen_design.py  Qwen 1.7B VoiceDesign (BENCH_DESIGN = voice description)
  scripts/eng_chatterbox_turbo.py  Chatterbox Turbo (BENCH_DEVICE, BENCH_VOICE = cloned voice)
  scripts/eng_kokoro.py       Kokoro baseline through the app's own desktop/kokoro/service.py
  scripts/make_refs.py        renders the Kokoro reference clips Chatterbox clones voices from
desktop/chatterbox/voices/*.wav  reference clips: af_heart, bf_emma, am_michael, bm_george
```

Every run writes `results/<engine>__short.json` (or `__long.json`) and `samples/<engine>/<engine>__<passage>.wav`.

## Steps

All commands run from `tools/tts-bench`.

### 0. Check the Mac

```bash
uname -m            # must be arm64 (Apple Silicon)
sysctl hw.memsize   # 16 GB or more for 1.7B
df -h .             # about 15 GB free for all steps
brew install uv     # if missing
```

### 1. Qwen environment (~1.5 GB of packages; ask first)

```bash
cd tools/tts-bench
uv venv --python 3.11 envs/qwen
uv pip install --python envs/qwen/bin/python "torch==2.6.0" "torchaudio==2.6.0" "qwen-tts==0.1.1"
envs/qwen/bin/python -c "import torch; print(torch.__version__, torch.backends.mps.is_available())"
```

`mps` must print `True`. If `qwen_tts` complains about sox, run `brew install sox`.

### 2. Qwen 1.7B CustomVoice (4.2 GB model; ask first)

```bash
export HF_HOME="$PWD/hf" PYTHONIOENCODING=utf-8
export BENCH_QWEN_SIZE=1.7B BENCH_DEVICE=mps BENCH_DTYPE=bfloat16 BENCH_SPEAKER=Aiden
envs/qwen/bin/python -I scripts/bench.py eng_qwen --only quiet_dialogue    # quick check first
```

- If it fails or prints "silent or broken audio", try `BENCH_DTYPE=float16`, then `float32`.
- If an operation is not supported on MPS, set `export PYTORCH_ENABLE_MPS_FALLBACK=1` and note it in
  the results (that step then runs on the CPU).

Then the full runs:

```bash
envs/qwen/bin/python -I scripts/bench.py eng_qwen                      # all short passages, Aiden
BENCH_SPEAKER=Ryan envs/qwen/bin/python -I scripts/bench.py eng_qwen --only quiet_dialogue,tense_exchange
BENCH_INSTRUCT="Read as a calm, warm audiobook narrator. Natural pace, gentle emotion in dialogue." \
  envs/qwen/bin/python -I scripts/bench.py eng_qwen                    # same, with a style instruction
```

If it is faster than real time (under 60 s per minute of audio), run the long test too:

```bash
envs/qwen/bin/python -I scripts/bench.py eng_qwen --long
```

### 3. Qwen 1.7B VoiceDesign (4.2 GB model; optional; ask first)

```bash
BENCH_DTYPE=bfloat16 envs/qwen/bin/python -I scripts/bench.py eng_qwen_design --only descriptive,quiet_dialogue,tense_exchange
```

The voice is designed again for every paragraph. **Listen for the voice changing between paragraphs.**
If it drifts, VoiceDesign is only useful for making a reference clip to clone with Chatterbox Turbo.

### 4. Chatterbox Turbo on the Mac (~3 GB model + packages; ask first)

```bash
uv venv --python 3.11 envs/chatterbox
uv pip install --python envs/chatterbox/bin/python "torch==2.6.0" "torchaudio==2.6.0" "chatterbox-tts==0.1.7" "setuptools<81"
BENCH_DEVICE=mps envs/chatterbox/bin/python -I scripts/bench.py eng_chatterbox_turbo
BENCH_DEVICE=mps BENCH_VOICE=af_heart envs/chatterbox/bin/python -I scripts/bench.py eng_chatterbox_turbo
BENCH_DEVICE=mps envs/chatterbox/bin/python -I scripts/bench.py eng_chatterbox_turbo --long
```

`setuptools<81` is required: Chatterbox's watermark library imports `pkg_resources`.

### 5. Offline check

After the downloads, turn Wi-Fi off and repeat one quick check with `HF_HUB_OFFLINE=1`.
The adapters load from the local snapshot folder. Loading Qwen by repo id calls the Hub even in offline mode.

### 6. Record and listen

- Add rows to the tables in [stage-1-results.md](stage-1-results.md): Mac model and memory, engine,
  device, dtype, seconds per minute of audio, load time, peak RAM, `mps_peak_gb`, first-play delay.
- Compare `samples/qwen-1.7B-*` with `samples/chatterbox-turbo-mps*` (same passages).
- Listen to at least 5 minutes of Chapter 1 without stopping. Note skipped, repeated or added words,
  voice drift and odd pauses.

## Known pitfalls (from the PC)

- **fp16 can crash** with a "device-side assert" (overflow during sampling). Use bfloat16 or float32.
- **Qwen Ryan** produced much longer audio than the others (lots of silence). Check whether 1.7B does the same.
- **Qwen 0.6B ignores `instruct`.** If instructions seem to do nothing, check that the run name starts with `qwen-1.7B`.
- `flash-attn` is not available on the Mac. The adapters use `sdpa`, and the warning about it is harmless.
- `-I` (isolated mode) is on purpose: Python then ignores the current folder and `PYTHON*` variables.

## What the answer decides

- If Qwen 1.7B is fast and clearly better on the Mac, Roza could offer it as a high-quality engine for
  Apple Silicon, with Chatterbox Turbo for NVIDIA GPUs and Kokoro as the light default everywhere.
- If Chatterbox Turbo is fast on the Mac, the desktop app's Chatterbox engine can be enabled for Mac users.
