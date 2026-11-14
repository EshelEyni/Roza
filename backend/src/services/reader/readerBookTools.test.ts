import AdmZip from "adm-zip";
import { ReaderContext } from "./readerContextService";
import { createReaderBookTools } from "./readerBookTools";
import { askReaderAi } from "./readerAiService";

const boundary = "epubcfi(/6/2!/4/4/1:10)";
function edition(navigation = "nav", long = false) {
  const zip = new AdmZip();
  const add = (name: string, text: string) => zip.addFile(name, Buffer.from(text));
  add("META-INF/container.xml", '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>');
  add("OPS/book.opf", '<package><manifest><item id="one" href="one.xhtml"/><item id="two" href="two.xhtml"/><item id="three" href="three.xhtml"/>' +
    (navigation === "nav" ? '<item id="nav" href="nav.xhtml" properties="nav"/>' : navigation === "ncx" ? '<item id="ncx" href="toc.ncx"/>' : '') +
    '</manifest><spine toc="ncx"><itemref idref="one"/><itemref idref="two"/><itemref idref="three"/></spine></package>');
  add("OPS/one.xhtml", '<html><head/><body><h1 id="one">First</h1><p>Alice finds a key in the garden.</p><h1 id="two">FUTURE_TITLE</h1><p>Bob opens the gate.</p></body></html>');
  add("OPS/two.xhtml", '<html><head/><body><p>' + (long ? 'Continuation. '.repeat(4000) : 'Continuation of Bob and Alice.') + '</p></body></html>');
  add("OPS/three.xhtml", '<html><head/><body><h1 id="three">Third</h1><p>FINAL_SECRET</p></body></html>');
  add("OPS/nav.xhtml", '<html xmlns:epub="http://www.idpf.org/2007/ops"><head/><body><nav epub:type="toc"><ol><li><a href="one.xhtml#one">First</a></li><li><a href="one.xhtml#two">FUTURE_TITLE</a></li><li><a href="three.xhtml#three">Third</a></li></ol></nav></body></html>');
  add("OPS/toc.ncx", '<ncx><navMap><navPoint><navLabel><text>First</text></navLabel><content src="one.xhtml#one"/></navPoint><navPoint><navLabel><text>FUTURE_TITLE</text></navLabel><content src="one.xhtml#two"/></navPoint><navPoint><navLabel><text>Third</text></navLabel><content src="three.xhtml#three"/></navPoint></navMap></ncx>');
  return new ReaderContext(zip.toBuffer());
}

