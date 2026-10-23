const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");
const { DOMParser } = require("../frontend/node_modules/@xmldom/xmldom");
const epub = require("../frontend/node_modules/epubjs");
const code = ts.transpileModule(
  fs.readFileSync(
    path.join(__dirname, "../frontend/src/services/readerPublisherPages.ts"),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const api = {};
new Function("exports", "require", code)(api, () => epub);
const cfi = (n) => "epubcfi(/6/2[chapter]!/4/" + n + ")";
const xml = (text) =>
  new DOMParser().parseFromString(text, "application/xhtml+xml");
function book(nav, content, ncx = false) {
  const section = {
    index: 0,
    linear: true,
    url: "/OPS/text/chapter.xhtml",
    cfiFromElement: (el) => el.getAttribute("data-cfi"),
  };
  const files = {
    "/OPS/nav/nav.xhtml": xml(nav),
    "/OPS/text/chapter.xhtml": xml(content),
  };
  return {
    packaging: ncx
      ? { ncxPath: "nav/nav.xhtml" }
      : { navPath: "nav/nav.xhtml" },
    spine: { each: (fn) => fn(section) },
    resolve: (href) => "/OPS/" + href,
    load: async (href) => {
      const resolved = href.startsWith("/") ? href : "/OPS/" + href;
      assert.ok(files[resolved], "Unknown path " + resolved);
      return files[resolved];
    },
  };
}
const body =
  '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><span id="front" data-cfi="' +
  cfi(2) +
  '"/><span id="p1" data-cfi="' +
  cfi(4) +
  '"/><span id="p2" data-cfi="' +
  cfi(8) +
  '"/></body></html>';
const signal = () => new AbortController().signal;
test("EPUB 3 page list resolves relative links, preserves Roman numerals, and sorts by reading order", async () => {
  const nav =
    '<html xmlns:epub="http://www.idpf.org/2007/ops"><nav epub:type="page-list"><a href="../text/chapter.xhtml#p2">2</a><a href="../text/chapter.xhtml#front">iv</a><a href="../text/chapter.xhtml#p1">1</a></nav></html>';
  const pages = await api.loadPublisherPages(book(nav, body), signal());
  assert.deepEqual(
    pages.map((p) => p.label),
    ["iv", "1", "2"],
  );
  assert.equal(api.publisherPageAt(pages, cfi(6))?.label, "1");
  assert.equal(api.publisherPageAt(pages, cfi(8))?.label, "2");
  assert.equal(api.publisherPageAt(pages, "epubcfi(/6/2[chapter]!/2/2)"), null);
});
test("EPUB 2 NCX page targets use their original labels", async () => {
  const nav =
    '<ncx><pageList><pageTarget><navLabel><text>17</text></navLabel><content src="../text/chapter.xhtml#p1"/></pageTarget></pageList></ncx>';
  assert.deepEqual(
    await api.loadPublisherPages(book(nav, body, true), signal()),
    [{ cfi: cfi(4), label: "17" }],
  );
});
test("pagebreak markers work without a page list", async () => {
  const content =
    '<html xmlns:epub="http://www.idpf.org/2007/ops"><body><span epub:type="pagebreak" title="iv" data-cfi="' +
    cfi(2) +
    '"/><span role="doc-pagebreak" aria-label="1" data-cfi="' +
    cfi(4) +
    '"/></body></html>';
  const pages = await api.loadPublisherPages(
    book("<html/>", content),
    signal(),
  );
  assert.deepEqual(
    pages.map((p) => p.label),
    ["iv", "1"],
  );
});
test("books without publisher pagination return no invented pages", async () => {
  assert.deepEqual(
    await api.loadPublisherPages(book("<html/>", body), signal()),
    [],
  );
});
test("cancelled indexing stops before archive access", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => api.loadPublisherPages(book("<html/>", body), controller.signal),
    { name: "AbortError" },
  );
});
