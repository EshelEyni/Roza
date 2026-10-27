const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");

// Exercise the real hook and component with deterministic renders and deferred APIs.
function harness(file, dependencies, exportName) {
  const slots = [];
  let index = 0;
  let effects = [];
  const react = {
    useState(initial) {
      const i = index++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
    },
    useRef(initial) {
      const i = index++;
      return slots[i] ||= { current: initial };
    },
    useCallback: callback => callback,
    useEffect(callback, deps) {
      const i = index++;
      if (!slots[i] || deps.some((dep, j) => dep !== slots[i][j])) effects.push(callback);
      slots[i] = deps;
    },
  };
  react.useLayoutEffect = react.useEffect;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../frontend/src", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "exports", code)(name => name === "react" ? react : dependencies[name] || {}, exports);
  return (...args) => {
    index = 0;
    effects = [];
    const result = (exportName ? exports[exportName] : Object.values(exports)[0])(...args);
    effects.forEach(effect => effect());
    return result;
  };
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));
const conversation = turns => ({ id: "conversation", turns, spoilersAllowed: false });
const turn = (id, question) => ({ id, question, answer: "answer", status: "completed" });
function setup(api, currentCfi = "cfi", userId) {
  let id = 0;
  const hook = harness("hooks/useReaderChat.ts", {
    "../services/readerChatApiService": { default: api },
    "../services/createRequestId": { createRequestId: () => `request-${++id}` },
  });
  const renderChat = () => hook("book", () => currentCfi, userId);
  const jsx = (type, props) => ({ type, props });
  const component = harness("components/Reader/ReaderChat.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-i18next": { useTranslation: () => ({ t: key => key }) },
    "../../services/readerAiLimits": { readerAiLimits: { question: 10000 } },
  });
  const render = () => component({ chat: renderChat(), onClose() {} });
  render(); // Initial draft reset effect.
  return { renderChat, render, navigate(cfi) { currentCfi = cfi; } };
}
function find(node, predicate) {
  if (!node || typeof node !== "object") return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}
const input = tree => find(tree, node => node.type === "textarea");
const submit = tree => find(tree, node => node.type === "form").props.onSubmit({ preventDefault() {} });

test("slow first send clears immediately, renders pending, blocks duplicates and preserves new draft through success", async () => {
  const create = deferred(), response = deferred();
  let calls = 0;
  const s = setup({ create: () => create.promise, send: () => { calls++; return response.promise; } });
  input(s.render()).props.onChange({ target: { value: "First" } });
  submit(s.render());
  let tree = s.render();
  assert.equal(input(tree).props.value, "");
  assert.equal(input(tree).props.disabled, false);
  assert.equal(s.renderChat().pending.question, "First");
  assert.ok(find(tree, node => node.props?.role === "status"));
  assert.equal(s.renderChat().send("First"), false);
  input(tree).props.onChange({ target: { value: "Next draft" } });
  create.resolve(conversation([]));
  await flush();
  s.render();
  assert.equal(input(s.render()).props.value, "Next draft");
  submit(s.render());
  assert.equal(calls, 1);
  response.resolve(conversation([turn("request-1", "First")]));
  await flush();
  assert.equal(input(s.render()).props.value, "Next draft");
  assert.equal(s.renderChat().pending, null);
  assert.equal(s.renderChat().sending, false);
});

test("failure preserves optimistic message; retry reuses ID, preserves history and draft", async () => {
  const response = deferred();
  const requests = [];
  const old = turn("old", "Earlier");
  const api = {
    create: async () => conversation([old]),
    getById: async () => conversation([old]),
    send: (_book, _id, body) => { requests.push(body); return response.promise; },
  };
  const s = setup(api);
  input(s.render()).props.onChange({ target: { value: "Question" } });
  submit(s.render());
  await flush();
  response.reject(new Error("Offline"));
  await flush();
  const chat = s.renderChat();
  assert.equal(chat.pending.question, "Question");
  assert.equal(chat.error, "Offline");
  input(s.render()).props.onChange({ target: { value: "Draft" } });
  const retry = find(s.render(), node => node.type === "button" && node.props.children === "reader.retry");
  assert.ok(retry);
  api.send = async (_book, _id, body) => { requests.push(body); return conversation([old, turn(body.requestId, body.question)]); };
  retry.props.onClick();
  await flush();
  assert.equal(requests[0].requestId, requests[1].requestId);
  assert.deepEqual(s.renderChat().conversation.turns.map(t => t.id), ["old", "request-1"]);
  assert.equal(input(s.render()).props.value, "Draft");
});