describe("On-demand chapter and book tools", () => {
  it.each(["nav", "ncx"])("uses %s chapters within and across spine files", navigation => {
    const context = edition(navigation);
    const contents = context.bookContents(boundary, true);
    expect(contents.chapters.map(chapter => chapter.title)).toEqual(["First", "FUTURE_TITLE", "Third"]);
    const next = context.readChapter(boundary, true, "next");
    expect(next.chapter).toBe("chapter-2");
    expect(next.complete).toBe(true);
    expect(JSON.stringify(next.excerpts)).toContain("Bob opens");
    expect(JSON.stringify(next.excerpts)).toContain("Continuation");
    expect(JSON.stringify(next.excerpts)).not.toContain("FINAL_SECRET");
  });
  it("hides future titles, chapter text and search hits even after unrestricted reads", async () => {
    const context = edition();
    context.readChapter(boundary, true, "next");
    const { tools } = createReaderBookTools(context, boundary, false);
    const results = await Promise.all([
      tools.execute("book_contents", { start: 0 }),
      tools.execute("read_chapter", { chapter: "next", start: 0 }),
      tools.execute("read_book", { chapter: "chapter-2", start: 0 }),
      tools.execute("search_book", { query: "FINAL_SECRET Bob gate" }),
    ]);
    expect(JSON.stringify(results)).not.toMatch(/FUTURE_TITLE|FINAL_SECRET|Bob opens/);
    expect(JSON.stringify(results)).toContain("Enable spoilers");
    const current = context.readChapter(boundary, false, "current");
    expect(current.restricted).toBe(true);
    expect(current.complete).toBe(false);
    expect(JSON.stringify(current.excerpts)).toContain("Alice find");
    expect(JSON.stringify(current.excerpts)).not.toContain("key");
  });
  it("reads a long chapter exactly once across consecutive pages and returns book continuation", () => {
    const context = edition("nav", true);
    const first = context.readBook(boundary, true, "chapter-2");
    expect(first.next).toEqual({ chapter: "chapter-2", start: 24000 });
    let cursor = first.next;
    let text = first.excerpts!.map(excerpt => excerpt.text).join("");
    while (cursor && cursor.chapter === "chapter-2") {
      const page = context.readBook(boundary, true, cursor.chapter!, cursor.start!);
      text += page.excerpts!.map(excerpt => excerpt.text).join("");
      cursor = page.next;
    }
    expect(text.match(/Continuation\. /g)).toHaveLength(4000);
    expect(cursor).toEqual({ chapter: "chapter-3", start: 0 });
    expect(context.readBook(boundary, true, "chapter-3").next).toBeNull();
  });
  it("falls back to spine sections and fails gracefully on invalid chapter IDs", () => {
    const context = edition("none");
    expect(context.bookContents(boundary, true).chapters).toHaveLength(3);
    expect(context.readChapter(boundary, true, "next").excerpts![0].text).toContain("Continuation");
    expect(context.readChapter(boundary, true, "chapter-999").error).toContain("unavailable");
    expect(context.readChapter(boundary, true, "chapter-0").error).toContain("unavailable");
  });
  it("validates model arguments and limits cumulative book data without sharing request scope", async () => {
    const context = edition("nav", true);
    const { tools, excerpts } = createReaderBookTools(context, boundary, true);
    for (const args of [{ chapter: "next", start: -1 }, { chapter: "next", start: 0.5 }, { chapter: "next", start: 0, spoilers: true }, null]) {
      expect(await tools.execute("read_chapter", args)).toHaveProperty("error");
    }
    expect(await tools.execute("search_book", { query: "" })).toHaveProperty("error");
    expect(await tools.execute("invented", {})).toHaveProperty("error");
    for (let count = 0; count < 3; count++) await tools.execute("read_chapter", { chapter: "next", start: 0 });
    expect(await tools.execute("read_chapter", { chapter: "next", start: 0 })).toHaveProperty("error");
    expect(excerpts.length).toBeGreaterThan(0);
    const safe = createReaderBookTools(context, boundary, false);
    expect(safe.excerpts).toEqual([]);
    expect(await safe.tools.execute("read_chapter", { chapter: "next", start: 0 })).toHaveProperty("error");
  });
  it("never turns an invalid reading boundary into unrestricted book access", async () => {
    const { tools, excerpts } = createReaderBookTools(edition(), "invalid-cfi", true);
    expect(await tools.execute("read_chapter", { chapter: "next", start: 0 })).toHaveProperty("error");
    expect(await tools.execute("book_contents", { start: 0 })).toHaveProperty("error");
    expect(excerpts).toEqual([]);
  });
  it("preserves exact edition offsets on chapter read pages", () => {
    const context = edition();
    const page = context.readChapter(boundary, true, "chapter-2");
    expect(page.excerpts![0].label).toMatch(/^Section 1: one.xhtml \[characters [0-9]+-[0-9]+\]$/);
    for (const excerpt of page.excerpts!) {
      const [, from, to] = excerpt.label.match(/characters ([0-9]+)-([0-9]+)/)!;
      expect(excerpt.text.length).toBe(Number(to) - Number(from));
    }
  });
  it("reads requested chapter through the actual provider loop without sending the full book initially", async () => {
    const originalFetch = global.fetch;
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "mock-only";
    const context = edition();
    const { tools, excerpts } = createReaderBookTools(context, boundary, true);
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "completed", output: [
        { type: "function_call", call_id: "read1", name: "read_chapter", arguments: JSON.stringify({ chapter: "next", start: 0 }) },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "completed", output: [
        { type: "message", content: [{ type: "output_text", text: "Bob opens the gate (Section 1)." }] },
      ] }) });
    try {
      expect(await askReaderAi("Use tools", [{ role: "user", content: "Summarize the next chapter" }], "gpt-4.1-mini", "answer", 4000, tools)).toContain("Bob");
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][1].body).not.toContain("Bob opens");
      const continuation = JSON.parse(calls[1][1].body);
      expect(continuation.store).toBe(false);
      const result = JSON.parse(continuation.input.find((item: { type: string }) => item.type === "function_call_output").output);
      expect(result.complete).toBe(true);
      expect(JSON.stringify(result)).toContain("Continuation");
      expect(JSON.stringify(result)).not.toContain("FINAL_SECRET");
      expect(excerpts.length).toBe(2);
    } finally {
      global.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    }
  });
});
