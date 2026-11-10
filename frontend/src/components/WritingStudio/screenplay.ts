import { Node } from "slate";
import { SlateCustomElement, ScreenplayType } from "../../../../shared/types/books";
export const screenplayTypes: ScreenplayType[] = ["scene_heading", "action", "character", "dialogue", "parenthetical", "transition"];
export const isScreenplay = (type: string): type is ScreenplayType => screenplayTypes.includes(type as ScreenplayType);
export const scenePattern = /^(INT\.\/EXT\.|INT\/EXT\.|INT\.|EXT\.|I\/E\.)\s/i;
export const nextElement = (type: string): ScreenplayType => ({scene_heading:"action",character:"dialogue",parenthetical:"dialogue",dialogue:"character",transition:"scene_heading"} as Record<string, ScreenplayType>)[type] || "action";
export function fountain(nodes: SlateCustomElement[]) {
  return nodes.map(node => {
    const text = Node.string(node);
    switch(node.type) {
      case "scene_heading": return "\n." + text.toUpperCase() + "\n";
      case "character": return "\n@" + text.toUpperCase();
      case "dialogue": return text;
      case "parenthetical": return "(" + text.replace(/^\(|\)$/g, "") + ")";
      case "transition": return "\n>" + text.toUpperCase() + "\n";
      default: return "\n!" + text + "\n";
    }
  }).join("\n") + "\n";
}
/** Planned AI editing must round-trip this exact block tree, then show a diff for approval.
 * Dialogue belongs to the preceding character until action/scene/transition; preserve speech voice.
 */
export function validateScreenplayEdit(before: SlateCustomElement[], after: SlateCustomElement[]) {
 return before.length === after.length && before.every((block, i) => block.type === after[i].type &&
   (!["scene_heading", "character"].includes(block.type) || Node.string(block) === Node.string(after[i])));
}
