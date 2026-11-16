import { Fragment, memo, useMemo } from "react";
import { audiobookParagraphs, audiobookWordAt, audiobookWordWindow, type AudiobookParagraphData, type AudiobookSentence, type AudiobookSection } from "../../services/readerTts";

const HighlightedSentence = memo(function HighlightedSentence({ sentence, index, highlight, offset }: {
  sentence: AudiobookSentence; index: number; highlight: number | null; offset: number;
}) {
  const cursor = highlight ?? audiobookWordAt(sentence.words, offset);
  const band = Math.floor(cursor / 32);
  // Keep a stable 64-word window. Surrounding text never leaves the document.
  const wordWindow = useMemo(() => audiobookWordWindow(sentence, band * 32), [sentence, band]);
  return <span className="audiobook-sentence is-active" aria-current="true" data-sentence={index}>
    {wordWindow.prefix}
    {sentence.words.slice(wordWindow.start, wordWindow.end).map((word, localIndex) => {
      const wordIndex = wordWindow.start + localIndex;
      return <Fragment key={word.start}>
        <span className={"audiobook-word" + (wordIndex === highlight ? " is-active" : "")}
          data-audiobook-cursor={wordIndex === cursor ? "" : undefined}>{word.text}</span>
        {wordIndex + 1 < wordWindow.end ? sentence.text.slice(word.end, sentence.words[wordIndex + 1].start) : ""}
      </Fragment>;
    })}
    {wordWindow.suffix}
  </span>;
});

/** Inactive paragraphs are plain text. Modal/status changes reuse every paragraph. */
const ReaderAudiobookParagraph = memo(function ReaderAudiobookParagraph({ paragraph, activeIndex, highlight, offset }: {
  paragraph: AudiobookParagraphData; activeIndex: number; highlight: number | null; offset: number;
}) {
  const active = paragraph.items[activeIndex - paragraph.first];
  return <p>
    {active ? <>
      {paragraph.text.slice(0, active.offset)}
      <HighlightedSentence sentence={active.sentence} index={activeIndex} highlight={highlight} offset={offset} />
      {paragraph.text.slice(active.offset + active.sentence.text.length)}
    </> : paragraph.text}
  </p>;
});

/** Modal, voice and status state never re-renders the chapter's text subtree. */
export const ReaderAudiobookText = memo(function ReaderAudiobookText({ section, bookTitle, loading, index, highlight, offset }: {
  section: AudiobookSection | null; bookTitle: string; loading: boolean;
  index: number; highlight: number | null; offset: number;
}) {
  const paragraphs = useMemo(() => audiobookParagraphs(section?.sentences || []), [section?.sentences]);
  return <article className="audiobook-content" dir="auto" aria-busy={loading}>
    {section?.title && <div className="audiobook-chapter-meta">{bookTitle}</div>}
    <h1 className="audiobook-chapter-title">{section?.title || bookTitle}</h1>
    {loading && <p className="audiobook-loading" role="status">Loading book…</p>}
    {!loading && paragraphs.map(paragraph => {
      const active = index >= paragraph.first && index <= paragraph.last;
      return <ReaderAudiobookParagraph key={paragraph.paragraph} paragraph={paragraph}
        activeIndex={active ? index : -1} highlight={active ? highlight : null} offset={active ? offset : 0} />;
    })}
  </article>;
});
