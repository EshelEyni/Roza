import { Editor, Node, Transforms, Text } from "slate";
import { ReactEditor, useSlate } from "slate-react";
import { screenplayTypes, isScreenplay } from "./screenplay";
export function ScreenplayToolbar({
  characters = [],
  onCreateCharacter,
  tabCycles,
  onTabCycles,
}: {
  characters?: string[];
  tabCycles?: boolean;
  onTabCycles?: (value: boolean) => void;
  onCreateCharacter?: (name: string) => void;
}) {
  const editor = useSlate();
  const index = editor.selection?.anchor.path[0] ?? 0;
  const block = editor.children[index];
  const type =
    "type" in block && isScreenplay(String(block.type))
      ? String(block.type)
      : "action";
  const text = Node.string(block);
  return (
    <div className="sp-tools">
      <label>
        Element{" "}
        <select
          aria-label="Screenplay element"
          disabled={!("children" in block) || !block.children.every(Text.isText)}
          title="Existing lists retain their structure; choose a text paragraph to change its element."
          value={type}
          onChange={(e) => {
            Transforms.setNodes(editor, { type: e.target.value } as never, {
              at: [index],
            });
            ReactEditor.focus(editor);
          }}
        >
          {screenplayTypes.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      {type === "character" && (
        <label>
          Character{" "}
          <select
            aria-label="Character library"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              Transforms.select(editor, Editor.range(editor, [index]));
              Transforms.insertText(editor, e.target.value.toUpperCase());
              ReactEditor.focus(editor);
            }}
          >
            <option value="">Choose or type a new name</option>
            {characters
              .filter((name) => name.toUpperCase().includes(text.toUpperCase()))
              .map((name) => (
                <option key={name}>{name}</option>
              ))}
          </select>
        </label>
      )}
      {type === "character" &&
        onCreateCharacter &&
        text.trim() &&
        !characters.some(
          (name) => name.toUpperCase() === text.toUpperCase(),
        ) && (
          <button type="button" onClick={() => onCreateCharacter(text.trim())}>
            Add {text} to Character Library
          </button>
        )}
      <details>
        <summary>
          Scenes (
          {
            editor.children.filter(
              (n) => "type" in n && n.type === "scene_heading",
            ).length
          }
          )
        </summary>
        {editor.children.map((n, i) =>
          "type" in n && n.type === "scene_heading" ? (
            <button
              key={i}
              type="button"
              onClick={() => {
                Transforms.select(editor, Editor.start(editor, [i]));
                ReactEditor.focus(editor);
              }}
            >
              {Node.string(n) || "Untitled scene"}
            </button>
          ) : null,
        )}
      </details>
      <label>
        <input
          type="checkbox"
          checked={tabCycles || false}
          onChange={(e) => onTabCycles?.(e.target.checked)}
        />
        Tab cycles elements (Escape to release)
      </label>
    </div>
  );
}
