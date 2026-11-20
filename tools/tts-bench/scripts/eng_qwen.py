"""Qwen3-TTS CustomVoice (qwen-tts==0.1.1). One call per paragraph: the model makes up to 2048 tokens
(~170 s at 12 Hz), so a ROZA passage (<=250 words, ~100 s) needs no chunking.

Env: BENCH_QWEN_SIZE (0.6B / 1.7B), BENCH_SPEAKER (Ryan / Aiden), BENCH_DTYPE (float16 / float32 / bfloat16),
BENCH_DEVICE (cuda / cpu / mps), BENCH_INSTRUCT (style instruction; ignored by the 0.6B model).
"""

import os

import numpy as np
import torch

SIZE = os.environ.get("BENCH_QWEN_SIZE", "0.6B")
SPEAKER = os.environ.get("BENCH_SPEAKER", "Ryan")
DTYPE = os.environ.get("BENCH_DTYPE", "float16")
DEVICE = os.environ.get("BENCH_DEVICE", "cuda")
INSTRUCT = os.environ.get("BENCH_INSTRUCT") or None
REPO = f"Qwen/Qwen3-TTS-12Hz-{SIZE}-CustomVoice"
NAME = f"qwen-{SIZE}-{DEVICE}-{DTYPE}-{SPEAKER}" + ("-instruct" if INSTRUCT else "")
LANGS = {"en"}
INFO = {"model": REPO, "device": DEVICE, "dtype": DTYPE, "speaker": SPEAKER, "instruct": INSTRUCT,
        "package": "qwen-tts==0.1.1", "torch": torch.__version__}
model = None


def load():
    global model
    from qwen_tts import Qwen3TTSModel
    from huggingface_hub import snapshot_download
    torch.manual_seed(0)
    # Loading by repo id calls the Hub API even with HF_HUB_OFFLINE=1, so load from the local folder.
    path = snapshot_download(REPO)
    model = Qwen3TTSModel.from_pretrained(path, device_map=DEVICE if DEVICE != "cuda" else "cuda:0",
                                          dtype=getattr(torch, DTYPE), attn_implementation="sdpa")
    INFO["speakers"] = model.get_supported_speakers()


def generate(text, lang):
    with torch.inference_mode():
        wavs, rate = model.generate_custom_voice(text=text, language="English", speaker=SPEAKER, instruct=INSTRUCT)
    audio = np.asarray(wavs[0], dtype=np.float32).reshape(-1)
    if not np.isfinite(audio).all() or np.abs(audio).max() < 1e-4:
        print("    WARNING: silent or broken audio (NaN) - try BENCH_DTYPE=float32", flush=True)
    if len(audio) / rate > 165:
        print(f"    WARNING: near the 2048-token cap ({len(audio) / rate:.0f}s), end may be cut", flush=True)
    if DEVICE == "mps":  # Apple GPU memory held by PyTorch (shares the Mac's unified memory)
        INFO["mps_peak_gb"] = round(max(INFO.get("mps_peak_gb", 0), torch.mps.driver_allocated_memory() / 1024 ** 3), 2)
    if DEVICE == "cuda":
        INFO["torch_peak_vram_gb"] = round(max(INFO.get("torch_peak_vram_gb", 0),
                                               torch.cuda.max_memory_allocated() / 1024 ** 3), 2)
    return audio, rate
