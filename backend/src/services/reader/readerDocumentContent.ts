// Runtime validation stays in the CommonJS backend; shared types are ESM and
// may only be imported with `import type` here.
import type { SlateCustomElement, SlateCustomText } from "../../../../shared/types/books";

export const MAX_DOCUMENT_TITLE = 200;
export const MAX_DOCUMENT_TEXT = 500_000;
export const MAX_DOCUMENT_NODES = 20_000;
export const MAX_DOCUMENTS_PER_BOOK = 200;
const PREVIEW_LENGTH = 200;

const textBlocks = ["paragraph", "heading-one", "heading-two", "block-quote", "list-item"] as const;
const listBlocks = ["bulleted-list", "numbered-list"] as const;
const aligns = ["left", "center", "right", "justify"] as const;

export const emptyDocumentContent = (): SlateCustomElement[] => [
  { type: "paragraph", children: [{ text: "" }] },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Rebuilds rich text from an allow-list of block types and marks. Returns null
 * for anything malformed, so unknown keys and nested markup are never stored.
 * Text is kept verbatim: Slate renders it as text, never as HTML.
 */
export function normalizeDocumentContent(value: unknown): SlateCustomElement[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  let nodes = 0;
  let characters = 0;
  const leaf = (input: unknown): SlateCustomText | null => {
    if (!isRecord(input) || typeof input.text !== "string") return null;
    nodes++;
    characters += input.text.length;
    const result: SlateCustomText = { text: input.text };
    for (const mark of ["bold", "italic", "underline"] as const) {
      if (input[mark] === undefined) continue;
      if (typeof input[mark] !== "boolean") return null;
      if (input[mark]) result[mark] = true;
    }
    return result;
  };
  const leaves = (input: unknown) => {
    if (!Array.isArray(input) || !input.length) return null;
    const result = input.map(leaf);
    return result.every(Boolean) ? (result as SlateCustomText[]) : null;
  };
  const alignOf = (input: Record<string, unknown>) => {
    if (input.align === undefined || input.align === null) return {};
    return aligns.includes(input.align as (typeof aligns)[number])
      ? { align: input.align as (typeof aligns)[number] }
      : null;
  };
  const block = (input: unknown, insideList = false): SlateCustomElement | null => {
    if (!isRecord(input) || typeof input.type !== "string") return null;
    nodes++;
    const align = alignOf(input);
    if (!align) return null;
    if (insideList) {
      if (input.type !== "list-item") return null;
      const children = leaves(input.children);
      return children ? { type: "list-item", ...align, children } : null;
    }
    if (listBlocks.includes(input.type as (typeof listBlocks)[number])) {
      if (!Array.isArray(input.children) || !input.children.length) return null;
      const items = input.children.map(child => block(child, true));
      if (!items.every(Boolean)) return null;
      return {
        type: input.type as (typeof listBlocks)[number],
        ...align,
        children: items as Extract<SlateCustomElement, { type: "list-item" }>[],
      };
    }
    if (!textBlocks.includes(input.type as (typeof textBlocks)[number]) || input.type === "list-item")
      return null;
    const children = leaves(input.children);
    return children
      ? ({ type: input.type, ...align, children } as SlateCustomElement)
      : null;
  };
  const result = value.map(node => block(node));
  if (!result.every(Boolean) || nodes > MAX_DOCUMENT_NODES || characters > MAX_DOCUMENT_TEXT)
    return null;
  return result as SlateCustomElement[];
}

export function normalizeDocumentTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.replace(/\s+/g, " ").trim();
  return title && title.length <= MAX_DOCUMENT_TITLE ? title : null;
}

export function documentPreview(content: SlateCustomElement[]) {
  const parts: string[] = [];
  let length = 0;
  const visit = (node: SlateCustomElement | SlateCustomText) => {
    if (length > PREVIEW_LENGTH) return;
    if ("text" in node) {
      parts.push(node.text);
      length += node.text.length;
      return;
    }
    node.children.forEach(child => visit(child as SlateCustomElement | SlateCustomText));
    parts.push(" ");
  };
  content.forEach(visit);
  return parts.join("").replace(/\s+/g, " ").trim().slice(0, PREVIEW_LENGTH);
}
