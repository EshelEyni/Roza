import { ConfirmDialog } from "./ReaderArchiveDialog";
import { FiFlag } from "react-icons/fi";
import type { EpubReaderController } from "../../hooks/reader/useEpubReader";

export function ReaderReadingTarget({ reader }: { reader: EpubReaderController }) {
  return <>
      {reader.readingTarget.selecting && <div className="reader-target-instructions" role="status">
        <span>Select a word in Page Mode to set your reading target.</span>
        <button className="reader-button" disabled={reader.readingTarget.pending}
          aria-label="Cancel target selection" onClick={() => void reader.readingTarget.finish(false)}>Cancel</button>
      </div>}
      {reader.readingTarget.selecting && reader.textSelection && <ConfirmDialog
        heading="Set reading target?" message="Read up to the sentence containing this selection? You will return to your starting sentence."
        confirmLabel="Set target" icon={<FiFlag />} pending={reader.readingTarget.pending}
        onCancel={reader.readingTarget.chooseAgain} onConfirm={() => void reader.readingTarget.finish(true)}>
        <blockquote>{reader.textSelection.text}</blockquote>
        {reader.readingTarget.error && <p role="alert">{reader.readingTarget.error}</p>}
      </ConfirmDialog>}
  </>;
}
