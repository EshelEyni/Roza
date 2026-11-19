// Builds the desktop app for this computer and opens the fresh build.
// 1. Closes a running Roza (on Windows it locks dist\win-unpacked and makes
//    electron-builder fail with EBUSY). "Roza Publish.exe" is not touched.
// 2. Runs `npm run dist:win` on Windows, `npm run dist:mac` on a Mac.
// 3. Opens the built app when the build succeeds.
const { execFileSync, spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const desktop = path.resolve(__dirname, "..");
const isMac = process.platform === "darwin";

const windows = {
  buildScript: "dist:win",
  outDir: path.join(desktop, "dist", "win-unpacked"),
  appPath: path.join(desktop, "dist", "win-unpacked", "Roza.exe"),
  isRunning() {
    try {
      const out = execFileSync("tasklist", ["/FI", "IMAGENAME eq Roza.exe", "/FO", "CSV", "/NH"], { encoding: "utf8" });
      return out.toLowerCase().includes('"roza.exe"');
    } catch {
      return false;
    }
  },
  quit() {
    spawnSync("taskkill", ["/IM", "Roza.exe", "/T", "/F"], { stdio: "ignore" });
  },
  open(appPath) {
    spawn(appPath, [], { cwd: path.dirname(appPath), detached: true, stdio: "ignore" }).unref();
  },
};

const mac = {
  buildScript: "dist:mac",
  outDir: path.join(desktop, "dist", "mac-arm64"),
  appPath: path.join(desktop, "dist", "mac-arm64", "Roza.app"),
  isRunning() {
    return spawnSync("pgrep", ["-x", "Roza"], { stdio: "ignore" }).status === 0;
  },
  quit() {
    spawnSync("osascript", ["-e", 'quit app "Roza"'], { stdio: "ignore" });
  },
  open(appPath) {
    spawnSync("open", [appPath], { stdio: "inherit" });
  },
};

const platform = isMac ? mac : windows;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function closeApp() {
  if (!platform.isRunning()) return;
  console.log("Closing running Roza…");
  platform.quit();
  for (let i = 0; i < 40 && platform.isRunning(); i++) sleep(250);
  if (platform.isRunning()) {
    console.error("Roza is still running. Close it and try again.");
    process.exit(1);
  }
  sleep(500); // let the OS release file handles
}

function clearOldBuild() {
  if (!fs.existsSync(platform.outDir)) return;
  try {
    fs.rmSync(platform.outDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch (error) {
    console.error(`Could not remove ${platform.outDir}: ${error.message}`);
    console.error("Close anything using that folder (Explorer/Finder windows, terminals) and try again.");
    process.exit(1);
  }
}

closeApp();
clearOldBuild();

const build = spawnSync(`npm run ${platform.buildScript}`, {
  cwd: desktop,
  stdio: "inherit",
  shell: true,
  // Without a signing certificate, skip looking for one on a Mac.
  env: { ...process.env, ...(isMac && { CSC_IDENTITY_AUTO_DISCOVERY: "false" }) },
});
if (build.status !== 0) process.exit(build.status ?? 1);

if (!fs.existsSync(platform.appPath)) {
  console.error(`Build finished but ${platform.appPath} was not found.`);
  process.exit(1);
}
console.log(`Opening ${platform.appPath}`);
platform.open(platform.appPath);
