// Runs service.py as one long-lived Python process and feeds it one sentence at a time, so a
// sentence the listener is waiting for ("high") can jump ahead of read-ahead and offline saves ("low").
// Ported from RozaReader's server/focus/kokoro.ts.
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { createInterface } = require("node:readline");

/**
 * @param {{ python: () => string, script: string, cwd: string | (() => string), env: () => NodeJS.ProcessEnv, isInstalled: () => boolean,
 *   label?: string, idleMs?: number }} options
 *   `label` names the engine in messages; `idleMs` stops the process after that long without work
 *   (the Chatterbox add-on holds most of the graphics memory while it runs).
 */
function createEngine(options) {
  const label = options.label || "Kokoro";
  const queues = { high: [], low: [] };
  let child = null;
  let status = { state: "stopped" };
  let running = null;
  let nextId = 1;
  let recentErrors = [];
  let idleTimer = null;

  const clearIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  };
  const armIdle = () => {
    clearIdle();
    if (!options.idleMs || running || queues.high.length || queues.low.length) return;
    idleTimer = setTimeout(() => { if (!running && !queues.high.length && !queues.low.length) stop(); }, options.idleMs);
    idleTimer.unref?.();
  };

  const failAll = (message) => {
    const jobs = [...(running ? [running] : []), ...queues.high, ...queues.low];
    running = null;
    queues.high = [];
    queues.low = [];
    for (const job of jobs) job.reject(new Error(message));
  };

  const pump = () => {
    if (running || !child || status.state !== "ready") return;
    const job = queues.high.shift() || queues.low.shift();
    if (!job) return armIdle();
    clearIdle();
    running = job;
    child.stdin.write(`${JSON.stringify({ id: job.id, ...job.request })}\n`);
  };

  const start = () => {
    if (child) return;
    if (!options.isInstalled() || !existsSync(options.script)) {
      status = { state: "missing", message: "Local voices are not installed." };
      return;
    }
    status = { state: "loading", message: `Loading the ${label} voice model…` };
    recentErrors = [];
    const python = options.python();
    const processRef = spawn(python, [options.script], {
      cwd: typeof options.cwd === "function" ? options.cwd() : options.cwd,
      env: { ...options.env(), VIRTUAL_ENV: path.dirname(path.dirname(python)) },
      windowsHide: true,
    });
    child = processRef;
    processRef.stdin.on("error", () => {});

    createInterface({ input: processRef.stdout }).on("line", (line) => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message.event === "ready") {
        status = { state: "ready", ...(message.device ? { device: message.device } : {}) };
        pump();
        return;
      }
      const job = running;
      if (!job || message.id !== job.id) return;
      running = null;
      if (message.ok) job.resolve(message.clips ? { clips: message.clips } : { duration: message.duration || 0, words: message.words || [] });
      else job.reject(new Error(message.error || `${label} could not read this sentence.`));
      pump();
    });

    // Keep the last few log lines, so a crash can say why.
    createInterface({ input: processRef.stderr }).on("line", (line) => {
      recentErrors = [...recentErrors, line].slice(-5);
    });

    const onEnd = (code) => {
      if (child !== processRef) return;
      child = null;
      const reason = recentErrors.filter((line) => line.trim()).at(-1) || `exit code ${code}`;
      status = code === 0 ? { state: "stopped" } : { state: "error", message: `${label} stopped: ${reason}` };
      failAll(status.message || `${label} stopped.`);
    };
    processRef.on("exit", onEnd);
    processRef.on("error", (error) => {
      recentErrors.push(error.message);
      onEnd(1);
    });
  };

  /** @returns {Promise<{ duration: number, words: [number, number][] } | { clips: { duration: number, words: [number, number][] }[] }>} */
  const synthesize = (request, priority) => new Promise((resolve, reject) => {
    start();
    if (!child) return reject(new Error(status.message || `${label} is not running.`));
    clearIdle();
    queues[priority === "low" ? "low" : "high"].push({ id: String(nextId++), request, resolve, reject });
    pump();
  });

  /** Drops queued (not yet started) low-priority work, e.g. when a book's offline save stops. */
  const dropLow = (predicate) => {
    const dropped = queues.low.filter((job) => predicate(job.request));
    queues.low = queues.low.filter((job) => !predicate(job.request));
    for (const job of dropped) job.reject(new Error("Stopped."));
  };

  function stop() {
    clearIdle();
    const current = child;
    child = null;
    status = { state: "stopped" };
    failAll(`${label} was stopped.`);
    if (current) {
      current.stdin.end();
      current.kill();
    }
  }

  return {
    start,
    stop,
    synthesize,
    dropLow,
    status: () => (child || status.state !== "stopped" ? status : options.isInstalled() ? status : { state: "missing" }),
  };
}

module.exports = { createEngine };
