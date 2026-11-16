import { KokoroTTS } from "kokoro-js";

let model: Awaited<ReturnType<typeof KokoroTTS.from_pretrained>> | undefined;
self.onmessage = async (event: MessageEvent<{ text: string; voice: string }>) => {
  try {
    model ??= await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8", device: "wasm",
      progress_callback: (progress: { status: string; progress?: number }) => {
        self.postMessage({ status: progress.status === "progress"
          ? `Downloading model: ${Math.round(progress.progress || 0)}%`
          : "Loading Kokoro model…" });
      },
    });
    self.postMessage({ status: "Generating Kokoro audio…" });
    const audio = await model.generate(event.data.text, { voice: event.data.voice as keyof KokoroTTS["voices"] });
    self.postMessage({ blob: audio.toBlob() });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
