"""Chatterbox Turbo speech service for the Roza desktop app (Ticket #66).

Same contract as desktop/kokoro/service.py, so the engine, store and exporter treat both alike.
Reads one JSON request per line on stdin and answers one JSON line on stdout:
  request:  {"id": "1", "text": "...", "words": ["Hello,", "world."], "voice": "cb_heart", "out": "/abs/file.wav",
             "pause": 0.75}   (pause is optional; speed is ignored: the player changes the rate)
  response: {"id": "1", "ok": true, "duration": 1.84, "words": [[0.05, 0.41], [0.45, 0.98]]}
A paragraph request speaks several sentences as one passage and cuts it into one clip per sentence:
  request:  {"id": "2", "voice": "cb_heart", "sentences": [{"text": "...", "words": [...], "out": "/abs/1.wav"}, ...]}
  response: {"id": "2", "ok": true, "clips": [{"duration": 2.1, "words": [[0.04, 0.4], ...]}, ...]}
The first line it prints is {"event": "ready", "device": "cuda"} once the models are loaded. Logs go to stderr.

Chatterbox gives no word times, so a small local aligner (wav2vec2, English letters) finds where each
book word is in the audio. Turbo stops after ~40 s of audio per call, so a passage is spoken in chunks of
whole sentences (a very long sentence is split at a comma or semicolon) and the chunks are joined.

  python service.py --build-voices <reference clips folder> <voices folder>
turns each reference clip (<voice id>.wav) into a voice file (<voice id>.pt), once, at install time.
"""

import json
import os
import re
import sys
import warnings

warnings.filterwarnings("ignore")

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402
import torchaudio  # noqa: E402
import torchaudio.functional as AF  # noqa: E402

# Speech is made in the background while the user reads; keep the CPU side (aligner, resampling) gentle.
torch.set_num_threads(4)
if hasattr(os, "nice"):
    os.nice(10)

REPO_ID = "ResembleAI/chatterbox-turbo"
MODEL_FILES = ["t3_turbo_v1.safetensors", "s3gen_meanflow.safetensors", "ve.safetensors",
               "*.json", "*.txt", "*.pt", "*.model"]
SAMPLE_RATE = 24000
LEAD_SECONDS = 0.04
TAIL_SECONDS = 0.16
# Turbo makes at most 1000 speech tokens (~40 s) per call. 60 words is ~25 s, well inside it.
CHUNK_WORDS = 60
CAP_SECONDS = 39.0
MIN_CLIP_SECONDS = 0.05
START_LAG_SECONDS = 0.06
VOICE_ID = re.compile(r"^cb_[a-z]+$")


# stdout carries only the JSON answers. Libraries print to stdout too (the watermarker announces itself),
# so everything else written to stdout goes to the log (stderr) instead.
REPLIES = sys.stdout
sys.stdout = sys.stderr


def emit(message):
    REPLIES.write(json.dumps(message) + "\n")
    REPLIES.flush()


def log(text):
    sys.stderr.write(f"[chatterbox] {text}\n")
    sys.stderr.flush()


def pick_device():
    wanted = os.environ.get("ROZA_CHATTERBOX_DEVICE", "auto")
    if wanted != "auto":
        return wanted
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_model(device):
    from huggingface_hub import snapshot_download
    from chatterbox.tts_turbo import ChatterboxTurboTTS
    path = snapshot_download(REPO_ID, allow_patterns=MODEL_FILES)
    return ChatterboxTurboTTS.from_local(path, device)


# ---- Voices ----

def build_voices(refs_dir, voices_dir):
    """Clones every reference clip into a small voice file the service loads by id."""
    model = load_model(pick_device())
    os.makedirs(voices_dir, exist_ok=True)
    names = sorted(name[:-4] for name in os.listdir(refs_dir) if name.endswith(".wav") and VOICE_ID.match(name[:-4]))
    for index, name in enumerate(names, 1):
        model.prepare_conditionals(os.path.join(refs_dir, f"{name}.wav"))
        model.conds.save(os.path.join(voices_dir, f"{name}.pt"))
        REPLIES.write(f"{index}/{len(names)}\n")
        REPLIES.flush()


