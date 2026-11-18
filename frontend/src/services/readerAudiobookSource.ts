import { EpubCFI, type Book } from "epubjs";
import type Section from "epubjs/types/section";
import { extractReaderSentences } from "./readerSentences";
import { rsvpStart } from "./readerRsvp";
import { loadReaderChapters, readerChapterTitle } from "./readerChapters";
import { audiobookWords, audiobookWordAt, type AudiobookSection, type AudiobookSentence } from "./readerTts";

/** One section's sentences, words and paragraph groups. Live and whole-book loading share this split. */
function sectionSentences(section: Section): AudiobookSentence[] {
  let totalWords = 0;
  let paragraph = -1;
  let previousBlock: Element | null | undefined;
  return extractReaderSentences(section, true).map(sentence => {
    const range = new EpubCFI(sentence.cfi).toRange(section.document);
    const container = range.startContainer.nodeType === 1 ? range.startContainer as Element : range.startContainer.parentElement;
    const block = container?.closest("p,div,li,h1,h2,h3,h4,h5,h6,blockquote,pre,td") || null;
    if (block !== previousBlock) paragraph++;
    previousBlock = block;
    const words = audiobookWords(sentence.text);
    const item = { ...sentence, paragraph, words, startWord: totalWords };
    totalWords += words.length;
    return item;
  });
}

/** Render one spine section at a time, retaining the existing safe text/CFI mapping. */
export async function loadAudiobookSection(
  book: Book, target: string | number, direction: 1 | -1 = 1, from?: string,
): Promise<AudiobookSection | null> {
  await loadReaderChapters(book);
  let section = book.spine.get(target);
  while (section) {
    if (section.linear !== false) {
      await section.load(book.load.bind(book));
      const sentences = sectionSentences(section);
      const totalWords = sentences.reduce((sum, sentence) => sum + sentence.words.length, 0);
      if (sentences.length) {
        const start = from ? rsvpStart(sentences.map(sentence => ({ ...sentence, paragraphEnd: false })), from)
          : direction < 0 ? sentences.length - 1 : 0;
        let offset = 0;
        if (from) {
          try {
            const anchor = new EpubCFI(from).toRange(section.document);
            const range = new EpubCFI(sentences[start].cfi).toRange(section.document);
            range.setEnd(anchor.startContainer, anchor.startOffset);
            const length = range.toString().replace(/\s+/gu, " ").length;
            offset = sentences[start].words[audiobookWordAt(sentences[start].words, length)]?.start || 0;
          } catch { /* Fall back to the containing sentence for element-only CFIs. */ }
        }
        return {
          section: section.index,
          title: readerChapterTitle(book, sentences[start].cfi),
          sentences, totalWords, start, offset,
          previous: section.index > book.spine.first().index ? section.index - 1 : null,
          next: section.index < book.spine.last().index ? section.index + 1 : null,
        };
      }
    }
    section = book.spine.get(section.index + direction);
    from = undefined;
  }
  return null;
}

export type AudiobookChapter = { section: number; title: string };

/** The book's real chapters (its table of contents), one per section, for the audiobook contents menu. */
export async function loadAudiobookChapters(book: Book): Promise<AudiobookChapter[]> {
  const chapters = await loadReaderChapters(book);
  const seen = new Set<number>();
  return chapters.filter(chapter => !seen.has(chapter.section) && seen.add(chapter.section))
    .map(chapter => ({ section: chapter.section, title: chapter.title }));
}

/**
 * Every readable section of the book, for offline saves and export. Each section is loaded as its own
 * document (like search), so the page view and its rendering are never disturbed. Yields between sections.
 */
export async function loadAudiobookBook(
  book: Book, onProgress: (done: number, total: number) => void, signal: AbortSignal,
): Promise<{ section: number; title: string; sentences: AudiobookSentence[] }[]> {
  await loadReaderChapters(book);
  const sections: Section[] = [];
  book.spine.each((section: Section) => { if (section.linear !== false) sections.push(section); });
  const result: { section: number; title: string; sentences: AudiobookSentence[] }[] = [];
  for (let index = 0; index < sections.length; index++) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const section = sections[index];
    const document = (await book.load(section.url)) as Document;
    const detached = Object.create(section, { document: { value: document } }) as Section;
    const sentences = sectionSentences(detached);
    if (sentences.length) result.push({ section: section.index, title: readerChapterTitle(book, sentences[0].cfi), sentences });
    onProgress(index + 1, sections.length);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return result;
}
