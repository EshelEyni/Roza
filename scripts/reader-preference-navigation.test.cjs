const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");
const code = ts.transpileModule(
  fs.readFileSync(
    path.join(__dirname, "../frontend/src/hooks/reader/useEpubPreferences.ts"),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
function setup(display = () => Promise.resolve(), initialPreferences) {
  let scheduled;
  const calls = { display: [], report: 0, errors: [] };
  const rendition = {
    display: (cfi) => {
      calls.display.push(cfi);
      return display();
    },
    reportLocation: () => calls.report++,
  };
  const ref = (current) => ({ current });
  const runtime = {
    renditionRef: ref(rendition),
    appliedPreferences: ref(initialPreferences),
    stateRef: ref({ location: "old" }),
    changingLayout: ref(false),
    explicitNavigation: ref(false),
    layoutTask: ref(Promise.resolve()),
    navigationVersion: ref(0),
    rsvpActive: ref(false),
  };
  const exports = {};
  const dependencies = {
    react: { useEffect: (effect) => effect() },
    "react-i18next": { useTranslation: () => ({ t: (key) => key }) },
    "../../services/readerPreferences": { applyPreferences: () => {} },
  };
  new Function("exports", "require", "setTimeout", "clearTimeout", code)(
    exports,
    (name) => dependencies[name],
    (callback) => {
      scheduled = callback;
      return 1;
    },
    () => {},
  );
  exports.useEpubPreferences(runtime, { fontSize: 18 }, false, (error) =>
    calls.errors.push(error),
  );
  return { runtime, calls, run: () => scheduled?.(), isScheduled: () => !!scheduled };
}
test("opening with preferences already applied does not queue another display", () => {
  const { runtime, calls, isScheduled } = setup(undefined, { fontSize: 18 });
  assert.equal(isScheduled(), false);
  assert.equal(runtime.changingLayout.current, false);
  assert.deepEqual(calls.display, []);
});
test("queued preference display cannot replay a CFI after a newer navigation", () => {
  const { runtime, calls, run } = setup();
  runtime.navigationVersion.current++;
  runtime.stateRef.current.location = "restored-sentence";
  runtime.changingLayout.current = false;
  run();
  assert.deepEqual(calls.display, []);
  assert.equal(runtime.changingLayout.current, false);
});
test("hidden Sentence Mode preferences do not display or persist another page", () => {
  const { runtime, calls, run } = setup();
  runtime.rsvpActive.current = true;
  run();
  assert.deepEqual(calls.display, []);
  assert.equal(calls.report, 0);
});
test("current preference display resolves its anchor when the queued task runs", async () => {
  const { runtime, calls, run } = setup();
  runtime.stateRef.current.location = "current-sentence";
  run();
  await runtime.layoutTask.current;
  assert.deepEqual(calls.display, ["current-sentence"]);
  assert.equal(calls.report, 1);
});
for (const failed of [false, true])
  test(
    "superseded preference " +
      (failed ? "failure" : "completion") +
      " cannot release newer navigation guards",
    async () => {
      let resolve, reject;
      const pending = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const { runtime, calls, run } = setup(() => pending);
      run();
      runtime.navigationVersion.current++;
      runtime.changingLayout.current = true;
      if (failed) reject(Error("old display failed"));
      else resolve();
      await runtime.layoutTask.current;
      assert.equal(runtime.changingLayout.current, true);
      assert.equal(calls.report, 0);
      assert.deepEqual(calls.errors, []);
    },
  );
