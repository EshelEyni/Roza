# Staging Room in ROZA Desktop

Sign in to ROZA Desktop as an administrator and select **Staging Room**. Review proposed chapters and edits in the main ROZA window before applying them to the manuscript. Use the main navigation to return to another area of ROZA.

Set the user environment variable `ROZA_STAGING_ROOM_HOME` to the absolute path of your existing project folder, the one that contains `books/` and the publisher's optional `.env`. Restart ROZA Desktop after changing it. Development builds also discover a sibling `roza-publish` checkout containing `books/`. The workspace runs from ROZA's own code and needs no separate publisher executable.

The workspace reads the existing book files, list preferences, backup files, and sync state in place. It uses the same publisher database configuration, including the existing ROZA backend `.env` fallback. Compare, Pull and Push work against that configured database. Configure Staging Room only on machines trusted with those credentials and use one publisher at a time per project folder.
