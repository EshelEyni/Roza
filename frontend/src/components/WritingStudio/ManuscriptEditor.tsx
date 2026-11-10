import { ScreenplayToolbar } from "./ScreenplayToolbar";
import { isScreenplay, nextElement, scenePattern, screenplayTypes } from "./screenplay";
import { ReactNode, useMemo, useRef, useState } from "react";
import { createEditor, Editor, Range, Text, Transforms, Node } from "slate";
import { ChapterAnnotation } from "../../../../shared/types/books";
import { AnnotationMargin } from "./AnnotationMargin";
import { transformAnnotations, validAnchor } from "./annotations";
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

function Toolbar({ onAddNote }: { onAddNote?: () => void }) {
  const editor = useSlate() as ReturnType<typeof useSlate> & HistoryEditor;
  return (
    <div className="ws-toolbar" role="toolbar" aria-label="Text formatting">
      {btns.slice(0, 8).map(button => (
        <button
          key={button.format}
          type="button"
          aria-label={button.format.replace(/-/g, " ")}
          title={button.format.replace(/-/g, " ")}
          aria-pressed={getIsActive(editor, button)}
          onMouseDown={event => event.preventDefault()}
          onClick={() => onFormatText({ editor, button })}
        >
          {button.icon}
        </button>
      ))}
      <details className="ws-alignment">
        <summary
          onMouseDown={event => event.preventDefault()}
          title="Paragraph alignment"
        >
          Align
        </summary>
        <div>
          {btns.slice(8).map(button => (
            <button
              key={button.format}
              type="button"
              aria-label={`Align ${button.format}`}
              title={`Align ${button.format}`}
              aria-pressed={getIsActive(editor, button)}
              onMouseDown={event => event.preventDefault()}
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
        onMouseDown={event => event.preventDefault()}
        onClick={() => HistoryEditor.undo(editor)}
      >
        ↶
      </button>
      <button
        type="button"
        aria-label="Redo"
        title="Redo (Ctrl/Cmd+Shift+Z)"
        onMouseDown={event => event.preventDefault()}
        onClick={() => HistoryEditor.redo(editor)}
      >
        ↷
      </button>
      {onAddNote && (
        <button
          type="button"
          className="ws-add-selection-note"
          onMouseDown={event => event.preventDefault()}
          onClick={onAddNote}
          title="Add note to selected text or current paragraph"
        >
          + Note
        </button>
      )}
    </div>
  );
}
export function ManuscriptEditor({
  value,
  format = "prose",
  characters,
  onChange,
  readOnly = false,
  label = "Manuscript",
  placeholder = "Begin here. The next sentence is yours.",
  annotations,
  showAnnotations = true,
  legacyNotes,
  onRevealAnnotations,
}: {
  value: SlateCustomElement[];
  format?: "prose" | "screenplay";
  characters?: string[];
  onChange: (
    value: SlateCustomElement[],
    annotations?: ChapterAnnotation[],
  ) => void;
  annotations?: ChapterAnnotation[];
  showAnnotations?: boolean;
  legacyNotes?: ReactNode;
  onRevealAnnotations?: () => void;
  readOnly?: boolean;
  label?: string;
  placeholder?: string;
}) {
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const activeAnchor = annotations?.find(
    note => note.id === activeNote,
  )?.anchor;
  const notes = useRef(annotations || []);
  const receivedNotes = useRef(annotations);
  if (receivedNotes.current !== annotations) {
    notes.current = annotations || [];
    receivedNotes.current = annotations;
  }
  const editor = useMemo(() => {
    const instance = withHistory(withReact(createEditor()));
    if (format === "screenplay") {
      const insertBreak = instance.insertBreak;
      instance.insertBreak = () => {
        const index = instance.selection?.anchor.path[0];
        const current = index === undefined ? undefined : instance.children[index];
        const type = current && "type" in current && isScreenplay(String(current.type)) ? String(current.type) : "action";
        insertBreak();
        Transforms.setNodes(instance, {type:nextElement(type)} as never, {match:n=>Editor.isBlock(instance,n as never)});
      };
      const insertText = instance.insertText;
      instance.insertText = text => {
        const index = instance.selection?.anchor.path[0];
        const current = index === undefined ? undefined : instance.children[index];
        const type = current && "type" in current ? String(current.type) : "action";
        insertText(["scene_heading","character","transition"].includes(type) ? text.toUpperCase() : text);
        if (type === "action" && current && scenePattern.test(Node.string(instance.children[index!]))) Transforms.setNodes(instance, {type:"scene_heading"} as never);
      };
    }
    const apply = instance.apply;
    instance.apply = operation => {
      notes.current = transformAnnotations(notes.current, operation);
      apply(operation);
    };
    return instance;
  }, []);
  const persistNotes = (next: ChapterAnnotation[]) => {
    notes.current = next;
    onChange(editor.children as SlateCustomElement[], next);
  };
  const addSelectionNote = () => {
    const selection = editor.selection;
    const anchor =
      selection && Range.isExpanded(selection)
        ? selection
        : Editor.range(
            editor,
            selection ? selection.anchor.path.slice(0, -1) : [0],
          );
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
        value.length
          ? structuredClone(value)
          : [{ type: "paragraph", children: [{ text: "" }] }]
      }
      onChange={next => {
        if (
          editor.operations.some(
            operation => operation.type !== "set_selection",
          )
        )
          onChange(
            next as SlateCustomElement[],
            annotations === undefined
              ? undefined
              : notes.current.map(note => ({
                  ...note,
                  anchor: validAnchor(editor, note.anchor) ? note.anchor : null,
                })),
          );
      }}
    >
      {!readOnly && format === "screenplay" && <ScreenplayToolbar characters={characters} />}
      {!readOnly && (
        <Toolbar
          onAddNote={annotations !== undefined ? addSelectionNote : undefined}
        />
      )}
      <div
        className={
          annotations !== undefined ? "ws-annotated-editor" : undefined
        }
      >
        <Editable
          className={`ws-prose ${format === "screenplay" ? "sp-page" : ""}`}
          onKeyDown={event => {
            if (readOnly || event.nativeEvent.isComposing) return;
            if (event.ctrlKey || event.metaKey) {
              const button = btns.slice(0,3).find(button => button.keyboardSequence.key === event.code);
              if (button && !event.shiftKey && !event.altKey) {event.preventDefault();onFormatText({editor,button});return;}
            }
            if (format !== "screenplay") return;
            if (event.key === "Enter" && event.shiftKey) {event.preventDefault();Transforms.insertText(editor,"\n");return;}
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              const index = editor.selection?.anchor.path[0] ?? 0;
              const block = editor.children[index];
              const type = "type" in block ? String(block.type) : "action";
              Transforms.setNodes(editor, {type: screenplayTypes[(screenplayTypes.indexOf(isScreenplay(type) ? type : "action") + 1) % screenplayTypes.length]} as never, {at:[index]});
            }
          }}
          // Override Slate's measured placeholder height with the writing-area height.
          style={{ minHeight: "var(--ws-editor-min-height, 42vh)" }}
          aria-label={label}
          dir="auto"
          readOnly={readOnly}
          spellCheck
          placeholder={placeholder}
          onMouseMove={event => {
            const element = (event.target as HTMLElement).closest(
              '[data-slate-node="element"]',
            );
            if (!element || annotations === undefined) return;
            try {
              setHoveredPath(
                ReactEditor.findPath(
                  editor,
                  ReactEditor.toSlateNode(editor, element),
                ).join("."),
              );
            } catch {
              /* pending DOM commit */
            }
          }}
          onMouseLeave={() => setHoveredPath(null)}
          renderElement={props => <TextEditorElement {...props} />}
          decorate={([node, path]) => {
            if (
              !Text.isText(node) ||
              !activeAnchor ||
              !validAnchor(editor, activeAnchor)
            )
              return [];
            const intersection = Range.intersection(
              Editor.range(editor, path),
              activeAnchor,
            );
            return intersection
              ? [{ ...intersection, annotationActive: true }]
              : [];
          }}
          renderLeaf={props => (
            <Leaf {...props}>
              {(props.leaf as { annotationActive?: boolean })
                .annotationActive ? (
                <mark className="ws-annotation-highlight">
                  {props.children}
                </mark>
              ) : (
                props.children
              )}
            </Leaf>
          )}

        />
        {annotations !== undefined && (
          <AnnotationMargin
            notes={annotations}
            active={activeNote}
            hoveredPath={hoveredPath}
            onActive={setActiveNote}
            onReveal={onRevealAnnotations}
            visible={showAnnotations}
            readOnly={readOnly}
            onChange={persistNotes}
            legacyNotes={legacyNotes}
          />
        )}
      </div>
    </Slate>
  );
}
