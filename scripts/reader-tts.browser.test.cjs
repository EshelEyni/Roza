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
    const file = await epub();
    const saves = [];
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
          assert.match(await mode.getByRole("button",{name:"Choose narrator voice"}).innerText(),/Choose voice/);
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
    } finally {await server.close();}
  },
);
