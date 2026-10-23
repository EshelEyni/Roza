import AdmZip from "adm-zip";
import fs from "fs";
import { XMLValidator } from "fast-xml-parser";
import { parseEpub, MAX_EPUB_SIZE } from "./epubService";

function makeEpub({
  title = "Test Book",
  body = "<p>Hello reader.</p>",
  extra = "",
  meta = "",
} = {}) {
  const zip = new AdmZip();
  zip.addFile("mimetype", Buffer.from("application/epub+zip"));
  zip.addFile(
    "META-INF/container.xml",
    Buffer.from(
      '<container><rootfiles><rootfile full-path="OEBPS/book.opf"/></rootfiles></container>',
    ),
  );
  zip.addFile(
    "OEBPS/book.opf",
    Buffer.from(
      '<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>' +
        title +
        "</dc:title><dc:creator>Test Author</dc:creator>" +
        meta +
        '</metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>' +
        extra +
        '</manifest><spine><itemref idref="chapter"/></spine></package>',
    ),
  );
  zip.addFile(
    "OEBPS/chapter.xhtml",
    Buffer.from(
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter</title></head><body>' +
        body +
        "</body></html>",
    ),
  );
  return zip;
}

describe("EPUB import", () => {
  it("reads namespace metadata and keeps a readable sanitized archive", () => {
    const result = parseEpub(makeEpub().toBuffer(), "test.epub");
    expect(result.title).toBe("Test Book");
    expect(result.author).toBe("Test Author");
    const chapter = new AdmZip(result.buffer).readAsText("OEBPS/chapter.xhtml");
    expect(chapter).toContain("Hello reader.");
    expect(chapter).toContain("Content-Security-Policy");
    expect(XMLValidator.validate(chapter)).toBe(true);
  });

  it("keeps raster covers wrapped in SVG while stripping SVG scripting", () => {
    const result = parseEpub(
      makeEpub({
        body: '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><script>alert(1)</script><image xlink:href="../Images/cover.jpg"/></svg>',
      }).toBuffer(),
      "test.epub",
    );
    const chapter = new AdmZip(result.buffer).readAsText("OEBPS/chapter.xhtml");
    expect(chapter).toContain('src="../Images/cover.jpg"');
    expect(chapter).not.toMatch(/<svg|<script|xlink:/);
  });

  it("uses the filename when a title is missing", () => {
    expect(parseEpub(makeEpub({ title: "" }).toBuffer(), "My_Book.epub").title).toBe("My Book");
  });

  it("removes active content, remote resources, and event handlers", () => {
    const result = parseEpub(
      makeEpub({
        body: '<script>alert(1)</script><iframe src="https://evil.test"></iframe><img src="https://evil.test/a" onerror="alert(1)"/><a href="javascript:alert(1)">Link</a><p>Safe text</p><style>@import "https://evil.test/style"; p {background:url(https://evil.test/a)}</style>',
      }).toBuffer(),
      "test.epub",
    );
    const chapter = new AdmZip(result.buffer).readAsText("OEBPS/chapter.xhtml");
    expect(chapter).not.toMatch(
      /<script|<iframe|onerror|javascript:|https:\/\/evil|@import|url\s*\(/i,
    );
    expect(chapter).toContain("Safe text");
  });

  it("rejects encrypted, oversized, malformed, and fixed-layout books", () => {
    const encrypted = makeEpub();
    encrypted.addFile("META-INF/encryption.xml", Buffer.from("<encryption/>"));
    expect(() => parseEpub(encrypted.toBuffer(), "test.epub")).toThrow(/Encrypted/);
    expect(() => parseEpub(Buffer.alloc(MAX_EPUB_SIZE + 1), "test.epub")).toThrow(/25 MiB/);
    expect(() => parseEpub(Buffer.from("not a zip"), "test.epub")).toThrow(/Could not read/);
    expect(() =>
      parseEpub(
        makeEpub({ meta: '<meta property="rendition:layout">pre-paginated</meta>' }).toBuffer(),
        "test.epub",
      ),
    ).toThrow(/Fixed-layout/);
  });

  it("rejects missing spine resources and external manifest URLs", () => {
    const missing = makeEpub();
    missing.deleteFile("OEBPS/chapter.xhtml");
    expect(() => parseEpub(missing.toBuffer(), "test.epub")).toThrow(/missing/);
    expect(() =>
      parseEpub(
        makeEpub({
          extra:
            '<item id="remote" href="https://evil.test/book.xhtml" media-type="application/xhtml+xml"/>',
        }).toBuffer(),
        "test.epub",
      ),
    ).toThrow(/External or unsafe/);
  });

  it("rejects archive expansion bombs before inflation", () => {
    const zip = makeEpub();
    zip.addFile("oversize.txt", Buffer.alloc(11 * 1024 * 1024, 32));
    expect(() => parseEpub(zip.toBuffer(), "test.epub")).toThrow(/expands beyond/);
  });

  const sample = process.env.READER_TEST_EPUB;
  (sample ? it : it.skip)("imports the owner's sample without committing it", () => {
    const result = parseEpub(fs.readFileSync(sample!), "sample.epub");
    expect(result.title).toBe("In the Shadow of Young Girls in Flower");
    expect(result.author).toContain("Proust");
    expect(result.cover).toMatch(/^data:image\//);
    const archive = new AdmZip(result.buffer);
    for (const entry of archive.getEntries().filter(entry => /\.xhtml$/i.test(entry.entryName))) {
      expect(XMLValidator.validate(entry.getData().toString())).toBe(true);
    }
  });
});
