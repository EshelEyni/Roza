import { lookupReaderWord, normalizeReaderWord } from "./readerDictionaryService";

describe("Local English–Hebrew dictionary", () => {
  it("returns real Hebrew meanings and source information", () => {
    const entry = lookupReaderWord("Child");
    expect(entry?.headword).toBe("child");
    expect(
      entry?.senses.some(sense => sense.meanings.some(text => /[\u0590-\u05ff]/.test(text))),
    ).toBe(true);
    expect(entry?.source).toContain("WordNet");
    expect(entry?.senses.some(sense => sense.definition)).toBe(true);
  });
  it("resolves attested irregular inflections and normalizes casing", () => {
    expect(lookupReaderWord("CHILDREN")?.headword).toBe("child");
    expect(normalizeReaderWord("  Reader’s  ")).toBe("reader's");
  });
  it("does not invent translations for missing words, phrases or prototype keys", () => {
    for (const word of ["zzzxxyy", "two words", "__proto__", "toString"]) {
      expect(lookupReaderWord(word)).toBeNull();
    }
  });
  it("preserves separate senses and available explanations", () => {
    const entry = lookupReaderWord("child")!;
    expect(new Set(entry.senses.map(sense => sense.id)).size).toBe(entry.senses.length);
    expect(entry.senses.some(sense => sense.explanations.length)).toBe(true);
  });
});
