# Full-book AI access (ticket 10)

The existing chat already extracted owned EPUB text from MongoDB GridFS and scanned chapters per request. This change replaces that repeated scan with a lazy, in-process inverted index. No database migration, new service, dependency, embedding calls, or separate chat is required. Existing editions work immediately; a cold process rebuilds its index from the sanitized GridFS EPUB.

## Architecture choice

A MongoDB text index would require persisting/migrating individual chunks and handling edition deletion and upload failures. Embedding RAG would add embedding cost, provider calls, and lifecycle complexity. Local lexical RAG reuses the existing backend and storage, supports exact character/event/reference queries, and keeps retrieval free of provider calls. It is deliberately lexical: paraphrases, synonyms, and cross-language questions may miss relevant passages. Broad theme questions are grounded in the retrieved sample and must not claim exhaustive coverage.

Chunks contain at most 2,200 extracted characters with 400-character overlap. Unicode-normalized terms feed postings; inverse document frequency and saturated length-normalized term frequency rank candidates. At most two hits per section and six search hits encourage chapter diversity. Existing selection surroundings and reading context remain available. At most eight excerpts and 16,000 excerpt characters reach the model; whole excerpts are omitted rather than mislabeling a truncated source range. Selection and conversation history retain their existing independent limits.

The shared LRU cache is keyed by immutable GridFS file ID after book ownership checks. Concurrent loads are coalesced. Its conservative source-size accounting caps retained editions at 64 MiB; oversized editions still work without retention. It stores no question, answer, spoiler setting, or reading progress. Failed loads are not cached. Missing indexes are rebuilt automatically; missing source books fail before a paid request, leaving the conversation retryable. Cache accounting is an estimate, not a hard heap limit, and concurrent cold loads can temporarily exceed it.

## Spoilers and sources

Every retrieval applies the existing saved turn/selection reading boundary anew. Future chapters and offsets after that boundary are excluded before scoring; clipped chunks are re-tokenized so future-only matches cannot select them. Reusing an index after an unrestricted question never reuses unrestricted results. Existing history filtering and retry boundaries remain unchanged.

Search labels identify spine section, EPUB resource, and zero-based extracted-text character range (exclusive end). These are edition-specific text offsets, not printed pages or navigable CFIs. The model is instructed to cite supplied sources, distinguish incomplete evidence, and ground character/plot claims in accessible excerpts. No new source UI is introduced.

## Validation

Reader regression suites cover existing chat, ownership, retries, history, memory, EPUB handling and provider request limits. Added tests cover multi-chapter evidence and labels, cached unrestricted-to-restricted retrieval, same-chapter cutoffs, a synthetic 2.25-million-character edition with a late reference, context limits, cache coalescing, LRU eviction, oversized editions, and failed-load retries. Tests use mocked providers and make no paid API calls. Live model answer quality and actual provider token billing are not measured.