class Voices:
    """cb_default is Turbo's built-in voice; the others are files made by build_voices."""

    def __init__(self, model, folder, device):
        from chatterbox.tts_turbo import Conditionals
        self.model, self.folder, self.device, self.Conditionals = model, folder, device, Conditionals
        self.default = model.conds
        self.cache = {}

    def use(self, voice):
        if not isinstance(voice, str) or not VOICE_ID.match(voice):
            raise ValueError("Unknown Chatterbox voice.")
        if voice == "cb_default":
            self.model.conds = self.default
            return
        if voice not in self.cache:
            file = os.path.join(self.folder, f"{voice}.pt")
            if not os.path.exists(file):
                raise ValueError("Unknown Chatterbox voice.")
            self.cache[voice] = self.Conditionals.load(file, map_location="cpu").to(self.device)
        self.model.conds = self.cache[voice]


# ---- Word alignment ----

class Aligner:
    """wav2vec2 trained on English read speech: forced alignment of the book's words to the audio."""

    def __init__(self):
        bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
        self.model = bundle.get_model().eval()  # CPU: the GPU is busy with speech
        self.rate = bundle.sample_rate
        self.index = {label: number for number, label in enumerate(bundle.get_labels())}

    def letters(self, word):
        """The aligner's tokens for a book word: its letters and apostrophes (digits and marks have none)."""
        text = word.upper().replace("’", "'").replace("‘", "'")
        return [self.index[char] for char in text if char in self.index and char not in "-|"]

    @torch.inference_mode()
    def align(self, audio, words):
        """A [start, end] in seconds for each word, or None where the audio gave no evidence."""
        tokens = [self.letters(word) for word in words]
        targets = [token for word in tokens for token in word]
        if not targets:
            return [None] * len(words)
        wave = AF.resample(torch.from_numpy(audio).float().unsqueeze(0), SAMPLE_RATE, self.rate)
        emission, _ = self.model(wave)
        emission = torch.log_softmax(emission, dim=-1)
        frames = emission.shape[1]
        if frames < len(targets):
            return [None] * len(words)
        aligned, scores = AF.forced_align(emission, torch.tensor([targets], dtype=torch.int32), blank=0)
        spans = AF.merge_tokens(aligned[0], scores[0].exp())
        seconds = wave.shape[1] / self.rate / frames
        times, position, previous_end = [], 0, 0.0
        for word in tokens:
            if not word:
                times.append(None)
                continue
            own = spans[position:position + len(word)]
            position += len(word)
            if not own:
                times.append(None)
                continue
            # The aligner hears a word's first letter ~65 ms after it begins (checked against Kokoro's own
            # word times: ends match within 5 ms), so starts move earlier, never before the last word ends.
            start = max(own[0].start * seconds - START_LAG_SECONDS, previous_end, 0.0)
            end = own[-1].end * seconds
            times.append([start, max(start, end)])
            previous_end = end
        return times


def fill_gaps(times, duration):
    """Words without a time (numbers, dashes) share the gap between their timed neighbours evenly."""
    filled = list(times)
    position = 0
    while position < len(filled):
        if filled[position] is not None:
            position += 1
            continue
        gap_end = position
        while gap_end < len(filled) and filled[gap_end] is None:
            gap_end += 1
        low = filled[position - 1][1] if position > 0 else 0.0
        high = filled[gap_end][0] if gap_end < len(filled) else duration
        step = max(high - low, 0.0) / (gap_end - position)
        for offset in range(gap_end - position):
            filled[position + offset] = [low + step * offset, low + step * (offset + 1)]
        position = gap_end
    return [[round(start, 3), round(max(start, end), 3)] for start, end in filled]


# ---- Speaking ----

SPLIT_AFTER = re.compile(r"[,;:—–]$")


