import {
  defaultReaderAiSettings,
  validateReaderAiSettings,
  readerStyleInstructions,
} from "./readerAiSettingsService";

describe("Reader AI instructions", () => {
  it("defaults to complete, simple explanations without a fixed paragraph cap", () => {
    expect(defaultReaderAiSettings.answerLength).toBe("standard");
    const instructions = readerStyleInstructions(defaultReaderAiSettings);
    expect(instructions).toContain("complete explanation");
    expect(instructions).not.toContain("under 80 words");
    expect(instructions).toContain("simple everyday words");
    expect(readerStyleInstructions({ ...defaultReaderAiSettings, answerLength: "short" })).toContain("explicitly asks for more detail");
  });
  it("includes user instructions as preferences and applies the chosen length", () => {
    const instructions = readerStyleInstructions({
      answerLength: "standard",
      simpleLanguage: false,
      customInstructions: "Explain metaphors.",
    });
    expect(instructions).toContain("Explain metaphors.");
    expect(instructions).toContain("complete explanation");
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
      { ...defaultReaderAiSettings, model: "arbitrary-model" },
      { ...defaultReaderAiSettings, answerLength: "unlimited" },
      { ...defaultReaderAiSettings, simpleLanguage: "true" },
      { ...defaultReaderAiSettings, customInstructions: "x".repeat(8001) },
    ])
      expect(() => validateReaderAiSettings(value)).toThrow();
  });
});
