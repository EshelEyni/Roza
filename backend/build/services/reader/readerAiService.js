"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askReaderAi = askReaderAi;
const readerAiConfig_1 = require("./readerAiConfig");
const readerAiModels_1 = require("./readerAiModels");
const errorService_1 = require("../error/errorService");
function providerError(status, error) {
    const code = error === null || error === void 0 ? void 0 : error.code;
    if (code === "credit_balance_exhausted")
        return new errorService_1.AppError("Your OpenAI API account has no credits remaining. Add credits at https://platform.openai.com/settings/organization/billing/ and retry this question.", 429);
    if (code === "insufficient_quota" || (error === null || error === void 0 ? void 0 : error.type) === "insufficient_quota")
        return new errorService_1.AppError("Your OpenAI API quota is exhausted. Check the API project's billing and usage limits before retrying.", 429);
    if (code === "rate_limit_exceeded")
        return new errorService_1.AppError("OpenAI's " +
            ((error === null || error === void 0 ? void 0 : error.type) === "tokens" ? "token" : "request") +
            " rate limit was exceeded. Wait before retrying this question.", 429);
    if (code === "invalid_api_key" || status === 401)
        return new errorService_1.AppError("OpenAI rejected the API key. Update OPENAI_API_KEY in the backend environment and restart the backend.", 503);
    if (code === "model_not_found")
        return new errorService_1.AppError("OpenAI could not access the configured model. Choose an accessible model in AI settings or check READER_AI_MODEL for the server default.", 503);
    if (code === "context_length_exceeded")
        return new errorService_1.AppError("This question's context exceeds the OpenAI model's input limit. Start a new conversation with a shorter question.", 400);
    if (status === 403)
        return new errorService_1.AppError("OpenAI denied permission for this request (HTTP 403). Check the API project's permissions for the configured model.", 503);
    if (status >= 500)
        return new errorService_1.AppError("OpenAI returned a server error (HTTP " + status + "). Retry this question later.", 502);
    // Do not guess a cause from HTTP status alone or expose raw provider messages, which can include credentials and input.
    return new errorService_1.AppError("OpenAI rejected the request (HTTP " +
        status +
        "). The provider did not supply a recognized error reason.", status === 429 ? 429 : 502);
}
function askReaderAi(instructions_1, input_1) {
    return __awaiter(this, arguments, void 0, function* (instructions, input, selectedModel = "default", purpose = "answer", editOutputTokens = 4000, bookTools) {
        var _a, _b, _c;
        if (!readerAiModels_1.readerAiModels.includes(selectedModel))
            throw new errorService_1.AppError("Choose a supported AI model.", 400);
        const model = selectedModel === "default"
            ? process.env.READER_AI_MODEL || "gpt-4.1-mini"
            : selectedModel;
        const reasoningModel = /^gpt-6(?:[.-]|$)/.test(model);
        // UTF-8 byte size is a conservative envelope, not an exact token count.
        if (Buffer.byteLength(JSON.stringify({ instructions, input }), "utf8") > readerAiConfig_1.readerAiConfig.maxRequestBytes)
            throw new errorService_1.AppError("The combined question, instructions and context are too large. Shorten the selection or instructions and retry.", 400);
        const key = process.env.OPENAI_API_KEY;
        if (!key)
            throw new errorService_1.AppError("AI chat is not configured. Add OPENAI_API_KEY to the backend environment.", 503);
        const timeoutMs = purpose === "summary" ? readerAiConfig_1.readerAiConfig.summaryTimeoutMs : readerAiConfig_1.readerAiConfig.timeoutMs;
        const maxOutputTokens = purpose === "summary"
            ? (reasoningModel ? readerAiConfig_1.readerAiConfig.summaryReasoningOutputTokens : readerAiConfig_1.readerAiConfig.summaryOutputTokens)
            : (reasoningModel ? readerAiConfig_1.readerAiConfig.reasoningOutputTokens : readerAiConfig_1.readerAiConfig.outputTokens);
        const maxAnswerChars = purpose === "summary" ? readerAiConfig_1.readerAiConfig.maxSummaryChars : readerAiConfig_1.readerAiConfig.maxAnswerChars;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const transcript = [...input];
        const activeTools = purpose === "answer" ? bookTools : undefined;
        let toolCalls = 0;
        let finalize = false;
        try {
            for (let round = 0; round <= 12; round++) {
                if (controller.signal.aborted)
                    throw new errorService_1.AppError("Book analysis timed out. Ask a more focused question or continue in another message.", 504);
                const requestBody = Object.assign(Object.assign(Object.assign({ model, instructions, input: transcript, max_output_tokens: purpose === "edit" ? Math.min(16000, Math.max(reasoningModel ? 6000 : 1000, editOutputTokens)) : maxOutputTokens }, (reasoningModel ? Object.assign({ reasoning: { effort: "low" } }, (activeTools ? { include: ["reasoning.encrypted_content"] } : {})) : {})), (activeTools ? { tools: activeTools.definitions, parallel_tool_calls: false, tool_choice: finalize ? "none" : "auto" } : {})), { store: false });
                if (Buffer.byteLength(JSON.stringify(requestBody), "utf8") > readerAiConfig_1.readerAiConfig.maxRequestBytes)
                    throw new errorService_1.AppError("Book analysis reached the context budget. Ask about fewer chapters or continue in a new conversation.", 400);
                const response = yield fetch("https://api.openai.com/v1/responses", {
                    method: "POST",
                    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
                    signal: controller.signal,
                    body: JSON.stringify(requestBody),
                });
                let data;
                try {
                    data = yield response.json();
                    if (!data || typeof data !== "object")
                        throw new Error("Invalid provider response");
                }
                catch (_d) {
                    if (!response.ok)
                        throw providerError(response.status);
                    throw new errorService_1.AppError("OpenAI returned an unreadable response. Retry this question.", 502);
                }
                if (!response.ok || data.error)
                    throw providerError(response.status, data.error);
                if (data.status === "incomplete") {
                    if (((_a = data.incomplete_details) === null || _a === void 0 ? void 0 : _a.reason) === "max_output_tokens")
                        throw new errorService_1.AppError("OpenAI's answer reached the response length limit before finishing. Ask a more focused question.", 502);
                    if (((_b = data.incomplete_details) === null || _b === void 0 ? void 0 : _b.reason) === "content_filter")
                        throw new errorService_1.AppError("OpenAI stopped this answer because of its content filter. Rephrase the question.", 502);
                    throw new errorService_1.AppError("OpenAI returned an incomplete answer without a recognized reason. Retry this question.", 502);
                }
                if (data.status !== "completed")
                    throw new errorService_1.AppError("OpenAI did not complete the response. Retry this question.", 502);
                const calls = (data.output || []).filter(item => item.type === "function_call");
                if (calls.length) {
                    if (!activeTools || finalize || calls.length > 12 || toolCalls + calls.length > 12)
                        throw new errorService_1.AppError("Book analysis reached its tool-call limit. Ask a more focused question.", 502);
                    // Stateless Responses calls require ALL output items, including reasoning, in the continuation.
                    transcript.push(...(data.output || []));
                    for (const call of calls) {
                        if (!call.call_id || !call.name || typeof call.arguments !== "string")
                            throw new errorService_1.AppError("OpenAI returned an invalid book request. Retry this question.", 502);
                        let result;
                        if (!activeTools.definitions.some(tool => tool.name === call.name))
                            result = { error: "Unknown book tool." };
                        else {
                            let args;
                            try {
                                args = JSON.parse(call.arguments);
                            }
                            catch (_e) {
                                args = null;
                            }
                            result = args === null ? { error: "Invalid JSON tool arguments. Use the declared schema." } : yield activeTools.execute(call.name, args);
                        }
                        let output = (_c = JSON.stringify(result)) !== null && _c !== void 0 ? _c : "null";
                        const envelope = { type: "function_call_output", call_id: call.call_id, output };
                        if (Buffer.byteLength(JSON.stringify(Object.assign(Object.assign({}, requestBody), { input: [...transcript, envelope] })), "utf8") > readerAiConfig_1.readerAiConfig.maxRequestBytes - 8192) {
                            output = JSON.stringify({ error: "Context budget reached. Answer using evidence already supplied; clearly disclose incomplete coverage." });
                            finalize = true;
                        }
                        transcript.push({ type: "function_call_output", call_id: call.call_id, output });
                        toolCalls++;
                    }
                    if (toolCalls >= 12 || round >= 11)
                        finalize = true;
                    continue;
                }
                if (purpose === "edit" && (data.output || []).some(item => { var _a; return (_a = item.content) === null || _a === void 0 ? void 0 : _a.some(part => part.type === "refusal"); }))
                    throw new errorService_1.AppError("AI declined this editing request. Your writing is unchanged.", 422);
                const rawAnswer = (data.output || [])
                    .filter(item => item.type === "message")
                    .flatMap(item => item.content || [])
                    .map(item => (item.type === "output_text" ? item.text || "" : item.refusal || ""))
                    .join("\n");
                const answer = purpose === "edit" ? rawAnswer : rawAnswer.trim();
                if (!answer)
                    throw new errorService_1.AppError("OpenAI completed the request but returned no answer text. Retry this question.", 502);
                if (answer.length > maxAnswerChars)
                    throw new errorService_1.AppError("OpenAI's answer exceeds Roza's saved-answer length limit. Ask a more focused question.", 502);
                return answer;
            }
            throw new errorService_1.AppError("Book analysis reached its request limit. Ask a more focused question.", 502);
        }
        catch (error) {
            if (error instanceof errorService_1.AppError)
                throw error;
            if (controller.signal.aborted)
                throw new errorService_1.AppError("OpenAI did not respond within " + timeoutMs / 1000 + " seconds. Retry this question.", 504);
            throw new errorService_1.AppError("The backend could not connect to OpenAI. Check this PC's network connection and retry.", 502);
        }
        finally {
            clearTimeout(timer);
        }
    });
}
//# sourceMappingURL=readerAiService.js.map