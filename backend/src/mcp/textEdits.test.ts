import type { ChapterAnnotation, SlateElement } from "../../../shared/types/stagingRoom";
import { applyEdits, followNotes, mergeNotes } from "./textEdits";

const p = (text: string, extra: Partial<SlateElement> = {}): SlateElement => ({ type: "paragraph", ...extra, children: [{ text }] });
const breakNode = p("* * *", { align: "center" });

const chapter = (): SlateElement[] => [
  { type: "paragraph", children: [{ text: "A:", bold: true }, { text: " Not yet." }] },
  p("She waited."),
  breakNode,
  { type: "dialogue", children: [{ text: "Loading...", italic: true }] },
  p("The end."),
];

describe("applyEdits", () => {
  test("changes one sentence and keeps every other node as it is", () => {
    const before = chapter();
    const { text } = applyEdits(before, [{ find: "She waited.", replace: "She waited, still." }]);
    expect(text[1]).toEqual(p("She waited, still."));
    for (const i of [0, 2, 3, 4]) expect(text[i]).toBe(before[i]);
  });

  test("matches and writes bold and italic Markdown", () => {
    const { text } = applyEdits(chapter(), [
      { find: "**A:** Not yet.", replace: "**A:** Not *yet*." },
      { find: "*Loading...*", replace: "*Loaded.*" },
    ]);
    expect(text[0].children).toEqual([{ text: "A:", bold: true }, { text: " Not " }, { text: "yet", italic: true }, { text: "." }]);
    // The screenplay type survives the edit.
    expect(text[3]).toEqual({ type: "dialogue", children: [{ text: "Loaded.", italic: true }] });
  });

  test("a blank line in replace makes a new paragraph of the same kind", () => {
    const { text } = applyEdits(chapter(), [{ find: "*Loading...*", replace: "*Loading...*\n\nDone" }]);
    expect(text.map((b) => b.type)).toEqual(["paragraph", "paragraph", "paragraph", "dialogue", "dialogue", "paragraph"]);
    expect(text[4].children).toEqual([{ text: "Done" }]);
  });

  test("can span paragraphs and keeps untouched paragraphs inside the range", () => {
    const before = chapter();
    const { text } = applyEdits(before, [{ find: "She waited.\n\n\\* \\* \\*\n\n*Loading...*", replace: "She waited.\n\n\\* \\* \\*" }]);
    expect(text).toHaveLength(4);
    expect(text[1]).toBe(before[1]);
    expect(text[2]).toBe(before[2]);
    expect(text[3]).toBe(before[4]);
  });

  test("an empty replace removes an emptied paragraph", () => {
    const { text } = applyEdits(chapter(), [{ find: "She waited.", replace: "" }]);
    expect(text).toHaveLength(4);
    expect(text.some((b) => JSON.stringify(b).includes("She waited"))).toBe(false);
  });

  test("a missing or repeated find fails and changes nothing", () => {
    const before = chapter();
    const copy = JSON.parse(JSON.stringify(before));
    expect(() => applyEdits(before, [{ find: "She waited.", replace: "x" }, { find: "nowhere", replace: "y" }])).toThrow(/Edit 2 of 2.*not found/);
    expect(() => applyEdits(before, [{ find: "e", replace: "x" }])).toThrow(/more than once/);
    expect(before).toEqual(copy);
  });

  test("later edits see earlier ones", () => {
    const { text } = applyEdits(chapter(), [
      { find: "The end.", replace: "The very end." },
      { find: "very", replace: "real" },
    ]);
    expect(text[4]).toEqual(p("The real end."));
  });

  test("refuses to empty the chapter", () => {
    expect(() => applyEdits([p("Only.")], [{ find: "Only.", replace: "" }])).toThrow(/empty/);
  });
});

describe("notes", () => {
  const note = (quote: string, extra: Partial<ChapterAnnotation> = {}): ChapterAnnotation => ({ id: quote, content: `On ${quote}`, quote, anchor: null, ...extra });

  test("follow their quote, and become general notes when it is gone", () => {
    const text = [p("Intro."), p("She waited.")];
    const anchored = note("waited", { anchor: { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 6 } } });
    const { notes, lost } = followNotes(text, [anchored, note("Intro"), note("gone"), note("", { general: true })]);
    expect(notes![0].anchor).toEqual({ anchor: { path: [1, 0], offset: 4 }, focus: { path: [1, 0], offset: 10 } });
    expect(notes![1]).toEqual(note("Intro"));
    expect(notes![2]).toMatchObject({ quote: "gone", general: true, anchor: null });
    expect(notes).toHaveLength(4);
    expect(lost).toEqual([{ content: "On gone", quote: "gone" }]);
  });

  test("new notes are added, not replacing old ones", () => {
    const merged = mergeNotes([note("a")], [note("a"), note("b")]);
    expect(merged!.map((n) => n.quote)).toEqual(["a", "b"]);
  });
});
