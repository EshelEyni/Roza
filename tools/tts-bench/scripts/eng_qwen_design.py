"""Qwen3-TTS 1.7B VoiceDesign (qwen-tts==0.1.1): the voice comes from a text description, not a speaker id.
Each call designs the voice again, so listen for the voice changing between paragraphs.

Env: BENCH_DEVICE (mps / cuda / cpu), BENCH_DTYPE (bfloat16 / float16 / float32), BENCH_DESIGN (voice description).
"""

import os

import numpy as np
import torch

DEVICE = os.environ.get("BENCH_DEVICE", "mps")
DTYPE = os.environ.get("BENCH_DTYPE", "bfloat16")
DESIGN = os.environ.get("BENCH_DESIGN", "A warm, calm, middle-aged female audiobook narrator with a clear, "
                                        "gentle voice, unhurried pace and natural expression.")
REPO = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
NAME = f"qwen-1.7B-design-{DEVICE}-{DTYPE}"
LANGS = {"en"}
INFO = {"model": REPO, "device": DEVICE, "dtype": DTYPE, "design": DESIGN, "package": "qwen-tts==0.1.1",
        "torch": torch.__version__}
model = None


def load():
    global model
    from huggingface_hub import snapshot_download
    from qwen_tts import Qwen3TTSModel
    torch.manual_seed(0)
    path = snapshot_download(REPO)  # load from the local folder so HF_HUB_OFFLINE=1 works
    model = Qwen3TTSModel.from_pretrained(path, device_map=DEVICE if DEVICE != "cuda" else "cuda:0",
                                          dtype=getattr(torch, DTYPE), attn_implementation="sdpa")


def generate(text, lang):
    with torch.inference_mode():
        wavs, rate = model.generate_voice_design(text=text, language="English", instruct=DESIGN)
    audio = np.asarray(wavs[0], dtype=np.float32).reshape(-1)
    if not np.isfinite(audio).all() or np.abs(audio).max() < 1e-4:
        print("    WARNING: silent or broken audio (NaN) - try BENCH_DTYPE=float32", flush=True)
    if DEVICE == "mps":
        INFO["mps_peak_gb"] = round(max(INFO.get("mps_peak_gb", 0), torch.mps.driver_allocated_memory() / 1024 ** 3), 2)
    return audio, rate
