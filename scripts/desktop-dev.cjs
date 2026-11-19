// One command for the desktop app in development: `npm run desktop:dev` (repo root).
//
// 1. Downloads the Electron binary if npm skipped it.
// 2. Uses the local backend on port 3030, starting it (npm run dev in backend/) if it isn't running.
// 3. Rebuilds the page files (desktop/renderer) only when the frontend changed since the last build,
//    or always with `npm run desktop:dev -- --rebuild`.
// 4. Opens the app from source (no installer build) against the local backend, with its own app data
//    in %APPDATA%\Roza-Dev. Closing the app stops the backend if this script started it.
const { spawn, spawnSync } = require("node:child_process");
const { existsSync, readdirSync, statSync } = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const desktop = path.join(root, "desktop");
const frontend = path.join(root, "frontend");
const rendererIndex = path.join(desktop, "renderer", "index.html");
const electron = path.join(desktop, "node_modules", "electron", "dist", process.platform === "win32" ? "electron.exe" : "electron");
const PORT = 3030;
const DATA_DIR = "Roza-Dev";
const rebuild = process.argv.includes("--rebuild");

const log = (message) => console.log(`[desktop:dev] ${message}`);

function fail(message) {
  console.error(`[desktop:dev] ${message}`);
  process.exit(1);
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
  });
}

/** Runs an npm script to completion (npm is a .cmd on Windows, so it needs a shell). */
function npm(args, cwd) {
  const result = spawnSync("npm", args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) fail(`"npm ${args.join(" ")}" failed.`);
}

/** Newest change time of any file in a folder tree. */
function newest(folder) {
  let latest = 0;
  for (const entry of readdirSync(folder, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    latest = Math.max(latest, statSync(path.join(entry.parentPath, entry.name)).mtimeMs);
  }
  return latest;
}

function frontendChanged() {
  if (!existsSync(rendererIndex)) return true;
  const built = statSync(rendererIndex).mtimeMs;
  const sources = [path.join(frontend, "src"), path.join(frontend, "public")].filter(existsSync).map(newest);
  const files = ["index.html", "vite.config.ts", "package.json"].map((name) => path.join(frontend, name)).filter(existsSync)
    .map((file) => statSync(file).mtimeMs);
  return Math.max(...sources, ...files) > built;
}

/** Stops a process and everything it started (nodemon → ts-node). */
function stopTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

(async () => {
  for (const folder of ["frontend", "desktop", "backend"]) {
    if (!existsSync(path.join(root, folder, "node_modules"))) {
      log(`Installing ${folder} packages…`);
      npm(["ci"], path.join(root, folder));
    }
  }
  if (!existsSync(electron)) {
    log("Downloading the Electron binary…");
    const result = spawnSync(process.execPath, [path.join(desktop, "node_modules", "electron", "install.js")], { stdio: "inherit" });
    if (result.status !== 0 || !existsSync(electron)) fail("Electron could not be downloaded.");
  }

  let backend = null;
  if (await isPortOpen(PORT)) {
    log(`Using the backend already running on port ${PORT}.`);
  } else {
    if (!existsSync(path.join(root, "backend", ".env"))) fail("backend/.env is missing. Copy it from your main checkout first.");
    log(`Starting the local backend on port ${PORT}…`);
    backend = spawn("npm", ["run", "dev"], { cwd: path.join(root, "backend"), stdio: "inherit", shell: true });
    let exited = false;
    backend.once("exit", () => { exited = true; });
    const started = Date.now();
    while (!(await isPortOpen(PORT))) {
      if (exited) fail("The backend stopped while starting. See its output above.");
      if (Date.now() - started > 120000) { stopTree(backend); fail("The backend did not start within 2 minutes."); }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    log("Backend is ready.");
  }

  const cleanUp = () => stopTree(backend);
  process.on("SIGINT", () => { cleanUp(); process.exit(130); });
  process.on("exit", cleanUp);

  if (rebuild || frontendChanged()) {
    log("Building the page files from the frontend…");
    npm(["run", "build:frontend"], desktop);
  } else {
    log("Page files are up to date (use -- --rebuild to force a build).");
  }

  log(`Opening Roza (API: http://localhost:${PORT}, app data: %APPDATA%\\${DATA_DIR}).`);
  const app = spawn(electron, [desktop, `--api-origin=http://localhost:${PORT}`, `--data-dir=${DATA_DIR}`], { cwd: desktop, stdio: "inherit" });
  app.once("exit", (code) => {
    if (backend) log("App closed; stopping the backend it started.");
    cleanUp();
    process.exit(code ?? 0);
  });
})().catch((error) => fail(error.message));
