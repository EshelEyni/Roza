import { KokoroTTS } from "kokoro-js";

// Use the library's supported catalog, rather than a curated subset.
self.postMessage({ voices: Object.entries(KokoroTTS.prototype.voices).map(([value, voice]) => ({
  value, label: voice.name + " · " + voice.language + " · " + voice.gender,
})) });
let model: Awaited<ReturnType<typeof KokoroTTS.from_pretrained>> | undefined;
self.onmessage = async (event: MessageEvent<{ id: number; text: string; voice: string }>) => {
  const { id, text, voice } = event.data;
  try {
    model ??= await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8", device: "wasm",
      progress_callback: (progress: { status: string; progress?: number }) => {
        self.postMessage({ id, status: progress.status === "progress"
          ? `Downloading voice model: ${Math.round(progress.progress || 0)}%`
          : "Loading voice model…" });
      },
    });
    self.postMessage({ id, status: "Preparing speech…" });
    const audio = await model.generate(text, { voice: voice as keyof KokoroTTS["voices"] });
    self.postMessage({ id, blob: audio.toBlob() });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
