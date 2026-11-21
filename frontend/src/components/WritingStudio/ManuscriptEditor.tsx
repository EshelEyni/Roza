import { AiEdit, AiEditingContext } from "./AiEdit";
import { ManuscriptAudiobook } from "./ManuscriptAudiobook";
import { useManuscriptReadingMarks, type ManuscriptReadingPosition } from "./useManuscriptReadingMarks";
import { ScreenplayToolbar } from "./ScreenplayToolbar";
import {
  isScreenplay,
  screenplayTypes,
  withScreenplay,
  parseScreenplay,
  screenplayStart,
} from "./screenplay";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createEditor, Editor, Range, Text, Transforms, Node } from "slate";
import { ChapterAnnotation } from "../../../../shared/types/books";
import { AnnotationMargin } from "./AnnotationMargin";
import { annotationSentenceRange, manuscriptLines, transformAnnotations, validAnchor } from "./annotations";
import { ReadingGoToLine } from "./ReadingGoToLine";
import type { DraftComparisonMark } from "./draftComparison";
import { findManuscriptMatches, ManuscriptFind, type ManuscriptFindOptions } from "./ManuscriptFind";
import { isGoToLineShortcut } from "./goToLineInput";
import { Editable, ReactEditor, Slate, useSlate, withReact } from "slate-react";
import { HistoryEditor, withHistory } from "slate-history";
import { SlateCustomElement } from "../../../../shared/types/books";
import { TextEditorElement } from "../SlateTextEditor/TextEditorElement";
import { Leaf } from "../SlateTextEditor/Leaf";
import { btns } from "../SlateTextEditor/textEditorBtns";
import {
  getIsActive,
  onFormatText,
} from "../SlateTextEditor/textEditorService";

