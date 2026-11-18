const { app, BrowserWindow, session, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { readdirSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createKokoroDesktop } = require("./kokoro/index.cjs");

const origin = "https://roza.esheleyni.com";
const renderer = path.join(__dirname, "renderer");
// Development only: point /api at another backend (e.g. http://localhost:3030) to test unreleased
// backend changes from the desktop app. Ignored in packaged builds.
const devApiOrigin = !app.isPackaged && process.env.ROZA_API_ORIGIN ? new URL(process.env.ROZA_API_ORIGIN).origin : null;
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
