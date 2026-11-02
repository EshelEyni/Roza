# Production deployment authorization

Never execute a command that deploys, redeploys, restarts, or otherwise changes production without the user's explicit instruction authorizing that production action in the current request.

CP and CCP authorize committing and pushing only; they do not authorize production deployment. In particular, do not run npm run deploy:all, npm run deploy:roza, dispatch the production deployment workflow, or send a production redeploy command unless explicitly requested.

A completed deployment does not grant standing permission for future deployments. Read-only production status and health checks are allowed when relevant to the task.

# Pending work reminder

At the start of the next session working on this project, remind the user that the 75 MiB EPUB upload changes are saved on branch codex/epub-upload-75mib and have not been merged or deployed. The production nginx upload limit also needs a separately authorized update before larger uploads can work in production. Do not merge or deploy this branch without the user's instruction.

