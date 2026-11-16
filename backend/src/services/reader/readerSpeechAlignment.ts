export type ReaderSpeechWordTiming = {
  startChar: number; endChar: number; startSeconds: number; endSeconds: number;
};
type TimedWord = { word: string; start: number; end: number };
const key = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, "");

/** Match timestamped recognized words to exact UTF-16 source ranges, never guesses. */
export function matchReaderSpeechWords(text: string, words: unknown, duration: number): ReaderSpeechWordTiming[] | null {
  if (!Array.isArray(words) || !words.length || words.length > 1200 || !Number.isFinite(duration) || duration <= 0) return null;
  const recognized: TimedWord[] = [];
  let lastStart = 0, lastEnd = 0;
  for (const word of words) {
    if (!word || typeof word.word !== "string" || word.word.length > 2400
      || !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0
      || word.end <= word.start || word.end > duration + 0.05 || word.start < lastStart
      || word.end < lastEnd || word.start < lastEnd - 0.08) return null;
    lastStart = word.start; lastEnd = word.end;
    if (key(word.word)) recognized.push(word);
  }
  const timings: ReaderSpeechWordTiming[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/\S+/gu)) {
    const expected = key(match[0]);
    if (!expected) continue;
    const first = recognized[cursor];
    if (!first) return null;
    let actual = "", end = first.end;
    while (actual.length < expected.length && cursor < recognized.length) {
      const word = recognized[cursor++]; actual += key(word.word); end = word.end;
      if (!expected.startsWith(actual)) return null;
    }
    if (actual !== expected) return null;
    timings.push({ startChar: match.index!, endChar: match.index! + match[0].length,
      startSeconds: first.start, endSeconds: Math.min(duration, end) });
  }
  return cursor === recognized.length && timings.length ? timings : null;
}

/** Timestamp-capable Whisper is temporary (retirement: 2027-02-26).
 * Failure is nonfatal: keep the generated narration with passage highlighting.
 */
export async function alignReaderSpeech(
  text: string, wav: Buffer, duration: number, apiKey: string, signal: AbortSignal,
  request: typeof fetch = fetch, timeoutMs = 10000,
): Promise<ReaderSpeechWordTiming[] | null> {
  if (signal.aborted) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs); timer.unref?.();
  try {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "narration.wav");
    form.set("model", "whisper-1"); form.set("response_format", "verbose_json");
    form.set("timestamp_granularities[]", "word"); form.set("prompt", text);
    const response = await request("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: "Bearer " + apiKey }, body: form, signal: controller.signal,
    });
    if (!response.ok) return null;
    const raw = await response.text();
    if (controller.signal.aborted || raw.length > 128000) return null;
    const result = JSON.parse(raw);
    return matchReaderSpeechWords(text, result.words, duration);
  } catch { return null; }
  finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}
