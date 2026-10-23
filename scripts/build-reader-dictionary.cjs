// Usage: node scripts/build-reader-dictionary.cjs <extracted WordNet-3.0 directory>
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../backend/dictionary");
const source = process.argv[2];
if (!source) throw new Error("Pass the extracted WordNet-3.0 directory.");
const hebrew = {};
for (const line of fs.readFileSync(path.join(root, "hebrew.tab"), "utf8").split(/\r?\n/)) {
  const [id, field, ...values] = line.split("\t");
  if (!field) continue;
  const sense = hebrew[id] ||= { id, partOfSpeech: id.slice(-1), meanings: [], explanations: [], examples: [] };
  if (field === "heb:lemma") {
    const value = values[0].replace(/^!/, "").replace(/_/g, " ");
    if (/[\u0590-\u05ff]/.test(value) && !sense.meanings.includes(value)) sense.meanings.push(value);
  } else if (field === "heb:def") sense.explanations.push(values.slice(1).join("\t"));
}
const entries = Object.create(null), forms = Object.create(null);
for (const pos of ["noun", "verb", "adj", "adv"]) {
  const data = fs.readFileSync(path.join(source, "dict/data." + pos), "utf8");
  for (const line of data.split("\n")) {
    if (!/^\d{8} /.test(line)) continue;
    const [fields, gloss = ""] = line.split(" | ");
    const tokens = fields.trim().split(/\s+/);
    const id = tokens[0] + "-" + (tokens[2] === "s" ? "a" : tokens[2]);
    const sense = hebrew[id];
    if (!sense?.meanings.length) continue;
    const examples = [...gloss.matchAll(/"([^"]+)"/g)].map(match => match[1]);
    const definition = gloss.replace(/;?\s*"[^"]*"/g, "").trim();
    const result = { ...sense, definition, examples };
    const count = parseInt(tokens[3], 16);
    for (let i = 0; i < count; i++) {
      const word = tokens[4 + i * 2].replace(/\([aps]\)$/, "").replace(/_/g, " ").toLowerCase();
      (entries[word] ||= []).push(result);
    }
  }
  for (const line of fs.readFileSync(path.join(source, "dict/" + pos + ".exc"), "utf8").split("\n")) {
    const [form, ...lemmas] = line.trim().split(/\s+/);
    for (const lemma of lemmas) if (entries[lemma]) (forms[form] ||= []).push(lemma);
  }
}
// WordNet index files list senses in lexical frequency order, rather than byte-offset order.
for (const pos of ["noun", "verb", "adj", "adv"]) {
  for (const line of fs.readFileSync(path.join(source, "dict/index." + pos), "utf8").split("\n")) {
    if (!line || /^\s/.test(line)) continue;
    const tokens = line.trim().split(/\s+/);
    const word = tokens[0].replace(/_/g, " ").toLowerCase();
    if (!entries[word]) continue;
    const pointers = Number(tokens[3]);
    const ids = tokens.slice(6 + pointers).map(offset => offset + "-" + tokens[1]);
    entries[word].sort((left, right) => {
      const a = ids.indexOf(left.id), b = ids.indexOf(right.id);
      return (a < 0 ? Infinity : a) - (b < 0 ? Infinity : b);
    });
  }
}
fs.writeFileSync(path.join(root, "english-hebrew.json"), JSON.stringify({ source: "Princeton WordNet 3.0 / Hebrew WordNet (OMW)", entries, forms }));
fs.copyFileSync(path.join(source, "COPYING"), path.join(root, "WORDNET-LICENSE"));
console.log(Object.keys(entries).length + " English headwords compiled.");
