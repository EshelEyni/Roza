import AdmZip from "adm-zip";
import type { SlateCustomElement } from "../../../../shared/types/books";
import { parseEpub } from "./epubService";
import {
  buildStudioEpub,
  detectLanguage,
  parseCover,
  parsePublishingRequest,
  renderBlocks,
  StudioEpubChapter,
} from "./studioEpubService";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const paragraph = (text: string, marks = {}): SlateCustomElement => ({
  type: "paragraph",
  children: [{ text, ...marks }],
});
const chapters: StudioEpubChapter[] = [
  { id: "a".repeat(24), name: "הגעה", text: [paragraph("המעבורת עגנה <מעט> & אחרי"), paragraph("* * *"), paragraph("שורה", { bold: true })] },
  { id: "b".repeat(24), name: "", text: [paragraph("")] },
  {
    id: "c".repeat(24),
    name: "לילה",
    format: "screenplay",
    text: [
      { type: "scene_heading", children: [{ text: "int. tower - night" }] },
      { type: "dialogue", children: [{ text: "שלום" }] },
    ],
  },
];
const options = {
  title: "המגדלור & ים",
  author: "A <Writer>",
  language: "he" as const,
  includeTitlePage: true,
  includeToc: true,
  chapterIds: ["a".repeat(24), "c".repeat(24)],
  cover: "",
};

describe("renderBlocks", () => {
  it("escapes text, maps marks, scene breaks and stable ids", () => {
    const html = renderBlocks(chapters[0].text);
    expect(html).toContain('<p id="b-0">המעבורת עגנה &lt;מעט&gt; &amp; אחרי</p>');
    expect(html).toContain('<hr id="b-1" class="scene-break"/>');
    expect(html).toContain('<p id="b-2"><strong>שורה</strong></p>');
  });

  it("renders lists, quotes, headings, alignment and screenplay blocks", () => {
    const html = renderBlocks([
      { type: "heading-one", children: [{ text: "Part" }] },
      { type: "block-quote", align: "center", children: [{ text: "Quote", italic: true }] },
      {
        type: "bulleted-list",
        children: [
          { type: "list-item", children: [{ text: "One" }] },
          { type: "list-item", children: [{ text: "Two", underline: true }] },
        ],
      },
      { type: "character", children: [{ text: "MAYA" }] },
      paragraph(""),
    ]);
    expect(html).toContain('<h2 id="b-0">Part</h2>');
    expect(html).toContain('<blockquote id="b-1" class="align-center"><p><em>Quote</em></p></blockquote>');
    expect(html).toContain('<ul id="b-2"><li>One</li><li><span class="u">Two</span></li></ul>');
    expect(html).toContain('<p id="b-3" class="sp sp-character">MAYA</p>');
    expect(html.split("\n")).toHaveLength(4);
  });
});

describe("detectLanguage", () => {
  it("picks Hebrew or English by letters", () => {
    expect(detectLanguage(chapters)).toBe("he");
    expect(detectLanguage([{ name: "One", text: [paragraph("An English chapter")] }])).toBe("en");
  });
});

describe("parsePublishingRequest", () => {
  it("keeps Studio order and drops unknown chapters", () => {
    const parsed = parsePublishingRequest(
      { ...options, chapterIds: ["c".repeat(24), "x", "a".repeat(24)] },
      chapters,
    );
    expect(parsed.chapterIds).toEqual(["a".repeat(24), "c".repeat(24)]);
  });

  it("rejects bad input", () => {
    expect(() => parsePublishingRequest({ ...options, title: " " }, chapters)).toThrow("title");
    expect(() => parsePublishingRequest({ ...options, language: "fr" }, chapters)).toThrow("Hebrew");
    expect(() => parsePublishingRequest({ ...options, chapterIds: [] }, chapters)).toThrow("chapter");
    expect(() => parseCover("data:image/svg+xml;base64,PHN2Zz4=")).toThrow("PNG or JPEG");
    expect(() => parseCover("data:image/jpeg;base64," + png.toString("base64"))).toThrow("could not be read");
  });
});

describe("buildStudioEpub", () => {
  const cover = parseCover("data:image/png;base64," + png.toString("base64"));
  const buffer = buildStudioEpub({
    options,
    chapters,
    cover,
    identifier: "urn:uuid:1234",
    modified: new Date("2026-11-21T10:00:00.123Z"),
  });
  const zip = new AdmZip(buffer);

  it("writes mimetype first and uncompressed", () => {
    expect(buffer.subarray(30, 58).toString("latin1")).toBe("mimetypeapplication/epub+zip");
    expect(zip.getEntry("mimetype")!.header.method).toBe(0);
  });

  it("writes a right-to-left package with only the chosen chapters", () => {
    const opf = zip.readAsText("OEBPS/content.opf");
    expect(opf).toContain('page-progression-direction="rtl"');
    expect(opf).toContain("<dc:title>המגדלור &amp; ים</dc:title>");
    expect(opf).toContain("<dc:creator>A &lt;Writer&gt;</dc:creator>");
    expect(opf).toContain('<meta property="dcterms:modified">2026-11-21T10:00:00Z</meta>');
    expect(opf).toContain('properties="cover-image"');
    expect(zip.getEntry(`OEBPS/chapter-${"b".repeat(24)}.xhtml`)).toBeNull();
    const chapter = zip.readAsText(`OEBPS/chapter-${"a".repeat(24)}.xhtml`);
    expect(chapter).toContain('lang="he"');
    expect(chapter).toContain('dir="rtl"');
    const spine = opf.slice(opf.indexOf("<spine"));
    expect(spine.indexOf('idref="cover"')).toBeLessThan(spine.indexOf('idref="title-page"'));
    expect(spine.indexOf('idref="nav"')).toBeLessThan(spine.indexOf(`chapter-${"a".repeat(24)}`));
  });

  it("passes the upload check and keeps title, author and cover", () => {
    const parsed = parseEpub(buffer, "book.epub");
    expect(parsed.title).toContain("המגדלור");
    expect(parsed.author).toContain("Writer");
    expect(parsed.cover).toMatch(/^data:image\/png;base64,/);
  });

  it("hides the contents page when it is not wanted", () => {
    const plain = new AdmZip(
      buildStudioEpub({
        options: { ...options, includeToc: false, includeTitlePage: false },
        chapters,
        identifier: "urn:uuid:1234",
        modified: new Date(),
      }),
    );
    const opf = plain.readAsText("OEBPS/content.opf");
    expect(opf.slice(opf.indexOf("<spine"))).not.toContain('idref="nav"');
    expect(opf).not.toContain("title-page");
    expect(plain.readAsText("OEBPS/nav.xhtml")).toContain('hidden="hidden"');
  });
});
