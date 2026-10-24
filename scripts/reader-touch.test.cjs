const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");
const source = fs.readFileSync(
  path.join(__dirname, "../frontend/src/services/readerTouch.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exported = {};
new Function("exports", compiled)(exported);

function setup(overrides = {}) {
  const doc = new EventTarget();
  let selection = "";
  doc.getSelection = () => ({ toString: () => selection });
  const calls = [];
  const options = {
    enabled: () => true,
    paginated: () => true,
    blocked: () => false,
    selected: () => false,
    dismissSelection: () => calls.push("dismiss"),
    move: (d) => calls.push(d),
    ...overrides,
  };
  const cleanup = exported.bindReaderTouch(doc, options);
  function send(type, x = 200, y = 200, fingers = 1) {
    const event = new Event(type, { cancelable: true });
    event.touches =
      type === "touchend"
        ? []
        : Array.from({ length: fingers }, () => ({ clientX: x, clientY: y }));
    event.changedTouches = [{ clientX: x, clientY: y }];
    doc.dispatchEvent(event);
    return event;
  }
  return {
    doc,
    calls,
    send,
    cleanup,
    select: (text) => {
      selection = text;
    },
  };
}
test("short horizontal swipes turn exactly one English page in either direction", () => {
  const s = setup();
  s.send("touchstart");
  s.send("touchmove", 100, 205);
  const next = s.send("touchend", 100, 205);
  s.send("touchstart");
  s.send("touchmove", 300, 200);
  s.send("touchend", 300, 200);
  assert.deepEqual(s.calls, ["next", "prev"]);
  assert.equal(next.defaultPrevented, true);
});
test("a stationary tap preserves native behavior without navigating", () => {
  const s = setup();
  s.send("touchstart");
  const end = s.send("touchend");
  assert.deepEqual(s.calls, []);
  assert.equal(end.defaultPrevented, false);
});
test("vertical scrolls, diagonal movement and small drags never paginate", () => {
  for (const [x, y] of [
    [205, 300],
    [260, 280],
    [220, 200],
  ]) {
    const s = setup();
    s.send("touchstart");
    s.send("touchmove", x, y);
    s.send("touchend", x, y);
    assert.deepEqual(s.calls, []);
  }
});
test("long presses are reserved for native text selection", (context) => {
  let time = 1000;
  context.mock.method(Date, "now", () => time);
  const s = setup();
  s.send("touchstart");
  time += 700;
  s.send("touchend");
  assert.deepEqual(s.calls, []);
});
test("selection handles and new selections do not turn pages", () => {
  for (const existing of [true, false]) {
    const s = setup();
    if (existing) s.select("word");
    s.send("touchstart");
    s.select("some words");
    s.send("touchmove", 100, 200);
    s.send("touchend", 100, 200);
    assert.deepEqual(s.calls, []);
  }
});
test("a tap clearing a selection dismisses actions without navigating", () => {
  const s = setup({ selected: () => true });
  s.send("touchstart");
  s.send("touchend");
  assert.deepEqual(s.calls, ["dismiss"]);
});
test("multi-touch and cancelled gestures never navigate", () => {
  const s = setup();
  s.send("touchstart", 200, 200, 2);
  s.send("touchend", 100, 200);
  s.send("touchstart");
  s.send("touchmove", 100, 200, 2);
  s.send("touchend", 100, 200);
  s.send("touchstart");
  s.send("touchcancel");
  s.send("touchend", 100, 200);
  assert.deepEqual(s.calls, []);
});
test("disabled reader and open sheets block gestures; scrolling mode does not paginate", () => {
  for (const overrides of [
    { enabled: () => false },
    { blocked: () => true },
    { paginated: () => false },
  ]) {
    const s = setup(overrides);
    s.send("touchstart");
    s.send("touchmove", 100, 200);
    s.send("touchend", 100, 200);
    assert.deepEqual(s.calls, []);
  }
});
test("cleanup detaches every touch listener", () => {
  const s = setup();
  s.cleanup();
  s.send("touchstart");
  s.send("touchend");
  assert.deepEqual(s.calls, []);
});

test("ordinary taps and follow-up clicks pass through to native handlers", () => {
  const s = setup();
  let accidentalTurns = 0;
  s.doc.addEventListener("touchend", () => accidentalTurns++);
  s.doc.addEventListener("click", () => accidentalTurns++);
  s.send("touchstart");
  s.send("touchend");
  const click = new Event("click", { cancelable: true });
  Object.defineProperty(click, "detail", { value: 1 });
  s.doc.dispatchEvent(click);
  assert.deepEqual(s.calls, []);
  assert.equal(accidentalTurns, 2);
  assert.equal(click.defaultPrevented, false);
});

test("swipe click suppression expires and preserves keyboard activation", (context) => {
  let time = 1000;
  context.mock.method(Date, "now", () => time);
  const s = setup();
  s.send("touchstart");
  s.send("touchmove", 100, 200);
  s.send("touchend", 100, 200);
  let clicks = 0;
  s.doc.addEventListener("click", () => clicks++);
  const keyboardClick = new Event("click", { cancelable: true });
  Object.defineProperty(keyboardClick, "detail", { value: 0 });
  s.doc.dispatchEvent(keyboardClick);
  time += 600;
  const laterClick = new Event("click", { cancelable: true });
  Object.defineProperty(laterClick, "detail", { value: 1 });
  s.doc.dispatchEvent(laterClick);
  assert.equal(clicks, 2);
  assert.equal(laterClick.defaultPrevented, false);
});

test("horizontal swipes prevent native scrolling before touchend", () => {
  const s = setup();
  s.send("touchstart");
  const move = s.send("touchmove", 175, 202);
  assert.equal(move.defaultPrevented, true);
  assert.deepEqual(s.calls, []);
  s.send("touchend", 100, 202);
  assert.deepEqual(s.calls, ["next"]);
});

test("native selection, scrolling, zoom and long presses keep touchmove defaults", (context) => {
  let time = 1000;
  context.mock.method(Date, "now", () => time);
  for (const mode of ["vertical", "selection", "longpress", "zoom", "scrolled", "blocked"]) {
    const s = setup({ paginated: () => mode !== "scrolled", blocked: () => mode === "blocked" });
    s.send("touchstart");
    if (mode === "selection") s.select("word");
    if (mode === "longpress") time += 700;
    const move = mode === "vertical"
      ? s.send("touchmove", 202, 275)
      : s.send("touchmove", 100, 202, mode === "zoom" ? 2 : 1);
    assert.equal(move.defaultPrevented, false, mode);
    s.cleanup();
  }
});

test("a gesture starting vertically cannot later become a page turn", () => {
  const s = setup();
  s.send("touchstart");
  s.send("touchmove", 202, 230);
  const move = s.send("touchmove", 80, 230);
  s.send("touchend", 80, 230);
  assert.equal(move.defaultPrevented, false);
  assert.deepEqual(s.calls, []);
});
test("mobile reader suppresses native context menu without clearing selection", () => {
  const s = setup();
  s.select("selected words");
  const menu = new Event("contextmenu", { cancelable: true });
  s.doc.dispatchEvent(menu);
  assert.equal(menu.defaultPrevented, true);
  assert.equal(s.doc.getSelection().toString(), "selected words");
  assert.deepEqual(s.calls, []);
  s.cleanup();
  const after = new Event("contextmenu", { cancelable: true });
  s.doc.dispatchEvent(after);
  assert.equal(after.defaultPrevented, false);
});

test("desktop and blocked reader leave the context menu available", () => {
  for (const overrides of [{ enabled: () => false }, { blocked: () => true }]) {
    const s = setup(overrides);
    const menu = new Event("contextmenu", { cancelable: true });
    s.doc.dispatchEvent(menu);
    assert.equal(menu.defaultPrevented, false);
  }
});