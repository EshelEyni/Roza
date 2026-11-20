// Local voices (Roza desktop app). Keep in step with desktop/kokoro/voices.cjs and
// backend/src/services/reader/readerKokoroVoices.ts (scripts/desktop-kokoro.test.cjs checks that they match).
//
// Two models speak them, both under the narrator engine "kokoro" (local desktop narration):
// Kokoro, installed with the local voices, and Chatterbox Turbo, the "Expressive voices" add-on (Ticket #66).

export type LocalVoiceModel = "kokoro" | "chatterbox";

export type KokoroVoice = {
  /** Voice id. Kokoro ids start with the accent ("a" American, "b" British); Chatterbox ids with "cb_". */
  id: string;
  name: string;
  nationality: "American" | "British";
  gender: "Female" | "Male";
  model: LocalVoiceModel;
};

const voice = (id: string, name: string): KokoroVoice => ({
  id, name,
  nationality: id.startsWith("a") ? "American" : "British",
  gender: id[1] === "f" ? "Female" : "Male",
  model: "kokoro",
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

const expressive = (id: string, name: string, nationality: KokoroVoice["nationality"], gender: KokoroVoice["gender"]): KokoroVoice =>
  ({ id, name, nationality, gender, model: "chatterbox" });

/** Chatterbox Turbo voices: its built-in voice, and four cloned from Kokoro voices of the same name. */
export const chatterboxVoices: KokoroVoice[] = [
  expressive("cb_default", "Turbo", "American", "Female"),
  expressive("cb_heart", "Heart", "American", "Female"),
  expressive("cb_emma", "Emma", "British", "Female"),
  expressive("cb_michael", "Michael", "American", "Male"),
  expressive("cb_george", "George", "British", "Male"),
];

export const localVoices: KokoroVoice[] = [...kokoroVoices, ...chatterboxVoices];

export const defaultKokoroVoice = "af_heart";

export const kokoroVoice = (id: string) => localVoices.find(item => item.id === id);

export const kokoroLang = (item: KokoroVoice) => (item.nationality === "American" ? "en-US" : "en-GB");

export const localModelLabel = (model: LocalVoiceModel) => (model === "chatterbox" ? "Expressive" : "Standard");
