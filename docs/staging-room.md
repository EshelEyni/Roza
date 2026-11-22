# Staging Room in ROZA Desktop

Sign in to ROZA Desktop as an administrator and select **Staging Room**. Review proposed chapters and edits in the main ROZA window before applying them to the manuscript. Use the main navigation to return to another area of ROZA.

Save a file named `staging-room.json` in ROZA Desktop's user profile. On Windows this is normally `%APPDATA%\Roza\staging-room.json`. If you launch with `npm run desktop:dev`, use `%APPDATA%\Roza-Dev\staging-room.json`.

```json
{
  "projectFolder": "C:/dev/roza-publish"
}
```

Use the absolute path of the folder that contains `books/` and the optional database `.env`. Fully quit and reopen ROZA Desktop after editing the file. The file takes precedence over the existing `ROZA_STAGING_ROOM_HOME` and `ROZA_PUBLISH_HOME` environment variables. Development builds also discover a sibling `roza-publish` checkout containing `books/`.

The workspace reads the existing book files, list preferences, backup files, and sync state in place. It uses the same publisher database configuration, including the existing ROZA backend `.env` fallback. Compare, Pull and Push work against that configured database. Configure Staging Room only on machines trusted with those credentials and use one publisher at a time per project folder.