test("creation failure retains the question and can retry with the same ID", async () => {
  const api = { create: async () => { throw new Error("Unavailable"); } };
  const s = setup(api);
  assert.equal(s.renderChat().send("Question"), true);
  await flush();
  assert.equal(s.renderChat().pending.question, "Question");
  assert.equal(s.renderChat().sending, false);
  assert.equal(s.renderChat().send("Another"), false);
  api.create = async () => conversation([]);
  api.send = async (_book, _id, body) => conversation([turn(body.requestId, body.question)]);
  assert.equal(s.renderChat().send("Question", s.renderChat().pending.id), true);
  await flush();
  assert.equal(s.renderChat().conversation.turns[0].id, "request-1");
  assert.equal(s.renderChat().pending, null);
});

test("a rejected submission leaves the draft intact", () => {
  const s = setup({}, "");
  input(s.render()).props.onChange({ target: { value: "Draft" } });
  submit(s.render());
  assert.equal(input(s.render()).props.value, "Draft");
  assert.equal(s.renderChat().pending, null);
});

test("a failed request recovered from history renders its saved message only once", async () => {
  const s = setup({
    create: async () => conversation([turn("old", "Earlier")]),
    send: async () => { throw new Error("Disconnected"); },
    getById: async () => conversation([
      turn("old", "Earlier"),
      { ...turn("request-1", "Question"), status: "failed" },
    ]),
  });
  s.renderChat().send("Question");
  await flush();
  let count = 0;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "p" && node.props.children === "Question") count++;
    [node.props?.children].flat(Infinity).forEach(visit);
  }
  visit(s.render());
  assert.equal(count, 1);
  assert.ok(find(s.render(), node => node.type === "button" && node.props.children === "reader.retry"));
});


test("attaching another passage preserves the same conversation and previous answers", async () => {
  let creates = 0;
  const sent = [];
  const old = turn("old", "Earlier");
  const s = setup({
    create: async () => { creates++; return conversation([old]); },
    send: async (_book, id, body) => {
      sent.push({ id, body });
      return { ...conversation([old, turn(body.requestId, body.question)]),
        passage: body.passageCfi ? { cfi: body.passageCfi, text: "New passage" } : undefined };
    },
  });
  s.renderChat().send("First");
  await flush();
  s.renderChat().attach({ cfi: "new-cfi", endCfi: "end-cfi", text: "New passage" });
  assert.equal(s.renderChat().conversation.turns[0].answer, "answer");
  s.renderChat().send("Explain this passage");
  await flush();
  assert.equal(creates, 1);
  assert.equal(sent[1].id, "conversation");
  assert.equal(sent[1].body.passageCfi, "new-cfi");
  assert.equal(sent[1].body.passageEndCfi, "end-cfi");
});

test("reload restores the account/book active conversation and New chat clears its pointer", async () => {
  const original = global.window;
  const storage = new Map();
  global.window = { localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } };
  try {
    let restores = 0;
    const api = {
      create: async () => conversation([]),
      send: async (_book, _id, body) => conversation([turn(body.requestId, body.question)]),
      getById: async (_book, id) => { restores++; assert.equal(id, "conversation"); return conversation([turn("saved", "Saved")]); },
    };
    const first = setup(api, "cfi", "alice");
    first.renderChat().send("Question");
    await flush();
    assert.equal(storage.get("roza-active-chat:alice:book"), "conversation");
    const reloaded = setup(api, "cfi", "alice");
    await flush();
    assert.equal(reloaded.renderChat().conversation.turns[0].id, "saved");
    assert.equal(restores, 1);
    const other = setup(api, "cfi", "bob");
    await flush();
    assert.equal(other.renderChat().conversation, null);
    assert.equal(restores, 1);
    reloaded.renderChat().start();
    assert.equal(storage.has("roza-active-chat:alice:book"), false);
    assert.equal(reloaded.renderChat().conversation, null);
  } finally { global.window = original; }
});

