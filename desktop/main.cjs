const { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, screen, session, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { existsSync, readdirSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createKokoroDesktop } = require("./kokoro/index.cjs");

const { registerDevBoard } = require("./dev-board/index.cjs");

const origin = "https://roza.esheleyni.com";
const renderer = path.join(__dirname, "renderer");
// Development-only command-line switches (ignored in packaged builds; see "npm run desktop:dev"):
//   --api-origin=http://localhost:3030   send /api to that backend instead of production
//   --data-dir=Roza-Dev                  keep app data (sign-in, local voices, saved audio) in this folder,
//                                        relative to %APPDATA% unless absolute
function devSwitch(name) {
  if (app.isPackaged) return null;
  const prefix = "--" + name + "=";
  const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
  return value || null;
}
const devApiOrigin = devSwitch("api-origin") ? new URL(devSwitch("api-origin")).origin : null;
const devDataDir = devSwitch("data-dir");
if (devDataDir) app.setPath("userData", path.resolve(app.getPath("appData"), devDataDir));
const devStagingRoomHome = path.resolve(__dirname, "..", "..", "roza-publish");
const configuredStagingRoomHome = process.env.ROZA_STAGING_ROOM_HOME || process.env.ROZA_PUBLISH_HOME ||
  (!app.isPackaged && existsSync(path.join(devStagingRoomHome, "books")) ? devStagingRoomHome : null);
const stagingRoomHome = configuredStagingRoomHome && path.isAbsolute(configuredStagingRoomHome)
  ? configuredStagingRoomHome : null;
let mainWindow = null;
const kokoro = createKokoroDesktop({ app, origin, getWindow: () => mainWindow });
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  `script-src ${origin}/assets/`,
  "style-src 'self' 'unsafe-inline' blob:",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data: blob:",
  "frame-src 'self' blob:",
  "media-src 'self' blob: data:",
  "connect-src 'self' https://api.cloudinary.com",
].join("; ");

function isApi(url) {
  return url.pathname === "/api" || url.pathname.startsWith("/api/");
}

function registerRenderer(browserSession) {
  if (!existsSync(path.join(renderer, "index.html"))) {
    throw new Error("The page files are missing (desktop/renderer). Run npm run desktop:dev:build once.");
  }
  const files = new Set(readdirSync(renderer, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(renderer, path.join(entry.parentPath, entry.name))
      .split(path.sep).map(encodeURIComponent).join("/")));

  browserSession.protocol.handle("https", async (request) => {
    const url = new URL(request.url);
    const fetchNetwork = (input, init) => browserSession.fetch(input, {
      ...init,
      bypassCustomProtocolHandlers: true,
    });
    if (url.origin !== origin) return fetchNetwork(request);
    if (isApi(url)) {
      if (["document", "iframe", "frame"].includes(request.headers.get("sec-fetch-dest"))) {
        return new Response(null, { status: 403 });
      }
      if (devApiOrigin) {
        const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
        return fetchNetwork(devApiOrigin + url.pathname + url.search, {
          method: request.method, headers: request.headers, body, credentials: "include", redirect: "error", cache: "no-store",
        });
      }
      return fetchNetwork(request, { credentials: "include", redirect: "error", cache: "no-store" });
    }
    const kokoroAudio = await kokoro.handleAudio(request, url);
    if (kokoroAudio) return kokoroAudio;
    if (request.method !== "GET") return new Response(null, { status: 405 });

    const asset = url.pathname.slice(1);
    const wantsDocument = url.pathname === "/" || request.headers.get("accept")?.includes("text/html");
    const file = files.has(asset) ? asset : wantsDocument ? "index.html" : null;
    if (!file) return new Response(null, { status: 404 });

    const response = await fetchNetwork(pathToFileURL(path.join(renderer, decodeURIComponent(file))).href);
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", csp);
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  });
}

// The page favicon doesn't reach the window, so the reading room swaps the window icon here.
// Windows keeps the Roza shortcut icon on the taskbar button, so each area adds a small badge
// over it: an open book in the reading room, headphones while an audiobook plays, a quill
// in the writing studio. Badge artwork: assets/badges/src/*.svg, rendered to 256 px PNGs.
const windowIcons = {
  app: path.join(renderer, "images", "icon-512X512.png"),
  reader: path.join(renderer, "images", "reader-favicon.ico"),
};
const badges = {
  reading: { file: "reading.png", label: "Reading room" },
  audio: { file: "audio.png", label: "Audiobook playing" },
  writing: { file: "writing.png", label: "Writing studio" },
};
const loadedImages = {};
const taskbar = { area: "other", audioPlaying: false, icon: null, badge: undefined };

function image(file) {
  loadedImages[file] ??= nativeImage.createFromPath(file);
  return loadedImages[file];
}

// Windows draws the overlay at 16 px times the display scale and stretches anything smaller,
// so the 256 px artwork is shrunk to that exact size here.
function overlayImage(window, badge) {
  const source = image(path.join(__dirname, "assets", "badges", badges[badge].file));
  if (source.isEmpty()) return null;
  const size = Math.round(16 * screen.getDisplayMatching(window.getBounds()).scaleFactor);
  return source.resize({ width: size, height: size, quality: "best" });
}

