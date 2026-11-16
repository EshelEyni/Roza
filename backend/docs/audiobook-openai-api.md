# OpenAI audiobook backend — frontend handoff

Backend API contract, connected to the reader's Audiobook Mode frontend. See [frontend behavior and local testing](../../docs/reader-tts-mvp.md). A book may now store an optional `audiobookNarrator` preference; existing books require no migration. No Docker, nginx or production settings are changed. Kokoro is absent. This runs in the existing Node backend; there is no model inference on EC2 and no second container.

## Enable deliberately

By default the feature is disabled, even when Reader chat already has an OpenAI key.

```dotenv
READER_AUDIOBOOK_ENABLED=true
# Default:
READER_AUDIOBOOK_MODEL=gpt-realtime-2.1-mini
# Optional dedicated API-project key. Otherwise OPENAI_API_KEY is reused:
READER_AUDIOBOOK_OPENAI_API_KEY=
```

An example is in `backend/audiobook.env.example`. Never expose either key to the browser. The other supported server-selected model is `gpt-realtime-2.1`. Clients cannot choose arbitrary models or supply instructions/tools. Model/account permissions and billing must be enabled in the OpenAI project; configuration readiness is not a live account/permissions probe.

Uses the current GA Realtime WebSocket API, not the deprecated Speech API:
- [Speech API migration notice](https://developers.openai.com/api/docs/guides/text-to-speech)
- [Realtime WebSocket connection](https://developers.openai.com/api/docs/guides/voice-websockets?api=realtime)
- [Realtime client events](https://developers.openai.com/api/reference/resources/realtime/client-events)
- [Realtime server events](https://developers.openai.com/api/reference/resources/realtime/server-events)

All routes below require normal Roza login, the existing Reader allowlist, and ownership of the book. Audio URLs use the same authentication: same-origin HTML audio can use the existing login cookie; a fetch client can use its usual credentials/Authorization header. No anonymous/public audio endpoint or browser OpenAI credential is created.

## API contract

Base: `/api/reader/:bookId/audiobook`.

### Narrator persistence and previews

`GET /config` also returns `narrator` (saved `{ engine, voice, name, lang }` or `null`) and `previewText` (the server-owned sample). Reading these settings never generates speech.

`PATCH /narrator` accepts only `{ engine: "system" | "openai", voice, name, lang }`. Voice/name are bounded nonempty strings; language is bounded and may be empty. OpenAI voice names must be supported. The authenticated owner is checked and only the book's `audiobookNarrator` field is updated, independently of progress/state writes. Returns the saved preference. Saving System preferences works with OpenAI disabled and makes no provider call. System voice availability is checked by the client, after asynchronous enumeration.

`POST /preview` accepts only `{ requestId, voice? }`, using the same request-ID validation, supported voices, authenticated owner/allowlist, feature flag, quota, cancellation and cache as narration. The fixed server text is “The morning arrived quietly, and the world seemed full of possibility.” Arbitrary text, CFIs, instructions and models are rejected. Returns the normal chunk metadata and authenticated `/chunks/:chunkId` WAV URL; passage CFI fields are absent. The default voice is marin. Previews may incur API charges. Stop/close cancels through the existing `DELETE /requests/:requestId` endpoint. Samples are scoped to the book owner and edition, and repeated previews can reuse the temporary cache.

### GET /config

Returns `{ status: "success", data: { ... } }`:

```json
{
  "enabled": true,
  "available": true,
  "provider": "openai",
  "model": "gpt-realtime-2.1-mini",
  "unavailableReason": null,
  "voices": ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"],
  "defaultVoice": "marin",
  "maxChars": 600,
  "maxUtf8Bytes": 2400,
  "maxConcurrentPerUser": 1,
  "audioFormat": "wav",
  "sampleRate": 24000,
  "channels": 1,
  "alignment": "passage",
  "wordTimings": false,
  "requiresAiVoiceDisclosure": true,
  "cacheTtlSeconds": 1800
}
```

Unavailable reasons: `disabled` or `not_configured`. The request does not contact OpenAI and never returns a key.

### POST /chunks

Automatically call this when Play needs audio or when preparing one upcoming passage. There should be no Generate button. Exactly these JSON fields are supported:

```json
{
  "requestId": "a-client-generated-uuid",
  "passageCfi": "epubcfi(/6/2!/4/2,/1:0,/1:12)",
  "voice": "marin"
}
```

- `requestId`: 16–80 ASCII letters/digits/hyphens; use a new UUID for each new generation attempt.
- `passageCfi`: a real selected/range CFI from the current owned EPUB, max 4096 characters.
- Optional `passageEndCfi`: a second verified CFI endpoint for selections represented with two CFIs.
- Optional `voice`: a voice from /config, default marin.
- **Do not send arbitrary text, speed, model, or instructions.** Extra fields are rejected.
- Point CFIs alone do not select text. Use the reader's sentence range CFI, or start/end word CFIs for a bounded sub-sentence selection.
- Backend derives and normalizes text from the owned saved EPUB. It does not trust text supplied by the browser. Choose at most 600 characters per chunk; split long sentences at word boundaries with corresponding source CFIs. Do not submit a chapter/book as one request.
- There is no server-side auto-advance: the future frontend remains responsible for its current reading position and requests the next source range.

Returns 201 on generation or 200 on a cache hit:

```json
{
  "status": "success",
  "data": {
    "chunkId": "<64-character-hex-id>",
    "audioUrl": "/api/reader/<book-id>/audiobook/chunks/<chunk-id>",
    "text": "Hello world.",
    "transcript": "Hello world.",
    "passageCfi": "<requested-range-cfi>",
    "provider": "openai",
    "model": "gpt-realtime-2.1-mini",
    "voice": "marin",
    "cacheHit": false,
    "expiresAt": "<ISO timestamp>",
    "mimeType": "audio/wav",
    "sampleRate": 24000,
    "channels": 1,
    "durationSeconds": 0.1,
    "alignment": {
      "type": "passage",
      "startSeconds": 0,
      "endSeconds": 0.1,
      "wordTimings": null
    },
    "aiGenerated": true
  }
}
```

`passageEndCfi` is echoed when supplied. Duration is measured from actual PCM sample count, not guessed from text. The example's duration is illustrative. A response can arrive only after the complete short chunk is validated; this endpoint does **not** stream unvalidated audio directly to the browser.

The provider streams PCM internally. The backend checks a completed successful response, one scoped audio item, valid/size-bounded PCM, and a generated transcript matching the source words (allowing punctuation/case/apostrophe normalization). Then it creates a playable WAV and caches it. There are no automatic billable retries. Transcript comparison is a quality guard, not independent ASR verification of the waveform; abbreviations/numbers or other verbalization changes can be conservatively rejected. A mismatch returns an error and saves no audio.

### GET /chunks/:chunkId (HEAD also supported)

Returns authenticated binary `audio/wav`, with Content-Length and `Accept-Ranges: bytes`. Standard single byte ranges are supported, including suffix ranges, for browser/Safari media loading. Invalid/unsatisfiable/multipart ranges return 416.

Responses use `Cache-Control: private, no-store`. The server memory cache is separate from browser/proxy caching. Metadata also uses no-store.

410 means the audio was evicted/expired or belongs to a different scope/edition. The client can request that source passage again when the user still wants it. An unowned/missing book returns 404 before any audio lookup. Opaque IDs do not grant access.

### DELETE /requests/:requestId

Cancels only the current authenticated user's matching book/edition/request. Returns 204 whether or not that request is still running. A stale cancel ID cannot stop a newer request. Cancellation remains available if the feature is disabled while a job is running.

Aborting the original POST fetch also cancels upstream generation when its HTTP connection closes. The future frontend should abort its outstanding POST on Stop, seek, voice change, mode exit or book switch. Use DELETE when an explicit cancel handle is needed. An explicitly cancelled still-connected POST receives 499; a disconnected POST sends no response.

## Future frontend sequence — no UI changes made here

1. Read /config. Offer OpenAI only when available; retain System Voices as fallback.
2. Use the existing EPUB position and choose a short source range. POST /chunks through the authenticated backend.
3. Play the returned same-origin audioUrl. Prepare at most one upcoming chunk, serially: max one generation is active per user. Cached metadata requests may still succeed while another passage is generating.
4. On end, play the next prepared chunk; continue through book sections using existing source positions.
5. Use HTML audio playbackRate for ordinary speed changes; the cached audio is generated at 1×. Backend speed is intentionally not a request field.
6. Display the required AI-generated voice disclosure.
7. Synchronize passage/sentence highlighting to real media time. **No word timestamps are provided.** Do not reuse native SpeechSynthesis boundary handlers or invent exact word timings for OpenAI audio. Fine word alignment needs separate validated work.
8. Exact duration is available per generated chunk. Whole-section/book remaining time is still estimated until all relevant audio exists.

A request ID is a cancellation handle, not persistent idempotency. Completed identical source text/voice/model is deduplicated by cache while present; in-flight duplicate generation is rejected with 409 rather than billed twice.

## Limits and storage

- 600 UTF-16 characters / 2400 UTF-8 bytes per selected chunk.
- 60-second total provider timeout, 10-second handshake timeout.
- 4 MiB raw PCM per response, 4096 maximum output tokens, 512 KiB individual provider-message cap.
- One active generation per user, two across this backend process.
- At most 120 generation attempts per user per ten-minute window and 200,000 source characters per hour.
- Failed/cancelled provider attempts still consume application admission budget because the provider may already have performed billable work. Cache hits do not consume that generation budget.
- At most 32 MiB / 128 audio entries in an LRU memory cache; fixed 30-minute TTL, potentially earlier eviction under pressure.
- Cache keys scope user, book, immutable file edition, normalized text, model and voice.
- No database/audio files, Redis, S3, background worker, Python container, transcription job or model download.
- Cache, limits and cancellation are per-process and reset on restart; this is appropriate for the current single-instance personal deployment, not a distributed hard billing cap. Use OpenAI project usage/billing controls for account-level limits.

WAV is uncompressed mono 24 kHz PCM16, approximately 48 KB per audio second. It avoids transcoding/encoding CPU on the small EC2 instance but uses more bandwidth than MP3. Book text is sent to OpenAI; provider retention/account settings are unchanged. Roza does not log or persist passage text/audio/API keys through this feature.

## Errors

Standard Roza JSON error envelope with a safe message:
- 400 malformed request, unsupported voice, invalid/unresolvable/empty/oversized selection.
- 401 not logged in; 403 Reader feature not allowed.
- 404 book not owned/missing or malformed audio ID.
- 409 user's other generation still active; Retry-After: 1.
- 410 cached audio no longer available.
- 429 local generation budget/capacity or provider quota/rate limit; Retry-After: 60.
- 499 explicit cancellation of an otherwise-connected POST.
- 502 invalid/incomplete/mismatched narration, failed connection/provider response.
- 503 disabled/missing configuration, unsupported configured model, provider credentials/access issue.
- 504 provider timeout.

No raw provider messages, API keys or upstream request/response bodies are returned. No fallback provider is silently selected or billed.

## Validation

```powershell
npm ci --prefix backend
./backend/node_modules/.bin/tsc --build shared/tsconfig.json backend/tsconfig.json
$env:NODE_ENV="test"
./backend/node_modules/.bin/jest --config backend/jest.config.ts --runInBand --watch=false --detectOpenHandles --runTestsByPath backend/src/services/reader/readerSpeechProvider.test.ts backend/src/services/reader/readerSpeechStore.test.ts backend/src/routers/reader/readerAudiobookRouter.test.ts
```

Tests include a real local ws transport server, actual EPUB/CFI extraction, access and ownership isolation, generation payload/schema checks, transcript failures, PCM/WAV headers, cancellation/disconnection, resource limits, cache scopes/eviction/expiry, byte ranges, and sanitized provider failures. They do not contact paid OpenAI services. Live model access, narration quality and end-to-end browser playback remain to be tested when explicitly enabled.

Backend build files are generated for validation only and are not part of this source change. CommonJS source/compiled route imports are checked separately because TypeScript/Jest alone can miss ESM runtime regressions. No deployment, frontend integration or paid API call is performed by this work.

Validated on 2026-11-16: backend TypeScript build passed; actual ts-node/CommonJS source and compiled reader-router imports passed; all 25 selected Reader/auth suites passed (382 tests passed, 1 existing skip). Transport tests used a real localhost WebSocket server; no paid OpenAI request was made. Frontend/shared source and deployment files were not changed.