def chunk_words(sentence_words):
    """Groups word positions into chunks of whole sentences of at most CHUNK_WORDS words.
    A sentence longer than that is split after a comma, semicolon or dash (or anywhere, as a last resort)."""
    pieces = []
    position = 0
    for words in sentence_words:
        base = position
        indexes = list(range(position, position + len(words)))
        position += len(words)
        while len(indexes) > CHUNK_WORDS:
            cut = max((i + 1 for i in range(CHUNK_WORDS // 2, CHUNK_WORDS) if SPLIT_AFTER.search(words[indexes[i] - base])),
                      default=CHUNK_WORDS)
            pieces.append(indexes[:cut])
            indexes = indexes[cut:]
        pieces.append(indexes)
    chunks, current = [], []
    for piece in pieces:
        if current and len(current) + len(piece) > CHUNK_WORDS:
            chunks.append(current)
            current = []
        current = current + piece
    if current:
        chunks.append(current)
    return chunks


class Speaker:
    def __init__(self):
        self.device = pick_device()
        self.model = load_model(self.device)
        self.voices = Voices(self.model, os.environ.get("ROZA_CHATTERBOX_VOICES", "voices"), self.device)
        self.aligner = Aligner()

    def generate(self, text):
        with torch.inference_mode():
            wav = self.model.generate(text)
        return wav.squeeze(0).cpu().numpy().astype(np.float32)

    def speak_chunk(self, words):
        """Audio and word times for one chunk. A chunk that hits Turbo's cap is spoken in two halves."""
        audio = self.generate(" ".join(words))
        if len(audio) / SAMPLE_RATE >= CAP_SECONDS and len(words) > 8:
            half = len(words) // 2
            first, first_times = self.speak_chunk(words[:half])
            second, second_times = self.speak_chunk(words[half:])
            shift = len(first) / SAMPLE_RATE
            return (np.concatenate([first, second]),
                    first_times + [None if t is None else [t[0] + shift, t[1] + shift] for t in second_times])
        return audio, self.aligner.align(audio, words)

    def speak(self, voice, sentence_words):
        """Untrimmed audio for the sentences and a [start, end] for every word, in order."""
        self.voices.use(voice)
        flat = [word for words in sentence_words for word in words]
        parts, times, offset = [], [], 0.0
        for chunk in chunk_words(sentence_words):
            audio, chunk_times = self.speak_chunk([flat[i] for i in chunk])
            times += [None if t is None else [t[0] + offset, t[1] + offset] for t in chunk_times]
            offset += len(audio) / SAMPLE_RATE
            parts.append(audio)
        audio = np.concatenate(parts) if parts else np.zeros(int(SAMPLE_RATE * 0.3), dtype=np.float32)
        return audio, fill_gaps(times, len(audio) / SAMPLE_RATE)


def trim_silence(audio, words):
    """Cuts the silence at both ends and shifts the word times to match."""
    level = np.abs(audio)
    loud = np.nonzero(level > max(level.max() * 0.02, 1e-4))[0]
    if not len(loud):
        return audio, words
    start = max(loud[0] - int(LEAD_SECONDS * SAMPLE_RATE), 0)
    end = min(loud[-1] + int(TAIL_SECONDS * SAMPLE_RATE), len(audio))
    shift = start / SAMPLE_RATE
    duration = (end - start) / SAMPLE_RATE
    shifted = [[round(max(0.0, s - shift), 3), round(min(duration, max(0.0, e - shift)), 3)] for s, e in words]
    return audio[start:end], shifted


def add_pause(audio, pause):
    extra = int(max(pause - TAIL_SECONDS, 0) * SAMPLE_RATE)
    return np.concatenate([audio, np.zeros(extra, dtype=audio.dtype)]) if extra else audio


def quietest(audio, low, high):
    """The sample in the middle of the quietest stretch between two times, where a cut is inaudible."""
    frame = int(0.01 * SAMPLE_RATE)
    start = min(max(int(low * SAMPLE_RATE), 0), len(audio))
    end = min(max(int(high * SAMPLE_RATE), start), len(audio))
    count = (end - start) // frame
    if count < 1:
        return (start + end) // 2
    energy = np.abs(audio[start:start + count * frame]).reshape(count, frame).mean(axis=1)
    quiet = energy <= energy.min() * 1.5 + 1e-5
    best, best_length, run_start = 0, 0, None
    for index, is_quiet in enumerate(list(quiet) + [False]):
        if is_quiet and run_start is None:
            run_start = index
        elif not is_quiet and run_start is not None:
            if index - run_start > best_length:
                best, best_length = run_start, index - run_start
            run_start = None
    return start + (best * frame) + (best_length * frame) // 2


def write_clip(path, audio):
    minimum = int(MIN_CLIP_SECONDS * SAMPLE_RATE)
    if len(audio) < minimum:
        audio = np.concatenate([audio, np.zeros(minimum - len(audio), dtype=np.float32)])
    sf.write(path, audio, SAMPLE_RATE)
    return round(len(audio) / SAMPLE_RATE, 3)


def synthesize(speaker, request):
    audio, words = speaker.speak(request["voice"], [request["words"]])
    audio, words = trim_silence(audio, words)
    audio = add_pause(audio, request.get("pause", 0))
    sf.write(request["out"], audio, SAMPLE_RATE)
    return {"duration": round(len(audio) / SAMPLE_RATE, 3), "words": words}


def synthesize_paragraph(speaker, request):
    """Speaks the sentences as one passage and saves one clip per sentence. Played back to back, the
    clips are exactly the passage: the natural pause between two sentences ends the first clip."""
    sentences = request["sentences"]
    counts = [len(sentence["words"]) for sentence in sentences]
    text = " ".join(sentence["text"] for sentence in sentences)
    if not any(char.isalnum() for char in text):
        # A scene mark such as "* * *" is not read aloud; the player adds the scene pause.
        clips = []
        for sentence, count in zip(sentences, counts):
            duration = write_clip(sentence["out"], np.zeros(0, dtype=np.float32))
            clips.append({"duration": duration, "words": [[0.0, duration]] * count})
        return {"clips": clips}

    audio, times = speaker.speak(request["voice"], [sentence["words"] for sentence in sentences])
    audio, times = trim_silence(audio, times)
    bounds = [0]
    position = 0
    for count in counts[:-1]:
        position += count
        last_end, next_start = times[position - 1][1], times[position][0]
        cut = quietest(audio, min(last_end, next_start) - 0.03, max(last_end, next_start) + 0.03)
        bounds.append(min(max(cut, bounds[-1]), len(audio)))
    bounds.append(len(audio))

    clips = []
    position = 0
    for index, (sentence, count) in enumerate(zip(sentences, counts)):
        start, end = bounds[index], bounds[index + 1]
        shift = start / SAMPLE_RATE
        duration = write_clip(sentence["out"], audio[start:end])
        words = [[round(min(max(0.0, s - shift), duration), 3), round(min(max(0.0, e - shift), duration), 3)]
                 for s, e in times[position:position + count]]
        position += count
        clips.append({"duration": duration, "words": words})
    return {"clips": clips}


def main():
    if len(sys.argv) == 4 and sys.argv[1] == "--build-voices":
        build_voices(sys.argv[2], sys.argv[3])
        return
    speaker = Speaker()
    emit({"event": "ready", "device": speaker.device})
    for line in sys.stdin:
        if not line.strip():
            continue
        request = json.loads(line)
        try:
            result = synthesize_paragraph(speaker, request) if "sentences" in request else synthesize(speaker, request)
            emit({"id": request["id"], "ok": True, **result})
        except Exception as error:  # Reported back, so one bad passage doesn't stop the service.
            log(f"failed: {error!r}")
            emit({"id": request["id"], "ok": False, "error": str(error)})


if __name__ == "__main__":
    main()
