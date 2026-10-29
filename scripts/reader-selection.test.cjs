const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../frontend/src", file), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  new Function("require", "exports", code)(name => dependencies[name], exports);
  return exports;
}

function setup(onBeforeSelection) {
  const states = [];
  const { useReaderSelection } = load("hooks/reader/useReaderSelection.ts", {
    react: {
      useCallback: callback => callback,
      useEffect: () => {},
      useRef: initial => ({ current: initial }),
      useState: initial => {
        const index = states.length;
        states.push(initial);
        return [initial, value => { states[index] = value; }];
      },
    },
    "react-i18next": { useTranslation: () => ({ t: key => key }) },
    "../../services/readerAiLimits": { readerAiLimits: { passage: 12000 } },
  });
  const selection = useReaderSelection(onBeforeSelection);
  let text = "word";
  const doc = new EventTarget();
  doc.getSelection = () => ({
    toString: () => text,
    removeAllRanges: () => { text = ""; },
  });
  doc.defaultView = {
    frameElement: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
  };
  selection.select("cfi", {
    document: doc,
    range: () => ({
      toString: () => text,
      getBoundingClientRect: () => ({ left: 0, bottom: 10 }),
    }),
  });
  doc.addEventListener("selectionchange", () => selection.onSelectionChange(doc));
  const turns = [];
  const { bindReaderTouch } = load("services/readerTouch.ts");
  bindReaderTouch(doc, {
    enabled: () => true,
    paginated: () => true,
    blocked: () => false,
    selected: () => !!states[0],
    dismissSelection: selection.closeLookup,
    move: direction => turns.push(direction),
  });
  function send(type, x) {
    const event = new Event(type, { cancelable: true });
    const touch = { clientX: x, clientY: 100 };
    event.touches = type === "touchend" ? [] : [touch];
    event.changedTouches = [touch];
    doc.dispatchEvent(event);
    return event;
  }
  return {
    states, turns, send, selection, doc,
    changeSelection(value) {
      text = value;
      doc.dispatchEvent(new Event("selectionchange"));
    },
    swipe() {
      send("touchstart", 200);
      const move = send("touchmove", 100);
      const end = send("touchend", 100);
      return { move, end };
    },
  };
}

test("clearing native selection restores the very next swipe without an extra tap", () => {
  const s = setup();
  s.changeSelection("");
  assert.equal(s.states[0], null);
  const { end } = s.swipe();
  assert.deepEqual(s.turns, ["next"]);
  assert.equal(end.defaultPrevented, true);
});

test("dictionary backdrop dismissal clears native selection and restores repeated swipes", () => {
  const s = setup();
  // The mobile ReaderSheet backdrop calls this without a touch in the EPUB document.
  s.selection.closeLookup();
  assert.equal(s.states[0], null);
  assert.equal(s.doc.getSelection().toString(), "");
  s.swipe();
  s.swipe();
  assert.deepEqual(s.turns, ["next", "next"]);
  s.selection.closeLookup();
});

test("active selection and handle movement keep native touch behavior", () => {
  const s = setup();
  const selected = s.states[0];
  s.changeSelection("word extended");
  assert.equal(s.states[0], selected);
  const { move, end } = s.swipe();
  assert.deepEqual(s.turns, []);
  assert.equal(move.defaultPrevented, false);
  assert.equal(end.defaultPrevented, false);
});

test("a gesture started on selection cannot turn a page when selection clears mid-drag", () => {
  const s = setup();
  s.send("touchstart", 200);
  s.changeSelection("");
  s.send("touchmove", 100);
  s.send("touchend", 100);
  assert.deepEqual(s.turns, []);
  s.swipe();
  assert.deepEqual(s.turns, ["next"]);
});

test("new native selection clears locator marks before publishing the range", () => {
  let cleared = 0;
  setup(() => cleared++);
  assert.equal(cleared, 1);
});
