# Full-book AI access (ticket 10)

The existing chat already extracted owned EPUB text from MongoDB GridFS and scanned chapters per request. This change replaces that repeated scan with a lazy, in-process inverted index. No database migration, new service, dependency, embedding calls, or separate chat is required. Existing editions work immediately; a cold process rebuilds its index from the sanitized GridFS EPUB.

## Architecture choice

A MongoDB text index would require persisting/migrating individual chunks and handling edition deletion and upload failures. Embedding RAG would add embedding cost, provider calls, and lifecycle complexity. Local lexical RAG reuses the existing backend and storage, supports exact character/event/reference queries, and keeps local keyword retrieval free of provider calls. On-demand model-selected reads add bounded provider continuation calls as described below. It is deliberately lexical: paraphrases, synonyms, and cross-language questions may miss relevant passages. Broad theme questions are grounded in the retrieved sample and must not claim exhaustive coverage.

Chunks contain at most 2,200 extracted characters with 400-character overlap. Unicode-normalized terms feed postings; inverse document frequency and saturated length-normalized term frequency rank candidates. At most two hits per section and six search hits encourage chapter diversity. Existing selection surroundings and reading context remain available. At most eight excerpts and 16,000 excerpt characters reach the model; whole excerpts are omitted rather than mislabeling a truncated source range. Selection and conversation history retain their existing independent limits.

The shared LRU cache is keyed by immutable GridFS file ID after book ownership checks. Concurrent loads are coalesced. Its conservative source-size accounting caps retained editions at 64 MiB; oversized editions still work without retention. It stores no question, answer, spoiler setting, or reading progress. Failed loads are not cached. Missing indexes are rebuilt automatically; missing source books fail before a paid request, leaving the conversation retryable. Cache accounting is an estimate, not a hard heap limit, and concurrent cold loads can temporarily exceed it.

## Spoilers and sources

Every retrieval applies the existing saved turn/selection reading boundary anew. Future chapters and offsets after that boundary are excluded before scoring; clipped chunks are re-tokenized so future-only matches cannot select them. Reusing an index after an unrestricted question never reuses unrestricted results. Existing history filtering and retry boundaries remain unchanged.

Search labels identify spine section, EPUB resource, and zero-based extracted-text character range (exclusive end). These are edition-specific text offsets, not printed pages or navigable CFIs. The model is instructed to cite supplied sources, distinguish incomplete evidence, and ground character/plot claims in accessible excerpts. No new source UI is introduced.

## Validation

Reader regression suites cover existing chat, ownership, retries, history, memory, EPUB handling and provider request limits. Added tests cover multi-chapter evidence and labels, cached unrestricted-to-restricted retrieval, same-chapter cutoffs, a synthetic 2.25-million-character edition with a late reference, context limits, cache coalescing, LRU eviction, oversized editions, and failed-load retries. Tests use mocked providers and make no paid API calls. Live model answer quality and actual provider token billing are not measured.

## On-demand book access

The same reader chat now exposes four Responses API function tools: book_contents, read_chapter, search_book, and read_book. The assistant can request additional source content itself; the reader does not need to paste a chapter or upload the EPUB again. Focused questions still use the existing bounded initial retrieval and may answer without any tool round. Chapter summaries are instructed to read all pages of the requested chapter; broad or exhaustive questions are instructed to gather wider coverage rather than claiming the initial search sample represents the whole book.

EPUB 3 TOC navigation and EPUB 2 NCX anchors define chapters, including multiple chapters in one file and chapters spanning several files. Missing or unusable navigation falls back to linear spine sections, explicitly identified as sections rather than printed chapter numbers. Nested TOC entries are addressable navigation units, so chapter boundaries follow the publisher's TOC structure. Current/next/previous refer to the existing reading boundary for the turn (the selected passage when one is attached); retries retain that boundary.

The book is available through paginated reads, not attached to every request. read_chapter returns up to 24,000 extracted characters with exact source offsets and a nextStart cursor. read_book adds a next chapter/start cursor for sequential coverage. book_contents pages up to 60 entries. When spoilers are disabled, future chapter titles and text are hidden, and the current chapter is clipped at the exact existing reading boundary. Complete/restricted fields distinguish a whole chapter from its accessible prefix. An unrestricted cached edition never caches a user's retrieved results.

Tool calls are automatic and add API rounds only when used. Each answer is capped at 12 tool calls plus one final response, 96,000 UTF-8 bytes of cumulative tool results, the existing 240,000-byte provider request envelope, and one shared 120-second deadline (not a fresh timeout per round). No tool calls are enabled for conversation-memory summaries or writing edits. Oversized tool results become explicit budget errors and trigger finalization instead of silently expanding context. Normal questions keep the one-response path. This makes the whole edition addressable, but does not promise an exhaustive one-request reading of arbitrarily large books. The assistant must disclose partial coverage and provide the continuation cursor when it cannot finish.

All Responses output items, including encrypted reasoning where needed, are carried into stateless continuations with store=false. Tool names and arguments are validated; the model cannot change book ownership, edition, reading boundary, or spoiler permission. Final answers and tool evidence are saved on the existing turn. History replays source prefixes within the existing context allowance so a large chapter read does not erase its question and answer from subsequent conversation. Full evidence remains saved. Existing history spoiler filtering still applies.

API implementation follows the [official OpenAI function-calling documentation](https://developers.openai.com/api/docs/guides/function-calling). Tests mock the provider; no live model behavior, billing or production deployment was exercised.
