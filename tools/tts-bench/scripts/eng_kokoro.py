"""Kokoro baseline: imports ROZA's own desktop service code, so it runs exactly as the app does
(CPU, 4 threads, voice af_heart, same silence trimming). Run it with the Kokoro runtime python of an
installed Roza desktop app, with HF_HOME set to that runtime's "hf" folder and HF_HUB_OFFLINE=1."""

import os
import sys

NAME = "kokoro"
LANGS = {"en"}
INFO = {"device": "cpu (4 threads, as in the app)", "voice": "af_heart"}
SERVICE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "desktop", "kokoro")
service = None


def load():
    global service
    sys.path.insert(0, SERVICE_DIR)
    import service as svc  # loads the model at import
    service = svc


def generate(text, lang):
    audio, times = service.speak("af_heart", text, text.split(), 1)
    audio, _ = service.trim_silence(audio, times)
    return audio, service.SAMPLE_RATE
