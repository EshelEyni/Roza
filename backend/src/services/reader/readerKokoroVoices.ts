/**
 * Kokoro voices a book may save as its narrator. Kokoro runs on the reader's own computer
 * (Roza desktop app), so the backend only validates the id. Keep this list in step with
 * frontend/src/services/audiobook/kokoroVoices.ts and desktop/kokoro/voices.cjs
 * (scripts/reader-kokoro-voices.test.cjs checks that they match).
 */
export const readerKokoroVoices = [
  "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore", "af_nicole", "af_nova",
  "af_river", "af_sarah", "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam",
  "am_michael", "am_onyx", "am_puck", "am_santa", "bf_alice", "bf_emma", "bf_isabella", "bf_lily",
  "bm_daniel", "bm_fable", "bm_george", "bm_lewis",
] as const;

export const isReaderKokoroVoice = (voice: string) => (readerKokoroVoices as readonly string[]).includes(voice);
