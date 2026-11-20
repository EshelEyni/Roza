"""Renders the ~16-19 s Kokoro reference clips that Chatterbox Turbo clones its voices from
(desktop/chatterbox/voices/<kokoro voice>.wav). Run it with the Kokoro runtime python of an installed
Roza desktop app (HF_HOME set to that runtime's "hf" folder, HF_HUB_OFFLINE=1):

    python -I make_refs.py af_heart,bf_emma,am_michael,bm_george
"""

import os
import sys
from pathlib import Path

import soundfile as sf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent.parent / "desktop" / "kokoro"))
import service  # noqa: E402

OUT = HERE.parent.parent.parent / "desktop" / "chatterbox" / "voices"
OUT.mkdir(parents=True, exist_ok=True)
TEXT = ("The road followed the river for most of the morning. Now and then it climbed a little, "
        "and from the top of each rise we could see the valley spread out below us, green and quiet. "
        "By noon the clouds had cleared, and the whole country lay open in the sun. "
        "We stopped beside an old stone bridge to rest.")

for voice in sys.argv[1].split(","):
    audio, times = service.speak(voice, TEXT, TEXT.split(), 1)
    audio, _ = service.trim_silence(audio, times)
    sf.write(OUT / f"{voice}.wav", audio, service.SAMPLE_RATE)
    print(f"{voice}: {len(audio) / service.SAMPLE_RATE:.1f}s", flush=True)
