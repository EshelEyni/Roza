/**
 * Backend port of the format switch in frontend/src/components/WritingStudio/screenplay.ts
 * (screenplayStart and proseBlocks). Writing Studio runs these when the author changes a
 * chapter's format. Keep the two in sync.
 */
import type { SlateElement, SlateText } from "../../../../shared/types/stagingRoom";
import { elementText } from "./slate";

const SCREENPLAY_TYPES = new Set(["scene_heading", "action", "character", "dialogue", "parenthetical", "transition"]);

/** Prose to screenplay: an empty chapter starts with a scene heading. Other text stays as it is. */
export function screenplayStart(nodes: SlateElement[]): SlateElement[] {
  if (!nodes.length) return [{ type: "scene_heading", children: [{ text: "" }] }];
  if (nodes.length === 1 && elementText(nodes[0]) === "" && nodes[0].children.every((child) => "text" in child))
    return [{ type: "scene_heading", children: nodes[0].children as SlateText[] }];
  return nodes;
}

/** Screenplay to prose: screenplay blocks become paragraphs. Text leaves stay, so note paths still work. */
export function proseBlocks(nodes: SlateElement[]): SlateElement[] {
  return nodes.map((node) => {
    if (!SCREENPLAY_TYPES.has(node.type)) return node;
    const paragraph = { ...node, type: "paragraph" };
    delete paragraph.align;
    return paragraph;
  });
}
