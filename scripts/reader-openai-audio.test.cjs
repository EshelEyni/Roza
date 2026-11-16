const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
function compile(file, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../frontend/src/services", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, ...globals });
  return exports;
}
const tts = compile("readerTts.ts");
function setup(handler) {
  const calls = [], sources = [], contexts = [], frames = new Map(); let frameId = 0;
  class Context {
    state = "suspended"; currentTime = 0; destination = {};
    constructor() { contexts.push(this); }
    resume() { this.state = "running"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({ duration: 10 }); }
    createBufferSource() {
      const source = { playbackRate: { value: 1, setValueAtTime(value) { this.value = value; } },
        connect() {}, disconnect() {}, stop() { this.stopped = true; }, start(_, offset) { this.offset = offset; } };
      sources.push(source); return source;
    }
  }
  const api = compile("readerOpenAiAudio.ts", { require: () => tts, AudioContext: Context, AbortController,
    requestAnimationFrame: callback => {frames.set(++frameId,callback);return frameId;},
    cancelAnimationFrame: id => frames.delete(id),
    crypto: require("node:crypto").webcrypto,
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options });
      const custom = handler?.(url, options);
      if (custom) return custom;
      if (options.method === "POST") return { ok: true, json: async () => ({ status: "success", data: {
        text: "Hello world.", chunkId: "a".repeat(64), audioUrl: "/api/reader/book/audiobook/chunks/" + "a".repeat(64),
      } }) };
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
    },
  });
  return { ...api, calls, sources, contexts, frames, tick: time => {
    contexts[0].currentTime=time; const pending=[...frames.values()]; frames.clear(); pending.forEach(callback=>callback());
  } };
}
const passage = { text: "Hello world.", cfi: "source-range" };

test("OpenAI passages stay within server bounds and retain exact source offsets", () => {
  const { openAiPassage } = setup();
  const text = Array.from({length:200}, (_, i) => "word" + i).join(" ") + " 😀 end";
  const ranges = [], chunks = [];
  let offset = 0;
  while (offset < text.length) {
    const part = openAiPassage({ text, rangeCfi: (a,b) => { ranges.push([a,b]); return `${a}:${b}`; } }, offset, 600);
    assert.ok(part.text.length <= 600 && part.text.length > 0);
    assert.equal(text.slice(...ranges.at(-1)), part.text);
    chunks.push(part.text); offset = part.end; while (text[offset] === " ") offset++;
  }
  assert.equal(chunks.join(" "), text);
  assert.throws(() => openAiPassage({text:"No source"}, 0, 600), /cannot be narrated/);
});

test("pause resumes decoded audio and speed changes locally without regeneration", async () => {
  const env = setup(), player = new env.ReaderOpenAiAudio("book");
  await player.unlock(); let ends=0;
  await player.play(passage,"marin",1,()=>{},()=>ends++);
  env.contexts[0].currentTime=3; player.pause();
  await player.play(passage,"marin",1,()=>{},()=>ends++);
  assert.equal(env.sources[1].offset,3);
  player.setRate(1.5);
  assert.equal(env.sources[1].playbackRate.value,1.5);
  assert.equal(env.calls.filter(call=>call.method==="POST").length,1);
  env.sources[1].onended(); assert.equal(ends,1);
  player.dispose(); assert.equal(env.contexts[0].state,"closed");
});

test("cancellation stops an old generation before a replacement and ignores stale audio", async () => {
  let finish;
  const env=setup((url, options)=>options.method==="POST" && !finish ? new Promise(resolve=>{finish=resolve;}) : undefined);
  const player=new env.ReaderOpenAiAudio("book"); await player.unlock();
  const first=player.play(passage,"marin",1,()=>assert.fail("stale audio started"),()=>{});
  await new Promise(resolve=>setImmediate(resolve));
  player.stop();
  const second=player.play({...passage,cfi:"new-range"},"cedar",1,()=>{},()=>{});
  await second;
  finish({ok:true,json:async()=>({status:"success",data:{text:"Hello world."}})});
  await first;
  assert.equal(env.sources.length,1);
  assert.equal(env.calls[0].signal.aborted,true);
  assert.deepEqual(env.calls.filter(call=>call.method).map(call=>call.method),["POST","DELETE","POST"]);
  player.dispose();
});

