import { NextFunction, Request, Response } from "express";
import { performance } from "perf_hooks";
import { logger } from "./logger/loggerService";

// Measures where a request's time goes and reports it in the Server-Timing
// header, which browser dev tools show under Network > Timing.
// "pre" covers everything before the controller: waiting for the body to
// upload, JSON parsing, and the sanitizer middlewares.

type Timing = { start: number; last: number; marks: [string, number][] };

const slowRequestMs = 1000;

export function startServerTiming(_req: Request, res: Response, next: NextFunction) {
  const now = performance.now();
  res.locals.serverTiming = { start: now, last: now, marks: [] } satisfies Timing;
  next();
}

/** Records the time since the previous mark under this name. */
export function markTiming(res: Response, name: string) {
  const timing = res.locals.serverTiming as Timing | undefined;
  if (!timing) return;
  const now = performance.now();
  timing.marks.push([name, now - timing.last]);
  timing.last = now;
}

/** Sends JSON and reports the timing marks, including serialization. */
export function sendTimedJson(req: Request, res: Response, payload: unknown) {
  const text = JSON.stringify(payload);
  markTiming(res, "json");
  const timing = res.locals.serverTiming as Timing | undefined;
  if (timing) {
    const total = performance.now() - timing.start;
    const header = [...timing.marks, ["total", total] as [string, number]]
      .map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`)
      .join(", ");
    res.set("Server-Timing", header);
    if (total > slowRequestMs)
      logger.warn(`Slow ${req.method} ${req.originalUrl}: ${header}; response ${text.length} bytes`);
  }
  res.type("json").send(text);
}
