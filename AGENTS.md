# Production deployment authorization

Never execute a command that deploys, redeploys, restarts, or otherwise changes production without the user's explicit instruction authorizing that production action in the current request.

CP and CCP authorize committing and pushing only; they do not authorize production deployment. In particular, do not run npm run deploy:all, npm run deploy:roza, dispatch the production deployment workflow, or send a production redeploy command unless explicitly requested.

A completed deployment does not grant standing permission for future deployments. Read-only production status and health checks are allowed when relevant to the task.

# Pending work reminder

At the start of the next session working on this project, remind the user that the 75 MiB EPUB upload changes are saved on branch codex/epub-upload-75mib and have not been merged or deployed. The production nginx upload limit also needs a separately authorized update before larger uploads can work in production. Do not merge or deploy this branch without the user's instruction.


# Backend/shared module boundary — recurring ERR_REQUIRE_ESM

The backend development runtime uses CommonJS through ts-node/nodemon. The root package.json has "type": "module", so runtime imports from shared/types/*.ts can crash startup with "Must use import to load ES Module" / "require() of ES modules is not supported".

Use `import type` for shared TypeScript contracts in backend code. Keep runtime defaults, validators, and constants in backend-owned modules, following the existing reader keyboard settings pattern, unless a shared runtime module has explicitly been made compatible with both runtimes. Do not change the root package module type to work around this error.

Ticket #23 reproduced this on 2026-11-14: readerProgressSettingsController.ts imported defaultReaderProgressSettings and isReaderProgressSettings as runtime values from shared/types/readerProgressSettings.ts. TypeScript checks and Jest passed but did not catch the development startup failure. Verify actual backend development runtime module loading as well as compilation and tests. The regression test is scripts/reader-progress-runtime.test.cjs.