test("unavailable browser storage does not prevent sending or saving chats", async () => {
  const original = global.window;
  global.window = { get localStorage() { throw new Error("Storage blocked"); } };
  try {
    const s = setup({
      create: async () => conversation([]),
      send: async (_book, _id, body) => conversation([turn(body.requestId, body.question)]),
    }, "cfi", "alice");
    assert.equal(s.renderChat().send("Question"), true);
    await flush();
    assert.equal(s.renderChat().conversation.turns.length, 1);
    assert.equal(s.renderChat().error, "");
  } finally { global.window = original; }
});

test("context omissions are visible while saved transcript remains readable", async () => {
  const saved = { ...conversation([turn("old", "Earlier")]), contextOmittedTurns: 2 };
  const s = setup({ getById: async () => saved });
  await s.renderChat().open("conversation");
  assert.ok(find(s.render(), node => node.type === "p" && node.props.children === "reader.chat.contextLimited"));
  assert.ok(find(s.render(), node => node.type === "p" && node.props.children === "Earlier"));
});


test("Ask AI from lookup starts a new passage chat on desktop and mobile", () => {
  for (const mobile of [false, true]) {
    const selected = { cfi: "new-passage", endCfi: "end", text: "A different passage" };
    const started = [];
    let closed = 0, panel;
    const render = harness("hooks/reader/useReaderPanels.ts", {
      "react-dom": { flushSync: callback => callback() },
      "../../services/readerAiLimits": { readerAiLimits: { passage: 20000 } },
    }, "useReaderPanelActions");
    const actions = render({
      mobile, shell: { current: null }, closeLookup: () => closed++,
      setPanel: value => { panel = value; },
      chat: { start: passage => started.push(passage), attach: () => assert.fail("Must start a new chat") },
      textSelection: selected,
    });
    actions.askAi();
    assert.deepEqual(started, [selected]);
    assert.equal(panel, "chat");
    assert.equal(closed, 1);
  }
});


test("a summary failure is visible while the saved answer remains readable", async () => {
  const saved = { ...conversation([turn("old", "Question")]), contextSummaryFailed: true };
  const s = setup({ getById: async () => saved });
  await s.renderChat().open("conversation");
  assert.ok(find(s.render(), node => node.type === "p" && node.props.children === "reader.chat.summaryUnavailable"));
  assert.ok(find(s.render(), node => node.type === "p" && node.props.children === "answer"));
});

test("retry after navigation preserves the original position and spoiler setting", async () => {
  const requests = [];
  const api = {
    create: async () => conversation([]),
    getById: async () => conversation([]),
    send: async (_book, _id, body) => { requests.push(body); throw Error("offline"); },
  };
  const s = setup(api, "original-page");
  s.renderChat().send("Question");
  await flush();
  s.navigate("different-chapter");
  s.renderChat().setSpoilersAllowed(true);
  const pending = s.renderChat().pending;
  assert.equal(s.renderChat().send(pending.question, pending.id), true);
  await flush();
  assert.equal(requests[1].currentCfi, "original-page");
  assert.equal(requests[1].spoilersAllowed, false);
  assert.equal(requests[1].requestId, requests[0].requestId);
});

test("cross-chapter passage sends use its end boundary even while renderer is unavailable", async () => {
  let request;
  const s = setup({
    create: async () => conversation([]),
    send: async (_book, _id, body) => { request = body; return conversation([]); },
  }, "");
  s.renderChat().start({ cfi: "selection-start", endCfi: "selection-end", text: "Selected words" });
  assert.equal(s.renderChat().send("Explain"), true);
  await flush();
  assert.equal(request.currentCfi, "selection-end");
  assert.equal(request.passageCfi, "selection-start");
  assert.equal(request.passageEndCfi, "selection-end");
});

