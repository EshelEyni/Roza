# Roza for Windows

The desktop app packages the existing Reader and Writing Studio. It serves the
built UI in its own Electron session at `https://roza.esheleyni.com` and uses
Chromium's HTTPS stack for the live `/api`. The existing HTTP-only login cookie
belongs to that desktop session. An internet connection is required for API
operations. Desktop builds disable the web service worker. The web build and
production deployment use their existing commands.

## Build and install locally

Use an x64 Windows machine with Node.js 24 and npm. From the repository root:

```powershell
npm ci --prefix frontend
npm ci --prefix desktop
npm --prefix desktop start
npm --prefix desktop run dist:win
```

The last command builds `desktop/dist/Roza-Setup-0.1.0-x64.exe` for version
0.1.0. Run it and launch Roza from the Start menu for packaged testing. Verify
that `desktop/dist/latest.yml` references the versioned installer, that the
installer's blockmap is adjacent and that `desktop/dist/win-unpacked/resources/app-update.yml`
points at the GitHub release feed. The production origin is public configuration.
The desktop build requires no backend environment file, database credentials, or
provider keys.

## Packaged-app acceptance checks

Use a dedicated Roza test account and an EPUB you have permission to upload.

1. Sign in, close and reopen the installed app, and verify the session survives.
   Sign out, reload, and verify the signed-in library is inaccessible.
2. While signed in, navigate between the Reader, library, and Writing Studio.
   Reload on a nested route and verify it opens correctly.
3. Open an existing EPUB and move between chapters. Upload a test EPUB, open it,
   change position, then relaunch and check the saved position.
4. Open a test Writing Studio project, edit and save a draft, then verify the
   change after reloading. Remove test content as appropriate.
5. Interrupt the network and verify API operations report failure. Restore the
   connection and repeat an API operation.
6. Validate an upgrade with two signed NSIS versions on a Windows test machine
   and a publicly readable test release feed. The updater checks on launch and
   downloads available stable updates for installation on quit.

## First release

1. Confirm public read access for the release repository and configure Windows
   signing using `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` in GitHub Actions.
2. Set the desktop version in both npm manifests using
   `npm --prefix desktop version <version> --no-git-tag-version` when a bump is
   needed. Commit the desktop changes to main and push after approval.
3. Run **Build Roza for Windows** on main. With **Upload a draft GitHub release
   for review** unchecked, the installer is available as a workflow artifact.
   Enable that input when ready to stage a draft release. The workflow builds
   and attaches the versioned installer, its blockmap, `latest.yml`, and a
   stable-name installer alias.
4. Verify the draft assets and the installer signature. After explicit approval,
   publish the draft as the latest stable GitHub Release. Keep the versioned
   installer, blockmap and metadata together as emitted by the build.
5. Use [Download Roza for Windows](https://github.com/EshelEyni/Roza/releases/latest/download/Roza-Setup-x64.exe)
   on the website after verifying the URL while signed out of GitHub.

## Before public distribution

- Complete packaged acceptance checks with a real test login, EPUB, and Writing Studio project.
- Establish a consistent Windows signing identity and test installation and update
  behavior on a clean Windows machine.
- Confirm the release feed and stable download URL are publicly readable. If the
  source repository must remain private, move the release assets to a public
  release repository and point the builder and website at that repository.
