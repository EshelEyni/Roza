// Local voices the desktop app may synthesize. Keep in step with
// frontend/src/services/narration/kokoroVoices.ts and backend/src/services/reader/readerKokoroVoices.ts
// (scripts/desktop-kokoro.test.cjs checks that they match).
const kokoroVoices = [
  "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore", "af_nicole", "af_nova",
  "af_river", "af_sarah", "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam",
  "am_michael", "am_onyx", "am_puck", "am_santa", "bf_alice", "bf_emma", "bf_isabella", "bf_lily",
  "bm_daniel", "bm_fable", "bm_george", "bm_lewis",
];

// Expressive voices from the Chatterbox Turbo add-on (Ticket #66). cb_default is Turbo's built-in
// voice; the others are cloned from desktop/chatterbox/voices/<id>.wav at install time.
const chatterboxVoices = ["cb_default", "cb_heart", "cb_emma", "cb_michael", "cb_george"];

const isKokoroVoice = (voice) => typeof voice === "string" && kokoroVoices.includes(voice);
const isChatterboxVoice = (voice) => typeof voice === "string" && chatterboxVoices.includes(voice);
const isLocalVoice = (voice) => isKokoroVoice(voice) || isChatterboxVoice(voice);

module.exports = { kokoroVoices, chatterboxVoices, isKokoroVoice, isChatterboxVoice, isLocalVoice };
