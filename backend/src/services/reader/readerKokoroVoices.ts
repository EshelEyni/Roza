/**
 * Local voices a book may save as its narrator (engine "kokoro"). They run on the reader's own computer
 * (Roza desktop app), so the backend only validates the id. Keep these lists in step with
 * frontend/src/services/narration/kokoroVoices.ts and desktop/kokoro/voices.cjs
 * (scripts/desktop-kokoro.test.cjs checks that they match).
 */
export const readerKokoroVoices = [
  "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore", "af_nicole", "af_nova",
  "af_river", "af_sarah", "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam",
  "am_michael", "am_onyx", "am_puck", "am_santa", "bf_alice", "bf_emma", "bf_isabella", "bf_lily",
  "bm_daniel", "bm_fable", "bm_george", "bm_lewis",
] as const;

/** Expressive voices from the desktop app's Chatterbox Turbo add-on (Ticket #66). */
export const readerChatterboxVoices = ["cb_default", "cb_heart", "cb_emma", "cb_michael", "cb_george"] as const;

export const isReaderKokoroVoice = (voice: string) =>
  (readerKokoroVoices as readonly string[]).includes(voice) || (readerChatterboxVoices as readonly string[]).includes(voice);
