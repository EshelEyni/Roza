"""Chatterbox Turbo (chatterbox-tts==0.1.7), built-in voice.

Turbo stops after 1000 speech tokens (~40 s), so a ROZA passage longer than that must be split.
Paragraphs are cut at sentence ends into chunks of at most MAX_WORDS words, generated one by one,
and joined directly (Turbo already ends each chunk with a short silence).
Device comes from BENCH_DEVICE (cuda or cpu).
"""

import os
import re

import numpy as np
import torch

VOICE = os.environ.get("BENCH_VOICE", "")  # e.g. "af_heart" -> voices\af_heart.pt, cloned from a Kokoro clip
NAME = "chatterbox-turbo-" + os.environ.get("BENCH_DEVICE", "cuda") + (f"-{VOICE}" if VOICE else "")
LANGS = {"en"}
MAX_WORDS = 60
HERE = os.path.dirname(os.path.abspath(__file__))
# Reference clips ship with the desktop app; the cloned voice files are cached in the bench folder.
REFS = os.path.join(HERE, "..", "..", "..", "desktop", "chatterbox", "voices")
VOICES = os.path.join(HERE, "..", "voices-cache")
INFO = {"device": os.environ.get("BENCH_DEVICE", "cuda"), "voice": VOICE or "built-in (conds.pt)", "chunk_max_words": MAX_WORDS,
        "package": "chatterbox-tts==0.1.7", "torch": torch.__version__}
model = None
FILES = ["t3_turbo_v1.safetensors", "s3gen_meanflow.safetensors", "ve.safetensors", "*.json", "*.txt", "*.pt", "*.model"]


def load():
    global model
    from huggingface_hub import snapshot_download
    from chatterbox.tts_turbo import ChatterboxTurboTTS
    torch.manual_seed(0)
    path = snapshot_download("ResembleAI/chatterbox-turbo", allow_patterns=FILES)
    model = ChatterboxTurboTTS.from_local(path, INFO["device"])
    if VOICE:
        from chatterbox.tts_turbo import Conditionals
        os.makedirs(VOICES, exist_ok=True)
        voice_file = os.path.join(VOICES, f"{VOICE}.pt")
        if not os.path.exists(voice_file):  # Clone once from the reference clip, then reuse the small file.
            model.prepare_conditionals(os.path.join(REFS, f"{VOICE}.wav"))
            model.conds.save(voice_file)
        model.conds = Conditionals.load(voice_file, map_location="cpu").to(INFO["device"])


def chunks(text):
    sentences = re.split(r"(?<=[.!?…])\s+|(?<=[.!?…][\"”’)])\s+|(?<=[;])\s+", text.strip())
    out, current = [], []
    for sentence in sentences:
        if current and len(" ".join(current + [sentence]).split()) > MAX_WORDS:
            out.append(" ".join(current))
            current = []
        current.append(sentence)
    if current:
        out.append(" ".join(current))
    # A single very long sentence still goes in one piece; flag it if it reaches the token cap.
    return out


def generate(text, lang):
    pieces = []
    for chunk in chunks(text):
        with torch.inference_mode():
            wav = model.generate(chunk)
        audio = wav.squeeze(0).numpy().astype(np.float32)
        if len(audio) / model.sr > 39:
            print(f"    WARNING: chunk hit the ~40 s cap and may be cut off: {chunk[:60]}...", flush=True)
        pieces.append(audio)
    if INFO["device"] == "cuda":
        INFO["torch_peak_vram_gb"] = round(max(INFO.get("torch_peak_vram_gb", 0),
                                               torch.cuda.max_memory_allocated() / 1024 ** 3), 2)
    return np.concatenate(pieces), model.sr
