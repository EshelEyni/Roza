// Serves Kokoro clips at https://roza.esheleyni.com/__kokoro/… with byte ranges, so <audio> can seek.
const { createReadStream } = require("node:fs");
const { stat } = require("node:fs/promises");
const path = require("node:path");
const { Readable } = require("node:stream");

const AUDIO_PATH = /^\/__kokoro\/(?:audio\/([a-f0-9]{24})\/([a-z]{2}_[a-z]+)\/(\d+-\d+-[a-f0-9]{16})|preview\/([a-z]{2}_[a-z]+-[a-f0-9]{16}))\.wav$/;

/** Returns null for paths outside /__kokoro/, so the caller can serve them. */
async function serveKokoroAudio(request, url, audioDir) {
  if (!url.pathname.startsWith("/__kokoro/")) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
  const match = url.pathname.match(AUDIO_PATH);
  if (!match) return new Response(null, { status: 404 });
  const file = match[4]
    ? path.join(audioDir, "_preview", `${match[4]}.wav`)
    : path.join(audioDir, match[1], match[2], `${match[3]}.wav`);
  if (!path.resolve(file).startsWith(path.resolve(audioDir) + path.sep)) return new Response(null, { status: 404 });
  let info;
  try { info = await stat(file); } catch { return new Response(null, { status: 404 }); }

  const headers = new Headers({
    "Content-Type": "audio/wav",
    "Accept-Ranges": "bytes",
    // Both narration and preview URLs include a content hash.
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0;
  let end = info.size - 1;
  let status = 200;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    } else {
      start = Math.max(info.size - Number(range[2]), 0);
    }
    if (start > end || start >= info.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    }
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
  }
  headers.set("Content-Length", String(end - start + 1));
  if (request.method === "HEAD") return new Response(null, { status, headers });
  return new Response(Readable.toWeb(createReadStream(file, { start, end })), { status, headers });
}

module.exports = { serveKokoroAudio };
