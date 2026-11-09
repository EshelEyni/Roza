const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");
const React = require("../frontend/node_modules/react");
const {
  renderToStaticMarkup,
} = require("../frontend/node_modules/react-dom/server");
require.extensions[".tsx"] = (module, file) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    file,
  );
const {
  ManuscriptText,
} = require("../frontend/src/components/WritingStudio/ManuscriptText.tsx");
test("details preview preserves nested lists, combined marks, alignment and escaped text", () => {
  const value = [
    {
      type: "paragraph",
      align: "right",
      children: [
        {
          text: "<script>not markup</script>",
          bold: true,
          italic: true,
          underline: true,
        },
      ],
    },
    {
      type: "numbered-list",
      children: [{ type: "list-item", children: [{ text: "A list item" }] }],
    },
  ];
  const html = renderToStaticMarkup(
    React.createElement(ManuscriptText, { value }),
  );
  assert.match(html, /text-align:right/);
  assert.match(html, /<u><em><strong>&lt;script&gt;/);
  assert.match(html, /<ol><li/);
  assert.ok(html.includes("A list item"));
  assert.ok(!html.includes("<script>"));
});
test("studio and overview styling only reference existing application palette tokens", () => {
  const css = fs.readFileSync(
    path.join(
      __dirname,
      "../frontend/src/components/WritingStudio/writingStudio.css",
    ),
    "utf8",
  );
  assert.equal(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(css), false);
  const palette = require("../frontend/tailwind.config.cjs").theme.extend
    .colors;
  const referenced = [...css.matchAll(/theme\("colors\.([^"]+)"\)/g)].map(
    (match) => match[1],
  );
  assert.ok(referenced.length > 15);
  for (const token of referenced)
    assert.ok(palette[token], `Missing app color: ${token}`);
});
