import { Node } from "slate";
import {
  SlateCustomElement,
  ScreenplayType,
} from "../../../../shared/types/books";
export const screenplayTypes: ScreenplayType[] = [
  "scene_heading",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
];
export const isScreenplay = (type: string): type is ScreenplayType =>
  screenplayTypes.includes(type as ScreenplayType);

export function screenplayStart(
  nodes: SlateCustomElement[],
): SlateCustomElement[] {
  if (!nodes.length)
    return [{ type: "scene_heading", children: [{ text: "" }] }];
  if (
    nodes.length === 1 &&
    Node.string(nodes[0]) === "" &&
    nodes[0].children.every((child) => "text" in child)
  ) {
    return [
      {
        type: "scene_heading",
        children: nodes[0]
          .children as import("../../../../shared/types/books").SlateCustomText[],
      },
    ];
  }
  return nodes;
}

/** Change block metadata only, preserving text leaves and annotation paths. */
export function proseBlocks(nodes: SlateCustomElement[]): SlateCustomElement[] {
  return nodes.map((node) => {
    if (
      node.type === "scene_heading" ||
      node.type === "action" ||
      node.type === "character" ||
      node.type === "dialogue" ||
      node.type === "parenthetical" ||
      node.type === "transition"
    ) {
      const paragraph = { ...node, type: "paragraph" as const };
      delete paragraph.align;
      return paragraph;
    }
    return node;
  });
}
export const scenePattern = /^(INT\.\/EXT\.|INT\/EXT\.|INT\.|EXT\.|I\/E\.)\s/i;
export const nextElement = (type: string): ScreenplayType =>
  (
    ({
      scene_heading: "action",
      character: "dialogue",
      parenthetical: "dialogue",
      dialogue: "character",
      transition: "scene_heading",
    }) as Record<string, ScreenplayType>
  )[type] || "action";
export function fountain(nodes: SlateCustomElement[]) {
  return (
    nodes
      .map((node) => {
        const text = Node.string(node);
        switch (node.type) {
          case "scene_heading":
            return "\n." + text.toUpperCase() + "\n";
          case "character":
            return "\n@" + text.toUpperCase();
          case "dialogue":
            return text;
          case "parenthetical":
            return "(" + text.replace(/^\(|\)$/g, "") + ")";
          case "transition":
            return "\n>" + text.toUpperCase() + "\n";
          default:
            return "\n!" + text + "\n";
        }
      })
      .join("\n") + "\n"
  );
}
/** Planned AI editing must round-trip this exact block tree, then show a diff for approval.
 * Dialogue belongs to the preceding character until action/scene/transition; preserve speech voice.
 */
export function validateScreenplayEdit(
  before: SlateCustomElement[],
  after: SlateCustomElement[],
) {
  return (
    before.length === after.length &&
    before.every(
      (block, i) =>
        block.type === after[i].type &&
        (!["scene_heading", "character"].includes(block.type) ||
          Node.string(block) === Node.string(after[i])),
    )
  );
}

import { Editor, Element, Transforms } from "slate";
/** Plain-text paste creates semantic blocks rather than indentation nodes. */
export function parseScreenplay(text: string): SlateCustomElement[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let previous: ScreenplayType = "action";
  return lines.flatMap((line, i) => {
    const value = line.trim();
    if (!value) {
      previous = "action";
      return [];
    }
    let type: ScreenplayType = "action";
    if (scenePattern.test(value)) type = "scene_heading";
    else if (/^(CUT TO:|FADE (IN:|OUT\.)|DISSOLVE TO:)/i.test(value))
      type = "transition";
    else if (
      /^[A-Z][A-Z0-9 .’'()-]+$/.test(value) &&
      value.length < 50 &&
      !!lines[i + 1]?.trim()
    )
      type = "character";
    else if (
      value.startsWith("(") &&
      ["character", "dialogue", "parenthetical"].includes(previous)
    )
      type = "parenthetical";
    else if (["character", "dialogue", "parenthetical"].includes(previous))
      type = "dialogue";
    previous = type;
    return [{ type, children: [{ text: value }] }];
  });
}
export function withScreenplay<T extends Editor>(
  editor: T,
  enabled = () => true,
): T {
  const insertBreak = editor.insertBreak;
  editor.insertBreak = () => {
    if (!enabled()) {
      insertBreak();
      return;
    }
    const index = editor.selection?.anchor.path[0];
    const block = index === undefined ? undefined : editor.children[index];
    if (
      block &&
      Element.isElement(block) &&
      block.children.some(Element.isElement)
    ) {
      insertBreak();
      return;
    }
    const type = block && Element.isElement(block) ? block.type : "action";
    insertBreak();
    Transforms.setNodes(
      editor,
      { type: nextElement(type) },
      { match: (n) => Element.isElement(n) && Editor.isBlock(editor, n) },
    );
  };
  const insertText = editor.insertText;
  editor.insertText = (text) => {
    if (!enabled()) {
      insertText(text);
      return;
    }
    const index = editor.selection?.anchor.path[0];
    const block = index === undefined ? undefined : editor.children[index];
    const type = block && Element.isElement(block) ? block.type : "action";
    insertText(
      ["scene_heading", "character", "transition"].includes(type)
        ? text.toUpperCase()
        : text,
    );
    if (
      index !== undefined &&
      ["action", "paragraph"].includes(type) &&
      scenePattern.test(Node.string(editor.children[index]))
    )
      Transforms.setNodes(editor, { type: "scene_heading" }, { at: [index] });
  };
  return editor;
}
