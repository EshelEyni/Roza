# Adding a voice to the expressive voices (Chatterbox Turbo)

**Ticket:** #66 · **Related:** [stage-1-results.md](stage-1-results.md)

The desktop app's expressive voices come from Chatterbox Turbo, an add-on on top of the Kokoro local voices.
Chatterbox makes a voice by **cloning** it from a short recording. Today the voice list is fixed in code,
so adding a voice is a developer step. There is no "add your own voice" button in the app yet.

## How a voice works

1. A **reference clip** holds 10–20 seconds of the voice: `desktop/chatterbox/voices/cb_<name>.wav`.
2. When the add-on installs, the service turns each clip into a small **voice file** (`cb_<name>.pt`, about
   166 KB) in the runtime folder: `%APPDATA%\Roza\kokoro\chatterbox\voices\` (`Roza-Dev` for the dev app).
3. From then on, the service loads that voice file whenever the voice is chosen. The clip is not used again.

`cb_default` is Turbo's built-in voice. It has no clip.

## Step 1: get a good recording

- 10–20 seconds of one person reading calmly, the way you want books to be read. Turbo refuses clips
  shorter than 5 seconds.
- The clone copies the style too. A whispered or shouted clip gives a whispering or shouting narrator.
- No music, no background noise, no echo. A quiet room and a decent microphone matter more than length.
- WAV format. Mono is best.
- **Only use a voice you have the right to use:** your own, or someone who agreed. Do not clone famous
  people or professional narrators without written permission.

## Step 2: add the voice to the code

Pick an id: `cb_` plus lowercase letters only (for example `cb_dana`). The audio route and the service
reject anything else.

1. Save the clip as `desktop/chatterbox/voices/cb_dana.wav`.
2. Add the id to all three voice lists. `scripts/desktop-kokoro.test.cjs` fails if they differ, or if a
   voice has no clip.
   - `desktop/kokoro/voices.cjs`: add `"cb_dana"` to `chatterboxVoices`.
   - `frontend/src/services/narration/kokoroVoices.ts`: add
     `expressive("cb_dana", "Dana", "American", "Female")` to `chatterboxVoices`.
     Accent is `"American"` or `"British"`; gender is `"Female"` or `"Male"`.
   - `backend/src/services/reader/readerKokoroVoices.ts`: add `"cb_dana"` to `readerChatterboxVoices`.
3. Run the check:

   ```powershell
   node --test scripts/desktop-kokoro.test.cjs
   ```

## Step 3: build the voice file in your installed app

Instead of reinstalling the add-on, build the voice files directly with the add-on's own Python.
This rebuilds every voice from its clip (about a minute on the GPU).

For the dev app (`npm run desktop:dev`):

```powershell
$r="$env:APPDATA\Roza-Dev\kokoro\chatterbox"; $env:HF_HOME="$r\hf"; $env:TORCH_HOME="$r\torch"; $env:HF_HUB_OFFLINE="1"; & "$r\.venv\Scripts\python.exe" C:\dev\Roza\desktop\chatterbox\service.py --build-voices C:\dev\Roza\desktop\chatterbox\voices "$r\voices"
```

For the installed Roza app, use `$env:APPDATA\Roza\kokoro\chatterbox` instead.

It prints `1/5`, `2/5` and so on. Then close and reopen the app. The voice appears in
**Choose narrator voice → Local voices → Model: Expressive**. The dev frontend must include the new list
entry (`npm run desktop:dev` rebuilds it when the frontend changed).

On a Mac, the folder is `~/Library/Application Support/Roza-Dev/kokoro/chatterbox` and Python is at
`.venv/bin/python`.

## Step 4: ship it to other users

1. Bump `version` in `desktop/kokoro/chatterbox.cjs`. Installed apps then show
   **Update expressive voices**, which runs the install again and builds the new voice file. Packages and
   models are already there, so the update is much faster than the first install.
2. The backend must be deployed before the new id can be saved as a book's narrator. Without it, saving
   fails with "Choose an available narrator voice." Deploy only with explicit authorization (`AGENTS.md`).
3. Release a new desktop app (the clip ships inside it: `electron-builder.yml` copies
   `chatterbox/voices/cb_*.wav`).

## Making a voice from a Kokoro voice

The four cloned voices (`cb_heart`, `cb_emma`, `cb_michael`, `cb_george`) were made from Kokoro clips.
To clone another Kokoro voice, render its clip with `tools/tts-bench/scripts/make_refs.py` using the Kokoro
runtime's Python, then rename the file to `cb_<name>.wav`:

```powershell
$k="$env:APPDATA\Roza\kokoro\runtime"; $env:HF_HOME="$k\hf"; $env:HF_HUB_OFFLINE="1"; Push-Location $k; & "$k\.venv\Scripts\python.exe" -I C:\dev\Roza\tools\tts-bench\scripts\make_refs.py bf_lily; Pop-Location
```

The clip lands in `desktop/chatterbox/voices/bf_lily.wav`. Rename it to `cb_lily.wav`, then follow steps 2–4.

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| "Unknown Chatterbox voice." | The voice file is missing. Run step 3, or check the id is `cb_` plus lowercase letters. |
| The voice is not in the picker | The frontend list lacks it, or the app was not rebuilt. Run `npm run desktop:dev -- --rebuild`. |
| "Choose an available narrator voice." on Save | The backend you are using does not have the new id. Restart it (dev) or deploy it (production). |
| `Audio prompt must be longer than 5 seconds!` | The clip is too short. Use 10–20 seconds. |
| The clone sounds noisy or odd | The clip has noise, echo or music. Record again in a quiet room. |

## A future "Add your own voice" feature

An in-app version would need: a file picker and a name field in the voice picker; a desktop step that checks
the clip (length, loudness) and builds the voice file; a stored list of the user's own voices; the backend
accepting any `cb_…` id instead of a fixed list; and a consent checkbox ("This is my voice, or I have
permission to use it"). Treat it as its own ticket.