test("mismatched source text and API quotas fail without playing or paid retries", async () => {
  for (const mode of ["mismatch","quota"]) {
    const env=setup((url, options)=> options.method==="POST" ? Promise.resolve({
      ok: mode!=="quota", status:429, headers:{get:()=>"60"}, json:async()=>mode==="quota"
        ? {status:"fail",message:"Limit reached."} : {status:"success",data:{text:"Different text"}},
    }) : undefined);
    const player=new env.ReaderOpenAiAudio("book"); await player.unlock();
    await assert.rejects(player.play(passage,"marin",1,()=>{},()=>{}),mode==="quota"?/60 seconds/:/differs/);
    assert.equal(env.sources.length,0); assert.equal(env.calls.length,1); player.dispose();
  }
});

test("an interrupted audio context reports the interruption", async () => {
  const env=setup(); let interrupted=0;
  const player=new env.ReaderOpenAiAudio("book",()=>{interrupted++;player.pause();}); await player.unlock();
  await player.play(passage,"marin",1,()=>{},()=>{});
  env.contexts[0].state="suspended"; env.contexts[0].onstatechange();
  assert.equal(interrupted,1); assert.equal(env.sources[0].stopped,true); player.dispose();
});

test("short sentences and paragraphs share a bounded passage with exact endpoints", () => {
  const {openAiBlock}=setup();
  const sentences=["First sentence.","Another sentence.","Next paragraph."].map((text,index)=>({
    text,paragraph:index<2?0:1,rangeCfi:(a,b)=>`${index}:${a}:${b}`,
  }));
  const block=openAiBlock(sentences,0,0,34);
  assert.equal(block.text,"First sentence. Another sentence.");
  assert.equal(block.cfi,"0:0:15"); assert.equal(block.endCfi,"1:0:17"); assert.equal(block.endIndex,1);
  assert.equal(openAiBlock(sentences,0,0,20).text,"First sentence.");
  assert.equal(openAiBlock(sentences,0,6,600).text,"sentence. Another sentence. Next paragraph.");
  assert.equal(openAiBlock(sentences,0,0,600).endCfi,"2:0:15");
  const long=Array.from({length:8},(_,i)=>({text:Array.from({length:i%3?12:100},(_,j)=>`word${i}_${j}`).join(" ")+".",paragraph:i,rangeCfi:(a,b)=>`${i}:${a}:${b}`}));
  const chunks=[]; let index=0, offset=0;
  while(index<long.length) {
    const part=openAiBlock(long,index,offset,600); chunks.push(part.text);
    assert.ok(part.text.length>0 && part.text.length<=600);
    index=part.endIndex; offset=part.end;
    while(/\s/u.test(long[index].text[offset]||"") && offset<long[index].text.length) offset++;
    if(offset>=long[index].text.length) {index++;offset=0;}
  }
  assert.equal(chunks.join(" "),long.map(sentence=>sentence.text).join(" "),"grouping and long-sentence splits never skip or repeat words");
});

test("look-ahead starts during playback and the next passage reuses its in-flight request", async () => {
  let finish;
  const env=setup((url,options)=>options.method==="POST" && JSON.parse(options.body).passageCfi==="next"
    ? new Promise(resolve=>{finish=resolve;}) : undefined);
  const player=new env.ReaderOpenAiAudio("book"); await player.unlock();
  await player.play(passage,"marin",1,()=>{},()=>{});
  const next={...passage,cfi:"next",endCfi:"next-end"};
  const ahead=player.prefetch(next,"marin");
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(env.sources[0].stopped,undefined,"prefetch never stops current audio");
  assert.equal(env.calls.filter(call=>call.method==="POST").length,2);
  env.sources[0].onended();
  const following=player.play(next,"marin",1,()=>{},()=>{});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(env.calls.filter(call=>call.method==="POST").length,2,"wait on the same generation if it is slow");
  const sent=JSON.parse(env.calls.filter(call=>call.method==="POST")[1].body);
  assert.equal(sent.passageEndCfi,"next-end");
  finish({ok:true,json:async()=>({status:"success",data:{text:"Hello world.",chunkId:"a".repeat(64),audioUrl:"/api/reader/book/audiobook/chunks/"+"a".repeat(64)}})});
  await ahead; await following;
  assert.equal(env.sources.length,2); player.dispose();
});

test("failed prefetch lets current audio finish and is not automatically regenerated", async () => {
  const env=setup((url,options)=>options.method==="POST" && JSON.parse(options.body).passageCfi==="next"
    ? Promise.resolve({ok:false,status:429,headers:{get:()=>"60"},json:async()=>({message:"Limit reached"})}) : undefined);
  const player=new env.ReaderOpenAiAudio("book"); await player.unlock();
  await player.play(passage,"marin",1,()=>{},()=>{});
  const next={...passage,cfi:"next"};
  await assert.rejects(player.prefetch(next,"marin"),/Limit reached/);
  assert.equal(env.sources[0].stopped,undefined);
  env.sources[0].onended();
  await assert.rejects(player.play(next,"marin",1,()=>{},()=>{}),/Limit reached/);
  assert.equal(env.calls.filter(call=>call.method==="POST").length,2);
  player.dispose();
});

