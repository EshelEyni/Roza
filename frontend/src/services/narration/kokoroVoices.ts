// Local Kokoro voices (Roza desktop app). Keep in step with desktop/kokoro/voices.cjs and
// backend/src/services/reader/readerKokoroVoices.ts (scripts/desktop-kokoro.test.cjs checks that they match).

export type KokoroVoice = {
  /** Kokoro voice id; the first letter is the accent ("a" American, "b" British). */
  id: string;
  name: string;
  nationality: "American" | "British";
  gender: "Female" | "Male";
};

const voice = (id: string, name: string): KokoroVoice => ({
  id, name,
  nationality: id.startsWith("a") ? "American" : "British",
  gender: id[1] === "f" ? "Female" : "Male",
});

export const kokoroVoices: KokoroVoice[] = [
  voice("af_heart", "Heart"),
  voice("af_alloy", "Alloy"),
  voice("af_aoede", "Aoede"),
  voice("af_bella", "Bella"),
  voice("af_jessica", "Jessica"),
  voice("af_kore", "Kore"),
  voice("af_nicole", "Nicole"),
  voice("af_nova", "Nova"),
  voice("af_river", "River"),
  voice("af_sarah", "Sarah"),
  voice("af_sky", "Sky"),
  voice("am_adam", "Adam"),
  voice("am_echo", "Echo"),
  voice("am_eric", "Eric"),
  voice("am_fenrir", "Fenrir"),
  voice("am_liam", "Liam"),
  voice("am_michael", "Michael"),
  voice("am_onyx", "Onyx"),
  voice("am_puck", "Puck"),
  voice("am_santa", "Santa"),
  voice("bf_alice", "Alice"),
  voice("bf_emma", "Emma"),
  voice("bf_isabella", "Isabella"),
  voice("bf_lily", "Lily"),
  voice("bm_daniel", "Daniel"),
  voice("bm_fable", "Fable"),
  voice("bm_george", "George"),
  voice("bm_lewis", "Lewis"),
];

export const defaultKokoroVoice = "af_heart";

export const kokoroVoice = (id: string) => kokoroVoices.find(item => item.id === id);

export const kokoroLang = (item: KokoroVoice) => (item.nationality === "American" ? "en-US" : "en-GB");
