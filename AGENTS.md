# Production deployment authorization

Never execute a command that deploys, redeploys, restarts, or otherwise changes production without the user's explicit instruction authorizing that production action in the current request.

CP and CCP authorize committing and pushing only; they do not authorize production deployment. In particular, do not run npm run deploy:all, npm run deploy:roza, dispatch the production deployment workflow, or send a production redeploy command unless explicitly requested.

A completed deployment does not grant standing permission for future deployments. Read-only production status and health checks are allowed when relevant to the task.
