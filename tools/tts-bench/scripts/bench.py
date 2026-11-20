"""Shared measuring harness for Ticket #66 (Stage 1).

An engine module gives: NAME, load() -> None, generate(text, lang) -> (float32 mono audio, sample_rate).
The harness renders every passage paragraph by paragraph (one call per paragraph, as ROZA does),
joins them with ROZA's pauses, and records timings, peak RAM and peak VRAM.

Run: <engine venv python> -I bench.py <engine_module> [--long] [--only name,name]
"""

import ctypes
import importlib
import json
import os
import re
import sys
import threading
import time
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


# ---- peak RAM (Windows: the OS tracks the peak working set for us; macOS/Linux: getrusage) ----
if sys.platform == "win32":
    import ctypes.wintypes as wt

    class PMC(ctypes.Structure):
        _fields_ = [("cb", wt.DWORD), ("PageFaultCount", wt.DWORD), ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t), ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPagedPoolUsage", ctypes.c_size_t), ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaNonPagedPoolUsage", ctypes.c_size_t), ("PagefileUsage", ctypes.c_size_t),
                    ("PeakPagefileUsage", ctypes.c_size_t)]


def peak_ram_gb():
    if sys.platform != "win32":
        import resource
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return peak / 1024 ** 3 if sys.platform == "darwin" else peak / 1024 ** 2  # macOS: bytes, Linux: KB
    counters = PMC()
    counters.cb = ctypes.sizeof(PMC)
    get_process = ctypes.windll.kernel32.GetCurrentProcess
    get_process.restype = wt.HANDLE
    get_info = ctypes.windll.psapi.GetProcessMemoryInfo
    get_info.argtypes = [wt.HANDLE, ctypes.POINTER(PMC), wt.DWORD]
    get_info.restype = wt.BOOL
    if not get_info(get_process(), ctypes.byref(counters), counters.cb):
        return -1.0
    return counters.PeakWorkingSetSize / 1024 ** 3


# ---- peak VRAM: whole-GPU use sampled by NVML (catches non-PyTorch allocations too) ----
class VramSampler:
    def __init__(self):
        self.peak = 0.0
        self.base = 0.0
        self.ok = False
        try:
            import pynvml
            pynvml.nvmlInit()
            self.nvml = pynvml
            self.handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            self.base = self.used()
            self.ok = True
        except Exception:
            return
        threading.Thread(target=self.loop, daemon=True).start()

    def used(self):
        return self.nvml.nvmlDeviceGetMemoryInfo(self.handle).used / 1024 ** 3

    def loop(self):
        while True:
            self.peak = max(self.peak, self.used())
            time.sleep(0.05)


def long_chapter():
    """Moby-Dick chapter 1 (public domain) split into paragraphs, for the continuous listening test."""
    text = (ROOT / "passages" / "moby_chapter1.txt").read_text(encoding="utf-8")
    paragraphs = [" ".join(p.split()) for p in re.split(r"\n\s*\n", text) if p.strip()]
    return {"lang": "en", "paragraphs": [{"pause": 1.15, "sentences": [p]} for p in paragraphs]}


def main():
    engine = importlib.import_module(sys.argv[1])
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    passages = json.loads((ROOT / "passages" / "passages.json").read_text(encoding="utf-8"))
    passages = {k: v for k, v in passages.items() if not k.startswith("_")}
    if "--long" in sys.argv:
        passages = {"moby_chapter1": long_chapter()}
    if only:
        passages = {k: v for k, v in passages.items() if k in only}
    langs = getattr(engine, "LANGS", {"en"})
    passages = {k: v for k, v in passages.items() if v["lang"] in langs}

    out_dir = ROOT / "samples" / engine.NAME
    out_dir.mkdir(parents=True, exist_ok=True)
    vram = VramSampler()

    started = time.perf_counter()
    engine.load()
    load_s = time.perf_counter() - started
    print(f"[{engine.NAME}] loaded in {load_s:.1f}s", flush=True)

    results = {"engine": engine.NAME, "load_s": round(load_s, 2), "passages": {}}
    total_gen = total_audio = 0.0
    for name, passage in passages.items():
        pieces, rate, first_delay, gen_s = [], None, None, 0.0
        for index, paragraph in enumerate(passage["paragraphs"]):
            text = " ".join(paragraph["sentences"])
            t0 = time.perf_counter()
            audio, rate = engine.generate(text, passage["lang"])
            took = time.perf_counter() - t0
            gen_s += took
            if first_delay is None:
                first_delay = took
            audio = np.asarray(audio, dtype=np.float32).reshape(-1)
            pieces.append(audio)
            pieces.append(np.zeros(int(rate * paragraph["pause"]), dtype=np.float32))
            print(f"  {name} #{index + 1}: {len(audio) / rate:.1f}s audio in {took:.1f}s", flush=True)
        joined = np.concatenate(pieces)
        audio_s = sum(len(p) for p in pieces[::2]) / rate
        sf.write(out_dir / f"{engine.NAME}__{name}.wav", joined, rate)
        total_gen += gen_s
        total_audio += audio_s
        results["passages"][name] = {"first_play_delay_s": round(first_delay, 2), "gen_s": round(gen_s, 2),
                                     "speech_s": round(audio_s, 2),
                                     "sec_per_audio_min": round(gen_s / audio_s * 60, 1)}

    results["total"] = {"gen_s": round(total_gen, 1), "speech_s": round(total_audio, 1),
                        "sec_per_audio_min": round(total_gen / total_audio * 60, 1) if total_audio else None}
    results["peak_ram_gb"] = round(peak_ram_gb(), 2)
    if vram.ok:
        time.sleep(0.2)
        results["peak_vram_gb"] = round(vram.peak, 2)
        results["vram_before_gb"] = round(vram.base, 2)
    results.update(getattr(engine, "INFO", {}))
    tag = "long" if "--long" in sys.argv else "short"
    (ROOT / "results").mkdir(exist_ok=True)
    (ROOT / "results" / f"{engine.NAME}__{tag}.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2), flush=True)


if __name__ == "__main__":
    main()
