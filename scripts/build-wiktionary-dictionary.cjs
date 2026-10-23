// Usage: node scripts/build-wiktionary-dictionary.cjs <English JSONL or JSONL.gz> <dump-date YYYY-MM-DD>
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { createHash } = require("node:crypto");
const { createGunzip } = require("node:zlib");
const { createCompiler } = require("./dictionary/wiktionary.cjs");
async function build(input, dumpDate, outputDirectory = path.resolve(__dirname, "../backend/dictionary")) {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(dumpDate || ""))
    throw new Error("Pass the English JSONL (or .gz) file and its dump date (YYYY-MM-DD).");
  const hash = createHash("sha256"), file = fs.createReadStream(input);
  file.on("data", chunk => hash.update(chunk));
  const stream = input.endsWith(".gz") ? file.pipe(createGunzip()) : file;
  if (stream !== file) file.on("error", error => stream.destroy(error));
  const compiler = createCompiler();
  let lines = 0, pending = "", recordStart = 0, repairedRecords = 0;
  for await (const line of readline.createInterface({ input: stream, crlfDelay: Infinity })) {
    lines++;
    if (!pending && !line.trim()) continue;
    if (!pending) recordStart = lines;
    // Some upstream examples contain literal newlines inside a JSON string.
    // Repair only that formatting defect, rather than dropping the whole entry.
    pending = pending ? pending + "\\n" + line : line;
    let record;
    try { record = JSON.parse(pending); }
    catch (error) {
      if (pending.length > 16 * 1024 * 1024 || lines - recordStart > 128)
        throw new Error("Invalid Wiktextract record at line " + recordStart + ": " + error.message);
      continue;
    }
    if (lines !== recordStart) repairedRecords++;
    compiler.consume(record);
    pending = "";
    if (lines % 250000 === 0) console.log("Processed " + lines + " records.");
  }
  if (pending) throw new Error("Truncated Wiktextract record at line " + recordStart);
  const fallback = JSON.parse(fs.readFileSync(path.join(outputDirectory, "english-hebrew.json"), "utf8"));
  const dictionary = compiler.finish(fallback.entries);
  if (!dictionary.counts.headwords) throw new Error("No English-to-Hebrew entries found; refusing to replace the dictionary.");
  const manifest = { schemaVersion: 1, ...dictionary.source,
    downloadUrl: "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl",
    dumpDate, repairedRecords, inputSha256: hash.digest("hex"), inputBytes: fs.statSync(input).size, counts: dictionary.counts,
    modifications: "Filtered to supported English headwords and attested Hebrew translations; grouped by source meaning; quotations and unrelated fields omitted; forms resolved to translated headwords." };
  delete dictionary.counts;
  const output = path.join(outputDirectory, "wiktionary-en-he.json");
  fs.writeFileSync(output + ".tmp", JSON.stringify(dictionary));
  fs.renameSync(output + ".tmp", output);
  fs.writeFileSync(path.join(outputDirectory, "wiktionary-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify(manifest.counts));
}
if (require.main === module) build(process.argv[2], process.argv[3], process.argv[4])
  .catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { build };