test("pause aborts look-ahead without allowing stale audio to start", async () => {
  let finish;
  const env=setup((url,options)=>options.method==="POST" && JSON.parse(options.body).passageCfi==="next"
    ? new Promise(resolve=>{finish=resolve;}) : undefined);
  const player=new env.ReaderOpenAiAudio("book"); await player.unlock();
  await player.play(passage,"marin",1,()=>{},()=>{});
  const oldEnd=env.sources[0].onended;
  const ahead=player.prefetch({...passage,cfi:"next"},"marin");
  await new Promise(resolve=>setImmediate(resolve)); player.pause();
  assert.equal(env.calls.find(call=>call.method==="POST" && JSON.parse(call.body).passageCfi==="next").signal.aborted,true);
  finish({ok:true,json:async()=>({status:"success",data:{text:"Hello world."}})});
  await ahead; oldEnd();
  assert.equal(env.sources.length,1);
  await player.play(passage,"marin",1,()=>{},()=>{});
  assert.equal(env.calls.filter(call=>call.method==="POST").length,2,"resume keeps the current decoded audio");
  player.dispose();
});

test("OpenAI preview requests use the fixed server sample endpoint without client text", async () => {
  const env=setup(), player=new env.ReaderOpenAiAudio("book"); await player.unlock();
  await player.play({...passage,preview:true},"cedar",1,()=>{},()=>{});
  const request=env.calls.find(call=>call.method==="POST");
  assert.equal(request.url,"/api/reader/book/audiobook/preview");
  assert.deepEqual(Object.keys(JSON.parse(request.body)).sort(),["requestId","voice"]);
  player.dispose();
});

test("word highlighting follows measured audio time, gaps, pause/resume and speed", async () => {
  const timings=[{startChar:0,endChar:5,startSeconds:0.5,endSeconds:1.25},{startChar:6,endChar:12,startSeconds:1.5,endSeconds:2.5}];
  const env=setup((_url,options)=> options.method==="POST" ? Promise.resolve({ok:true,json:async()=>({status:"success",data:{
    text:passage.text,chunkId:"a".repeat(64),audioUrl:"/api/reader/book/audiobook/chunks/"+"a".repeat(64),alignment:{wordTimings:timings},
  }})}) : undefined);
  const player=new env.ReaderOpenAiAudio("book"); await player.unlock(); const cues=[];
  await player.play(passage,"marin",1,aligned=>assert.equal(aligned,true),()=>{},word=>cues.push(word?.startChar??null));
  assert.deepEqual(cues,[null],"leading silence does not guess the first word");
  env.tick(0.75); assert.equal(cues.at(-1),0);
  env.tick(1.35); assert.equal(cues.at(-1),null,"no highlight between timed words");
  env.tick(1.75); assert.equal(cues.at(-1),6);
  const stale=[...env.frames.values()][0];
  player.pause(); const before=cues.length; env.tick(5); assert.equal(cues.length,before);
  await player.play(passage,"marin",1,()=>{},()=>{},word=>cues.push(word?.startChar??null));
  assert.equal(env.sources.at(-1).offset,1.75); assert.equal(cues.at(-1),6);
  const count=env.frames.size; stale(); assert.equal(env.frames.size,count,"stale animation frames cannot restart old highlights");
  player.setRate(2); env.tick(5.25); assert.equal(cues.at(-1),6);
  env.tick(5.5); assert.equal(cues.at(-1),null,"speed uses the audio clock, not elapsed wall time");
  assert.equal(env.calls.filter(call=>call.method==="POST").length,1);
  player.dispose(); assert.equal(env.frames.size,0);
});

test("malformed or partial timestamps fall back to passage highlighting", () => {
  const {validateAudiobookTimings,audiobookTimingAt}=setup();
  assert.equal(validateAudiobookTimings([{startChar:0,endChar:5,startSeconds:0,endSeconds:1}],passage.text,2),null);
  assert.equal(validateAudiobookTimings([{startChar:0,endChar:99,startSeconds:0,endSeconds:1},{startChar:6,endChar:12,startSeconds:1,endSeconds:2}],passage.text,2),null);
  assert.equal(audiobookTimingAt([],1),null);
});
