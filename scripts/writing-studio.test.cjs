const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("../frontend/node_modules/typescript");
require.extensions[".ts"] = (module, file) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    file,
  );
const {
  DraftStore,
} = require("../frontend/src/components/WritingStudio/draftStore.ts");
const {
  manuscriptHtml,
  words,
} = require("../frontend/src/components/WritingStudio/manuscript.ts");
const book = () => ({
  id: "book",
  userId: "owner",
  name: "Novel",
  updatedAt: "2026-01-01T00:00:00.000Z",
  chapters: [],
  characters: [],
  themes: [],
  plotlines: [],
  notes: [],
});
const storage = () => {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) || null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
};
test("serializes delayed saves and carries edits made while saving into the next request", async () => {
  const calls = [];
  let release;
  const mem = storage();
  let active = 0,
    max = 0;
  const store = new DraftStore(
    book(),
    async (snapshot) => {
      active++;
      max = Math.max(max, active);
      calls.push(snapshot);
      if (calls.length === 1)
        await new Promise((resolve) => (release = resolve));
      active--;
      return {
        ...snapshot,
        updatedAt: `2026-01-01T00:00:0${calls.length}.000Z`,
      };
    },
    mem,
  );
  store.edit((b) => ({ ...b, name: "First edit" }));
  const pending = store.flush();
  store.edit((b) => ({ ...b, name: "Latest edit" }));
  release();
  await pending;
  assert.equal(max, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].name, "Latest edit");
  assert.equal(calls[1].updatedAt, "2026-01-01T00:00:01.000Z");
  assert.equal(store.book.name, "Latest edit");
  assert.equal(store.state, "saved");
  assert.equal(mem.getItem(store.key), null);
  store.dispose();
});
test("failed save preserves latest draft and retries explicitly", async () => {
  let fail = true;
  const mem = storage();
  const store = new DraftStore(
    book(),
    async (b) => {
      if (fail) throw Error("offline");
      return { ...b, updatedAt: "new" };
    },
    mem,
  );
  store.edit((b) => ({ ...b, name: "Keep me" }));
  await store.flush();
  assert.equal(store.state, "error");
  assert.equal(JSON.parse(mem.getItem(store.key)).book.name, "Keep me");
  store.edit((b) => ({ ...b, name: "More writing" }));
  fail = false;
  await store.flush();
  assert.equal(store.state, "saved");
  assert.equal(store.book.name, "More writing");
  store.dispose();
});
test("recovery is explicit and refuses to restore over a changed server version", async () => {
  const mem = storage();
  const first = new DraftStore(book(), async (b) => b, mem);
  first.edit((b) => ({ ...b, name: "Recovered" }));
  first.dispose();
  const recovered = new DraftStore(book(), async (b) => b, mem);
  assert.ok(recovered.recovery);
  assert.equal(recovered.book.name, "Novel");
  recovered.restore();
  assert.equal(recovered.book.name, "Recovered");
  recovered.dispose();
  const conflicting = new DraftStore(
    { ...book(), updatedAt: "changed" },
    async (b) => b,
    mem,
  );
  assert.equal(conflicting.canRestore(), false);
  conflicting.restore();
  assert.equal(conflicting.book.name, "Novel");
  assert.ok(conflicting.recovery);
  conflicting.dispose();
});
test("navigation disposal retains unsent edits; storage failure is visible", () => {
  const mem = storage();
  const store = new DraftStore(book(), async (b) => b, mem);
  store.edit((b) => ({ ...b, name: "Leaving" }));
  store.dispose();
  assert.equal(JSON.parse(mem.getItem(store.key)).book.name, "Leaving");
  const full = new DraftStore(book(), async (b) => b, {
    getItem: () => null,
    setItem: () => {
      throw Error("quota");
    },
    removeItem: () => {},
  });
  full.edit((b) => ({ ...b, name: "Keep open" }));
  assert.equal(full.storageError, true);
  assert.equal(full.dirty, true);
  full.dispose();
});
test("word count joins marked leaves; export preserves structure, escapes HTML and excludes archived chapters", () => {
  const text = [
    {
      type: "paragraph",
      children: [{ text: "hel", bold: true }, { text: "lo world" }],
    },
    {
      type: "bulleted-list",
      children: [
        { type: "list-item", children: [{ text: "third word", italic: true }] },
      ],
    },
  ];
  assert.equal(words(text), 4);
  const html = manuscriptHtml({
    ...book(),
    name: "<script>bad</script>",
    chapters: [
      { name: "First", text },
      { name: "Hidden", text, isArchived: true },
      { name: "Last", text },
    ],
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<strong>hel</strong>"));
  assert.ok(html.includes("<ul><li><em>third word</em></li></ul>"));
  assert.ok(!html.includes("Hidden"));
  assert.ok(html.indexOf("First") < html.indexOf("Last"));
});
test("a late save acknowledgement does not erase a newer recovery draft from another instance", async () => {
  const mem = storage();
  let release;
  const store = new DraftStore(
    book(),
    async (b) => {
      await new Promise((resolve) => (release = resolve));
      return { ...b, updatedAt: "confirmed" };
    },
    mem,
  );
  store.edit((b) => ({ ...b, name: "Older instance" }));
  const saving = store.flush();
  const newer = JSON.stringify({
    book: { ...book(), name: "Newer instance" },
    base: book().updatedAt,
    owner: "another",
    revision: 1,
  });
  mem.setItem(store.key, newer);
  release();
  await saving;
  assert.equal(mem.getItem(store.key), newer);
  store.dispose();
});

test("preview renderer preserves formatting and escapes manuscript HTML", () => {
  const { richTextHtml } = require("../frontend/src/components/WritingStudio/manuscript.ts");
  const html = richTextHtml([
    { type: "heading-one", align: "center", children: [{ text: "A <new> beginning", bold: true }] },
    { type: "block-quote", children: [{ text: "<script>alert(1)</script>", italic: true, underline: true }] },
  ]);
  assert.match(html, /<h2 style="text-align:center"><strong>A &lt;new&gt; beginning<\/strong><\/h2>/);
  assert.match(html, /<blockquote><u><em>&lt;script&gt;/);
  assert.ok(!html.includes("<script>"));
});
