import { EpubCFI, type Book } from "epubjs";
import { extractReaderSentences } from "./readerSentences";
import { rsvpStart } from "./readerRsvp";
import { loadReaderChapters, readerChapterTitle } from "./readerChapters";
import { audiobookWords, audiobookWordAt, type AudiobookSection, type AudiobookSentence } from "./readerTts";

/** Render one spine section at a time, retaining the existing safe text/CFI mapping. */
export async function loadAudiobookSection(
  book: Book, target: string | number, direction: 1 | -1 = 1, from?: string,
): Promise<AudiobookSection | null> {
  await loadReaderChapters(book);
  let section = book.spine.get(target);
  while (section) {
    if (section.linear !== false) {
      await section.load(book.load.bind(book));
      let totalWords = 0;
      let paragraph = -1;
      let previousBlock: Element | null | undefined;
      const sentences: AudiobookSentence[] = extractReaderSentences(section).map(sentence => {
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
