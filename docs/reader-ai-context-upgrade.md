# Reader AI context upgrade

Implemented directly on main at the user's request. No manual deployment or paid API calls were made during implementation.

## Behavior

- Chat settings select the per-user model, with an explicit server-default option. Secrets stay backend-only.
- Questions: 10,000 characters; selected passages: 20,000; personal instructions: 8,000; book excerpts: up to 8 / 16,000 characters.
- Up to 24 recent completed pairs within 80,000 serialized UTF-8 bytes, plus up to four locally matched older pairs within 16,000 bytes. Original roles/order and safe reading boundaries are preserved. An old failed-turn retry excludes later turns.
- New turns retain the exact server-resolved selected passage and retrieved evidence. Another selection attaches to the active conversation. Passage attachments are visible per turn.
- Active chat ID is restored per account/book through optional browser storage; actual contents remain server-owned in MongoDB. New chat clears the pointer; account changes remount the reader.
- Follow-up retrieval uses the current question and two recent eligible turns. The prompt permits general literary knowledge, distinguishes edition evidence, and supports syntax, pronoun references, imagery, irony, interpretation and translation.
- Standard answers adapt to the question. Existing saved preferences remain intact. Mini permits 4,000 output tokens; GPT-6 permits 12,000 including low-effort reasoning. Timeout: 120 seconds; lease: 180 seconds; saved answer ceiling: 48,000 characters.
- Combined serialized instructions/input have a conservative 240,000-byte envelope; these are not exact token counts. Omitted history is disclosed in the chat. Existing 100-turn limit remains, with an additional 8 MiB saved-transcript guard. All original messages remain saved; this does not promise unlimited word-for-word recall.
- No automatic model summaries, new services or embedding calls were introduced. Older turns can be recalled lexically; original passage snapshots are available only for newly created turns. Selecting a passage after the current boundary requires navigating there or enabling spoilers.

## Validation

- Six focused backend suites: 61 tests passed.
- Frontend chat hook/component regressions: 9 tests passed, including reload, account isolation, storage failure, attaching passages and context warnings.
- Real-browser cross-page selection: desktop and mobile passed using installed Edge (3 reported tests). Bundled Chromium was unavailable; no browser download was needed.
- Backend and frontend TypeScript: passed without emitting build files.
- Targeted frontend ESLint: passed.
- Actual ts-node development imports: passed.
- No live provider quality evaluation or billing requests were made.

## Manual check

1. Restart the development backend and refresh the reader.
2. In Book chat > Settings, choose the model and Standard or Detailed answer length; save. Existing Short preferences remain Short until changed.
3. Select a long passage, ask a question, then ask a follow-up referring to its answer.
4. Select a different passage and ask how it relates to the previous one; verify the conversation and earlier answers remain visible.
5. Reload; verify the same chat reopens. New chat should intentionally start a separate conversation.
6. Check backward navigation and spoiler permission: later source context should not be sent when spoilers are off.
7. Continue a long conversation; excluded history should trigger a visible notice. Mention a specific earlier topic to exercise local recall.

## Modified files (including the preceding model-selector change)
- backend/src/controllers/reader/readerChatController.ts
- backend/src/models/reader/readerAiSettingsModel.ts
- backend/src/models/reader/schemas/readerConversationSchema.ts
- backend/src/routers/reader/readerAiSettingsRouter.test.ts
- backend/src/routers/reader/readerChatRouter.test.ts
- backend/src/services/reader/readerAiConfig.ts
- backend/src/services/reader/readerAiModels.ts
- backend/src/services/reader/readerAiService.test.ts
- backend/src/services/reader/readerAiService.ts
- backend/src/services/reader/readerAiSettingsService.test.ts
- backend/src/services/reader/readerAiSettingsService.ts
- backend/src/services/reader/readerContextService.test.ts
- backend/src/services/reader/readerContextService.ts
- backend/src/services/reader/readerHistoryService.test.ts
- backend/src/services/reader/readerHistoryService.ts
- backend/src/types/iTypes.ts
- frontend/public/locales/en/translation.json
- frontend/public/locales/he/translation.json
- frontend/src/components/Reader/EpubReader.tsx
- frontend/src/components/Reader/ReaderAiSettings.tsx
- frontend/src/components/Reader/ReaderChat.tsx
- frontend/src/hooks/reader/useEpubReader.ts
- frontend/src/hooks/reader/useReaderPanels.ts
- frontend/src/hooks/reader/useReaderSelection.ts
- frontend/src/hooks/useReaderChat.ts
- frontend/src/pages/ReaderDetails/ReaderDetails.tsx
- frontend/src/services/readerAiLimits.ts
- frontend/src/services/readerChatApiService.ts
- README.md
- scripts/fixtures/reader-selection.tsx
- scripts/reader-chat.test.cjs
- scripts/reader-selection.browser.test.cjs
- shared/types/readerAiSettings.ts
- shared/types/readerChat.ts
