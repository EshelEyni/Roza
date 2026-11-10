import AdmZip from "adm-zip";
import fs from "fs";
import { DOMParser } from "@xmldom/xmldom";
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
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Chapter</title></head><body>' +
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

  it("preserves EPUB navigation semantics, labels, and hidden auxiliary navigation", () => {
    const zip = makeEpub({ extra: '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' });
    zip.addFile("OEBPS/nav.xhtml", Buffer.from(
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body>' +
      '<nav epub:type="toc" id="toc"><ol><li><a href="chapter.xhtml#chapter">Chapter 10: Texas Coed</a></li></ol></nav>' +
      '<nav epub:type="page-list" role="doc-pagelist" hidden=""><ol><li><a href="chapter.xhtml#page1">1</a></li></ol></nav>' +
      '</body></html>',
    ));
    const archive = new AdmZip(parseEpub(zip.toBuffer(), "test.epub").buffer);
    const source = archive.readAsText("OEBPS/nav.xhtml");
    expect(XMLValidator.validate(source)).toBe(true);
    const doc = new DOMParser().parseFromString(source, "application/xhtml+xml");
    const navs = doc.getElementsByTagName("nav");
    expect(navs[0].getAttributeNS("http://www.idpf.org/2007/ops", "type")).toBe("toc");
    const link = navs[0].getElementsByTagName("a")[0];
    expect(link.textContent).toBe("Chapter 10: Texas Coed");
    expect(link.getAttribute("href")).toBe("chapter.xhtml#chapter");
    expect(navs[1].getAttribute("epub:type")).toBe("page-list");
    expect(navs[1].hasAttribute("hidden")).toBe(true);
    expect(navs[1].getAttribute("role")).toBe("doc-pagelist");
  });

  it("keeps self-closing note targets empty without turning surrounding prose into links", () => {
    const body = '<p>Before <a id="note371"/>First paragraph <i>emphasis</i>.</p>' +
      '<p><a id="note372"/>Second paragraph.</p><a href="#note371" epub:type="noteref">Note</a>';
    const archive = new AdmZip(parseEpub(makeEpub({ body }).toBuffer(), "test.epub").buffer);
    const source = archive.readAsText("OEBPS/chapter.xhtml");
    expect(XMLValidator.validate(source)).toBe(true);
    const doc = new DOMParser().parseFromString(source, "application/xhtml+xml");
    const anchors = doc.getElementsByTagName("a");
    expect(anchors.length).toBe(3);
    for (const target of [anchors[0], anchors[1]]) {
      expect(target.textContent).toBe("");
      expect(target.hasAttribute("href")).toBe(false);
    }
    expect(doc.getElementsByTagName("p")[0].textContent).toBe("Before First paragraph emphasis.");
    expect(doc.getElementsByTagName("p")[1].textContent).toBe("Second paragraph.");
    expect(anchors[2].getAttribute("href")).toBe("#note371");
    expect(anchors[2].getAttribute("epub:type")).toBe("noteref");
  });

  it("still strips executable content and unsafe links with XHTML self-closing elements", () => {
    const body = '<script src="https://evil.test/run.js"/><iframe src="https://evil.test/frame"/>' +
      '<p><a id="target" onclick="alert(1)"/>Safe text</p>' +
      '<a href="jav&#x61;script:alert(1)" epub:type="noteref">Bad link</a>' +
      '<a href="//evil.test">External link</a><img src="https://evil.test/img" onerror="alert(1)"/>';
    const archive = new AdmZip(parseEpub(makeEpub({ body }).toBuffer(), "test.epub").buffer);
    const source = archive.readAsText("OEBPS/chapter.xhtml");
    expect(source).not.toMatch(/<script|<iframe|onclick|onerror|javascript:|evil\.test/i);
    expect(source).toContain("Safe text");
    expect(source).toContain("default-src 'none'");
    expect(XMLValidator.validate(source)).toBe(true);
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
