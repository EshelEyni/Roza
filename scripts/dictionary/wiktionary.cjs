const { createHash } = require("node:crypto");
const SOURCE = { name: "Wiktionary", url: "https://en.wiktionary.org/",
  license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" };
const POS = { noun: "n", verb: "v", adj: "a", adv: "r", pron: "pron", prep: "prep",
  conj: "conj", det: "det", intj: "intj", num: "num", name: "name", article: "article", particle: "particle" };
const unique = values => [...new Set(values)];
const normalize = value => typeof value === "string" ? value.normalize("NFKC").replace(/[’‘]/g, "'").trim().toLowerCase() : "";
const validWord = word => /^[a-z]+(?:['-][a-z]+)*$/.test(word) && word.length <= 80;
const glossKey = text => normalize(text).replace(/[.!;:]$/g, "");
const hebrew = (values = []) => values.filter(value =>
  (value.code === "he" || value.lang_code === "he" || value.lang === "Hebrew") &&
  typeof value.word === "string" && /[\u05d0-\u05ea]/.test(value.word) && !value.tags?.includes("to-be-checked"));

function createCompiler() {
  const entries = Object.create(null), aliases = new Map();
  let records = 0;
  function addAlias(form, lemma, pos) {
    form = normalize(form); lemma = normalize(lemma);
    if (!validWord(form) || !validWord(lemma) || form === lemma) return;
    if (!aliases.has(form)) aliases.set(form, new Set());
    aliases.get(form).add(lemma + "\0" + pos);
  }
  function consume(record) {
    if (record.lang_code !== "en") return;
    records++;
    const word = normalize(record.word);
    if (!validWord(word)) return;
    const senses = record.senses || [];
    for (const form of record.forms || []) {
      if (!(form.tags || []).some(tag => ["canonical", "romanization", "table-tags", "error-unknown-tag"].includes(tag)))
        addAlias(form.form, word, POS[record.pos] || "other");
    }
    for (const sense of senses)
      for (const form of [...(sense.form_of || []), ...(sense.alt_of || [])]) addAlias(word, form.word, POS[record.pos] || "other");
    const groups = new Map();
    function group(translations, definition = "", examples = [], labels = []) {
      const meanings = unique(hebrew(translations).map(value => value.word.normalize("NFC").trim()));
      if (!meanings.length) return;
      const key = (POS[record.pos] || "other") + "\0" + glossKey(definition);
      if (!groups.has(key)) groups.set(key, { partOfSpeech: POS[record.pos] || "other",
        meanings: [], explanations: [], definition: definition.trim(), examples: [], labels: [],
        source: SOURCE.name, sourceUrl: "https://en.wiktionary.org/wiki/" + encodeURIComponent(record.word) + "#English" });
      const result = groups.get(key);
      result.meanings = unique([...result.meanings, ...meanings]);
      // Only explicit examples belonging to this sense; omit attributed quotations.
      result.examples = unique([...result.examples, ...examples
        .filter(example => example.type === "example" && !example.ref && typeof example.text === "string")
        .map(example => example.text)]);
      result.labels = unique([...result.labels, ...labels]).filter(label => typeof label === "string");
    }
    for (const sense of senses) group(sense.translations, (sense.glosses || []).join(" "), sense.examples, sense.tags);
    const top = new Map();
    for (const translation of hebrew(record.translations)) {
      const label = typeof translation.sense === "string" ? translation.sense : "";
      if (!top.has(label)) top.set(label, []);
      top.get(label).push(translation);
    }
    for (const [label, translations] of top) {
      // Free-text translation labels need not match definitions. Do not guess associations.
      const match = senses.find(sense => label && (sense.glosses || []).some(gloss => glossKey(gloss) === glossKey(label)));
      const sense = match || (!label && senses.length === 1 ? senses[0] : undefined);
      group(translations, label || (sense?.glosses || []).join(" "), sense?.examples, sense?.tags);
    }
    for (const sense of groups.values()) {
      const signature = JSON.stringify([word, sense.partOfSpeech, sense.definition, sense.meanings.slice().sort()]);
      sense.id = "wikt-" + createHash("sha256").update(signature).digest("hex").slice(0, 20);
      entries[word] ||= [];
      const previous = entries[word].find(value => value.id === sense.id);
      if (previous) {
        previous.examples = unique([...previous.examples, ...sense.examples]);
        previous.labels = unique([...previous.labels, ...sense.labels]);
      } else entries[word].push(sense);
    }
  }
  function finish(fallbackEntries = {}) {
    const forms = Object.create(null);
    function resolve(form, pos, visited = new Set()) {
      const senses = entries[form] || (Object.hasOwn(fallbackEntries, form) ? fallbackEntries[form] : []);
      if (senses.some(sense => sense.partOfSpeech === pos)) return [form];
      if (visited.has(form) || visited.size >= 8) return [];
      const next = new Set(visited).add(form);
      return unique([...(aliases.get(form) || [])].flatMap(target => {
        const [lemma, targetPos] = target.split("\0");
        return pos === targetPos ? resolve(lemma, pos, next) : [];
      }));
    }
    for (const form of [...aliases.keys()].sort()) {
      const targets = unique([...(aliases.get(form) || [])].flatMap(target => {
        const [lemma, pos] = target.split("\0");
        return resolve(lemma, pos);
      })).filter(lemma => lemma !== form);
      if (targets.length) forms[form] = targets;
    }
    return { schemaVersion: 1, source: SOURCE,
      entries: Object.fromEntries(Object.keys(entries).sort().map(word => [word, entries[word]])), forms,
      counts: { sourceRecords: records, headwords: Object.keys(entries).length, forms: Object.keys(forms).length,
        senses: Object.values(entries).reduce((total, senses) => total + senses.length, 0) } };
  }
  return { consume, finish };
}
module.exports = { SOURCE, createCompiler, normalize, validWord };
