import { ReaderConversationModel } from "../readerConversationModel";

const conversation = (question: string, passage?: { cfi: string; text: string }) => new ReaderConversationModel({
  userId: "507f1f77bcf86cd799439011", bookId: "507f1f77bcf86cd799439012", title: "Chat",
  turns: [{ id: "request-id", question, passage, currentCfi: "saved-cfi", spoilersAllowed: false, status: "pending" }],
});
describe("Selection-only saved chat turns", () => {
  it("allows an empty question when the exact selected passage is saved", () => {
    const saved = conversation("", { cfi: "word-cfi", text: "screed" });
    expect(saved.validateSync()).toBeUndefined();
    expect(saved.turns[0].question).toBe("");
    expect(saved.turns[0].passage?.text).toBe("screed");
  });
  it("rejects a saved turn with neither a question nor selected text", () => {
    expect(conversation("").validateSync()).toBeDefined();
    expect(conversation("  ", { cfi: "word-cfi", text: "  " }).validateSync()).toBeDefined();
  });
  it("still saves ordinary questions without a selected passage", () => {
    expect(conversation("Explain the narrator's jealousy.").validateSync()).toBeUndefined();
  });
});
