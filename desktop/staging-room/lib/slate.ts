import type { SlateElement, SlateText } from "../../../shared/types/stagingRoom";

const isText = (n: SlateText | SlateElement): n is SlateText =>
  typeof (n as SlateText).text === "string" && !(n as SlateElement).children;

export function elementText(el: SlateElement | SlateText): string {
  if (isText(el)) return el.text;
  return (el.children || []).map(elementText).join("");
}

export function plainParagraphs(nodes: SlateElement[] | undefined): string[] {
  return (nodes || []).map(elementText);
}

export function countWords(nodes: SlateElement[] | undefined): number {
  return plainParagraphs(nodes).join(" ").split(/\s+/).filter(Boolean).length;
}

/** Normalised text used to decide whether a local and a prod chapter differ. */
export function fingerprint(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";
  return plainParagraphs(nodes as SlateElement[])
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Plain text with newlines -> one paragraph per non-empty line. */
export function toSlate(text: string): SlateElement[] {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return (lines.length ? lines : [""]).map((line) => ({ type: "paragraph", children: [{ text: line }] }));
}

const ALLOWED_TYPES = new Set([
  "paragraph",
  "heading-one",
  "heading-two",
  "block-quote",
  "bulleted-list",
  "numbered-list",
  "list-item",
  "scene_heading",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
]);

/** Returns a list of problems; empty when the nodes match Roza's Slate shape. */
export function checkSlate(nodes: unknown, where: string): string[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return [`${where}: must be a non-empty list of paragraphs`];
  const errors: string[] = [];
  nodes.forEach((n, i) => {
    const el = n as SlateElement;
    if (!el || typeof el !== "object" || !ALLOWED_TYPES.has(el.type))
      errors.push(`${where} #${i + 1}: unknown block type "${(el && el.type) || "?"}"`);
    else if (!Array.isArray(el.children) || el.children.length === 0)
      errors.push(`${where} #${i + 1}: has no children`);
  });
  return errors.slice(0, 5);
}
