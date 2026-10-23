import { lookupReaderWord, normalizeReaderWord } from "./readerDictionaryService";

describe("Local English–Hebrew dictionary", () => {
  it("returns real Hebrew meanings and source information", () => {
    const entry = lookupReaderWord("Child");
    expect(entry?.headword).toBe("child");
    expect(
      entry?.senses.some(sense => sense.meanings.some(text => /[\u0590-\u05ff]/.test(text))),
    ).toBe(true);
    expect(entry?.source).toBe("Wiktionary");
    expect(entry?.attribution?.license).toBe("CC BY-SA 4.0");
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
    expect(entry.senses.some(sense => sense.definition.length)).toBe(true);
  });

  it("adds Wiktionary translations and attested regular forms", () => {
    const book = lookupReaderWord("book")!;
    expect(book.source).toBe("Wiktionary");
    expect(book.senses.some(sense => sense.meanings.includes("סֵפֶר"))).toBe(true);
    expect(lookupReaderWord("books")?.headword).toBe("book");
    expect(book.attribution?.url).toBe("https://en.wiktionary.org/wiki/book#English");
    expect(
      book.senses.every(sense => sense.sourceUrl?.startsWith("https://en.wiktionary.org/wiki/")),
    ).toBe(true);
  });

  it("does not manufacture translations by stripping suffixes from unrelated words", () => {
    expect(lookupReaderWord("news")?.headword).toBe("news");
    expect(lookupReaderWord("dictionarying")).toBeNull();
    expect(lookupReaderWord("bookishzzz")).toBeNull();
  });

  it("retains WordNet-only words and safely handles legitimate prototype-named words", () => {
    const fallback = lookupReaderWord("running")!;
    expect(fallback.source).toContain("WordNet");
    const constructor = lookupReaderWord("constructor");
    expect(Array.isArray(constructor?.senses)).toBe(true);
  });
});
