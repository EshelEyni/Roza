const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");
const code = ts.transpileModule(
  fs.readFileSync(
    path.join(
      __dirname,
      "../frontend/src/hooks/reader/useReaderSentenceMode.ts",
    ),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
function setup() {
  const slots = [];
  let cursor = 0,
    resolve,
    reject;
  const pending = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const calls = { saved: [], reports: 0 };
  const ref = (current) => ({ current });
  const sentence = { cfi: "active-sentence-cfi", text: "The active sentence." };
  const section = { index: 0, href: "chapter.xhtml", load: async () => {} };
  const book = {
    load: async () => {},
    spine: {
      get: (target) =>
        target === 0 || typeof target === "string" ? section : undefined,
    },
    navigation: { get: () => ({ label: "Chapter" }) },
    locations: { length: () => 0 },
  };
  const rendition = {
    reportLocation: async () => {
      calls.reports++;
    },
    getContents: () => [],
    currentLocation: () => ({ start: { cfi: "page-first-cfi" } }),
  };
  const runtime = {
    epubRef: ref(book),
    renditionRef: ref(rendition),
    stateRef: ref({ location: "old-cfi", progress: 0.2 }),
    updateRef: ref((value) => calls.saved.push(value)),
    rsvpLocation: ref(""),
    rsvpActive: ref(false),
    readingBoundary: ref(""),
    panelRef: ref(null),
    selectionRef: ref(null),
    keyboardWordCfi: ref(""),
    navigationVersion: ref(0),
    explicitNavigation: ref(false),
  };
  const react = {
    useState: (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value) => {
          slots[index] =
            typeof value === "function" ? value(slots[index]) : value;
        },
      ];
    },
    useRef: (initial) => {
      const index = cursor++;
      return (slots[index] ||= { current: initial });
    },
    useEffect: () => {},
  };
  class Cfi {
    constructor(value) {
      this.value = value;
    }
    collapse() {}
    toString() {
      return this.value;
    }
  }
  const dependencies = {
    react,
    "react-dom": { flushSync: (callback) => callback() },
    epubjs: { EpubCFI: Cfi },
    "../../services/readerSentences": {
      extractReaderSentences: () => [sentence],
    },
    "../../services/readerRsvp": { rsvpStart: () => 0 },
  };
  const exports = {};
  new Function("require", "exports", code)(
    (name) => dependencies[name],
    exports,
  );
  const restore = () => {
    runtime.navigationVersion.current++;
    return pending;
  };
  const render = () => {
    cursor = 0;
    return exports.useReaderSentenceMode(runtime, restore);
  };
  return { runtime, calls, resolve, reject, render, sentence };
}
test("exit reveals Page Mode but waits for completed CFI restoration before persisting", async () => {
  const { runtime, calls, resolve, render, sentence } = setup();
  await render().toggle();
  const before = calls.saved.length;
  const exiting = render().toggle();
  assert.equal(render().active, false);
  assert.equal(runtime.rsvpActive.current, true);
  assert.equal(calls.saved.length, before);
  resolve();
  await exiting;
  assert.equal(runtime.rsvpActive.current, false);
  assert.equal(calls.saved.at(-1).location, sentence.cfi);
  assert.equal(calls.saved.length, before + 1);
  assert.equal(calls.reports, 1);
});
for (const failure of [false, true])
  test(
    "superseded restore " +
      (failure ? "failure" : "completion") +
      " cannot persist the old sentence",
    async () => {
      const { runtime, calls, resolve, reject, render } = setup();
      await render().toggle();
      const before = calls.saved.length;
      const exiting = render().toggle();
      runtime.navigationVersion.current++;
      if (failure) reject(Error("superseded"));
      else resolve();
      await exiting;
      assert.equal(calls.saved.length, before);
      assert.equal(runtime.rsvpActive.current, false);
      assert.equal(render().active, false);
      assert.equal(calls.reports, 1);
    },
  );
test("failed current restoration keeps the same sentence available for retry", async () => {
  const { runtime, calls, reject, render } = setup();
  await render().toggle();
  const before = calls.saved.length;
  const exiting = render().toggle();
  reject(Error("display failed"));
  await exiting;
  assert.equal(calls.saved.length, before);
  assert.equal(runtime.rsvpActive.current, true);
  assert.equal(render().active, true);
  assert.match(render().error, /Could not return/);
});
