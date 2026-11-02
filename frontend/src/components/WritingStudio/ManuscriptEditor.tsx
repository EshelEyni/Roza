import { useMemo } from "react";
import { createEditor } from "slate";
import { Editable, Slate, useSlate, withReact } from "slate-react";
import { HistoryEditor, withHistory } from "slate-history";
import { SlateCustomElement } from "../../../../shared/types/books";
import { TextEditorElement } from "../SlateTextEditor/TextEditorElement";
import { Leaf } from "../SlateTextEditor/Leaf";
import { btns } from "../SlateTextEditor/textEditorBtns";
import {
  getIsActive,
  onFormatText,
} from "../SlateTextEditor/textEditorService";

function Toolbar() {
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
    </div>
  );
}
export function ManuscriptEditor({
  value,
  onChange,
  readOnly = false,
  label = "Manuscript",
}: {
  value: SlateCustomElement[];
  onChange: (value: SlateCustomElement[]) => void;
  readOnly?: boolean;
  label?: string;
}) {
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
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
          onChange(next as SlateCustomElement[]);
      }}
    >
      {!readOnly && <Toolbar />}
      <Editable
        className="ws-prose"
        aria-label={label}
        dir="auto"
        readOnly={readOnly}
        spellCheck
        placeholder="Begin here. The next sentence is yours."
        renderElement={props => <TextEditorElement {...props} />}
        renderLeaf={props => <Leaf {...props} />}
        onKeyDown={event => {
          if (!(event.ctrlKey || event.metaKey)) return;
          const button = btns
            .slice(0, 3)
            .find(button => button.keyboardSequence.key === event.code);
          if (button && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            onFormatText({ editor, button });
          }
        }}
      />
    </Slate>
  );
}
