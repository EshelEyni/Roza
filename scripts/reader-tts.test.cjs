const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("../frontend/node_modules/typescript");
const functions = {};
require("node:vm").runInNewContext(ts.transpileModule(fs.readFileSync(require("node:path").join(__dirname, "../frontend/src/services/readerTts.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: functions });
test("word boundaries retain UTF-16 offsets, punctuation and non-English text", () => {
  const text = "First 😀 word. שלום עולם";
  const words = functions.audiobookWords(text);
  assert.deepEqual(Array.from(words, word => text.slice(word.start, word.end)), ["First", "😀", "word.", "שלום", "עולם"]);
  assert.equal(functions.audiobookWordAt(words, 6), 1);
  assert.equal(functions.audiobookWordAt(words, 8), 2);
  assert.equal(functions.audiobookWordAt(words, 999), 4);
});
test("bounded speech chunks preserve every word in long sentences", () => {
  const text = Array.from({length:220}, (_,i)=>"word"+i).join(" ");
  let offset=0; const chunks=[];
  while(offset < text.length) {
    const part=functions.audiobookSpeechSlice(text,offset);
    assert.ok(part.text.length > 0 && part.text.length <= 260);
    chunks.push(part.text); offset=part.end;
    while(text[offset] === " ") offset++;
  }
  assert.equal(chunks.join(" "),text);
});
test("oversized Unicode tokens remain intact across chunks", () => {
  const text="😀".repeat(400)+" tail";
  let offset=0; let rebuilt="";
  while(offset < text.length) {
    const part=functions.audiobookSpeechSlice(text,offset,259);
    assert.ok(part.end > offset);
    assert.ok(part.text.charCodeAt(part.text.length-1) < 0xD800 || part.text.charCodeAt(part.text.length-1) > 0xDBFF);
    rebuilt+=part.text; offset=part.end;
  }
  assert.equal(rebuilt,text);
});
test("section seeking clamps and maps words to exact sentence offsets", () => {
  const section={ totalWords:5, sentences:[
    {startWord:0,words:functions.audiobookWords("First two.")},
    {startWord:2,words:functions.audiobookWords("Next three words.")},
  ]};
  assert.equal(functions.audiobookSeek(section,2).sentence,1);
  assert.equal(functions.audiobookSeek(section,4).offset,11);
  assert.equal(functions.audiobookSeek(section,-1).sentence,0);
  assert.equal(functions.audiobookSeek(section,999).offset,11);
  assert.equal(functions.audiobookTime(65), "1:05");
});
