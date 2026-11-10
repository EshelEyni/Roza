import { Editor, Node, Transforms, Text } from "slate";
import { ReactEditor, useSlate } from "slate-react";
import { screenplayTypes, isScreenplay } from "./screenplay";
export function ScreenplayToolbar() {
  const editor = useSlate();
  const index = editor.selection?.anchor.path[0] ?? 0;
  const block = editor.children[index];
  const type =
    "type" in block && isScreenplay(String(block.type))
      ? String(block.type)
      : "action";
  const scenes = editor.children.flatMap((node, i) =>
    "type" in node && node.type === "scene_heading"
      ? [{ index: i, title: Node.string(node) || "Untitled scene" }]
      : [],
  );
  const currentScene = scenes.filter((scene) => scene.index <= index).at(-1);
  return (
    <div className="sp-tools">
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
            {t
              .replace("_", " ")
              .replace(/\b\w/g, (letter) => letter.toUpperCase())}
          </option>
        ))}
      </select>
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
    </div>
  );
}
