import { countWords, markdownToSlate, parseInline, slateToMarkdown, slateToPlainText } from "./slateMarkdown";

test("converts Markdown blocks to ROZA Slate blocks", () => {
  const slate = markdownToSlate(
    "# Part One\n\n## The Gate\n\nShe *ran*.\nHe **stayed**.\n\n> A quote\n\n- one\n- two\n\n1. first\n2. second\n\n***\n\nEnd",
  );
  expect(slate).toEqual([
    { type: "heading-one", children: [{ text: "Part One" }] },
    { type: "heading-two", children: [{ text: "The Gate" }] },
    { type: "paragraph", children: [{ text: "She " }, { text: "ran", italic: true }, { text: "." }] },
    { type: "paragraph", children: [{ text: "He " }, { text: "stayed", bold: true }, { text: "." }] },
    { type: "block-quote", children: [{ text: "A quote" }] },
    {
      type: "bulleted-list",
      children: [
        { type: "list-item", children: [{ text: "one" }] },
        { type: "list-item", children: [{ text: "two" }] },
      ],
    },
    {
      type: "numbered-list",
      children: [
        { type: "list-item", children: [{ text: "first" }] },
        { type: "list-item", children: [{ text: "second" }] },
      ],
    },
    { type: "paragraph", align: "center", children: [{ text: "* * *" }] },
    { type: "paragraph", children: [{ text: "End" }] },
  ]);
});

test("parses nested and combined inline marks", () => {
  expect(parseInline("a ***b*** c **d** ***e*** <u>f</u> snake_case_word \\*g\\*")).toEqual([
    { text: "a " },
    { text: "b", bold: true, italic: true },
    { text: " c " },
    { text: "d", bold: true },
    { text: " " },
    { text: "e", bold: true, italic: true },
    { text: " " },
    { text: "f", underline: true },
    { text: " snake_case_word *g*" },
  ]);
});

test("keeps Hebrew text and empty input", () => {
  expect(markdownToSlate("שלום **עולם**")).toEqual([
    { type: "paragraph", children: [{ text: "שלום " }, { text: "עולם", bold: true }] },
  ]);
  expect(markdownToSlate("  \n\n")).toEqual([{ type: "paragraph", children: [{ text: "" }] }]);
});

test("Slate to Markdown round-trips formatting and literal symbols", () => {
  const source = [
    { type: "heading-one", children: [{ text: "Title" }] },
    { type: "paragraph", children: [{ text: "Plain *star* and " }, { text: "bold", bold: true }, { text: " " }, { text: "it", italic: true, underline: true }] },
    { type: "paragraph", children: [{ text: "- not a list" }] },
    { type: "paragraph", children: [{ text: "3. not numbered" }] },
    { type: "block-quote", children: [{ text: "Quoted" }] },
    { type: "bulleted-list", children: [{ type: "list-item", children: [{ text: "x" }] }] },
  ];
  const markdown = slateToMarkdown(source);
  expect(markdown).toContain("**bold** ");
  expect(markdownToSlate(markdown)).toEqual(source);
});

test("counts words in Slate text", () => {
  const slate = markdownToSlate("One two, three.\n\n— four — 5");
  expect(slateToPlainText(slate)).toBe("One two, three.\n— four — 5");
  expect(countWords(slateToPlainText(slate))).toBe(5);
});
