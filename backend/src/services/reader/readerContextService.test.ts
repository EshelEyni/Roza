import AdmZip from "adm-zip";
import { ReaderContext, MAX_CONTEXT_CHARS } from "./readerContextService";

function book(firstText?: string) {
  const zip = new AdmZip();
  const add = (name: string, text: string) => zip.addFile(name, Buffer.from(text));
  add(
    "META-INF/container.xml",
    '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
  );
  add(
    "OPS/book.opf",
    '<package><manifest><item id="one" href="one.xhtml"/><item id="two" href="two.xhtml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>',
  );
  add(
    "OPS/one.xhtml",
    firstText
      ? `<html><head/><body><p>${firstText}</p></body></html>`
      : "<html><head><title>Test</title></head><body><p>The garden was quiet.</p><p>The secret was revealed later.</p></body></html>",
  );
  add("OPS/two.xhtml", "<html><head/><body><p>The ending reveals FUTURE_SECRET.</p></body></html>");
  return new ReaderContext(zip.toBuffer());
}
const beforeSecret = "epubcfi(/6/2!/4/2/1:21)";
const passage = "epubcfi(/6/2!/4/2,/1:4,/1:10)";
describe("Reader book context", () => {
  const crossStart = "epubcfi(/6/2!/4/2/1:4)";
  const crossEnd = "epubcfi(/6/4!/4/2/1:10)";
  it("reconstructs cross-section passages in reading order from server-owned text", () => {
    expect(book().passage(crossStart, crossEnd)).toEqual({
      cfi: crossStart,
      endCfi: crossEnd,
      text: "garden was quiet.\nThe secret was revealed later.\nThe ending",
    });
  });
  it("checks the final endpoint of cross-section passages against the spoiler boundary", () => {
    const context = book();
    expect(context.retrieve("Explain", beforeSecret, false, crossStart, crossEnd).passage).toBe("");
    expect(
      context.retrieve("Explain", "epubcfi(/6/4!/4/2/1:9)", false, crossStart, crossEnd).passage,
    ).toBe("");
    expect(context.retrieve("Explain", crossEnd, false, crossStart, crossEnd).passage).toBe(
      context.passage(crossStart, crossEnd).text,
    );
    expect(context.retrieve("Explain", beforeSecret, true, crossStart, crossEnd).passage).toBe(
      context.passage(crossStart, crossEnd).text,
    );
  });
  it("rejects reversed, invalid and oversized cross-section AI passages", () => {
    expect(() => book().passage(crossEnd, crossStart)).toThrow();
    expect(() => book().passage(crossStart, "epubcfi(/6/200!/4/2/1:10)")).toThrow();
    expect(() => book().passage(crossStart, "epubcfi(/6/2!/4/2/1:0)")).toThrow();
    expect(() => book("x".repeat(20005)).passage(crossStart, crossEnd)).toThrow("20,000");
  });
  it("accepts a literary passage longer than the previous 3,000 character cap", () => {
    const text = "x".repeat(12000);
    expect(book(text).passage("epubcfi(/6/2!/4/2,/1:0,/1:12000)").text).toBe(text);
  });
  it("resolves exact selected text from the saved edition, including CFI assertions", () => {
    expect(book().passage(passage).text).toBe("garden");
    expect(book().passage("epubcfi(/6/2[chapter^,one]!/4/2,/1:4,/1:10)").text).toBe("garden");
  });
  it("cuts off inside the current section, not just at chapter boundaries", () => {
    const result = book().retrieve("What is the secret and ending?", beforeSecret, false, passage);
    const text = JSON.stringify(result);
    expect(text).toContain("garden");
    expect(text).not.toContain("revealed later");
    expect(text).not.toContain("FUTURE_SECRET");
  });
  it("does not resend a saved selected passage after the reader moves before it", () => {
    expect(book().retrieve("Explain", "epubcfi(/6/2!/4/2/1:0)", false, passage).passage).toBe("");
  });
  it("permits later excerpts only with spoiler permission", () => {
    expect(JSON.stringify(book().retrieve("FUTURE_SECRET", beforeSecret, true))).toContain(
      "FUTURE_SECRET",
    );
  });
  it("handles Hebrew questions with local context and bounds the combined excerpts", () => {
    const result = book().retrieve("מה קורה בקטע הזה?", beforeSecret, false);
    expect(result.context.length).toBeGreaterThan(0);
    expect(result.context.reduce((sum, entry) => sum + entry.text.length, 0)).toBeLessThanOrEqual(
      MAX_CONTEXT_CHARS,
    );
  });
  it("compares positions by content, ignoring reading history", () => {
    expect(book().isAtOrBefore(beforeSecret, "epubcfi(/6/4!/4/2/1:10)")).toBe(true);
    expect(book().isAtOrBefore(beforeSecret, "epubcfi(/6/2!/4/2/1:0)")).toBe(false);
  });
  it("rejects invalid locations and empty selections instead of inventing context", () => {
    expect(() => book().retrieve("Question", "not-a-cfi", false)).toThrow();
    expect(() => book().retrieve("Question", "epubcfi(/6/200!/4/2/1:0)", false)).toThrow();
    expect(() => book().passage(beforeSecret)).toThrow();
  });
});