function Toolbar({
  onAddNote,
  screenplayControls,
  aiEditing,
}: {
  onAddNote?: () => void;
  screenplayControls?: ReactNode;
  aiEditing?: AiEditingContext;
}) {
  const editor = useSlate() as ReturnType<typeof useSlate> & HistoryEditor;
  return (
    <div className="ws-toolbar" role="toolbar" aria-label="Text formatting">
      {btns.slice(0, 8).map((button) => (
        <button
          key={button.format}
          type="button"
          aria-label={button.format.replace(/-/g, " ")}
          title={button.format.replace(/-/g, " ")}
          aria-pressed={getIsActive(editor, button)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onFormatText({ editor, button })}
        >
          {button.icon}
        </button>
      ))}
      <details className="ws-alignment">
        <summary
          onMouseDown={(event) => event.preventDefault()}
          title="Paragraph alignment"
        >
          Align
        </summary>
        <div>
          {btns.slice(8).map((button) => (
            <button
              key={button.format}
              type="button"
              aria-label={`Align ${button.format}`}
              title={`Align ${button.format}`}
              aria-pressed={getIsActive(editor, button)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onFormatText({ editor, button })}
            >
              {button.icon}
            </button>
          ))}
        </div>
      </details>
      <span className="ws-toolbar-divider" />
      <button
        type="button"
        aria-label="Undo"
        title="Undo (Ctrl/Cmd+Z)"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => HistoryEditor.undo(editor)}
      >
        ↶
      </button>
      <button
        type="button"
        aria-label="Redo"
        title="Redo (Ctrl/Cmd+Shift+Z)"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => HistoryEditor.redo(editor)}
      >
        ↷
      </button>
      <div className="ws-toolbar-end">
        {aiEditing && <AiEdit context={aiEditing} />}
        {screenplayControls}
        {onAddNote && (
          <button
            type="button"
            className="ws-add-selection-note"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onAddNote}
            title="Add note to selected text or current paragraph"
          >
            + Note
          </button>
        )}
      </div>
    </div>
  );
}
export function ManuscriptEditor({
  audiobook,
  audiobookKey,
  audiobookHeader,
  audiobookState,
  readingPosition,
  value,
  format = "prose",
  onChange,
  readOnly = false,
  reading = false,
  annotationsReadOnly = readOnly,
  label = "Manuscript",
  placeholder = "Begin here. The next sentence is yours.",
  annotations,
  showAnnotations = true,
  legacyNotes,
  onRevealAnnotations,
  aiEditing,
  primaryFindTarget = false,
  draftComparison,
}: {
  aiEditing?: AiEditingContext;
  audiobook?: { id: string; title: string; manuscriptId: string };
  audiobookKey?: string;
  audiobookHeader?: HTMLDivElement | null;
  audiobookState?: { open: boolean; onChange: (open: boolean) => void };
  readingPosition?: ManuscriptReadingPosition;
  value: SlateCustomElement[];
  format?: "prose" | "screenplay";
  onChange: (
    value: SlateCustomElement[],
    annotations?: ChapterAnnotation[],
  ) => void;
  annotations?: ChapterAnnotation[];
  showAnnotations?: boolean;
  legacyNotes?: ReactNode;
  onRevealAnnotations?: () => void;
  readOnly?: boolean;
  reading?: boolean;
  annotationsReadOnly?: boolean;
  label?: string;
  placeholder?: string;
  primaryFindTarget?: boolean;
  draftComparison?: ReadonlyMap<string, DraftComparisonMark[]>;
}) {
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findOptions, setFindOptions] = useState<ManuscriptFindOptions>({ matchCase: false, wholeWord: false });
  const [findIndex, setFindIndex] = useState(0);
  const [findFocus, setFindFocus] = useState(0);
  const [findDocumentVersion, setFindDocumentVersion] = useState(0);
  // Line count while Read Mode's Go to line dialog is open.
  const [goToLineTotal, setGoToLineTotal] = useState<number | null>(null);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const activeAnchor = annotations?.find(
    (note) => note.id === activeNote,
  )?.anchor;
  const notes = useRef(annotations || []);
  const receivedNotes = useRef(annotations);
  if (receivedNotes.current !== annotations) {
    notes.current = annotations || [];
    receivedNotes.current = annotations;
  }
  const screenplayMode = useRef(format === "screenplay");
  screenplayMode.current = format === "screenplay";
  const editor = useMemo(() => {
    const instance = withHistory(withReact(createEditor()));
    withScreenplay(instance, () => screenplayMode.current);
    const insertData = instance.insertData;
    instance.insertData = (data) => {
      const text = data.getData("text/plain");
      if (
        screenplayMode.current &&
        !data.getData("application/x-slate-fragment") &&
        /[\r\n]/.test(text)
      ) {
        const blocks = parseScreenplay(text);
        if (blocks.length)
          Transforms.insertNodes(instance, blocks, { select: true });
      } else insertData(data);
    };
    const apply = instance.apply;
    instance.apply = (operation) => {
      notes.current = transformAnnotations(notes.current, operation);
      apply(operation);
    };
    return instance;
  }, []);
  const readingMarks = useManuscriptReadingMarks(reading, editor, readingPosition);
  const findRoot = readingMarks.root;
  const matches = useMemo(
    () => findManuscriptMatches(editor, findOpen ? findQuery : "", findOptions),
    [editor, findOpen, findQuery, findDocumentVersion, findOptions],
  );
  const currentMatch = Math.min(findIndex, matches.count - 1);
  useEffect(() => {
    const openFind = (event: KeyboardEvent) => {
      if (event.isComposing || event.code !== "KeyF" || !event.ctrlKey || !event.altKey ||
          event.shiftKey || event.metaKey || event.getModifierState("AltGraph")) return;
      const root = findRoot.current;
      const target = event.target;
      if (!root || !(target instanceof Element) || target.closest("dialog[open]")) return;
      const focusedEditor = target.closest("[data-slate-editor], [data-ws-find]");
      const isTarget = focusedEditor ? root.contains(focusedEditor) : primaryFindTarget;
      if (!isTarget) {
        setFindOpen(false);
        return;
      }
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (event.repeat) return;
      setFindOpen(true);
      setFindFocus(request => request + 1);
    };
    window.addEventListener("keydown", openFind);
    return () => window.removeEventListener("keydown", openFind);
  }, [findRoot, primaryFindTarget]);
  useEffect(() => {
    if (currentMatch < 0) return;
    findRoot.current?.querySelector(`[data-ws-find-match="${currentMatch}"]`)
      ?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [currentMatch, matches, findFocus, findRoot]);
  const activeSentence = annotationSentenceRange(editor, activeAnchor ?? null);
  const persistNotes = (next: ChapterAnnotation[]) => {
    notes.current = next;
    onChange(editor.children as SlateCustomElement[], next);
  };
  const canAddNote = annotations !== undefined && !annotationsReadOnly;
  useEffect(() => {
    if (!reading) {
      setGoToLineTotal(null);
      return;
    }
    const open = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || !isGoToLineShortcut(event)) return;
      event.preventDefault();
      if (!event.repeat) setGoToLineTotal(manuscriptLines(editor).length);
    };
    window.addEventListener("keydown", open);
    return () => window.removeEventListener("keydown", open);
  }, [editor, reading]);
  const goToLine = (number: number) => {
    setGoToLineTotal(null);
    const line = manuscriptLines(editor)[number - 1];
    if (!line) return;
    // Wait for the dialog to close and hand focus back before moving the reading position.
    requestAnimationFrame(() => {
      try {
        readingMarks.revealLine(ReactEditor.toDOMNode(editor, line[0]));
      } catch {
        /* The text changed while the dialog was open. */
      }
    });
  };
  const selectedReadingSentence = (editable: HTMLElement) => {
    const selection = editable.ownerDocument.getSelection();
    const nativeRange = selection?.rangeCount && !selection.isCollapsed
      ? selection.getRangeAt(0)
      : readingMarks.markedSentence.current;
    if (!nativeRange || !editable.contains(nativeRange.commonAncestorContainer)) return;
    const anchor = ReactEditor.toSlateRange(editor, nativeRange, {
      exactMatch: false,
      suppressThrow: true,
    });
    return annotationSentenceRange(editor, anchor);
  };
  const resumeReadingAtNote = (note: ChapterAnnotation) => {
    const sentence = annotationSentenceRange(editor, note.anchor);
    if (!sentence) return;
    // Closing the card removes its Slate decoration and changes the DOM text leaves.
    requestAnimationFrame(() => {
      const editable = readingMarks.root.current?.querySelector<HTMLElement>("[data-slate-editor]");
      if (!editable || !validAnchor(editor, sentence)) return;
      editable.focus({ preventScroll: true });
      editable.ownerDocument.getSelection()?.removeAllRanges();
      readingMarks.markRange(ReactEditor.toDOMRange(editor, sentence));
    });
  };
  const addSelectionNote = (readingAnchor?: Range) => {
    if (!canAddNote) return;
    if (readingAnchor) {
      readingMarks.clear();
      readingMarks.root.current?.ownerDocument.getSelection()?.removeAllRanges();
    }
    const selection = editor.selection;
    const anchor = readingAnchor ?? (
      selection && Range.isExpanded(selection)
        ? selection
        : Editor.range(
            editor,
            selection ? selection.anchor.path.slice(0, -1) : [0],
          ));
    const note: ChapterAnnotation = {
      id: crypto.randomUUID(),
      content: "",
      anchor,
      quote: Editor.string(editor, anchor).slice(0, 500),
    };
    persistNotes([...notes.current, note]);
    setActiveNote(note.id);
    onRevealAnnotations?.();
  };
  return (
    <Slate
      editor={editor}
      initialValue={
        format === "screenplay"
          ? structuredClone(screenplayStart(value))
          : value.length
            ? structuredClone(value)
            : [{ type: "paragraph", children: [{ text: "" }] }]
      }
      onChange={(next) => {
        if (
          editor.operations.some(
            (operation) => operation.type !== "set_selection",
          )
        ) {
          if (findOpen) setFindDocumentVersion(version => version + 1);
          onChange(
            next as SlateCustomElement[],
            annotations === undefined
              ? undefined
              : notes.current.map((note) => ({
                  ...note,
                  anchor: validAnchor(editor, note.anchor) ? note.anchor : null,
                })),
          );
        }
      }}
    >
      {!readOnly && (
        <Toolbar
          aiEditing={aiEditing}
          screenplayControls={
            format === "screenplay" ? <ScreenplayToolbar /> : undefined
          }
          onAddNote={canAddNote && (showAnnotations || onRevealAnnotations) ? () => addSelectionNote() : undefined}
        />
      )}
      {reading && audiobook && audiobookHeader && audiobookState && (
        <ManuscriptAudiobook key={audiobookKey} chapter={audiobook} header={audiobookHeader} root={readingMarks.root} markedSentence={readingMarks.markedSentence}
          open={audiobookState.open} onOpenChange={audiobookState.onChange} onPositionChange={readingMarks.saveRangePosition} />
      )}
      {reading && canAddNote && (
        <button
          type="button"
          className="ws-add-selection-note"
          aria-keyshortcuts="Control+Alt+N"
          title="Add a note to the selected sentence (Ctrl+Alt+N)"
          onMouseDown={event => event.preventDefault()}
          onClick={() => {
            const editable = readingMarks.root.current?.querySelector<HTMLElement>("[data-slate-editor]");
            addSelectionNote(editable ? selectedReadingSentence(editable) : undefined);
          }}
        >
          + Note
        </button>
      )}
      <div
        ref={findRoot}
        className={
          [annotations !== undefined && "ws-annotated-editor", reading && "ws-reading-editor"].filter(Boolean).join(" ")
        }
      >
        <Editable
          autoFocus={
            !readOnly &&
            format === "screenplay" &&
            value.every((node) => Node.string(node) === "")
          }
          className={`ws-prose ${reading ? "ws-prose-reading" : ""} ${format === "screenplay" ? "sp-page" : ""}`}
          tabIndex={reading ? 0 : undefined}
          onClick={readingMarks.onClick}
          onKeyDownCapture={event => {
            if (reading && canAddNote && !event.repeat && !event.nativeEvent.isComposing &&
                event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey &&
                !event.getModifierState("AltGraph") && event.code === "KeyN") {
              const sentence = selectedReadingSentence(event.currentTarget);
              if (sentence) {
                event.preventDefault();
                addSelectionNote(sentence);
                return;
              }
            }
            readingMarks.onKeyDown?.(event);
          }}
          onKeyDown={(event) => {
            if (readOnly || event.nativeEvent.isComposing) return;
            if (event.ctrlKey || event.metaKey) {
              const button = btns
                .slice(0, 3)
                .find((button) => button.keyboardSequence.key === event.code);
              if (button && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                onFormatText({ editor, button });
                return;
              }
            }
            if (format !== "screenplay") return;
            if (event.key === "Enter" && event.shiftKey) {
              event.preventDefault();
              Transforms.insertText(editor, "\n");
              return;
            }
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              const index = editor.selection?.anchor.path[0] ?? 0;
              const block = editor.children[index];
              if (!("children" in block) || !block.children.every(Text.isText))
                return;
              event.preventDefault();
              const type = "type" in block ? String(block.type) : "action";
              Transforms.setNodes(
                editor,
                {
                  type: screenplayTypes[
                    (screenplayTypes.indexOf(
                      isScreenplay(type) ? type : "action",
                    ) +
                      1) %
                      screenplayTypes.length
                  ],
                } as never,
                { at: [index] },
              );
            }
          }}
          // Override Slate's measured placeholder height with the writing-area height.
          style={{ minHeight: "var(--ws-editor-min-height, 42vh)" }}
          aria-label={label}
          dir="auto"
          readOnly={readOnly}
          spellCheck
          placeholder={
            draftComparison ? undefined : format === "screenplay" ? "INT. LOCATION - DAY" : placeholder
          }
          renderElement={(props) => <TextEditorElement {...props} />}
          decorate={([node, path]) => {
            if (!Text.isText(node)) return [];
            const key = path.join(".");
            const found = matches.highlights.get(key) ?? [];
            const intersection = activeSentence && Range.intersection(
              Editor.range(editor, path),
              activeSentence,
            );
            const decorations = intersection ? [...found, { ...intersection, annotationActive: true }] : found;
            const comparison = draftComparison?.get(key);
            return comparison ? [...decorations, ...comparison] : decorations;
          }}
          renderLeaf={props => {
            const { annotationActive, findMatch, draftAddition, draftDeletion, draftAddedBreak } = props.leaf as Text & DraftComparisonMark & {
              annotationActive?: boolean;
              findMatch?: number;
            };
            let children = annotationActive
              ? <mark className="ws-annotation-highlight">{props.children}</mark>
              : props.children;
            if (draftAddition) children = <ins className="ws-draft-insertion">{children}</ins>;
            if (findMatch !== undefined) {
              children = (
                <mark className="ws-manuscript-match" data-ws-find-match={findMatch}
                  data-current={findMatch === currentMatch}>
                  {children}
                </mark>
              );
            }
            return (
              <Leaf {...props}>
                {draftDeletion && <del className="ws-draft-deletion" contentEditable={false}>{draftDeletion}</del>}
                {draftAddedBreak && <ins className="ws-draft-break" contentEditable={false} aria-label="Added paragraph break">{"\u21b5"}</ins>}
                {children}
              </Leaf>
            );
          }}
        />
        {reading && <div className="ws-reading-highlights" aria-hidden="true" />}
        {annotations !== undefined && (
          <AnnotationMargin
            notes={annotations}
            active={activeNote}
            onActive={setActiveNote}
            onConfirm={reading ? resumeReadingAtNote : undefined}
            onReveal={onRevealAnnotations}
            visible={showAnnotations}
            readOnly={annotationsReadOnly}
            onChange={persistNotes}
            legacyNotes={legacyNotes}
          />
        )}
        {findOpen && (
          <ManuscriptFind
            query={findQuery}
            count={matches.count}
            current={currentMatch}
            focusRequest={findFocus}
            options={findOptions}
            onOptions={options => {
              setFindOptions(options);
              setFindIndex(0);
            }}
            onQuery={query => {
              setFindQuery(query);
              setFindIndex(0);
            }}
            onStep={direction => {
              if (matches.count) {
                setFindIndex((currentMatch + direction + matches.count) % matches.count);
              }
            }}
            onClose={() => {
              setFindOpen(false);
              findRoot.current?.querySelector<HTMLElement>("[data-slate-editor]")
                ?.focus({ preventScroll: true });
            }}
          />
        )}
      </div>
      {reading && goToLineTotal !== null && (
        <ReadingGoToLine
          total={goToLineTotal}
          onGo={goToLine}
          onCancel={() => setGoToLineTotal(null)}
        />
      )}
    </Slate>
  );
}
