import { readerInstructionText } from "./readerInstructionService";
import { readerStyleInstructionSections } from "./readerAiSettingsService";

describe("Named nested reader instructions", () => {
  it("serializes active sentence leaves in order without leaking inactive branches or object labels", () => {
    const text = readerInstructionText({
      role: { identity: "Reading companion.", inactive: undefined },
      nested: { task: { selection: "Explain the selection.", unavailable: undefined } },
      end: "Use Hebrew.",
    });
    expect(text).toBe("Reading companion.\nExplain the selection.\nUse Hebrew.");
    expect(text).not.toContain("[object Object]");
    expect(text).not.toContain("undefined");
  });
  it("keeps style branches readable while sending only the chosen length and terminology", () => {
    const sections = readerStyleInstructionSections({
      answerLength: "short", simpleLanguage: true, customInstructions: "",
    });
    const text = readerInstructionText(sections);
    expect(text).toContain("under 80 words");
    expect(text).toContain("Explain necessary literary terms briefly");
    expect(text).not.toContain("Give a thorough, organized explanation");
    expect(text).not.toContain("Give a complete explanation");
    expect(text).not.toContain("Use literary terminology when it helps");
  });
});
