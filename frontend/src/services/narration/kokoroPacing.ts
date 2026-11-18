// Pacing for Kokoro narration (from RozaReader): Kokoro reads every sentence the same way, so the
// book gets its rhythm from the silence after each sentence and a slightly slower pace for short,
// dramatic lines. The pause is baked into each clip by the desktop service.
import type { AudiobookSentence } from "../readerTts";

export type SentencePacing = {
  /** Seconds of silence after the spoken words. */
  pause: number;
  /** Kokoro's speaking speed; 1 is normal. */
  speed: number;
};

const PAUSE = {
  sentence: 0.35,
  question: 0.45,
  trailing: 0.6,
  paragraph: 0.75,
  speakerChange: 0.9,
  sceneBreak: 1.4,
  chapterEnd: 1.5,
};

const SHORT_SENTENCE_WORDS = 5;
const SHORT_SENTENCE_SPEED = 0.92;
const TRAILING_SPEED = 0.95;

const OPENING_QUOTE = /^["'“‘«]/;
const ANY_QUOTE = /["“”«»]/;
const HAS_LETTERS = /[\p{L}\p{N}]/u;
const TRAILING_END = /(…|\.\.\.|[—–-])["'”’)\]]*$/;
const QUESTION_END = /[!?]["'”’)\]]*$/;

type PacingSentence = Pick<AudiobookSentence, "text" | "paragraph" | "words">;

/** True when the sentence is spoken by a character: it has a quote mark, or a quote opened earlier is still open. */
function isQuoted(paragraph: PacingSentence[], target: PacingSentence) {
  let isOpen = false;
  for (const item of paragraph) {
    if (item === target) return isOpen || ANY_QUOTE.test(item.text);
    for (const char of item.text) {
      if (char === "“" || char === "«") isOpen = true;
      else if (char === "”" || char === "»") isOpen = false;
      else if (char === "\"") isOpen = !isOpen;
    }
  }
  return false;
}

/** Pacing for every sentence of one section (chapter). */
export function sectionPacing(sentences: PacingSentence[]): SentencePacing[] {
  const paragraphs: PacingSentence[][] = [];
  for (const sentence of sentences) {
    const last = paragraphs[paragraphs.length - 1];
    if (last && last[0].paragraph === sentence.paragraph) last.push(sentence);
    else paragraphs.push([sentence]);
  }
  const paragraphOf = new Map<PacingSentence, number>();
  paragraphs.forEach((paragraph, index) => paragraph.forEach(item => paragraphOf.set(item, index)));
  const paragraphText = (paragraph: PacingSentence[] | undefined) => (paragraph || []).map(item => item.text).join(" ");

  return sentences.map((sentence, index) => {
    const text = sentence.text.trim();
    if (!HAS_LETTERS.test(text)) return { pause: PAUSE.sceneBreak, speed: 1 };
    const paragraphIndex = paragraphOf.get(sentence) ?? 0;
    const paragraph = paragraphs[paragraphIndex];
    const isLastInChapter = index === sentences.length - 1;
    const isParagraphEnd = paragraph[paragraph.length - 1] === sentence;
    const isDialogue = OPENING_QUOTE.test(paragraphText(paragraph).trim());
    const isNextDialogue = OPENING_QUOTE.test(paragraphText(paragraphs[paragraphIndex + 1]).trim());
    const isTrailing = TRAILING_END.test(text);
    // Short narration lines ("Or yesterday.") land harder a little slower; quick dialogue stays quick.
    const isShortNarration = sentence.words.length <= SHORT_SENTENCE_WORDS && !isQuoted(paragraph, sentence);
    const speed = isTrailing ? TRAILING_SPEED : isShortNarration ? SHORT_SENTENCE_SPEED : 1;
    if (isLastInChapter) return { pause: PAUSE.chapterEnd, speed };
    if (isParagraphEnd && isDialogue && isNextDialogue) return { pause: PAUSE.speakerChange, speed };
    if (isParagraphEnd) return { pause: PAUSE.paragraph, speed };
    if (isTrailing) return { pause: PAUSE.trailing, speed };
    if (QUESTION_END.test(text)) return { pause: PAUSE.question, speed };
    return { pause: PAUSE.sentence, speed };
  });
}

/** What the desktop service needs to speak one sentence. */
export function kokoroSentence(sentence: PacingSentence, pacing: SentencePacing) {
  return { text: sentence.words.map(word => word.text).join(" "), words: sentence.words.map(word => word.text), pause: pacing.pause, speed: pacing.speed };
}
