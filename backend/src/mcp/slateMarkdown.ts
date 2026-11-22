import type {
  SlateCustomElement,
  SlateCustomText,
  SlateElementType,
} from "../../../shared/types/books";

// Converts between the Markdown that Claude writes and the Slate blocks that the
// ROZA editor stores. Only the formatting ROZA can show is kept: headings,
// block quotes, lists, bold, italic and underline (<u>…</u>).

type Marks = Pick<SlateCustomText, "bold" | "italic" | "underline">;
type Block = { type: SlateElementType; children: unknown[]; align?: "center" };

const sceneBreak = /^\s{0,3}([*\-_])(\s*\1){2,}\s*$/;
const bullet = /^\s{0,3}[-*+]\s+(.*)$/;
const numbered = /^\s{0,3}\d{1,9}[.)]\s+(.*)$/;
const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const quote = /^\s{0,3}>\s?(.*)$/;
const fence = /^\s{0,3}(```|~~~)/;

// Order matters: escapes first, then the longest markers.
const inline =
  /\\([\\`*_{}[\]()#+\-.!<>|~])|\*\*\*(?=\S)([\s\S]*?\S)\*\*\*|\*\*(?=\S)([\s\S]*?\S)\*\*|__(?=\S)([\s\S]*?\S)__|<u>([\s\S]*?)<\/u>|\*(?=\S)([\s\S]*?\S)\*|(?<![\p{L}\p{N}])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}])/u;

export function markdownToSlate(markdown: string): SlateCustomElement[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let list: Block | null = null;
  let inFence = false;

  for (const line of lines) {
    if (fence.test(line)) {
      inFence = !inFence;
      list = null;
      continue;
    }
    if (inFence) {
      blocks.push({ type: "paragraph", children: [{ text: line }] });
      continue;
    }
    if (!line.trim()) {
      list = null;
      continue;
    }

    const bulletMatch = line.match(bullet);
    const numberedMatch = !bulletMatch && line.match(numbered);
    if (!sceneBreak.test(line) && (bulletMatch || numberedMatch)) {
      const type = bulletMatch ? "bulleted-list" : "numbered-list";
      if (!list || list.type !== type) {
        list = { type, children: [] };
        blocks.push(list);
      }
      const content = (bulletMatch || numberedMatch) as RegExpMatchArray;
      list.children.push({ type: "list-item", children: parseInline(content[1]) });
      continue;
    }
    list = null;

    if (sceneBreak.test(line)) {
      blocks.push({ type: "paragraph", align: "center", children: [{ text: "* * *" }] });
      continue;
    }
    const headingMatch = line.match(heading);
    if (headingMatch) {
      const type = headingMatch[1].length === 1 ? "heading-one" : "heading-two";
      blocks.push({ type, children: parseInline(headingMatch[2]) });
      continue;
    }
    const quoteMatch = line.match(quote);
    if (quoteMatch) {
      blocks.push({ type: "block-quote", children: parseInline(quoteMatch[1]) });
      continue;
    }
    // Every non-empty line is its own paragraph. Writers often use single line
    // breaks for dialogue and verse, and those breaks must survive the save.
    blocks.push({ type: "paragraph", children: parseInline(line.trim()) });
  }

  if (!blocks.length) blocks.push({ type: "paragraph", children: [{ text: "" }] });
  return blocks as unknown as SlateCustomElement[];
}

export function parseInline(text: string, marks: Marks = {}): SlateCustomText[] {
  const leaves: SlateCustomText[] = [];
  let rest = text;
  while (rest) {
    const match = rest.match(inline);
    if (!match || match.index === undefined) {
      pushLeaf(leaves, rest, marks);
      break;
    }
    pushLeaf(leaves, rest.slice(0, match.index), marks);
    const [, escaped, boldItalic, bold, boldUnderscore, underline, italic, italicUnderscore] =
      match;
    if (escaped !== undefined) pushLeaf(leaves, escaped, marks);
    else if (boldItalic !== undefined)
      leaves.push(...parseInline(boldItalic, { ...marks, bold: true, italic: true }));
    else if (bold !== undefined || boldUnderscore !== undefined)
      leaves.push(...parseInline((bold ?? boldUnderscore) as string, { ...marks, bold: true }));
    else if (underline !== undefined)
      leaves.push(...parseInline(underline, { ...marks, underline: true }));
    else leaves.push(...parseInline((italic ?? italicUnderscore) as string, { ...marks, italic: true }));
    rest = rest.slice(match.index + match[0].length);
  }
  return mergeLeaves(leaves);
}

function pushLeaf(leaves: SlateCustomText[], text: string, marks: Marks) {
  if (!text) return;
  const leaf: SlateCustomText = { text };
  if (marks.bold) leaf.bold = true;
  if (marks.italic) leaf.italic = true;
  if (marks.underline) leaf.underline = true;
  leaves.push(leaf);
}

function mergeLeaves(leaves: SlateCustomText[]): SlateCustomText[] {
  const merged: SlateCustomText[] = [];
  for (const leaf of leaves) {
    const last = merged[merged.length - 1];
    if (last && sameMarks(last, leaf)) last.text += leaf.text;
    else merged.push({ ...leaf });
  }
  return merged.length ? merged : [{ text: "" }];
}

function sameMarks(a: Marks, b: Marks) {
  return !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.underline === !!b.underline;
}

export function slateToMarkdown(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";
  const out: string[] = [];
  for (const node of nodes as Block[]) {
    const type = node?.type;
    if (type === "bulleted-list" || type === "numbered-list") {
      const items = (Array.isArray(node.children) ? node.children : []) as Block[];
      out.push(
        items
          .map((item, i) => `${type === "bulleted-list" ? "-" : `${i + 1}.`} ${leavesToMarkdown(item?.children)}`)
          .join("\n"),
      );
      continue;
    }
    const text = leavesToMarkdown(node?.children);
    if (type === "heading-one") out.push(`# ${text}`);
    else if (type === "heading-two") out.push(`## ${text}`);
    else if (type === "block-quote") out.push(`> ${text}`);
    else out.push(escapeLineStart(text));
  }
  return out.join("\n\n");
}

function leavesToMarkdown(children: unknown): string {
  if (!Array.isArray(children)) return "";
  return children
    .map(child => {
      const leaf = child as SlateCustomText;
      if (typeof leaf?.text !== "string") return leavesToMarkdown((child as Block)?.children);
      const body = escapeInline(leaf.text);
      if (!body.trim()) return body;
      // Keep surrounding spaces outside the markers so the Markdown stays valid.
      const [, lead, core, trail] = body.match(/^(\s*)([\s\S]*?)(\s*)$/) as RegExpMatchArray;
      let marked = core;
      if (leaf.underline) marked = `<u>${marked}</u>`;
      if (leaf.bold && leaf.italic) marked = `***${marked}***`;
      else if (leaf.bold) marked = `**${marked}**`;
      else if (leaf.italic) marked = `*${marked}*`;
      return lead + marked + trail;
    })
    .join("");
}

function escapeInline(text: string): string {
  return text.replace(/([\\*_`])/g, "\\$1").replace(/<(\/?u>)/g, "\\<$1");
}

function escapeLineStart(text: string): string {
  return text
    .replace(/^(\s{0,3})([#>+-])(?=\s)/, "$1\\$2")
    .replace(/^(\s{0,3}\d{1,9})([.)])(?=\s)/, "$1\\$2");
}

export function slateToPlainText(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";
  return nodes
    .map(node => {
      const children = (node as Block)?.children;
      if (!Array.isArray(children)) return "";
      return children
        .map(child =>
          typeof (child as SlateCustomText)?.text === "string"
            ? (child as SlateCustomText).text
            : slateToPlainText([child]),
        )
        .join("");
    })
    .join("\n");
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
}
