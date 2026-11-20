import type { ReaderAudiobookNarrator } from "../../../../shared/types/reader";
import { AppError } from "../error/errorService";
import { isReaderKokoroVoice } from "./readerKokoroVoices";

export function parseAudiobookNarrator(
  input: unknown,
  openAiVoices: readonly string[] = [],
): ReaderAudiobookNarrator {
  const body = input as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some(key => !["engine", "voice", "name", "lang"].includes(key))
    || (body.engine !== "system" && body.engine !== "openai" && body.engine !== "kokoro")
    || typeof body.voice !== "string" || !body.voice.trim() || body.voice.length > 1024
    || typeof body.name !== "string" || !body.name.trim() || body.name.length > 256
    || typeof body.lang !== "string" || body.lang.length > 32
    || (body.engine === "openai" && !openAiVoices.includes(body.voice))
    || (body.engine === "kokoro" && !isReaderKokoroVoice(body.voice)))
    throw new AppError("Choose an available narrator voice.", 400);
  return { engine: body.engine, voice: body.voice, name: body.name, lang: body.lang };
}
