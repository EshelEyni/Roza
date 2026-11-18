import type { useReaderAudiobook } from "../../../hooks/reader/useReaderAudiobook";
import { kokoroVoice } from "../../../services/narration/kokoroVoices";

export type ReaderAudiobook = ReturnType<typeof useReaderAudiobook>;

/** The narrator's name and a short engine line, for the player and the mini player. */
export function narratorLabel(audio: ReaderAudiobook) {
  if (audio.engine === "kokoro") {
    const voice = kokoroVoice(audio.localVoice);
    return { name: voice?.name || "Local voice", detail: voice ? voice.nationality + " · Local" : "Local" };
  }
  if (audio.engine === "openai") return { name: audio.aiVoice || "OpenAI", detail: "OpenAI · AI voice" };
  const voice = audio.voices.find(item => item.voiceURI === audio.voice);
  return { name: voice?.name || (audio.voice === "browser-default" ? "Browser default" : "Choose voice"), detail: voice?.lang ? "System · " + voice.lang : "System" };
}
