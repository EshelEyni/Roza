import { buildReaderHistory } from "./readerHistoryService";

const make = (id: string, overrides = {}) => ({
  id, question: "Question " + id, answer: "Answer " + id, status: "completed",
  currentCfi: "safe", spoilersAllowed: false, ...overrides,
});
const build = (turns: ReturnType<typeof make>[], question = "Follow up", requestId = "new", allow = false) =>
  buildReaderHistory(turns, requestId, question, "safe", allow, earlier => earlier === "safe");

describe("Reader source-aware history", () => {
  it("replays more than six pairs in chronological order with original assistant roles", () => {
    const history = build(Array.from({ length: 20 }, (_, i) => make(String(i))));
    expect(history.input).toHaveLength(40);
    expect(history.input[0]).toEqual({ role: "user", content: "Question 0" });
    expect(history.input[39]).toEqual({ role: "assistant", content: "Answer 19" });
    expect(history.omitted).toBe(0);
  });
  it("does not let an oversized recent turn hide smaller preceding turns", () => {
    const history = build([make("small"), make("large", { answer: "א".repeat(90000) })]);
    expect(history.input).toHaveLength(2);
    expect(history.input[0].content).toContain("small");
    expect(history.omitted).toBe(1);
  });
  it("recalls an older relevant pair beyond the recent window, preserving order", () => {
    const history = build([make("old", { question: "Explain Swann" }),
      ...Array.from({ length: 28 }, (_, i) => make(String(i)))], "What about Swann?");
    expect(history.input[0].content).toContain("Swann");
    expect(history.input).toHaveLength(50);
    expect(history.omitted).toBe(4);
  });
  it("includes original passage evidence and uses recent history for follow-up retrieval", () => {
    const history = build([make("one", {
      passage: { cfi: "safe", text: "The hawthorns flowered." },
      excerpts: [{ label: "Section 1", text: "Swann walked in the garden." }],
    })], "Why did he do that?");
    expect(history.input[0].content).toContain("hawthorns");
    expect(history.input[0].content).toContain("Section 1");
    expect(history.retrievalQuery).toContain("hawthorns");
  });
  it("excludes unsafe turns and failed turns, including attached passage boundaries", () => {
    const turns = [make("safe"), make("spoilers", { spoilersAllowed: true }),
      make("future", { currentCfi: "future" }), make("failed", { status: "failed" }),
      make("future-passage", { passage: { cfi: "safe", endCfi: "future", text: "Secret" } })];
    expect(build(turns).input).toHaveLength(2);
    expect(build(turns).omitted).toBe(3);
    expect(build(turns, "Question", "new", true).input).toHaveLength(8);
  });
  it("never injects later answers into a retry of an earlier failed request", () => {
    const result = build([make("one"), make("retry", { status: "failed" }), make("later")], "Again", "retry");
    expect(result.input).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("later");
  });
});
