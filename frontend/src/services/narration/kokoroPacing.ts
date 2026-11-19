// Pacing for Kokoro narration. Kokoro speaks a whole paragraph (a "passage") in one go, so it phrases
// the sentences of a thought together and keeps its own natural pauses between them. The book gets
// its larger rhythm from the silence added after a passage: longer after a paragraph, a heading or a
// scene break. Ticket #64 listening tests: one call per sentence sounded flat and its pauses short.
import type { AudiobookSentence } from "../readerTts";

export type SentencePacing = {
  /** Seconds of silence after the spoken words. */
  pause: number;
};

const PAUSE = {
  sentence: 0.5,
  question: 0.6,
  trailing: 0.8,
  speakerChange: 1.0,
  paragraph: 1.15,
  heading: 1.6,
  sceneBreak: 2.6,
  chapterEnd: 2.5,
};

// Kokoro handles long text, but a passage is also the wait before a paragraph starts playing.
const MAX_PASSAGE_WORDS = 250;
const MAX_PASSAGE_SENTENCES = 40;

const OPENING_QUOTE = /^["'“‘«]/;
const HAS_LETTERS = /[\p{L}\p{N}]/u;
const TRAILING_END = /(…|\.\.\.|[—–-])["'”’)\]]*$/;
const QUESTION_END = /[!?]["'”’)\]]*$/;

type PacingSentence = Pick<AudiobookSentence, "text" | "paragraph" | "words" | "heading" | "sceneBreakBefore">;

const isSceneMark = (sentence: PacingSentence) => !HAS_LETTERS.test(sentence.text);

/**
 * The passage number of every sentence of a section: neighbours with the same number are spoken
 * together. A passage is one paragraph, split if it is very long; headings and scene marks stand alone.
 */
export function sectionPassages(sentences: PacingSentence[]): number[] {
  const passages: number[] = [];
  let passage = -1;
  let words = 0;
  let count = 0;
  sentences.forEach((sentence, index) => {
    const previous = sentences[index - 1];
    const isNew = !previous || previous.paragraph !== sentence.paragraph || isSceneMark(sentence) || isSceneMark(previous)
      || !!sentence.heading !== !!previous.heading
      || words + sentence.words.length > MAX_PASSAGE_WORDS || count >= MAX_PASSAGE_SENTENCES;
    if (isNew) { passage++; words = 0; count = 0; }
    words += sentence.words.length;
    count++;
    passages.push(passage);
  });
  return passages;
}

/**
 * Pause after every sentence of one section (chapter). With `passages`, a sentence inside a passage
 * gets no added pause: Kokoro's own pause between the sentences is already in the audio.
 */
export function sectionPacing(sentences: PacingSentence[], passages?: number[]): SentencePacing[] {
  // A paragraph is dialogue when it opens with a quote mark.
  const isDialogue = new Map<number, boolean>();
  for (const sentence of sentences) {
    if (!isDialogue.has(sentence.paragraph)) isDialogue.set(sentence.paragraph, OPENING_QUOTE.test(sentence.text.trim()));
  }

  return sentences.map((sentence, index) => {
    const next = sentences[index + 1];
    if (!next) return { pause: PAUSE.chapterEnd };
    if (isSceneMark(sentence) || next.sceneBreakBefore) return { pause: PAUSE.sceneBreak };
    if (passages && passages[index] === passages[index + 1]) return { pause: 0 };
    const text = sentence.text.trim();
    if (sentence.heading && !next.heading) return { pause: PAUSE.heading };
    if (next.paragraph !== sentence.paragraph) {
      const isSpeakerChange = isDialogue.get(sentence.paragraph) && isDialogue.get(next.paragraph);
      return { pause: isSpeakerChange ? PAUSE.speakerChange : PAUSE.paragraph };
    }
    if (TRAILING_END.test(text)) return { pause: PAUSE.trailing };
    if (QUESTION_END.test(text)) return { pause: PAUSE.question };
    return { pause: PAUSE.sentence };
  });
}

export type KokoroSentenceRequest = { text: string; words: string[]; pause: number; speed: number; passage?: number };

/** What the desktop service needs to speak one sentence. */
export function kokoroSentence(sentence: PacingSentence, pacing: SentencePacing, passage?: number): KokoroSentenceRequest {
  return {
    text: sentence.words.map(word => word.text).join(" "), words: sentence.words.map(word => word.text),
    pause: pacing.pause, speed: 1, ...(passage === undefined ? {} : { passage }),
  };
}

/** Requests for a whole section, grouped into passages when the desktop app can speak them. */
export function kokoroSectionRequests(sentences: PacingSentence[], withPassages: boolean): KokoroSentenceRequest[] {
  const passages = withPassages ? sectionPassages(sentences) : undefined;
  const pacing = sectionPacing(sentences, passages);
  return sentences.map((sentence, index) => kokoroSentence(sentence, pacing[index], passages?.[index]));
}
