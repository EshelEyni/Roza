import {
  BlockButton,
  MarkButton,
  MarkFormat,
  SlateEditor,
  TextEditorButton,
} from "../../types/app";
import { Editor, Transforms, Element as SlateElement } from "slate";

type TextAlignType = "left" | "center" | "right" | "justify";

const TEXT_ALIGN_TYPES = ["left", "center", "right", "justify"];
const LIST_TYPES = ["numbered-list", "bulleted-list"];

function getIsActive(editor: SlateEditor, btn: TextEditorButton) {
  if (isMarkButton(btn)) return isMarkActive(editor, btn.format);
  else if (isBlockButton(btn))
    return isBlockActive(
      editor,
      btn.format,
      TEXT_ALIGN_TYPES.includes(btn.format) ? "align" : "type",
    );

  return false;
}

function isMarkActive(editor: SlateEditor, format: MarkFormat) {
  const marks = Editor.marks(editor);
  return marks ? marks[format] === true : false;
}

function toggleMark(editor: SlateEditor, format: MarkFormat) {
  const isActive = isMarkActive(editor, format);

  if (isActive) Editor.removeMark(editor, format);
  else Editor.addMark(editor, format, true);
}

function toggleBlock(editor: SlateEditor, format: string) {
  const isActive = isBlockActive(
    editor,
    format,
    TEXT_ALIGN_TYPES.includes(format) ? "align" : "type",
  );
  const isList = LIST_TYPES.includes(format);

  Transforms.unwrapNodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      LIST_TYPES.includes(n.type) &&
      !TEXT_ALIGN_TYPES.includes(format),
    split: true,
  });

  let newProperties: Partial<SlateElement>;

  if (TEXT_ALIGN_TYPES.includes(format)) {
    newProperties = { align: isActive ? undefined : (format as TextAlignType) };
  } else {
    newProperties = {
      type: isActive ? "paragraph" : isList ? "list-item" : format,
    };
  }

  Transforms.setNodes<SlateElement>(editor, newProperties);

  if (isActive || !isList) return;
  const block = { type: format, children: [] };
  Transforms.wrapNodes(editor, block);
}

function isBlockActive(
  editor: SlateEditor,
  format: string,
  blockType: "align" | "type" = "type",
) {
  const { selection } = editor;
  if (!selection) return false;

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: n =>
        !Editor.isEditor(n) &&
        SlateElement.isElement(n) &&
        n[blockType] === format,
    }),
  );

  return !!match;
}

function isMarkButton(button: TextEditorButton): button is MarkButton {
  return button.type === "mark";
}

function isBlockButton(button: TextEditorButton): button is BlockButton {
  return button.type === "block";
}

function onFormatText({
  editor,
  button,
}: {
  editor: SlateEditor;
  button: TextEditorButton;
}) {
  if (isMarkButton(button)) toggleMark(editor, button.format);
  else if (isBlockButton(button)) toggleBlock(editor, button.format);
}

export { getIsActive, onFormatText };