function areaOf(url) {
  try {
    const { pathname } = new URL(url);
    if (pathname === "/reader" || pathname.startsWith("/reader/")) return "reading";
    if (pathname === "/books" || pathname.startsWith("/book/") || pathname.startsWith("/book-edit/")) return "writing";
  } catch {}
  return "other";
}

function updateTaskbar(window) {
  if (window.isDestroyed()) return;
  const icon = taskbar.area === "reading" ? "reader" : "app";
  if (icon !== taskbar.icon && !image(windowIcons[icon]).isEmpty()) {
    window.setIcon(image(windowIcons[icon]));
    taskbar.icon = icon;
  }
  if (process.platform !== "win32") return;
  const badge = taskbar.area === "reading" ? (taskbar.audioPlaying ? "audio" : "reading")
    : taskbar.area === "writing" ? "writing" : null;
  if (badge === taskbar.badge) return;
  window.setOverlayIcon(badge ? overlayImage(window, badge) : null, badge ? badges[badge].label : "");
  taskbar.badge = badge;
}

function onPageNavigated(window, url) {
  taskbar.area = areaOf(url);
  if (taskbar.area !== "reading") taskbar.audioPlaying = false;
  updateTaskbar(window);
}

function registerTaskbarBadge(window) {
  ipcMain.on("taskbar:audio-playing", (event, playing) => {
    // Only the app's own top-level page may change the badge; book iframes may not.
    if (event.sender !== window.webContents || event.senderFrame !== event.sender.mainFrame) return;
    taskbar.audioPlaying = playing === true;
    updateTaskbar(window);
  });
}

function registerStagingRoom(window, browserSession) {
  if (!stagingRoomHome) return;
  const { stagingRoomHandlers } = require("./staging-room-build/desktop/staging-room/handlers.js");
  const handlers = stagingRoomHandlers(stagingRoomHome, shell.openPath);
  let authorization;
  const fromStagingRoom = (event) =>
    !window.isDestroyed() && event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    window.webContents.getURL().split(/[?#]/, 1)[0] === origin + "/staging-room";

  // Share a live check across concurrent requests from the same page.
  async function checkAdmin() {
    const response = await browserSession.fetch(
      (devApiOrigin || origin) + "/api/auth/login/with-token",
      {
        bypassCustomProtocolHandlers: true,
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return false;
    const { status, data } = await response.json();
    return status === "success" && Array.isArray(data?.roles) && data.roles.includes("admin");
  }

  for (const [action, handle] of Object.entries(handlers)) {
    ipcMain.handle("staging-room:" + action, async (event, ...args) => {
      if (!fromStagingRoom(event)) throw new Error("Staging Room access denied.");
      authorization ??= checkAdmin().catch(() => false).finally(() => { authorization = undefined; });
      if (!await authorization || !fromStagingRoom(event)) throw new Error("Staging Room access denied.");
      const log = (level, message) => {
        if (fromStagingRoom(event)) {
          event.sender.send("staging-room:log", { at: new Date().toISOString(), level, text: redact(message) });
        }
      };
      try {
        return await handle(log, ...args);
      } catch (error) {
        throw new Error(redact(error instanceof Error ? error.message : String(error)));
      }
    });
  }
}

function redact(message) {
  return String(message).replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, "[database address]");
}

function openInBrowser(url) {
  const target = new URL(url);
  if (target.protocol === "https:" && !target.username && !target.password) {
    void shell.openExternal(target.href).catch(console.error);
  }
}

app.enableSandbox();

app.whenReady().then(async () => {
  app.setAppUserModelId("com.esheleyni.roza");
  const browserSession = session.fromPartition("persist:roza-desktop");
  browserSession.setPermissionCheckHandler(() => false);
  browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  registerRenderer(browserSession);
  kokoro.register();

  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      session: browserSession,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      additionalArguments: stagingRoomHome ? ["--roza-staging-room-enabled"] : [],
    },
  });
  mainWindow = window;

  window.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    if (target.origin === origin && !isApi(target)) return;
    event.preventDefault();
    if (target.origin !== origin) openInBrowser(url);
  });
  window.webContents.on("will-redirect", (event) => event.preventDefault());
  window.webContents.on("did-navigate", (_event, url) => onPageNavigated(window, url));
  window.webContents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
    if (isMainFrame) onPageNavigated(window, url);
  });
  registerTaskbarBadge(window);
  registerDevBoard({ app, ipcMain, dialog, clipboard, shell, window, origin });
  registerStagingRoom(window, browserSession);
  window.webContents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url);
    return { action: "deny" };
  });

  await window.loadURL(origin + "/");

  if (app.isPackaged && process.platform === "win32") {
    autoUpdater.disableWebInstaller = true;
    autoUpdater.on("error", (error) => console.error("Roza update failed", error));
    void autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }
}).catch((error) => {
  console.error("Could not start Roza", error);
  app.exit(1);
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => kokoro.shutdown());
