const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");
const source = fs.readFileSync(path.join(__dirname, "../frontend/src/services/readerChatScroll.ts"), "utf8");
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
const moduleExports = {};
new Function("exports", code)(moduleExports);
const { scrollReaderChat } = moduleExports;
const turn = (id, status = "completed") => ({ id, status, question: "Question", answer: "Answer" });
const chat = turns => ({ id: "chat", turns });
function viewport(offsets) {
  const container = {
    scrollTop: 0, scrollHeight: 2400, clientTop: 2,
    getBoundingClientRect: () => ({ top: 80 }),
    querySelectorAll: () => Object.entries(offsets).map(([id, top]) => ({
      dataset: { readerChatAnswer: id },
      getBoundingClientRect: () => ({ top: 82 + top - container.scrollTop }),
    })),
  };
  return container;
}

test("a completed long answer aligns to its beginning instead of the bottom", () => {
  const container = viewport({ old: 0, next: 600 });
  const before = scrollReaderChat(container, null, chat([turn("old")]), "next");
  container.scrollTop = 2100;
  scrollReaderChat(container, before, chat([turn("old"), turn("next")]), undefined);
  assert.equal(container.scrollTop, 600);
  assert.notEqual(container.scrollTop, container.scrollHeight);
});

test("new submissions reveal the pending question but completion moves to the answer start", () => {
  const container = viewport({ old: 0, next: 720 });
  let state = scrollReaderChat(container, null, chat([turn("old")]));
  state = scrollReaderChat(container, state, chat([turn("old")]), "next");
  assert.equal(container.scrollTop, 2400);
  scrollReaderChat(container, state, chat([turn("old"), turn("next")]));
  assert.equal(container.scrollTop, 720);
});

test("rerenders preserve the user's manual reading position after the answer arrives", () => {
  const container = viewport({ old: 0, next: 600 });
  const state = scrollReaderChat(container, null, chat([turn("old"), turn("next")]));
  container.scrollTop = 820;
  scrollReaderChat(container, state, chat([turn("old"), turn("next")]));
  assert.equal(container.scrollTop, 820);
});

test("retrying an earlier failed turn reveals that answer rather than a later saved answer", () => {
  const container = viewport({ first: 200, later: 900 });
  const state = scrollReaderChat(container, null, chat([turn("first", "failed"), turn("later")]), "first");
  scrollReaderChat(container, state, chat([turn("first"), turn("later")]));
  assert.equal(container.scrollTop, 200);
});

test("reopening a saved chat starts at the last answer and does not require a pending request", () => {
  const container = viewport({ old: 0, last: 1000 });
  scrollReaderChat(container, null, chat([turn("old"), turn("last")]));
  assert.equal(container.scrollTop, 1000);
});

test("an empty chat can open without an answer target", () => {
  const container = viewport({});
  const state = scrollReaderChat(container, null, null);
  assert.equal(state.completedIds.size, 0);
});

test("answer-start geometry works in a real browser on desktop and mobile", {
  skip: !process.env.PLAYWRIGHT_MODULE, timeout: 30000,
}, async t => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
  try {
    for (const width of [1280, 390]) {
      await t.test(width === 390 ? "mobile" : "desktop", async () => {
        const page = await browser.newPage({ viewport: { width, height: 700 } });
        try {
          await page.setContent(`<style>
            body { margin: 0; min-height: 1800px; }
            #chat { margin-top: 300px; height: 240px; overflow-y: auto; border: 2px solid black; padding: 18px; overflow-anchor: none; }
            .old { height: 400px; } .question { height: 100px; }
            .answer { height: 1400px; padding: 12px; }
          </style><div id="chat"><div class="old" data-reader-chat-answer="old">Earlier answer</div>
          <div class="question">New question</div><div class="answer" data-reader-chat-answer="next">FIRST LINE<br>Long answer</div></div>`);
          await page.addScriptTag({ content: "var exports = {};\n" + code });
          const measured = await page.evaluate(() => {
            window.scrollTo(0, 100);
            const container = document.getElementById("chat");
            const pageTop = window.scrollY;
            container.scrollTop = container.scrollHeight;
            const previous = { container, conversationId: "chat", completedIds: new Set(["old"]), pendingId: "next" };
            const state = exports.scrollReaderChat(container, previous, {
              id: "chat", turns: [{ id: "old", status: "completed" }, { id: "next", status: "completed" }],
            });
            const answer = container.querySelector('[data-reader-chat-answer="next"]');
            const distance = answer.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientTop;
            const atBottom = container.scrollTop >= container.scrollHeight - container.clientHeight - 1;
            container.scrollTop += 100;
            const manual = container.scrollTop;
            exports.scrollReaderChat(container, state, {
              id: "chat", turns: [{ id: "old", status: "completed" }, { id: "next", status: "completed" }],
            });
            return { distance, atBottom, pageStayed: pageTop === window.scrollY, manualStayed: manual === container.scrollTop };
          });
          assert.ok(Math.abs(measured.distance) <= 1);
          assert.equal(measured.atBottom, false);
          assert.equal(measured.pageStayed, true);
          assert.equal(measured.manualStayed, true);
        } finally { await page.close(); }
      });
    }
  } finally { await browser.close(); }
});
