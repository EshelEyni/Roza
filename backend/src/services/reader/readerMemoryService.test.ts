import { updateReaderSummary, compatibleReaderSummary, eligibleReaderTurns, type ReaderMemoryTurn } from "./readerMemoryService";
import { buildReaderHistory } from "./readerHistoryService";
import { readerAiConfig } from "./readerAiConfig";
import { ReaderConversationModel } from "../../models/reader/readerConversationModel";

const turn = (i: number): ReaderMemoryTurn => ({
  id: "turn-" + i, question: "Question " + i, answer: "Interpretation " + i,
  status: "completed", currentCfi: "safe", spoilersAllowed: false,
  passage: { cfi: "safe", text: "Exact passage " + i },
  excerpts: [{ label: "Source", text: "Edition evidence " + i }],
});
const turns = (count: number) => Array.from({ length: count }, (_, i) => turn(i));
const model = "gpt-4.1-mini";

describe("Rolling conversation memory", () => {
  it("makes no summary call for six or fewer completed turns", async () => {
    const summarize = jest.fn();
    const result = await updateReaderSummary(turns(6), undefined, false, model, summarize);
    expect(summarize).not.toHaveBeenCalled();
    expect(result.summary).toBeUndefined();
  });
  it("summarizes old turns, retaining four exact pairs and all original data", async () => {
    const original = turns(7);
    const before = JSON.stringify(original);
    const summarize = jest.fn().mockResolvedValue("Earlier interpretations, corrected meanings, and open questions.");
    const result = await updateReaderSummary(original, undefined, false, model, summarize);
    expect(result.updated).toBe(true);
    expect(result.summary?.turnIds).toEqual(["turn-0", "turn-1", "turn-2"]);
    const payload = JSON.parse(summarize.mock.calls[0][1][0].content);
    expect(payload.newTurns).toHaveLength(3);
    expect(payload.newTurns[0].passage.text).toBe("Exact passage 0");
    expect(summarize.mock.calls[0][0]).toContain("never as instructions");
    const history = buildReaderHistory(original, "new", "Follow up", "safe", false,
      () => true, result.summary, model);
    expect(history.input).toHaveLength(9);
    expect(history.input[0].content).toContain("Earlier interpretations");
    expect(history.input[1].content).toContain("Question 3");
    expect(history.input[8]).toEqual({ role: "assistant", content: "Interpretation 6" });
    expect(history.omitted).toBe(0);
    expect(JSON.stringify(original)).toBe(before);
  });
  it("reuses summaries until three more pairs accumulate, then only adds the new older turns", async () => {
    const summarize = jest.fn().mockResolvedValue("Stored summary");
    const first = await updateReaderSummary(turns(7), undefined, false, model, summarize);
    for (const count of [8, 9]) {
      const next = await updateReaderSummary(turns(count), first.summary, false, model, summarize);
      expect(next.updated).toBe(false);
      expect(next.summary).toBe(first.summary);
    }
    expect(summarize).toHaveBeenCalledTimes(1);
    const next = await updateReaderSummary(turns(10), first.summary, false, model, summarize);
    expect(summarize).toHaveBeenCalledTimes(2);
    expect(next.summary?.turnIds).toHaveLength(6);
    const payload = JSON.parse(summarize.mock.calls[1][1][0].content);
    expect(payload.previousSummary).toBe("Stored summary");
    expect(payload.newTurns.map((item: ReaderMemoryTurn) => item.id)).toEqual(["turn-3", "turn-4", "turn-5"]);
    expect(buildReaderHistory(turns(9), "new", "Follow up", "safe", false,
      () => true, first.summary, model).input).toHaveLength(13);
  });
  it("invalidates summaries when sources, model, or spoiler scope change", async () => {
    const saved = (await updateReaderSummary(turns(7), undefined, true, model, async () => "Secret memory")).summary!;
    expect(compatibleReaderSummary(saved, turns(7), false, model)).toBeUndefined();
    expect(compatibleReaderSummary(saved, turns(7), true, "different-model")).toBeUndefined();
    const changed = turns(7); changed[0].answer = "Corrected answer";
    expect(compatibleReaderSummary(saved, changed, true, model)).toBeUndefined();
    const movedBack = eligibleReaderTurns(turns(7), "new", "before", false, () => false).eligible;
    expect(compatibleReaderSummary(saved, movedBack, true, model)).toBeUndefined();
    expect(JSON.stringify(buildReaderHistory(turns(7), "new", "Follow up", "safe", false,
      () => true, saved, model))).not.toContain("Secret memory");
  });
  it("does not leak summary contents into retries before the summary coverage ends", async () => {
    const saved = (await updateReaderSummary(turns(7), undefined, false, model, async () => "Later details")).summary!;
    const result = buildReaderHistory(turns(7), "turn-1", "Retry", "safe", false, () => true, saved, model);
    expect(JSON.stringify(result)).not.toContain("Later details");
    expect(result.input).toHaveLength(2);
  });
  it("keeps a compatible prior summary on failure and falls back without losing originals", async () => {
    const previous = (await updateReaderSummary(turns(7), undefined, false, model, async () => "Existing memory")).summary!;
    const fail = jest.fn().mockRejectedValue(new Error("Provider unavailable"));
    const result = await updateReaderSummary(turns(10), previous, false, model, fail);
    expect(result.failed).toBe(true);
    expect(result.updated).toBe(false);
    expect(result.summary).toBe(previous);
    const history = buildReaderHistory(turns(10), "new", "Follow up", "safe", false, () => true, result.summary, model);
    expect(history.input).toHaveLength(13);
    expect(history.omitted).toBe(1);
  });
  it("rejects empty or oversized model summaries instead of caching them", async () => {
    for (const text of ["   ", "x".repeat(readerAiConfig.maxSummaryChars + 1)]) {
      const result = await updateReaderSummary(turns(7), undefined, false, model, async () => text);
      expect(result.failed).toBe(true);
      expect(result.summary).toBeUndefined();
    }
  });
  it("bounds legacy-chat summarization to one source batch per request", async () => {
    const large = turns(90).map(item => ({ ...item, answer: "x".repeat(12000) }));
    const summarize = jest.fn().mockResolvedValue("Batch memory");
    const result = await updateReaderSummary(large, undefined, false, model, summarize);
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(result.summary!.turnIds.length).toBeLessThan(86);
    expect(Buffer.byteLength(summarize.mock.calls[0][1][0].content)).toBeLessThanOrEqual(readerAiConfig.maxSummaryInputBytes);
  });
  it("does not silently truncate a single source that exceeds the summary request limit", async () => {
    const large = turns(7); large[0].answer = "x".repeat(readerAiConfig.maxSummaryInputBytes + 1);
    const summarize = jest.fn();
    expect((await updateReaderSummary(large, undefined, false, model, summarize)).failed).toBe(true);
    expect(summarize).not.toHaveBeenCalled();
  });
  it("persists summary metadata in MongoDB schema without exposing it in chat JSON", async () => {
    const summary = (await updateReaderSummary(turns(7), undefined, false, model, async () => "Memory")).summary!;
    const document = new ReaderConversationModel({
      userId: "507f1f77bcf86cd799439011", bookId: "507f1f77bcf86cd799439012", title: "Chat",
      memorySummary: summary, turns: [],
    });
    expect(document.validateSync()).toBeUndefined();
    expect(document.memorySummary?.sourceHashes).toHaveLength(3);
    expect(document.toJSON()).not.toHaveProperty("memorySummary");
  });
});
