import { Editor, Node, Transforms, Text } from "slate";
import { ReactEditor, useSlate } from "slate-react";
import { screenplayTypes, isScreenplay } from "./screenplay";
export function ScreenplayToolbar({
  characters = [],
  onCreateCharacter,
}: {
  characters?: string[];
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
  const scenes = editor.children.flatMap((node, i) =>
    "type" in node && node.type === "scene_heading"
      ? [{ index: i, title: Node.string(node) || "Untitled scene" }]
      : [],
  );
  const currentScene = scenes.filter((scene) => scene.index <= index).at(-1);
  return (
    <div className="sp-tools">
      <label>
        Element{" "}
        <select
          aria-label="Screenplay element"
          disabled={
            !("children" in block) || !block.children.every(Text.isText)
          }
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
      <label>
        Scenes ({scenes.length}){" "}
        <select
          aria-label="Scene navigation"
          disabled={!scenes.length}
          value={currentScene?.index ?? ""}
          onChange={(event) => {
            const scene = scenes.find(
              (entry) => String(entry.index) === event.target.value,
            );
            if (!scene) return;
            Transforms.select(editor, Editor.start(editor, [scene.index]));
            ReactEditor.focus(editor);
          }}
        >
          <option value="" disabled>
            {scenes.length ? "Choose a scene" : "No scenes yet"}
          </option>
          {scenes.map((scene, i) => (
            <option key={scene.index} value={scene.index}>
              {i + 1}. {scene.title}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
