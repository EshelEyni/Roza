// Expressive voices add-on: Chatterbox Turbo (Ticket #66), installed on top of the Kokoro local voices.
// Its own runtime folder, service (desktop/chatterbox/service.py) and voice files; the store, offline
// saves, export (with Kokoro's ffmpeg) and audio route are shared with Kokoro.
//
// Chatterbox gives no word times, so the runtime also holds a small English aligner (wav2vec2 from
// torchaudio) that the service uses for word highlighting, seeking and sentence cuts.
const path = require("node:path");

// Model files the service loads (s3gen.safetensors, the older decoder, is not needed: ~1 GB saved).
const PREFETCH = `
import torchaudio
from huggingface_hub import snapshot_download
snapshot_download("ResembleAI/chatterbox-turbo", allow_patterns=${JSON.stringify([
  "t3_turbo_v1.safetensors", "s3gen_meanflow.safetensors", "ve.safetensors", "*.json", "*.txt", "*.pt", "*.model",
])})
print("1/2", flush=True)
torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H.get_model()
print("2/2", flush=True)
`;

/**
 * @param {{ voiceRefs: string }} options  folder with the reference clips (cb_<name>.wav)
 */
function chatterboxRecipe({ voiceRefs }) {
  return {
    name: "chatterbox",
    label: "Expressive",
    version: 1,
    // PyTorch with CUDA (~2.5 GB), the other packages (~2 GB), the model (~2.8 GB) and the aligner (~0.4 GB).
    neededBytes: 10 * 1024 ** 3,
    // PyTorch 2.6 has no Intel Mac build.
    supported: () => process.platform === "win32" || (process.platform === "darwin" && process.arch === "arm64"),
    packages: (platform) => [
      ...(platform === "win32"
        ? ["--index-strategy", "unsafe-best-match", "--extra-index-url", "https://download.pytorch.org/whl/cu124",
          "torch==2.6.0+cu124", "torchaudio==2.6.0+cu124"]
        : ["torch==2.6.0", "torchaudio==2.6.0"]),
      "chatterbox-tts==0.1.7",
      // Chatterbox's watermarker imports pkg_resources, which setuptools 81 removed.
      "setuptools<81",
      "soundfile==0.14.0",
    ],
    env: (runtimeDir) => ({
      TORCH_HOME: path.join(runtimeDir, "torch"),
      ROZA_CHATTERBOX_VOICES: path.join(runtimeDir, "voices"),
    }),
    selfTestRequest: (out) => ({ id: "test", text: "Hello from Roza.", words: ["Hello", "from", "Roza."], voice: "cb_heart", out }),
    async steps({ run, report, venvPython, runtimeDir, script }) {
      report("model", "Downloading the voice model and word aligner…", 56);
      await run(venvPython, ["-c", PREFETCH], {
        onLine: (line) => {
          const [done, total] = line.split("/").map(Number);
          if (total) report("model", `Downloading models… ${done} of ${total}`, 56 + (done / total) * 26);
        },
      });
      report("voices", "Preparing the voices…", 84);
      await run(venvPython, [script, "--build-voices", voiceRefs, path.join(runtimeDir, "voices")], {
        onLine: (line) => {
          const [done, total] = line.split("/").map(Number);
          if (total) report("voices", `Preparing voices… ${done} of ${total}`, 84 + (done / total) * 10);
        },
      });
      return {};
    },
  };
}

module.exports = { chatterboxRecipe };
