import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createEditor, type Descendant } from "slate";
import { withHistory } from "slate-history";
import { Editable, Slate, useSlate, withReact, type RenderElementProps, type RenderLeafProps } from "slate-react";
import { useTranslation } from "react-i18next";
import { FiArrowLeft } from "react-icons/fi";
import type { SlateCustomElement } from "../../../../shared/types/books";
import type { ReaderDocument } from "../../../../shared/types/readerDocuments";
import { TextEditorElement } from "../SlateTextEditor/TextEditorElement";
import { Leaf } from "../SlateTextEditor/Leaf";
import { btns } from "../SlateTextEditor/textEditorBtns";
import { getIsActive, onFormatText } from "../SlateTextEditor/textEditorService";
import api from "../../services/readerDocumentsApiService";
import { createReaderDocumentSaver, type ReaderDocumentSaveStatus } from "../../services/readerDocumentSaver";

function Toolbar() {
  const editor = useSlate();
  const { t } = useTranslation();
  return (
    <div className="reader-document-toolbar" role="toolbar" aria-label={t("reader.documents.formatting")}>
      {btns.map(button => (
        <button key={button.format} type="button" className="reader-icon-button"
          aria-label={t("reader.documents.format." + button.format)} title={t("reader.documents.format." + button.format)}
          aria-pressed={getIsActive(editor, button)}
          // Keep the editor selection; formatting applies to it.
          onMouseDown={event => { event.preventDefault(); onFormatText({ editor, button }); }}>
          {button.icon}
        </button>
      ))}
    </div>
  );
}

export function ReaderDocumentEditor({ bookId, document: doc, onBack, onRename, onSaved }: {
  bookId: string;
  document: ReaderDocument;
  onBack: () => void;
  onRename: (title: string) => Promise<boolean>;
  onSaved: (preview: string, updatedAt: string) => void;
}) {
  const { t } = useTranslation();
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const [status, setStatus] = useState<ReaderDocumentSaveStatus>("idle");
  const [title, setTitle] = useState(doc.title);
  const [renaming, setRenaming] = useState(false);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const saver = useMemo(() => createReaderDocumentSaver<SlateCustomElement[]>({
    save: content => api.saveContent(bookId, doc.id, content)
      .then(saved => onSavedRef.current(saved.preview, saved.updatedAt)),
    onStatus: setStatus,
  }), [bookId, doc.id]);

  useEffect(() => {
    const flush = () => { if (saver.dirty) void saver.flush(); };
    const onHidden = () => { if (window.document.visibilityState === "hidden") flush(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!saver.dirty) return;
      void saver.flush();
      event.preventDefault();
      event.returnValue = "";
    };
    window.document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", beforeUnload);
      // Closing the panel or switching documents must not drop the last edit.
      flush();
    };
  }, [saver]);

  // Slate sets dir="rtl" per block for Hebrew text on its own.
  const renderElement = useCallback((props: RenderElementProps) => <TextEditorElement {...props} />, []);
  const renderLeaf = useCallback((props: RenderLeafProps) => <Leaf {...props} />, []);

  function onKeyDown(event: KeyboardEvent) {
    const button = btns.find(({ keyboardSequence: k }) => event.code === k.key && event.ctrlKey === !!k.ctrlKey &&
      event.shiftKey === !!k.shiftKey && event.altKey === !!k.altKey);
    if (!button) return;
    event.preventDefault();
    onFormatText({ editor, button });
  }

  async function commitTitle() {
    const next = title.replace(/\s+/g, " ").trim();
    if (!next || next === doc.title) return setTitle(doc.title);
    setRenaming(true);
    if (!(await onRename(next))) setTitle(doc.title);
    setRenaming(false);
  }

  const statusText = status === "saving" ? t("reader.documents.saving")
    : status === "pending" ? t("reader.documents.unsaved")
      : status === "error" ? t("reader.documents.saveError")
        : status === "saved" ? t("reader.documents.saved") : "";

  return (
    <div className="reader-document-editor">
      <header className="reader-document-editor-header">
        <button type="button" className="reader-icon-button" aria-label={t("reader.documents.back")} title={t("reader.documents.back")}
          onClick={() => { void saver.flush(); onBack(); }}>
          <FiArrowLeft aria-hidden="true" />
        </button>
        <input className="reader-document-title" dir="auto" value={title} maxLength={200} disabled={renaming}
          aria-label={t("reader.documents.titleLabel")}
          onChange={event => setTitle(event.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={event => {
            if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setTitle(doc.title); }
          }} />
      </header>
      <Slate editor={editor} initialValue={doc.content as Descendant[]}
        onChange={value => {
          // Selection-only changes do not modify the document.
          if (editor.operations.some(operation => operation.type !== "set_selection"))
            saver.schedule(value as SlateCustomElement[]);
        }}>
        <Toolbar />
        <Editable className="reader-document-body" renderElement={renderElement} renderLeaf={renderLeaf}
          spellCheck autoFocus={doc.preview === ""}
          aria-label={t("reader.documents.bodyLabel", { title: doc.title })}
          placeholder={t("reader.documents.placeholder")} onKeyDown={onKeyDown} />
      </Slate>
      <footer className="reader-document-status">
        <span role="status" aria-live="polite" className={status === "error" ? "is-error" : undefined}>{statusText}</span>
        {status === "error" && <button type="button" className="reader-button" onClick={() => void saver.retry()}>{t("reader.retry")}</button>}
      </footer>
    </div>
  );
}
