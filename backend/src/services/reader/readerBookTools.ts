import type { ReaderContext } from "./readerContextService";
import type { ReaderAiTools } from "./readerAiService";
import { AppError } from "../error/errorService";

type Excerpt = { label: string; text: string };
const integer = { type: "integer", minimum: 0 };
function tool(name: string, description: string, properties: Record<string, unknown>) {
  return { type: "function" as const, name, description, strict: true,
    parameters: { type: "object", properties, required: Object.keys(properties), additionalProperties: false } };
}
export const readerBookToolDefinitions = [
  tool("book_contents", "Inspect accessible book chapters and current chapter. Paginated; start=0 initially. Use IDs rather than guessing printed chapter numbers. Future titles are hidden when spoilers are off.", { start: integer }),
  tool("read_chapter", "Read a specific entire chapter on demand, including next/current/previous relative to the reading position. chapter is current, next, previous, or a chapter-N ID from book_contents. start=0 initially; follow nextStart until null before summarizing the entire chapter. No unread content with spoilers off.", { chapter: { type: "string" }, start: integer }),
  tool("search_book", "Search accessible text across all chapters; use specific names, events, relationships, theme terms or references, preferably in the book's language. Try alternative terms when needed. Results are evidence samples, not exhaustive coverage.", { query: { type: "string" } }),
  tool("read_book", "Read the book sequentially for broad analysis without sending it all at once. Start chapter=chapter-1,start=0, then follow next cursors. Can also begin at any accessible chapter ID. Report partial coverage if the request budget prevents finishing.", { chapter: { type: "string" }, start: integer }),
];

export function createReaderBookTools(context: ReaderContext, currentCfi: string, allow: boolean) {
  const excerpts: Excerpt[] = [];
  let evidenceBytes = 0;
  const tools: ReaderAiTools = {
    definitions: readerBookToolDefinitions,
    execute(name, args) {
      try {
        if (!args || typeof args !== "object" || Array.isArray(args)) return { error: "Expected an argument object." };
        const value = args as Record<string, unknown>;
        const expected = name === "search_book" ? ["query"] : name === "book_contents" ? ["start"] : ["chapter", "start"];
        if (Object.keys(value).some(key => !expected.includes(key)) || expected.some(key => !(key in value)))
          return { error: "Invalid tool arguments." };
        if (name !== "search_book" && (!Number.isSafeInteger(value.start) || Number(value.start) < 0))
          return { error: "start must be a nonnegative integer." };
        if ((name === "read_chapter" || name === "read_book") && (typeof value.chapter !== "string" || value.chapter.length > 80))
          return { error: "Use current, next, previous or a chapter-N ID." };
        let result: unknown;
        if (name === "book_contents") result = context.bookContents(currentCfi, allow, Number(value.start));
        else if (name === "read_chapter") result = context.readChapter(currentCfi, allow, String(value.chapter), Number(value.start));
        else if (name === "read_book") result = context.readBook(currentCfi, allow, String(value.chapter), Number(value.start));
        else if (name === "search_book") {
          if (typeof value.query !== "string" || !value.query.trim() || value.query.length > 2000)
            return { error: "Supply a search query of 1-2000 characters." };
          result = { excerpts: context.retrieve(value.query, currentCfi, allow).context, coverage: "Relevant excerpts only; use chapter reading for complete coverage." };
        } else return { error: "Unknown book tool." };
        const sources = (result as { excerpts?: Excerpt[] }).excerpts || [];
        const size = Buffer.byteLength(JSON.stringify(result), "utf8");
        if (evidenceBytes + size > 96000) return { error: "Book-reading budget reached for this answer. Use the evidence already retrieved, disclose partial coverage, and offer to continue in another question." };
        evidenceBytes += size;
        for (const source of sources) if (!excerpts.some(item => item.label === source.label && item.text === source.text)) excerpts.push(source);
        return result;
      } catch (error) {
        if (error instanceof AppError) return { error: "This book position or content is unavailable. Keep the answer limited to verified supplied evidence." };
        throw error;
      }
    },
  };
  return { tools, excerpts };
}
