const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const JSZip = require("../frontend/node_modules/jszip");
const root = path.resolve(__dirname, "..");
async function epub() {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    "book.opf",
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">rsvp</dc:identifier><dc:title>RSVP</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="note" href="note.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="note" linear="no"/><itemref idref="b"/></spine></package>',
  );
  zip.file(
    "a.xhtml",
    "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head><title>A Quiet Morning</title></head><body><p>At the <em>edge</em> of the little town, where the road turned toward the fields, the morning arrived without ceremony. The first light touched the windows, and a pale breeze moved through the trees. Nothing seemed especially remarkable, yet the world felt different from the evening before.</p><p>Thomas opened his notebook and looked at the empty page. He had carried it with him for weeks, convinced that one day he would find the right words. Now, sitting beside the window, he wondered whether words were really what he had been looking for. Somewhere beyond the garden, a bird began to sing.</p><p>The kettle clicked in the kitchen. He rose slowly, poured a cup of tea, and watched the steam drift into the cold air. Across the street, a woman in a blue coat hurried toward the station. A dog followed her for a moment and then returned to the warmth of its doorway.</p><p>It was a morning like many others, and that was precisely what made it beautiful. He understood, for the first time in many months, that he did not need to go anywhere. The quiet room, the distant bells, and the light on the table were enough.</p><p>Later, when the rain began, he would remember the smallness of this moment. Not because anything extraordinary had happened, but because he had finally stopped expecting it to. He picked up his pen and began to write.</p><p hidden=\"hidden\">Hidden text</p></body></html>",
  );
  zip.file(
    "note.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Note</title></head><body><p>Footnote</p></body></html>',
  );
  zip.file(
    "b.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>B</title></head><body><p>A new day began. He opened the window.</p></body></html>',
  );
  zip.file("nav.xhtml", '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="a.xhtml">A Quiet Morning</a></li><li><a href="b.xhtml">The Next Day</a></li></ol></nav></body></html>');
  return zip.generateAsync({ type: "nodebuffer" });
}
test(
  "Audiobook Mode: system speech, real EPUB follow-along and footer",
  { timeout: 600000 },
  async (t) => {
    const { createServer } = await import(
      pathToFileURL(
        path.join(root, "frontend/node_modules/vite/dist/node/index.js"),
      )
    );
    const { default: react } = await import(
      pathToFileURL(
        path.join(
          root,
          "frontend/node_modules/@vitejs/plugin-react/dist/index.mjs",
        ),
      )
    );
    let file = await epub();
    const saves = [];
    let storedNarrator = null;
    const lookups = [];
    const aliases = [
      "react",
      "react-dom",
      "react-router-dom",
      "epubjs",
      "react-icons",
      "i18next",
      "react-i18next",
      "axios",
    ].map((name) => ({
      find: name,
      replacement: path
        .join(root, "frontend/node_modules", name)
        .replaceAll("\\", "/"),
    }));
    const server = await createServer({
      configFile: false,
      appType: "custom",
      root,
      cacheDir: path.join(root, "frontend/node_modules/.vite-tts-test"),
      plugins: [react()],
      resolve: { alias: aliases },
      optimizeDeps: { entries: ["scripts/fixtures/reader-rsvp.tsx"] },
      server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
    });
    server.middlewares.use("/rsvp-state", (_, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(saves.length ? saves[saves.length - 1] : "null");
    });
    server.middlewares.use("/api/reader/rsvp/file", (_, res) => {
      res.setHeader("Content-Type", "application/epub+zip");
      res.end(file);
    });
    server.middlewares.use("/api/", (req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        if(req.url.endsWith("/audiobook/config")) {
          res.setHeader("Content-Type","application/json");
          res.end(JSON.stringify({status:"success",data:{available:false,voices:[],defaultVoice:"marin",maxChars:600,narrator:storedNarrator}})); return;
        }
        if(req.url.endsWith("/audiobook/narrator") && req.method==="PATCH") {
          storedNarrator=JSON.parse(body); res.setHeader("Content-Type","application/json");
          res.end(JSON.stringify({status:"success",data:storedNarrator})); return;
        }
        if (body && req.url.includes("/state")) saves.push(body);
        if (req.url.includes("dictionary")) lookups.push(JSON.parse(body));
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            status: "success",
            data: {
              entry: {
                word: "reading",
                headword: "reading",
                source: "Fixture",
                senses: [
                  {
                    id: "1",
                    partOfSpeech: "verb",
                    meanings: ["שלום"],
                    explanations: [],
                    definition: "",
                    examples: [],
                    labels: [],
                  },
                ],
              },
              lookupCount: 1,
            },
          }),
        );
      });
    });
    server.middlewares.use("/rsvp-test", async (_, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        await server.transformIndexHtml(
          "/rsvp-test",
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}.reader-shell{height:100dvh}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-rsvp.tsx"></script></body></html>',
        ),
      );
    });
    await server.listen();
    try {
      for (const mobile of [false, true]) await t.test(mobile ? "mobile system follow-along" : "desktop system follow-along", async () => {
        storedNarrator=null;
        saves.length = 0;
        const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
        try {
          const page = await browser.newPage({ viewport: { width: mobile ? 375 : 1280, height: 844 }, hasTouch: mobile, isMobile: mobile });
          page.setDefaultTimeout(30000);
          await page.addInitScript(() => {
            const synth = new EventTarget();
            window.spoken=[]; window.cancelled=0; window.workers=0;
            synth.getVoices=()=>window.testVoices || [];
            synth.speak=utterance=>{ window.spoken.push(utterance); queueMicrotask(()=>utterance.onstart?.()); };
            synth.cancel=()=>window.cancelled++;
            synth.resume=()=>{};
            Object.defineProperty(window,"speechSynthesis",{value:synth});
            window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
            window.Worker=class {constructor(){window.workers++; throw new Error("Audiobook must not load a model");}};
          });
          await page.goto(server.resolvedUrls.local[0]+"rsvp-test");
          await page.waitForFunction(()=>window.rsvpTest?.reader.loading===false);
          const source=await page.evaluate(async()=>{
            const first=await window.rsvpTest.reader.audiobook.loadSection();
            const next=await window.rsvpTest.reader.audiobook.loadSection(1,1);
            return {title:first.title,sentences:first.sentences.map(s=>({text:s.text,paragraph:s.paragraph})),next:next.section,total:first.totalWords};
          });
          assert.equal(source.title,"A Quiet Morning");
          assert.equal(source.next,2,"non-linear footnote skipped");
          assert.ok(source.sentences.length>10);
          assert.equal(source.sentences[0].paragraph,source.sentences[1].paragraph);
          assert.equal(source.sentences.some(s=>/Hidden text|Footnote/.test(s.text)),false);
          const anchored = await page.evaluate(async () => {
            const reader=window.rsvpTest.reader;
            const doc=document.querySelector('iframe').contentDocument;
            const range=doc.createRange(); range.selectNodeContents(doc.querySelector('em'));
            const selection=doc.getSelection(); selection.removeAllRanges(); selection.addRange(range);
            const loaded=await reader.audiobook.loadSection();
            selection.removeAllRanges(); reader.closeLookup();
            return {start:loaded.start,offset:loaded.offset};
          });
          assert.deepEqual(anchored,{start:0,offset:7});
          await page.waitForFunction(()=>!window.rsvpTest.reader.textSelection);
          await page.getByRole("button",{name:"Reader menu",exact:true}).click();
          assert.deepEqual(await page.locator("[data-reader-menu] button span").allTextContents(),["Go to page","Review later","Sentence Mode","RSVP Mode","Audiobook Mode","Settings"]);
          await page.getByRole("button",{name:"Audiobook Mode",exact:true}).click();
          const mode=page.getByRole("dialog",{name:"Audiobook Mode",exact:true});
          await mode.getByRole("heading",{name:"A Quiet Morning"}).waitFor();
          await page.waitForFunction(()=>!document.querySelector('.audiobook-content[aria-busy="true"]'));
          assert.equal(await mode.locator(".audiobook-content p").count(),5);
          assert.equal(await mode.locator(".audiobook-sentence.is-active").innerText(),source.sentences[0].text);
          assert.equal(await mode.getByText(/Kokoro|Generate/).count(),0);
          assert.equal(await mode.getByRole("combobox").count(),0);
          assert.equal(await mode.getByRole("button",{name:"Choose narrator voice"}).count(),1);
          assert.equal(await page.evaluate(()=>window.workers),0);
          async function layout() {
            const result=await mode.evaluate(element=>{
              const bounds=element.getBoundingClientRect();
              const footer=element.querySelector(".audiobook-player").getBoundingClientRect();
              const controls=[...element.querySelectorAll(".audiobook-control-row button")].map(button=>button.getBoundingClientRect());
              return {overflow:element.scrollWidth>innerWidth,footer:Math.round(footer.bottom),bottom:Math.round(bounds.bottom),controls:controls.every(r=>r.left>=0&&r.right<=innerWidth&&r.width>=44&&r.height>=44),
                overlap:controls.some((r,i)=>controls.slice(i+1).some(s=>r.left<s.right&&r.right>s.left&&r.top<s.bottom&&r.bottom>s.top))};
            });
            assert.equal(result.overflow,false);
            assert.equal(result.footer,result.bottom);
            assert.equal(result.controls,true,JSON.stringify(result));
            assert.equal(result.overlap,false,JSON.stringify(result));
          }
          await layout();
          if(mobile) {
            for(const viewport of [{width:320,height:740},{width:844,height:390}]) {
              await page.setViewportSize(viewport); await layout();
            }
            await page.setViewportSize({width:375,height:844});
          }
          await mode.getByRole("button",{name:"Play narration",exact:true}).click();
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).text),source.sentences[0].text);
          assert.equal(await mode.locator(".audiobook-word.is-active").count(),0,"no simulated word timings");
          await page.evaluate(()=>window.spoken.at(-1).onboundary({name:"word",charIndex:7}));
          await page.waitForFunction(()=>document.querySelector(".audiobook-word.is-active")?.textContent==="edge");
          if(process.env.TTS_SCREENSHOT) await page.screenshot({path:process.env.TTS_SCREENSHOT.replace(".png",mobile?"-mobile.png":"-desktop.png")});
          await page.evaluate(()=>{window.oldEnd=window.spoken.at(-1).onend; window.oldBoundary=window.spoken.at(-1).onboundary;});
          await mode.getByRole("button",{name:"Pause narration"}).click();
          await mode.getByRole("button",{name:"Play narration"}).click();
          assert.match(await page.evaluate(()=>window.spoken.at(-1).text),/^edge of/,"resume from last actual boundary");
          await page.evaluate(()=>{window.oldEnd();window.oldBoundary({name:"word",charIndex:0});});
          assert.equal(await mode.locator(".audiobook-word.is-active").innerText(),"edge");
          await mode.getByRole("button",{name:"Next sentence"}).click();
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).text),source.sentences[1].text);
          await mode.getByRole("button",{name:"Previous sentence"}).click();
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).text),source.sentences[0].text);
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          let picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.waitFor();
          await picker.getByText(/No system voices detected yet/).waitFor();
          assert.equal(await picker.getByRole("button",{name:"Use this voice"}).isDisabled(),true);
          await page.evaluate(()=>{
            window.testVoices=[
              {voiceURI:"native",name:"A very long installed system narrator name",lang:"en-US",default:true,localService:true},
              {voiceURI:"alex",name:"Alex",lang:"en-GB",localService:true},
              {voiceURI:"french",name:"Amelie",lang:"fr-FR",localService:true},
              ...Array.from({length:8},(_,i)=>({voiceURI:"voice-"+i,name:"English narrator "+(i+1),lang:"en-US",localService:false})),
            ];
            speechSynthesis.dispatchEvent(new Event("voiceschanged"));
          });
          await picker.getByRole("radio",{name:/A very long installed/}).waitFor();
          assert.equal(await picker.getByRole("radio").count(),10);
          assert.equal(await picker.getByRole("radio",{name:/A very long installed/}).isChecked(),true);
          const beforeSelect=await page.evaluate(()=>window.spoken.length);
          await picker.getByRole("radio",{name:/Alex/}).check();
          assert.equal(await page.evaluate(()=>window.spoken.length),beforeSelect,"staging a voice does not speak");
          await picker.getByRole("button",{name:"Cancel",exact:true}).click();
          await picker.waitFor({state:"detached"});
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).voice),null,"Cancel retains default narration");
          assert.match(await mode.getByRole("button",{name:"Choose narrator voice"}).innerText(),/Browser default/);
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.waitFor();
          async function pickerLayout() {
            const bounds=await picker.locator(".audiobook-voice-dialog").boundingBox();
            const viewport=page.viewportSize();
            assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1,JSON.stringify(bounds));
            const controls=await picker.locator(".audiobook-voice-dialog-footer").boundingBox();
            assert.ok(controls.y>=0&&controls.y+controls.height<=viewport.height+1);
            assert.equal(await picker.evaluate(el=>el.scrollWidth<=innerWidth),true);
          }
          await pickerLayout();
          if(mobile) {
            for(const viewport of [{width:320,height:740},{width:844,height:390}]) {
              await page.setViewportSize(viewport); await pickerLayout();
            }
            await page.setViewportSize({width:375,height:844});
          }
          if(process.env.TTS_SCREENSHOT) await page.screenshot({path:process.env.TTS_SCREENSHOT.replace(".png",mobile?"-voices-mobile.png":"-voices-desktop.png")});
          await picker.getByRole("searchbox",{name:"Search voices"}).fill("French");
          assert.equal(await picker.getByRole("radio").count(),0);
          await picker.getByRole("button",{name:"English only"}).click();
          await picker.getByRole("radio",{name:/Amelie/}).check();
          await picker.getByRole("button",{name:"Preview Amelie",exact:true}).click();
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).voice.voiceURI),"french");
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).lang),"fr-FR");
          assert.match(await page.evaluate(()=>window.spoken.at(-1).text),/^The morning arrived quietly/);
          await picker.getByRole("button",{name:"Stop preview of Amelie",exact:true}).click();
          await picker.getByRole("button",{name:"Preview Amelie",exact:true}).click();
          await page.evaluate(()=>{window.stalePreviewEnd=window.spoken.at(-1).onend;});
          await picker.getByRole("button",{name:"Cancel",exact:true}).click();
          await picker.waitFor({state:"detached"});
          const afterPreview=await page.evaluate(()=>window.cancelled);
          await page.evaluate(()=>window.stalePreviewEnd());
          assert.equal(await page.evaluate(()=>window.cancelled),afterPreview,"late preview completion cannot cancel book speech");
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).voice),null);
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.getByRole("radio",{name:/A very long installed/}).check();
          await picker.getByRole("button",{name:/Preview A very long/}).click();
          await page.evaluate(()=>window.spoken.at(-1).onerror({error:"interrupted"}));
          await picker.getByRole("alert").waitFor();
          await picker.getByRole("button",{name:"Close voice picker"}).focus();
          await page.keyboard.press("Shift+Tab");
          assert.equal(await picker.getByRole("button",{name:"Use this voice"}).evaluate(el=>el===document.activeElement),true);
          await picker.getByRole("button",{name:"Use this voice"}).click();
          await picker.waitFor({state:"detached"});
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).voice.voiceURI),"native");
          assert.equal(await mode.getByRole("button",{name:"Choose narrator voice"}).evaluate(el=>el===document.activeElement),true);
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.getByRole("searchbox",{name:"Search voices"}).fill("Alex");
          await picker.getByRole("searchbox",{name:"Search voices"}).press("Escape");
          await picker.waitFor({state:"detached"});
          assert.equal(await mode.count(),1,"Escape closes only narrator picker");
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.waitFor(); await page.mouse.click(5,5);
          await picker.waitFor({state:"detached"});
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.getByRole("button",{name:"Preview Alex",exact:true}).click();
          await page.evaluate(()=>window.dispatchEvent(new Event("pagehide")));
          await picker.getByRole("button",{name:"Preview Alex",exact:true}).waitFor();
          await picker.getByRole("button",{name:"Cancel",exact:true}).click();
          await mode.getByRole("button",{name:"Play narration"}).waitFor();
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.getByRole("radio",{name:/Alex/}).check();
          await picker.getByRole("button",{name:"Use this voice"}).click();
          await mode.getByRole("button",{name:"Play narration"}).waitFor();
          await mode.getByRole("button",{name:"Play narration"}).click();
          await mode.getByRole("button",{name:"Reading speed 1×"}).click();
          const speed=mode.getByRole("slider",{name:"Reading speed",exact:true});
          await speed.focus(); await speed.press("ArrowRight");
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).rate),1.1);
          const popup=await mode.getByRole("dialog",{name:"Reading speed",exact:true}).boundingBox();
          assert.ok(popup.x>=0 && popup.x+popup.width<=(mobile?375:1280),JSON.stringify(popup));
          if(process.env.TTS_SCREENSHOT) await page.screenshot({path:process.env.TTS_SCREENSHOT.replace(".png",mobile?"-speed-mobile.png":"-speed-desktop.png")});
          await speed.press("Escape");
          assert.equal(await mode.count(),1,"Escape closes only the speed popup");
          const seek=mode.getByRole("slider",{name:"Estimated section progress"});
          await seek.focus(); await seek.press("End");
          assert.match(await page.evaluate(()=>window.spoken.at(-1).text),/write\.$/);
          await page.evaluate(()=>window.spoken.at(-1).onend());
          await mode.getByRole("heading",{name:"The Next Day"}).waitFor();
          await page.waitForFunction(()=>window.spoken.at(-1).text==="A new day began.");
          assert.equal(await mode.locator(".audiobook-word.is-active").count(),0);
          await mode.getByRole("button",{name:"Previous sentence"}).click();
          await mode.getByRole("heading",{name:"A Quiet Morning"}).waitFor();
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).text),source.sentences.at(-1).text);
          await mode.getByRole("button",{name:"Next sentence"}).click();
          await mode.getByRole("heading",{name:"The Next Day"}).waitFor();
          await page.evaluate(()=>window.spoken.at(-1).onend());
          await page.waitForFunction(()=>window.spoken.at(-1).text==="He opened the window.");
          await page.evaluate(()=>window.spoken.at(-1).onend());
          await mode.getByText("End of book",{exact:true}).waitFor();
          await mode.getByRole("button",{name:"Play narration"}).click();
          await page.waitForFunction(()=>window.spoken.at(-1).text==="A new day began.");
          await page.evaluate(()=>{window.lateEnd=window.spoken.at(-1).onend; window.dispatchEvent(new Event("pagehide"));});
          await mode.getByRole("button",{name:"Play narration"}).waitFor();
          await page.evaluate(()=>window.lateEnd());
          assert.equal(await mode.locator(".audiobook-sentence.is-active").innerText(),"A new day began.");
          await mode.getByRole("button",{name:"Play narration"}).click();
          await page.evaluate(()=>window.spoken.at(-1).onerror({error:"interrupted"}));
          await mode.getByRole("alert").waitFor();
          await mode.getByRole("button",{name:"Play narration"}).click();
          await mode.getByRole("button",{name:"Exit audiobook mode"}).click();
          await mode.waitFor({state:"detached"});
          assert.equal(await page.evaluate(()=>document.body.style.overflow),"");
          assert.equal(await page.evaluate(()=>[...document.querySelectorAll(".reader-shell [inert]")].length),0);
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).onend),null);
          assert.equal(await page.evaluate(()=>window.workers),0);
        } finally {await browser.close();}
      });

      for (const mobile of [false, true]) await t.test(mobile ? "mobile OpenAI narration" : "desktop OpenAI narration", async () => {
        const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
        try {
          const page = await browser.newPage({ viewport: { width: mobile ? 375 : 1280, height: 844 }, hasTouch: mobile, isMobile: mobile });
          const requests = [], previewRequests=[];
          let passages = {}, failure = false, narrator = null, saveFailure=false, aligned=false;
          const sample="The morning arrived quietly, and the world seemed full of possibility.";
          await page.route("**/audiobook/**", async route => {
            const url = new URL(route.request().url());
            if (url.pathname.endsWith("/config")) return route.fulfill({json:{status:"success",data:{available:true,voices:["marin","cedar"],defaultVoice:"marin",maxChars:600,narrator,previewText:sample}}});
            if(url.pathname.endsWith("/narrator")) {
              if(saveFailure) return route.fulfill({status:500,json:{status:"fail",message:"Save failed"}});
              narrator=route.request().postDataJSON(); return route.fulfill({json:{status:"success",data:narrator}});
            }
            if(url.pathname.endsWith("/preview")) {
              const body=route.request().postDataJSON(); previewRequests.push(body);
              assert.deepEqual(Object.keys(body).sort(),["requestId","voice"]);
              return route.fulfill({json:{status:"success",data:{text:sample,chunkId:"b".repeat(64),audioUrl:"/api/reader/rsvp/audiobook/chunks/"+"b".repeat(64)}}});
            }
            if (route.request().method()==="DELETE") return route.fulfill({status:204});
            if (route.request().method()==="POST") {
              const body=route.request().postDataJSON(); requests.push(body);
              if(failure) return route.fulfill({status:429,headers:{"Retry-After":"60"},json:{status:"fail",message:"Narration limit reached."}});
              assert.deepEqual(Object.keys(body).sort(),body.passageEndCfi ? ["passageCfi","passageEndCfi","requestId","voice"] : ["passageCfi","requestId","voice"]);
              const key=body.passageCfi+"|"+(body.passageEndCfi||"");
              assert.ok(passages[key],"real EPUB range identifies the submitted passage");
              const text=passages[key];
              const wordTimings=aligned ? [...text.matchAll(/\S+/gu)].filter(match=>/[\p{L}\p{M}\p{N}]/u.test(match[0])).map((match,index)=>({startChar:match.index,endChar:match.index+match[0].length,startSeconds:0.2+index*0.06,endSeconds:0.24+index*0.06})) : null;
              return route.fulfill({json:{status:"success",data:{chunkId:"a".repeat(64),audioUrl:"/api/reader/rsvp/audiobook/chunks/"+"a".repeat(64),text,alignment:{wordTimings}}}});
            }
            return route.fulfill({contentType:"audio/wav",body:Buffer.from("mock audio decoded by fake AudioContext")});
          });
          await page.addInitScript(() => {
            window.audioSources=[]; window.audioContexts=[]; window.spoken=[];
            const synth=new EventTarget();
            window.availableVoices=location.search.includes("delayed=1")?[]:[{voiceURI:"native",name:"Native",lang:"en-US",default:true,localService:true}];
            synth.getVoices=()=>window.availableVoices;
            synth.speak=u=>{window.spoken.push(u);u.onstart?.();}; synth.cancel=()=>{}; synth.resume=()=>{};
            Object.defineProperty(window,"speechSynthesis",{value:synth}); window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
            window.AudioContext=class {
              constructor(){this.state="suspended";this.currentTime=0;this.destination={};window.audioContexts.push(this);}
              resume(){this.state="running";return Promise.resolve();} close(){this.state="closed";return Promise.resolve();}
              decodeAudioData(){return Promise.resolve({duration:10});}
              createBufferSource(){const source={playbackRate:{value:1,setValueAtTime(value){this.value=value;}},connect(){},disconnect(){},stop(){this.stopped=true;},start(when,offset){this.offset=offset;}};window.audioSources.push(source);return source;}
            };
          });
          await page.goto(server.resolvedUrls.local[0]+"rsvp-test");
          await page.waitForFunction(()=>window.rsvpTest?.reader.loading===false);
          const source=await page.evaluate(async()=>{
            const section=await window.rsvpTest.reader.audiobook.loadSection();
            const {openAiBlock}=await import("/frontend/src/services/readerOpenAiAudio.ts");
            return section.sentences.map((s,index)=>({text:s.text,block:openAiBlock(section.sentences,index,0,600),partial:openAiBlock(section.sentences,index,7,600),variants:s.words.map(word=>openAiBlock(section.sentences,index,word.start,600))}));
          });
          const mapped=await page.evaluate(()=>{
            const doc=new DOMParser().parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Hello   <em>😀 world</em>\t again.</p></body></html>',"application/xhtml+xml");
            const sentences=window.rsvpTest.sentenceService.extractReaderSentences({document:doc,cfiFromRange:range=>range.toString()},true);
            const sentence=sentences[0];
            return {text:sentence.text,part:sentence.rangeCfi(6,14)};
          });
          assert.deepEqual(mapped,{text:"Hello 😀 world again.",part:"😀 world"},"normalized UTF-16 ranges map through inline nodes and whitespace");
          passages=Object.fromEntries(source.flatMap(s=>[s.block,s.partial,...s.variants].map(block=>[block.cfi+"|"+(block.endCfi||""),block.text])));
          const following=await page.evaluate(async()=>{
            const section=await window.rsvpTest.reader.audiobook.loadSection(2,1);
            const {openAiBlock}=await import("/frontend/src/services/readerOpenAiAudio.ts");
            return section.sentences.map((_,index)=>openAiBlock(section.sentences,index,0,600));
          });
          for(const block of following) passages[block.cfi+"|"+(block.endCfi||"")]=block.text;
          await page.getByRole("button",{name:"Reader menu",exact:true}).click();
          await page.getByRole("button",{name:"Audiobook Mode",exact:true}).click();
          const mode=page.getByRole("dialog",{name:"Audiobook Mode",exact:true});
          await mode.getByRole("heading",{name:"A Quiet Morning"}).waitFor();
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          let picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.getByRole("button",{name:/OpenAI voices/}).click();
          await picker.getByText(/These voices are generated by AI/).waitFor();
          if(process.env.TTS_SCREENSHOT) await page.screenshot({path:process.env.TTS_SCREENSHOT.replace(".png",mobile?"-openai-voices-mobile.png":"-openai-voices-desktop.png")});
          assert.equal(await picker.getByRole("button",{name:/Preview/}).count(),2);
          assert.equal(previewRequests.length,0,"browsing does not generate paid previews");
          await picker.getByRole("radio",{name:/cedar/}).check();
          await picker.getByRole("button",{name:"Use this voice"}).click();
          await picker.waitFor({state:"detached"});
          assert.equal(narrator.voice,"cedar","voice is saved to the book before closing settings");
          assert.equal(requests.length,0);
          await mode.getByRole("button",{name:"Play narration",exact:true}).click();
          await page.waitForFunction(()=>window.audioSources.length===1);
          await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
          await mode.getByRole("button",{name:"Pause narration"}).waitFor();
          assert.equal(await page.evaluate(()=>window.audioSources[0].stopped),undefined,"visibility alone does not stop narration");
          await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));});
          assert.equal(requests[0].voice,"cedar");
          assert.equal(requests[0].passageCfi,source[0].block.cfi);
          assert.equal(requests[0].passageEndCfi,source[0].block.endCfi,"multiple short sentences share one request");
          assert.ok(source[0].block.endIndex>0);
          assert.equal(await mode.locator(".audiobook-word.is-active").count(),0);
          await mode.getByText(/AI-generated voice · passage follow-along/).waitFor();
          await page.waitForFunction(()=>window.audioSources.length===1);
          await page.waitForTimeout(100);
          const nextBlock=source[source[0].block.endIndex+1].block;
          assert.ok(requests.some(request=>request.passageCfi===nextBlock.cfi),"next audio requested before the current audio ends");
          if(process.env.TTS_SCREENSHOT) await page.screenshot({path:process.env.TTS_SCREENSHOT.replace(".png",mobile?"-openai-mobile.png":"-openai-desktop.png")});
          await page.evaluate(()=>window.audioContexts[0].currentTime=3);
          await mode.getByRole("button",{name:"Pause narration"}).click();
          await mode.getByRole("button",{name:"Play narration",exact:true}).click();
          await page.waitForFunction(()=>window.audioSources.length===2);
          assert.equal(requests.filter(request=>request.passageCfi===source[0].block.cfi).length,1,"resume reuses generated audio");
          assert.equal(await page.evaluate(()=>window.audioSources.at(-1).offset),3);
          await mode.getByRole("button",{name:"Reading speed 1×",exact:true}).click();
          const speed=mode.getByRole("slider",{name:"Reading speed",exact:true}); await speed.focus(); await speed.press("ArrowRight");
          assert.equal(await page.evaluate(()=>window.audioSources.at(-1).playbackRate.value),1.1);
          assert.equal(requests.filter(request=>request.passageCfi===source[0].block.cfi).length,1,"speed changes do not regenerate audio");
          await mode.getByRole("button",{name:"Reading speed 1.1×",exact:true}).click();
          await page.evaluate(()=>window.audioSources.at(-1).onended());
          await page.waitForFunction(()=>window.audioSources.length===3);
          assert.ok(requests.some(request=>request.passageCfi===nextBlock.cfi),"completion advances automatically");
          assert.equal(requests.filter(request=>request.passageCfi===nextBlock.cfi).length,1,"prefetched audio is consumed without a new request");
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.waitFor();
          await picker.getByRole("button",{name:/System voices/}).click();
          await picker.getByRole("button",{name:"Use this voice"}).click();
          await page.waitForFunction(()=>window.spoken.length>0);
          assert.equal(await page.evaluate(()=>window.audioSources.at(-1).stopped),true);
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.getByRole("button",{name:/OpenAI voices/}).click();
          await picker.getByRole("button",{name:"Use this voice"}).click();
          await page.waitForFunction(()=>window.audioSources.length===4);
          failure=true;
          await mode.getByRole("button",{name:"Next sentence"}).click();
          await mode.getByRole("alert").filter({hasText:"Narration limit reached"}).waitFor();
          assert.match(await mode.getByRole("alert").innerText(),/60 seconds/);
          const count=requests.length; await page.waitForTimeout(100); assert.equal(requests.length,count,"no automatic paid retry");
          failure=false;
          const seek=mode.getByRole("slider",{name:"Estimated section progress"});
          await seek.focus(); await seek.press("Home"); await seek.press("ArrowRight"); await seek.press("ArrowRight");
          await mode.getByRole("button",{name:"Play narration",exact:true}).click();
          await page.waitForFunction(()=>window.audioSources.length===5);
          assert.ok(requests.some(request=>request.passageCfi===source[0].partial.cfi && request.passageEndCfi===source[0].partial.endCfi),"seek submits a precise partial source range");
          let chapterPrepared=false;
          for(let step=0;step<10 && !(await mode.getByRole("heading",{name:"The Next Day",exact:true}).count());step++) {
            await page.waitForTimeout(100);
            const active=(await mode.locator(".audiobook-sentence.is-active").allTextContents()).join(" ");
            if(active.includes(source.at(-1).text)) {
              assert.ok(requests.some(request=>request.passageCfi===following[0].cfi),"next chapter starts preparing before this chapter ends");
              chapterPrepared=true;
            }
            const before=await page.evaluate(()=>window.audioSources.length);
            await page.evaluate(()=>window.audioSources.at(-1).onended());
            await page.waitForFunction(previous=>window.audioSources.length>previous,before);
          }
          assert.equal(chapterPrepared,true);
          await mode.getByRole("heading",{name:"The Next Day",exact:true}).waitFor();
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.getByText(/Preview text:/).waitFor();
          const beforePreview=await page.evaluate(()=>window.audioSources.length);
          await picker.getByRole("button",{name:"Preview marin",exact:true}).click();
          await page.waitForFunction(before=>window.audioSources.length>before,beforePreview);
          assert.equal(previewRequests.at(-1).voice,"marin");
          assert.equal(narrator.voice,"cedar","preview does not replace the saved narrator");
          await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
          await picker.getByRole("button",{name:"Stop preview of marin",exact:true}).waitFor();
          await picker.getByRole("button",{name:"Stop preview of marin",exact:true}).click();
          await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));});
          await picker.getByRole("button",{name:"Cancel",exact:true}).click();
          await picker.waitFor({state:"detached"});
          await mode.getByRole("button",{name:"Exit audiobook mode"}).click();
          assert.equal(await page.evaluate(()=>window.audioContexts[0].state),"closed");
          await page.reload();
          await page.waitForFunction(()=>window.rsvpTest?.reader.loading===false);
          await page.getByRole("button",{name:"Reader menu",exact:true}).click(); await page.getByRole("button",{name:"Audiobook Mode",exact:true}).click();
          await mode.getByRole("button",{name:"Choose narrator voice"}).filter({hasText:"cedar"}).waitFor();
          await mode.getByRole("button",{name:"Exit audiobook mode"}).click();
          narrator={engine:"system",voice:"missing-device-voice",name:"Unavailable narrator",lang:"en-US"};
          await page.reload(); await page.waitForFunction(()=>window.rsvpTest?.reader.loading===false);
          await page.getByRole("button",{name:"Reader menu",exact:true}).click(); await page.getByRole("button",{name:"Audiobook Mode",exact:true}).click();
          picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.getByRole("alert").filter({hasText:/Saved narrator.*unavailable/}).waitFor();
          assert.equal(await mode.getByRole("button",{name:"Play narration",exact:true}).isDisabled(),true);
          await picker.getByRole("button",{name:/OpenAI voices/}).click();
          await picker.getByRole("radio",{name:/marin/}).check();
          saveFailure=true;
          await picker.getByRole("button",{name:"Use this voice"}).click();
          await picker.getByRole("alert").filter({hasText:/could not be saved/}).waitFor();
          assert.equal(await picker.isVisible(),true,"failed save keeps settings open");
          saveFailure=false;
          await picker.getByRole("button",{name:"Use this voice"}).click(); await picker.waitFor({state:"detached"});
          assert.equal(narrator.voice,"marin");
          await mode.getByRole("button",{name:"Play narration",exact:true}).waitFor();
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.getByRole("button",{name:/System voices/}).click();
          await picker.getByRole("button",{name:"Use this voice"}).click(); await picker.waitFor({state:"detached"});
          assert.equal(narrator.engine,"system"); assert.equal(narrator.voice,"native");
          await mode.getByRole("button",{name:"Exit audiobook mode"}).click();
          await page.goto(server.resolvedUrls.local[0]+"rsvp-test?delayed=1");
          await page.waitForFunction(()=>window.rsvpTest?.reader.loading===false);
          await page.getByRole("button",{name:"Reader menu",exact:true}).click(); await page.getByRole("button",{name:"Audiobook Mode",exact:true}).click();
          await mode.getByRole("heading",{name:"A Quiet Morning"}).waitFor();
          assert.equal(await page.getByRole("dialog",{name:"Choose a narrator",exact:true}).count(),0,"delayed voice enumeration is not immediately treated as missing");
          await page.evaluate(()=>{window.availableVoices=[{voiceURI:"native",name:"Native",lang:"en-US",default:true,localService:true}];speechSynthesis.dispatchEvent(new Event("voiceschanged"));});
          await mode.getByRole("button",{name:"Play narration",exact:true}).click();
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).voice.voiceURI),"native","saved system voice is restored after asynchronous enumeration");
          await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
          await mode.getByRole("button",{name:"Pause narration",exact:true}).waitFor();
          await mode.getByRole("button",{name:"Exit audiobook mode"}).click();
          aligned=true; narrator={engine:"openai",voice:"cedar",name:"cedar",lang:""};
          await page.goto(server.resolvedUrls.local[0]+"rsvp-test");
          await page.waitForFunction(()=>window.rsvpTest?.reader.loading===false);
          await page.getByRole("button",{name:"Reader menu",exact:true}).click(); await page.getByRole("button",{name:"Audiobook Mode",exact:true}).click();
          // Reading speed is remembered on this device (as in RozaReader); word cues below assume 1×.
          await mode.getByRole("button",{name:"Reading speed 1.1×",exact:true}).click();
          const resetSpeed=mode.getByRole("slider",{name:"Reading speed",exact:true}); await resetSpeed.focus(); await resetSpeed.press("ArrowLeft");
          await mode.getByRole("button",{name:"Reading speed 1×",exact:true}).click();
          await mode.getByRole("button",{name:"Play narration",exact:true}).click();
          await page.waitForFunction(()=>window.audioSources.length===1);
          await mode.getByText(/AI-generated voice · word follow-along/).waitFor();
          assert.equal(await mode.locator(".audiobook-word.is-active").count(),0,"no word is guessed during leading silence");
          await page.evaluate(()=>window.audioContexts[0].currentTime=0.21);
          await page.waitForFunction(()=>document.querySelector(".audiobook-word.is-active")?.textContent==="At");
          const timedWords=[...source[0].block.text.matchAll(/\S+/gu)];
          const second=source[0].block.locations.find(location=>location.sentence===1);
          const cueIndex=timedWords.findIndex(word=>word.index>=second.start);
          const cueTime=0.21+cueIndex*0.06;
          await page.evaluate(time=>window.audioContexts[0].currentTime=time,cueTime);
          await page.waitForFunction(()=>document.querySelector(".audiobook-word.is-active")?.textContent==="The");
          assert.equal(await mode.locator(".audiobook-sentence.is-active").innerText(),source[1].text,"word cues cross source sentence boundaries");
          assert.ok(await mode.locator(".audiobook-word").count()<=64);
          const beforeResume=requests.filter(request=>request.passageCfi===source[0].block.cfi && request.passageEndCfi===source[0].block.endCfi).length;
          await mode.getByRole("button",{name:"Pause narration",exact:true}).click();
          await mode.getByRole("button",{name:"Play narration",exact:true}).click();
          await page.waitForFunction(()=>window.audioSources.length===2);
          assert.equal(requests.filter(request=>request.passageCfi===source[0].block.cfi && request.passageEndCfi===source[0].block.endCfi).length,beforeResume,"moving word highlights do not regenerate audio on resume");
          assert.ok(Math.abs(await page.evaluate(()=>window.audioSources.at(-1).offset)-cueTime)<0.001);
          await mode.getByRole("button",{name:"Reading speed 1×",exact:true}).click();
          const timedSpeed=mode.getByRole("slider",{name:"Reading speed",exact:true}); await timedSpeed.focus(); await timedSpeed.press("End");
          await page.evaluate(time=>window.audioContexts[0].currentTime=time+0.12,cueTime);
          await page.waitForFunction(expected=>document.querySelector(".audiobook-word.is-active")?.textContent===expected,timedWords[cueIndex+5][0]);
          await timedSpeed.press("Escape");
          const timedSeek=mode.getByRole("slider",{name:"Estimated section progress"});
          const beforeSeek=await page.evaluate(()=>window.audioSources.length);
          await timedSeek.focus(); await timedSeek.press("Home"); await timedSeek.press("ArrowRight"); await timedSeek.press("ArrowRight");
          await page.waitForFunction(before=>window.audioSources.length>before && !window.audioSources.at(-1).stopped,beforeSeek);
          await page.evaluate(()=>window.audioContexts[0].currentTime+=0.084);
          await page.waitForFunction(()=>document.querySelector(".audiobook-word.is-active")?.textContent==="edge");
          if(process.env.TTS_SCREENSHOT) await page.screenshot({path:process.env.TTS_SCREENSHOT.replace(".png",mobile?"-word-mobile.png":"-word-desktop.png")});
          await mode.getByRole("button",{name:"Exit audiobook mode"}).click();
        } finally { await browser.close(); }
      });
      await t.test("local Kokoro voices: desktop narration, mini player and offline saving", async () => {
        storedNarrator=null;
        const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || "msedge"});
        try {
          // On the website there is no desktop bridge: local voices are shown but cannot be chosen.
          const web=await browser.newPage({viewport:{width:1280,height:844}});
          await web.goto(server.resolvedUrls.local[0]+"rsvp-test");
          await web.waitForFunction(()=>window.rsvpTest?.reader.loading===false);
          await web.getByRole("button",{name:"Reader menu",exact:true}).click();
          await web.getByRole("button",{name:"Audiobook Mode",exact:true}).click();
          const webMode=web.getByRole("dialog",{name:"Audiobook Mode",exact:true});
          await webMode.getByRole("button",{name:"Choose narrator voice"}).click();
          const webPicker=web.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await webPicker.getByText("Desktop app only · runs on your computer").waitFor();
          assert.equal(await webPicker.getByRole("button",{name:/Local voices/}).isDisabled(),true);
          await web.close();

          const page=await browser.newPage({viewport:{width:1280,height:844}});
          page.setDefaultTimeout(15000);
          await page.addInitScript(()=>{
            const synth=new EventTarget();
            synth.getVoices=()=>[]; synth.speak=()=>{}; synth.cancel=()=>{}; synth.resume=()=>{};
            Object.defineProperty(window,"speechSynthesis",{value:synth});
            window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
            window.kokoroCalls=[]; window.audios=[]; window.scripts=[];
            // Fake <audio>: the test moves time and ends clips itself.
            window.Audio=class extends EventTarget {
              constructor(){super();this.currentTime=0;this.paused=true;this.volume=1;this.playbackRate=1;window.audios.push(this);}
              load(){} play(){this.paused=false;return Promise.resolve();} pause(){this.paused=true;}
            };
            const status={installed:true,needsUpdate:false,installing:false,progress:null,error:null,formats:["m4a","mp4","mp3"],neededBytes:3e9,engine:{state:"ready"},exportFolder:"C:\\Music\\Roza Audiobooks"};
            let offline={state:"missing",completed:0,total:0,chaptersReady:0,chapters:0};
            window.rozaDesktop={kokoro:{
              status:async()=>status, install:async()=>status, cancelInstall:async()=>status, remove:async()=>status, start:async()=>status,
              sentence:async input=>{window.kokoroCalls.push(input);return {url:"/__kokoro/audio/"+input.index+".wav",duration:input.sentence.words.length*0.5,words:input.sentence.words.map((_,i)=>({start:i*0.5,end:i*0.5+0.4}))};},
              preview:async voice=>({url:"/__kokoro/preview/"+voice+".wav"}),
              hasScript:async()=>window.scripts.length>0,
              saveScript:async script=>{window.scripts.push(script);const total=script.sections.reduce((n,s)=>n+s.sentences.length,0);offline={state:"missing",completed:0,total,chaptersReady:0,chapters:script.sections.length};return {sections:script.sections.length,sentences:total};},
              offline:async input=>{ if(input.action==="start") offline={...offline,state:"ready",completed:offline.total,chaptersReady:offline.chapters}; return input.section===null?offline:{...offline,chapters:1,chaptersReady:offline.state==="ready"?1:0}; },
              chooseFolder:async()=>({folder:status.exportFolder}), startExport:async()=>({id:"x",state:"running",progress:0,stage:"Starting…"}),
              getExport:async()=>null, stopExport:async()=>null, revealExport:async()=>null,
              onInstallStatus:()=>()=>{},
            }};
          });
          await page.goto(server.resolvedUrls.local[0]+"rsvp-test");
          await page.waitForFunction(()=>window.rsvpTest?.reader.loading===false);
          await page.getByRole("button",{name:"Reader menu",exact:true}).click();
          await page.getByRole("button",{name:"Audiobook Mode",exact:true}).click();
          const mode=page.getByRole("dialog",{name:"Audiobook Mode",exact:true});
          await mode.getByRole("heading",{name:"A Quiet Morning"}).waitFor();
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          const picker=page.getByRole("dialog",{name:"Choose a narrator",exact:true});
          await picker.getByRole("button",{name:/Local voices/}).click();
          const localList=picker.getByRole("radiogroup",{name:"Available local voices"});
          assert.equal(await localList.getByRole("radio").count(),28,"all English Kokoro voices");
          await picker.getByRole("radiogroup",{name:"Accent"}).getByRole("radio",{name:"British"}).click();
          await picker.getByRole("radiogroup",{name:"Gender"}).getByRole("radio",{name:"Female"}).click();
          assert.equal(await localList.getByRole("radio").count(),4);
          await picker.getByRole("radio",{name:/Emma/}).check();
          await picker.getByRole("button",{name:"Use this voice"}).click();
          await picker.waitFor({state:"detached"});
          assert.deepEqual(storedNarrator,{engine:"kokoro",voice:"bf_emma",name:"Emma",lang:"en-GB"});
          assert.match(await mode.getByRole("button",{name:"Choose narrator voice"}).innerText(),/Emma/);

          await mode.getByRole("button",{name:"Play narration",exact:true}).click();
          await page.waitForFunction(()=>window.kokoroCalls.some(call=>call.priority==="high"&&call.index===0));
          const first=await page.evaluate(()=>window.kokoroCalls.find(call=>call.index===0));
          assert.equal(first.voice,"bf_emma");
          assert.equal(first.sentence.text,first.sentence.words.join(" "));
          assert.ok(first.sentence.pause>0&&first.sentence.speed>0,"pacing travels with each sentence");
          await mode.getByText(/Local voice · word follow-along/).waitFor();
          // Read-ahead asks for the next sentences at low priority.
          await page.waitForFunction(()=>window.kokoroCalls.some(call=>call.priority==="low"&&call.index===1));
          await page.evaluate(()=>{ window.audios.find(a=>!a.paused).currentTime=1.1; });
          await page.waitForFunction(()=>document.querySelector(".audiobook-word.is-active")?.textContent==="edge");
          await page.evaluate(()=>window.audios.find(a=>!a.paused).dispatchEvent(new Event("ended")));
          await page.waitForFunction(()=>document.querySelector(".audiobook-sentence.is-active")?.textContent.startsWith("The first light"));

          // Back to the book: narration keeps going in the mini player; it can reopen the full view.
          await mode.getByRole("button",{name:"Back to the book"}).click();
          await mode.waitFor({state:"detached"});
          const mini=page.getByRole("group",{name:"Audiobook player"});
          await mini.getByRole("button",{name:"Pause narration"}).waitFor();
          await mini.getByRole("button",{name:"Pause narration"}).click();
          await mini.getByRole("button",{name:"Play narration"}).waitFor();
          await mini.getByRole("button",{name:/^Open Audiobook Mode/}).click();
          await mode.getByRole("heading",{name:"A Quiet Morning"}).waitFor();
          await page.waitForFunction(()=>document.querySelector(".audiobook-sentence.is-active")?.textContent.startsWith("The first light"));

          // Save offline prepares the whole book's text once, then saves with the chosen voice.
          await mode.getByRole("button",{name:"Save offline"}).click();
          const offline=page.getByRole("dialog",{name:"Save for offline",exact:true});
          await offline.getByRole("button",{name:"Save chapter"}).waitFor();
          const script=await page.evaluate(()=>window.scripts[0]);
          assert.deepEqual(script.sections.map(section=>section.section),[0,2],"non-linear sections are skipped");
          assert.ok(script.sections[0].sentences.every(sentence=>sentence.words.length&&sentence.pause>0));
          await offline.getByRole("button",{name:"Save chapter"}).click();
          await offline.getByText("Ready for offline listening").waitFor();
          await offline.getByRole("button",{name:"Close",exact:true}).first().click();
          await offline.waitFor({state:"detached"});
          await mode.getByRole("button",{name:"Exit audiobook mode"}).click();
          await mode.waitFor({state:"detached"});
          assert.equal(await mini.count(),0,"exit ends the session");
        } finally {await browser.close();}
      });
      await t.test("long chapter is virtualized with native scrolling and bounded highlight DOM", async () => {
        storedNarrator=null;
        const archive=await JSZip.loadAsync(file);
        const original=await archive.file("a.xhtml").async("string");
        const paragraph=original.match(/<p>[\s\S]*?<\/p>/)[0];
        const longSentence=Array.from({length:2000},(_,i)=>"token"+i).join(" ")+".";
        archive.file("a.xhtml",original.replace("</body>",paragraph.repeat(150)+"<p>"+longSentence+"</p></body>"));
        file=await archive.generateAsync({type:"nodebuffer"}); saves.length=0;
        const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || "msedge"});
        try {
          const page=await browser.newPage({viewport:{width:375,height:844},isMobile:true,hasTouch:true});
          await page.emulateMedia({reducedMotion:"reduce"});
          await page.addInitScript(()=>{
            const synth=new EventTarget(); window.spoken=[];
            synth.getVoices=()=>[{voiceURI:"native",name:"Native narrator",lang:"en-US",default:true,localService:true}];
            synth.cancel=()=>{}; synth.resume=()=>{};
            synth.speak=u=>{window.spoken.push(u);queueMicrotask(()=>u.onstart?.());};
            Object.defineProperty(window,"speechSynthesis",{value:synth});
            window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
          });
          await page.goto(server.resolvedUrls.local[0]+"rsvp-test");
          await page.waitForFunction(()=>window.rsvpTest?.reader.loading===false);
          const source=await page.evaluate(async()=>{
            const data=await window.rsvpTest.reader.audiobook.loadSection();
            return {text:data.sentences.map(s=>s.text).join(" ")+" ",total:data.totalWords};
          });
          assert.ok(source.total>9000);
          await page.getByRole("button",{name:"Reader menu",exact:true}).click();
          await page.getByRole("button",{name:"Audiobook Mode",exact:true}).click();
          const mode=page.getByRole("dialog",{name:"Audiobook Mode",exact:true});
          await page.waitForFunction(()=>document.querySelector(".audiobook-content")?.getAttribute("aria-busy")==="false");
          // Long chapters are virtualized (from RozaReader): only paragraphs near the reading position
          // are in the page, each one exact book text, while the scroll height covers the whole chapter.
          const rendered=async()=>{
            const paragraphs=await mode.locator(".audiobook-content p").allTextContents();
            return {count:paragraphs.length,exact:paragraphs.every(text=>source.text.includes(text))};
          };
          let view=await rendered();
          assert.ok(view.count>0&&view.count<=100,"bounded paragraph DOM: "+view.count);
          assert.equal(view.exact,true,"rendered paragraphs are exact book text");
          assert.ok(await mode.locator(".audiobook-word").count()<=64);
          const scroll=mode.locator(".audiobook-reading");
          await scroll.evaluate(element=>{ element.scrollTop=element.scrollHeight; });
          await page.waitForFunction(()=>[...document.querySelectorAll(".audiobook-content p")].some(p=>p.textContent.includes("token1999.")));
          const before=await scroll.evaluate(element=>{
            element.scrollTop=element.scrollHeight;
            return {top:element.scrollTop,height:element.scrollHeight,client:element.clientHeight};
          });
          assert.ok(before.top+before.client>=before.height-1,"native scrolling reaches the end of the chapter");
          await page.evaluate(()=>{
            window.articleMutations=0;
            window.articleObserver=new MutationObserver(records=>window.articleMutations+=records.length);
            window.articleObserver.observe(document.querySelector(".audiobook-content"),{subtree:true,childList:true,characterData:true,attributes:true});
          });
          await mode.getByRole("button",{name:"Choose narrator voice"}).click();
          await page.getByRole("dialog",{name:"Choose a narrator",exact:true}).getByRole("button",{name:"Cancel",exact:true}).click();
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const after=await scroll.evaluate(element=>({top:element.scrollTop,height:element.scrollHeight}));
          assert.equal(after.top,before.top,"modal does not move the user's scroll position");
          assert.equal(after.height,before.height);
          assert.equal(await page.evaluate(()=>window.articleMutations),0,"modal opening and closing leave chapter DOM untouched");
          await page.evaluate(()=>window.articleObserver.disconnect());
          const seek=mode.getByRole("slider",{name:"Estimated section progress"});
          await seek.focus(); await seek.press("End");
          await page.waitForFunction(()=>document.querySelector("[data-audiobook-cursor]")?.textContent==="token1999.");
          assert.ok(await mode.locator(".audiobook-word").count()<=64);
          view=await rendered();
          assert.ok(view.count<=100&&view.exact);
          const cursor=await mode.locator("[data-audiobook-cursor]").boundingBox();
          const reading=await scroll.boundingBox();
          assert.ok(cursor.y>=reading.y&&cursor.y+cursor.height<=reading.y+reading.height+1,"seeking within a long sentence scrolls to the chosen word");
          await mode.getByRole("button",{name:"Previous sentence"}).click();
          await mode.getByRole("button",{name:"Next sentence"}).click();
          await page.waitForFunction(()=>document.querySelector("[data-audiobook-cursor]")?.textContent==="token0");
          view=await rendered();
          assert.ok(view.count<=100&&view.exact);
          await seek.focus(); await seek.press("End");
          await mode.getByRole("button",{name:"Play narration",exact:true}).click();
          assert.equal(await page.evaluate(()=>window.spoken.at(-1).text),"token1999.");
          await page.evaluate(()=>window.spoken.at(-1).onboundary({name:"word",charIndex:0}));
          await page.waitForFunction(()=>document.querySelector(".audiobook-word.is-active")?.textContent==="token1999.");
          assert.ok(await mode.locator(".audiobook-word").count()<=64);
          await page.evaluate(()=>window.spoken.at(-1).onend());
          await mode.getByRole("heading",{name:"The Next Day"}).waitFor();
          await page.waitForFunction(()=>window.spoken.at(-1).text==="A new day began.");
          await mode.getByRole("button",{name:"Exit audiobook mode"}).click();
        } finally {await browser.close();}
      });
    } finally {await server.close();}
  },
);
