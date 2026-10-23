import { AppError } from "../error/errorService";

export type ReaderAiInput = { role: "user" | "assistant"; content: string };

async function askReaderAi(instructions: string, input: ReaderAiInput[]): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key)
    throw new AppError(
      "AI chat is not configured. Add OPENAI_API_KEY to the backend environment.",
      503,
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.READER_AI_MODEL || "gpt-4.1-mini",
        instructions,
        input,
        max_output_tokens: 1200,
        store: false,
      }),
    });
    if (!response.ok) {
      if (response.status === 429)
        throw new AppError(
          "AI is busy or its usage limit was reached. Please try again later.",
          429,
        );
      throw new AppError("AI is temporarily unavailable. Please try again.", 502);
    }
    const data = (await response.json()) as {
      status?: string;
      output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
    };
    const answer = (data.output || [])
      .filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .map(item => (item.type === "output_text" ? item.text || "" : item.refusal || ""))
      .join("\n")
      .trim();
    if (!answer || answer.length > 16000 || data.status !== "completed")
      throw new AppError(
        "AI could not complete this answer. Please try again or ask a shorter question.",
        502,
      );
    return answer;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      controller.signal.aborted
        ? "AI took too long. Please retry."
        : "Could not reach AI. Please retry.",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

export { askReaderAi };