test("reopened failed turn retries its own passage rather than a newly attached one", async () => {
  let request;
  const original = { ...turn("failed", "Question"), status: "failed", currentCfi: "old-end",
    spoilersAllowed: false, passage: { cfi: "old-start", endCfi: "old-end", text: "Original words" } };
  const s = setup({
    getById: async () => conversation([original]),
    send: async (_book, _id, body) => { request = body; return conversation([original]); },
  }, "new-page");
  await s.renderChat().open("conversation");
  s.renderChat().attach({ cfi: "new-selection", text: "Other words" });
  assert.equal(s.renderChat().send("Question", "failed"), true);
  await flush();
  assert.equal(request.currentCfi, "old-end");
  assert.equal(request.passageCfi, "old-start");
  assert.equal(request.passageEndCfi, "old-end");
});


test("selected word can be submitted from the form without a typed question", async () => {
  let request;
  const selected = { cfi: "word-cfi", text: "screed" };
  const s = setup({
    create: async () => ({ ...conversation([]), passage: selected }),
    send: async (_book, _id, body) => {
      request = body;
      return { ...conversation([{ ...turn(body.requestId, ""), passage: selected }]), passage: selected };
    },
  }, "");
  s.renderChat().start(selected);
  const tree = s.render();
  const button = find(tree, node => node.type === "button" && node.props.type === "submit");
  assert.equal(button.props.disabled, false);
  assert.equal(input(tree).props.value, "");
  assert.equal(input(tree).props.placeholder, "reader.chat.optionalQuestion");
  submit(tree);
  await flush();
  assert.equal(request.question, "");
  assert.equal(request.passageCfi, "word-cfi");
  assert.equal(request.currentCfi, "word-cfi");
  assert.ok(find(s.render(), node => node.type === "p" && node.props.children === "screed"));
});

test("a selected paragraph with whitespace-only draft sends the selection without inventing a question", async () => {
  let request;
  const selected = { cfi: "start", endCfi: "end", text: "A long sentence with several clauses." };
  const s = setup({
    create: async () => ({ ...conversation([]), passage: selected }),
    send: async (_book, _id, body) => { request = body; return { ...conversation([]), passage: selected }; },
  });
  s.renderChat().start(selected);
  input(s.render()).props.onChange({ target: { value: "  \n " } });
  submit(s.render());
  await flush();
  assert.equal(request.question, "");
  assert.equal(request.passageEndCfi, "end");
});

test("a completely empty submission stays disabled and never creates a chat", () => {
  let creates = 0;
  const s = setup({ create: async () => { creates++; return conversation([]); } });
  assert.equal(find(s.render(), node => node.type === "button" && node.props.type === "submit").props.disabled, true);
  assert.equal(s.renderChat().send(""), false);
  submit(s.render());
  assert.equal(creates, 0);
});

test("selection-only retry retains its original selected word and request ID", async () => {
  const selected = { cfi: "word-cfi", text: "screed" };
  const requests = [];
  const api = {
    create: async () => ({ ...conversation([]), passage: selected }),
    getById: async () => ({ ...conversation([]), passage: selected }),
    send: async (_book, _id, body) => { requests.push(body); throw new Error("Offline"); },
  };
  const s = setup(api);
  s.renderChat().start(selected);
  assert.equal(s.renderChat().send(""), true);
  await flush();
  const pending = s.renderChat().pending;
  assert.equal(pending.question, "");
  assert.equal(pending.passage.text, "screed");
  s.navigate("different-page");
  api.send = async (_book, _id, body) => { requests.push(body); return { ...conversation([]), passage: selected }; };
  assert.equal(s.renderChat().send("", pending.id), true);
  await flush();
  assert.equal(requests[1].requestId, requests[0].requestId);
  assert.equal(requests[1].question, "");
  assert.equal(requests[1].passageCfi, "word-cfi");
  assert.equal(requests[1].currentCfi, "word-cfi");
});
