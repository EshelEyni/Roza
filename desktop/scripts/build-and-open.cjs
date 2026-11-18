// Builds the Windows desktop app and opens the fresh build.
// 1. Closes any running Roza.exe (it locks dist\win-unpacked and makes
//    electron-builder fail with EBUSY). "Roza Publish.exe" is not touched.
// 2. Runs `npm run dist:win`.
// 3. Opens dist\win-unpacked\Roza.exe when the build succeeds.
const { execFileSync, spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const desktop = path.resolve(__dirname, "..");
const unpacked = path.join(desktop, "dist", "win-unpacked");
const exe = path.join(unpacked, "Roza.exe");
const image = "Roza.exe";

function isRunning() {
  try {
    const out = execFileSync(
      "tasklist",
      ["/FI", `IMAGENAME eq ${image}`, "/FO", "CSV", "/NH"],
      { encoding: "utf8" },
    );
    return out.toLowerCase().includes(`"${image.toLowerCase()}"`);
  } catch {
    return false;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function closeApp() {
  if (!isRunning()) return;
  console.log(`Closing running ${image}…`);
  spawnSync("taskkill", ["/IM", image, "/T", "/F"], { stdio: "ignore" });
  for (let i = 0; i < 40 && isRunning(); i++) sleep(250);
  if (isRunning()) {
    console.error(`${image} is still running. Close it and try again.`);
    process.exit(1);
  }
  sleep(500); // let Windows release file handles
}

function clearOldBuild() {
  if (!fs.existsSync(unpacked)) return;
  try {
    fs.rmSync(unpacked, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch (error) {
    console.error(`Could not remove ${unpacked}: ${error.message}`);
    console.error("Close anything using that folder (Explorer windows, terminals) and try again.");
    process.exit(1);
  }
}

closeApp();
clearOldBuild();

const build = spawnSync("npm run dist:win", {
  cwd: desktop,
  stdio: "inherit",
  shell: true,
});
if (build.status !== 0) process.exit(build.status ?? 1);

if (!fs.existsSync(exe)) {
  console.error(`Build finished but ${exe} was not found.`);
  process.exit(1);
}
console.log(`Opening ${exe}`);
spawn(exe, [], { cwd: unpacked, detached: true, stdio: "ignore" }).unref();
