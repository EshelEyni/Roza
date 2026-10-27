const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("../frontend/node_modules/typescript");
const source = fs.readFileSync(
  require("node:path").join(
    __dirname,
    "../frontend/src/services/observeReaderLayout.ts",
  ),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
function setup({ autoReport = true } = {}) {
  let observer;
  const timers = new Map();
  let id = 0;
  const listeners = new Map();
  const surface = {
    addEventListener: (name, cb) => listeners.set(name, cb),
    removeEventListener: name => listeners.delete(name),
  };
  const exported = {};
  new Function(
    "exports",
    "require",
    "ResizeObserver",
    "setTimeout",
    "clearTimeout",
    "requestAnimationFrame",
    "window",
    "document",
    compiled,
  )(
    exported,
    () => ({
      EpubCFI: class {
        compare(a, b) {
          return Number(a) - Number(b);
        }
      },
    }),
    class {
      constructor(cb) {
        observer = cb;
      }
      observe() {}
      disconnect() {}
    },
    (fn, delay) => {
      timers.set(++id, { fn, delay });
      return id;
    },
    key => timers.delete(key),
    cb => cb(),
    surface,
    surface,
  );
  const ref = current => ({ current });
  const runtime = {
    explicitNavigation: ref(false),
    changingLayout: ref(false),
    pendingResize: ref(),
    fullscreenResizeAnchor: ref(null),
    stateRef: ref({ location: "14" }),
    layoutTask: ref(Promise.resolve()),
    layoutVersion: ref(0),
    requestLayout: ref(null),
  };
  const pending = [];
  const targets = [];
  const events = new Map();
  let reports = 0;
  let errors = 0;
  let location = { start: { cfi: "13" }, end: { cfi: "15" } };
  const rendition = {
    resize() {},
    display(target) {
      targets.push(target);
      return new Promise(resolve => pending.push(resolve));
    },
    once(name, cb) {
      events.set(name, cb);
    },
    off(name, cb) {
      if (events.get(name) === cb) events.delete(name);
    },
    reportLocation() {
      reports++;
      if (autoReport) deliverReport();
      return Promise.resolve();
    },
  };
  function deliverReport() {
    const cb = events.get("relocated");
    events.delete("relocated");
    cb?.(location);
  }
  const cleanup = exported.observeReaderLayout(
    { clientWidth: 900, clientHeight: 700 },
    rendition,
    runtime,
    () => true,
    () => errors++,
    "error",
  );
  const flush = () => {
    for (const [key, timer] of [...timers])
      if (timer.delay === 100) {
        timers.delete(key);
        timer.fn();
      }
  };
  return {
    runtime,
    pending,
    targets,
    cleanup,
    listeners,
    events,
    deliverReport,
    timeout: () => {
      for (const timer of timers.values()) if (timer.delay === 3000) timer.fn();
    },
    resize: observer,
    flush,
    get reports() {
      return reports;
    },
    get errors() {
      return errors;
    },
    setLocation: value => (location = value),
  };
}
test("older resize cannot release the newer guard or overwrite its anchor", async () => {
  const s = setup();
  s.resize();
  s.flush();
  await tick();
  s.runtime.stateRef.current.location = "7";
  s.resize();
  s.flush();
  await tick();
  assert.equal(s.pending.length, 1, "resize work is serialized");
  s.pending.shift()();
  await tick();
  assert.equal(s.runtime.changingLayout.current, true);
  assert.equal(s.runtime.fullscreenResizeAnchor.current, "14");
  assert.deepEqual(s.targets, ["14", "14"]);
  s.pending.shift()();
  await tick();
  s.pending.shift()();
  await tick();
  assert.equal(s.runtime.changingLayout.current, false);
  assert.equal(s.runtime.fullscreenResizeAnchor.current, null);
  assert.equal(s.errors, 0);
  s.cleanup();
});
test("navigation invalidates pending resize restoration", async () => {
  const s = setup();
  s.resize();
  s.flush();
  await tick();
  s.runtime.explicitNavigation.current = true;
  s.runtime.layoutVersion.current++;
  s.runtime.fullscreenResizeAnchor.current = null;
  s.pending.shift()();
  await tick();
  assert.equal(s.targets.length, 1);
  assert.equal(s.reports, 0);
  s.cleanup();
});
test("unexpected passage never unlocks position saving", async () => {
  const s = setup();
  s.setLocation({ start: { cfi: "6" }, end: { cfi: "8" } });
  s.resize();
  s.flush();
  await tick();
  s.pending.shift()();
  await tick();
  s.pending.shift()();
  await tick();
  assert.equal(s.runtime.changingLayout.current, true);
  assert.equal(s.runtime.fullscreenResizeAnchor.current, "14");
  assert.equal(s.errors, 1);
  s.cleanup();
});
test("fullscreen browser event guards immediately and cleanup removes listeners", () => {
  const s = setup();
  s.listeners.get("fullscreenchange")();
  assert.equal(s.runtime.changingLayout.current, true);
  s.cleanup();
  assert.equal(s.listeners.size, 0);
});
test("disposing an in-flight resize does not report or release its guard", async () => {
  const s = setup();
  s.resize();
  s.flush();
  await tick();
  s.cleanup();
  s.pending.shift()();
  await tick();
  assert.equal(s.reports, 0);
  assert.equal(s.targets.length, 1);
});

test("preference reflow coalesces with resize and keeps the original anchor", async () => {
  const s = setup();
  s.resize();
  s.flush();
  await tick();
  s.runtime.requestLayout.current();
  s.flush();
  await tick();
  s.pending.shift()();
  await tick();
  assert.equal(s.runtime.changingLayout.current, true);
  assert.equal(s.runtime.fullscreenResizeAnchor.current, "14");
  s.pending.shift()();
  await tick();
  s.pending.shift()();
  await tick();
  assert.equal(s.runtime.changingLayout.current, false);
  assert.equal(s.errors, 0);
  s.cleanup();
  assert.equal(s.runtime.requestLayout.current, null);
});

test("resize during a seek waits and uses the new reading destination", async () => {
  const s = setup();
  s.runtime.explicitNavigation.current = true;
  s.resize();
  s.flush();
  await tick();
  assert.equal(s.pending.length, 0);
  s.runtime.explicitNavigation.current = false;
  s.runtime.stateRef.current.location = "30";
  s.setLocation({ start: { cfi: "29" }, end: { cfi: "31" } });
  s.flush();
  s.flush();
  await tick();
  assert.deepEqual(s.targets, ["30"]);
  s.pending.shift()();
  await tick();
  s.pending.shift()();
  await tick();
  assert.equal(s.runtime.changingLayout.current, false);
  assert.equal(s.errors, 0);
  s.cleanup();
});

test("saving waits for the relocated event, not reportLocation's promise", async () => {
  const s = setup({ autoReport: false });
  s.resize();
  s.flush();
  await tick();
  s.pending.shift()();
  await tick();
  s.pending.shift()();
  await tick();
  assert.equal(s.runtime.changingLayout.current, true);
  assert.equal(s.reports, 1);
  s.deliverReport();
  await tick();
  assert.equal(s.runtime.changingLayout.current, false);
  assert.equal(s.reports, 2);
  assert.equal(s.events.size, 0);
  s.cleanup();
});
test("missing relocation times out without saving and removes its listener", async () => {
  const s = setup({ autoReport: false });
  s.resize();
  s.flush();
  await tick();
  s.pending.shift()();
  await tick();
  s.pending.shift()();
  await tick();
  s.timeout();
  await tick();
  assert.equal(s.runtime.changingLayout.current, true);
  assert.equal(s.runtime.fullscreenResizeAnchor.current, "14");
  assert.equal(s.errors, 1);
  assert.equal(s.events.size, 0);
  s.cleanup();
});
