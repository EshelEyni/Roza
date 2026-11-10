import { fountain, isScreenplay } from "./screenplay";
import { Node } from "slate";
import {
  Book,
  SlateCustomElement,
  SlateCustomText,
} from "../../../../shared/types/books";

export const plainText = (nodes: SlateCustomElement[]) =>
  nodes.map((node) => Node.string(node)).join("\n");
export const words = (nodes: SlateCustomElement[]) =>
  plainText(nodes).trim().split(/\s+/u).filter(Boolean).length;
export const manuscriptWords = (book: Book) =>
  book.chapters
    .filter((chapter) => !chapter.isArchived)
    .reduce((count, chapter) => count + words(chapter.text), 0);
export const newId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
function htmlNode(node: SlateCustomElement | SlateCustomText): string {
  if ("text" in node) {
    let text = escape(node.text);
    if (node.bold) text = `<strong>${text}</strong>`;
    if (node.italic) text = `<em>${text}</em>`;
    if (node.underline) text = `<u>${text}</u>`;
    return text;
  }
  const tag =
    {
      "heading-one": "h2",
      "heading-two": "h3",
      "block-quote": "blockquote",
      "bulleted-list": "ul",
      "numbered-list": "ol",
      "list-item": "li",
      paragraph: "p",
    }[node.type as "paragraph"] || "p";
  const align = ["left", "right", "center", "justify"].includes(
    node.align || "",
  )
    ? ` style="text-align:${node.align}"`
    : "";
  return `<${tag}${isScreenplay(node.type) ? ` class="sp-block sp-${node.type}"` : ""}${align}>${node.children.map(htmlNode).join("")}</${tag}>`;
}
export const richTextHtml = (nodes: SlateCustomElement[]) =>
  nodes.map(htmlNode).join("");

export function manuscriptHtml(book: Book) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(book.name)}</title><style>body{max-width:42rem;margin:4rem auto;padding:0 1.5rem;font:19px/1.8 Georgia,serif;color:#292721}h1,h2{line-height:1.2}section{break-before:page;margin-top:4rem}blockquote{border-inline-start:3px solid #aaa;padding-inline-start:1.5rem} .sp-page{font:12pt/1 Courier,monospace;max-width:6in}.sp-block{white-space:pre-wrap;margin:0 0 1em}.sp-character{margin-left:2.2in;margin-bottom:0;text-transform:uppercase;break-after:avoid}.sp-dialogue{margin-left:1in;margin-right:1.5in}.sp-parenthetical{margin-left:1.6in;margin-right:2in;margin-bottom:0;break-after:avoid}.sp-scene_heading{margin-top:2em;text-transform:uppercase;break-after:avoid}.sp-transition{text-align:right;text-transform:uppercase}@page{size:letter;margin:1in 1in 1in 1.5in}@media print{body{margin:0;max-width:none}}</style></head><body dir="auto"><h1>${escape(book.name)}</h1>${book.chapters
    .filter((c) => !c.isArchived)
    .map(
      (c) =>
        `<section class="${c.format === "screenplay" ? "sp-page" : ""}"><h2>${escape(c.name)}</h2>${c.text.map(htmlNode).join("")}</section>`,
    )
    .join("")}</body></html>`;
}
export function download(book: Book, format: "json" | "html" | "fountain") {
  const blob = new Blob(
    [
      format === "json"
        ? JSON.stringify(
            { format: "roza-manuscript", version: 1, book },
            null,
            2,
          )
        : format === "fountain"
          ? book.chapters
              .filter((c) => !c.isArchived && c.format === "screenplay")
              .map((c) => fountain(c.text))
              .join("\n")
          : manuscriptHtml(book),
    ],
    {
      type: format === "json" ? "application/json" : "text/html;charset=utf-8",
    },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${book.name.replace(/[<>:"/\\|?*]/g, "_") || "manuscript"}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
