import {
  defaultReaderAiSettings,
  validateReaderAiSettings,
  readerStyleInstructions,
} from "./readerAiSettingsService";

describe("Reader AI instructions", () => {
  it("defaults to short, simple answers without changing spoiler or language rules", () => {
    expect(defaultReaderAiSettings.answerLength).toBe("short");
    const instructions = readerStyleInstructions(defaultReaderAiSettings);
    expect(instructions).toContain("2–4 short sentences");
    expect(instructions).toContain("under 80 words");
    expect(instructions).toContain("simple everyday words");
    expect(instructions).toContain("explicitly asks for more detail");
  });
  it("includes user instructions as preferences and applies the chosen length", () => {
    const instructions = readerStyleInstructions({
      answerLength: "standard",
      simpleLanguage: false,
      customInstructions: "Explain metaphors.",
    });
    expect(instructions).toContain("Explain metaphors.");
    expect(instructions).toContain("one or two short paragraphs");
    expect(instructions).toContain("compatible");
    expect(instructions).not.toContain("2–4 short sentences");
  });
  it("validates values and does not persist unrecognized fields", () => {
    expect(
      validateReaderAiSettings({
        ...defaultReaderAiSettings,
        userId: "attacker",
        customInstructions: "  Briefly explain metaphors. ",
      }),
    ).toEqual({ ...defaultReaderAiSettings, customInstructions: "Briefly explain metaphors." });
    for (const value of [
      null,
      {},
      { ...defaultReaderAiSettings, answerLength: "unlimited" },
      { ...defaultReaderAiSettings, simpleLanguage: "true" },
      { ...defaultReaderAiSettings, customInstructions: "x".repeat(1501) },
    ])
      expect(() => validateReaderAiSettings(value)).toThrow();
  });
});
