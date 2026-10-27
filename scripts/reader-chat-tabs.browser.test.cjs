const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const tick = () => new Promise(resolve=>setImmediate(resolve));
const until = async fn => { for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,20))}throw Error('Timed out waiting for intercepted request') };

test('real chat workspace: concurrent tabs, restored drafts, history, keyboard, resize and mobile', {timeout:120000},async t=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'frontend/node_modules/vite/dist/node/index.js')));
 const {default:react}=await import(pathToFileURL(path.join(root,'frontend/node_modules/@vitejs/plugin-react/dist/index.mjs')));
 const aliases=['react','react-dom','i18next','react-i18next','react-icons','axios'].map(name=>({find:name,replacement:path.join(root,'frontend/node_modules',name).replaceAll('\\','/')}));
 const server=await createServer({configFile:false,appType:'custom',root,cacheDir:path.join(root,'frontend/node_modules/.vite-chat-tabs-test'),
   optimizeDeps:{entries:['scripts/fixtures/reader-chat-tabs.tsx']},resolve:{alias:aliases},plugins:[react()],server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});
 server.middlewares.use('/tabs-test',async(_,res)=>{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/tabs-test',
  '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{height:100%;margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}button{cursor:pointer;background:none;border:0;font:inherit}p,h1,h2,h3,h4{margin:0}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-chat-tabs.tsx"></script></body></html>'))});
 await server.listen();let browser;
 try{browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 for(const lang of ['en','he'])await t.test(lang,async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],saved=new Map(),requests=[];let created=0;
  const base=id=>({id,title:id,turns:[],spoilersAllowed:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  saved.set('Earlier conversation', {...base('Earlier conversation'),turns:[{id:'old',question:'Earlier question',answer:Array(30).fill('An earlier answer for testing independent scroll.').join('\n\n'),status:'completed',currentCfi:'old-cfi',createdAt:new Date().toISOString()}]});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/reader/**',async route=>{
   const req=route.request(),url=new URL(req.url()),segments=url.pathname.split('/'),id=decodeURIComponent(segments[5]||'');
   const respond=data=>route.fulfill({json:{status:'success',data}});
   if(segments[4]!=='conversations')throw Error('Unexpected API '+url.pathname);
   if(req.method()==='GET'&&!id)return respond({items:[...saved.values()].map(({turns,...rest})=>rest),nextCursor:null});
   if(req.method()==='POST'&&!id){const conversation=base('Conversation '+ ++created);saved.set(conversation.id,conversation);return respond(conversation)}
   if(req.method()==='GET')return respond(saved.get(id));
   if(req.method()==='DELETE'){saved.delete(id);return respond(null)}
   if(req.method()==='POST'&&segments[6]==='messages'){
    const body=req.postDataJSON();let resolve;const promise=new Promise(r=>resolve=r);requests.push({id,body,finish:()=>resolve()});await promise;
    const previous=saved.get(id),updated={...previous,turns:[...previous.turns,{id:body.requestId,question:body.question,answer:'Answer for '+body.question,status:'completed',currentCfi:body.currentCfi,spoilersAllowed:body.spoilersAllowed,createdAt:new Date().toISOString()}]};saved.set(id,updated);return respond(updated);
   }
   throw Error('Unexpected request '+req.method()+' '+url.pathname);
  });
  const label={send:lang==='he'?'שליחה':'Send',all:lang==='he'?'כל השיחות':'All conversations',search:lang==='he'?'חיפוש שיחות…':'Search conversations…',closeList:lang==='he'?'סגירת רשימת השיחות':'Close conversation list',undo:lang==='he'?'פתיחה מחדש':'Reopen tab'};
  try{
   await page.goto(server.resolvedUrls.local[0]+'tabs-test?lang='+lang);await page.waitForFunction(()=>!!window.tabTest);
   const headerClose=page.locator('.reader-chat-panel > .reader-panel-close');
   assert.equal(await headerClose.evaluate(button=>{const r=button.getBoundingClientRect();return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),true,'The close button beside the chat heading must receive pointer events');
   await headerClose.click();
   assert.equal(await page.locator('.reader-chat-panel').count(),0);
   await page.getByRole('button',{name:'Toggle chat',exact:true}).click();
   const snapshot=()=>page.evaluate(()=>window.tabTest.snapshot());
   const textarea=page.locator('#reader-chat-question');
   await textarea.fill('Question A');await page.getByRole('button',{name:label.send,exact:true}).click();await until(()=>requests.length===1);
   const a=(await snapshot()).activeKey;
   await textarea.fill('Draft A');await page.locator('.reader-chat-new-tab').click();
   await textarea.fill('Question B');await page.getByRole('button',{name:label.send,exact:true}).click();await until(()=>requests.length===2);
   const b=(await snapshot()).activeKey;await textarea.fill('Draft B');
   await page.getByRole('tab',{name:/Conversation 1/}).click();assert.equal(await textarea.inputValue(),'Draft A');
   requests[1].finish();requests[0].finish();await page.waitForFunction(()=>Object.values(window.tabTest.snapshot().tabs).filter(tab=>tab.sending).length===0);
   assert.equal((await snapshot()).tabs[b].unread,true);assert.equal((await snapshot()).tabs[a].conversation.turns[0].answer,'Answer for Question A');
   await page.getByRole('button',{name:label.all,exact:true}).click();
   const dialog=page.locator('.reader-chat-history-drawer');await dialog.waitFor();await page.getByRole('textbox',{name:label.search,exact:true}).fill('Conversation 2');
   await page.locator('.reader-chat-history-item').getByRole('button').first().click();assert.equal(await page.getByRole('tab').count(),2);assert.equal(await textarea.inputValue(),'Draft B');
   await page.getByRole('button',{name:label.all,exact:true}).click();await page.getByRole('textbox',{name:label.search,exact:true}).fill('Earlier');await page.locator('.reader-chat-history-item').getByRole('button').first().click();
   await page.locator('.reader-chat-answer').waitFor();const earlier=(await snapshot()).activeKey;
   await page.locator('.reader-chat-messages').evaluate(node=>{node.scrollTop=100;node.dispatchEvent(new Event('scroll'))});
   await page.getByRole('tab',{name:/Conversation 1/}).click();await page.getByRole('tab',{name:/Earlier conversation/}).click();assert.equal(await page.locator('.reader-chat-messages').evaluate(n=>n.scrollTop),100);
   const closeName=(lang==='he'?'סגירת טאב: ':'Close tab: ')+'Earlier conversation';await page.getByRole('button',{name:closeName,exact:true}).click();assert.equal(await page.getByRole('tab').count(),2);
   await page.getByRole('button',{name:label.undo,exact:true}).click();assert.equal((await snapshot()).activeKey,earlier);
   const separator=page.getByRole('separator');await separator.focus();await separator.press('ArrowLeft');assert.equal((await snapshot()).panelWidth,500);
   const paper=page.locator('.reader-paper');
   const bookAt500=await paper.boundingBox();
   for(let i=0;i<5;i++)await separator.press('ArrowLeft');
   const bookAt600=await paper.boundingBox();
   assert.equal(bookAt500.width-bookAt600.width,100,'Before 760px both panes must resize');
   for(let i=0;i<8;i++)await separator.press('ArrowLeft');
   assert.equal((await snapshot()).panelWidth,760);
   const bookRect=await paper.boundingBox();
   assert.equal(bookAt600.width-bookRect.width,160,'The split stage must continue through 760px');
   const unchangedBook=async()=>assert.deepEqual(await paper.boundingBox(),bookRect,'Above 760px chat must overlay the fixed reader');
   await separator.press('ArrowLeft');assert.equal((await snapshot()).panelWidth,780);await unchangedBook();
   await separator.press('End');
   const workspaceRect=await page.locator('.reader-workspace').boundingBox();
   assert.equal((await page.locator('.reader-chat-panel').boundingBox()).width,workspaceRect.width);
   assert.equal(await separator.getAttribute('aria-valuemax'),String(workspaceRect.width));
   await unchangedBook();
   // Drag from full width through the split boundary and back into overlay mode.
   let grip=await separator.boundingBox();
   await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();
   await page.mouse.move(workspaceRect.x+workspaceRect.width-600,grip.y+grip.height/2,{steps:12});await page.mouse.up();
   assert.deepEqual(await paper.boundingBox(),bookAt600,'Dragging back below 760px resumes the original split');
   grip=await separator.boundingBox();
   await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();
   await page.mouse.move(workspaceRect.x+workspaceRect.width-1000,grip.y+grip.height/2,{steps:12});await page.mouse.up();
   assert.equal((await page.locator('.reader-chat-panel').boundingBox()).width,1000);await unchangedBook();
   // Closing the expanded panel uses the real header X, not a fixture shortcut.
   await headerClose.click();assert.equal(await page.locator('.reader-chat-panel').count(),0);
   await page.getByRole('button',{name:'Toggle chat',exact:true}).click();
   assert.equal((await page.locator('.reader-chat-panel').boundingBox()).width,1000);await unchangedBook();
   await separator.press('Home');for(let i=0;i<3;i++)await separator.press('ArrowLeft');

   await page.getByRole('tab',{name:/Conversation 2/}).click();await page.reload();await page.waitForFunction(()=>window.tabTest&&window.tabTest.snapshot().tabs[window.tabTest.snapshot().activeKey]?.conversation);
   assert.equal(await page.getByRole('tab').count(),3);assert.equal(await textarea.inputValue(),'Draft B');
   await page.getByRole('tab',{name:/Conversation 1/}).focus();await page.keyboard.press(lang==='he'?'ArrowLeft':'ArrowRight');assert.equal((await snapshot()).activeKey,b);
   await page.getByRole('button',{name:label.all,exact:true}).click();await page.getByRole('textbox',{name:label.search,exact:true}).fill('no matching text');assert.equal(await page.locator('.reader-chat-history-item').count(),0);
   await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await page.getByRole('button',{name:label.all,exact:true}).evaluate(n=>n===document.activeElement),true, await page.evaluate(()=>document.activeElement.outerHTML));
   // The hook outlives the visible chat: closing the panel while replying keeps the result.
   await textarea.fill('Background question');await page.getByRole('button',{name:label.send,exact:true}).click();await until(()=>requests.length===3);
   await page.getByRole('button',{name:'Toggle chat',exact:true}).click();requests[2].finish();await page.waitForFunction(()=>Object.values(window.tabTest.snapshot().tabs).every(tab=>!tab.sending));
   await page.getByRole('button',{name:'Toggle chat',exact:true}).click();assert.equal((await snapshot()).tabs[b].conversation.turns.length,2);
   for(const width of [1100,1280,1440,1920]){await page.setViewportSize({width,height:960});const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,chat:document.querySelector('.reader-chat-panel').getBoundingClientRect().width,paper:document.querySelector('.reader-paper').getBoundingClientRect().width}));assert.equal(layout.overflow,false,JSON.stringify(layout));assert.ok(layout.chat>=440&&layout.paper>=480,JSON.stringify(layout))}
   await page.setViewportSize({width:1100,height:960});
   await separator.press('End');
   assert.equal((await paper.boundingBox()).width,480,'Narrow desktops retain the original minimum reader width');
   assert.equal((await page.locator('.reader-chat-panel').boundingBox()).width,1100);
   await page.setViewportSize({width:1440,height:960});
   await page.waitForFunction(()=>document.querySelector('.reader-paper').getBoundingClientRect().width===680);
   assert.equal((await paper.boundingBox()).width,680,'Viewport changes recompute the split threshold');
   await separator.press('Home');for(let i=0;i<3;i++)await separator.press('ArrowLeft');
   if(process.env.CHAT_TABS_SCREENSHOT_DIR){await page.screenshot({path:path.join(process.env.CHAT_TABS_SCREENSHOT_DIR,`chat-tabs-${lang}.png`)});await page.getByRole('button',{name:'Theme',exact:true}).click();await page.screenshot({path:path.join(process.env.CHAT_TABS_SCREENSHOT_DIR,`chat-tabs-${lang}-dark.png`)})}
   // All panels use the same saved width, including after switching and reloading.
   let sharedWidth=500;
   for(const panel of ['contents','search','settings']){
    await page.getByLabel('Panel',{exact:true}).selectOption(panel);
    assert.equal(await page.getByRole('separator').count(),1,'Each panel must have exactly one resize handle');
    const side=page.locator('.reader-resizable-panel'),handle=page.getByRole('separator');
    assert.equal((await side.boundingBox()).width,sharedWidth,'Switching panels must keep the same width');
    await handle.press('Home');assert.equal((await side.boundingBox()).width,440);
    for(let i=0;i<16;i++)await handle.press('ArrowLeft');
    assert.equal((await side.boundingBox()).width,760);
    const bookAtCap=await paper.boundingBox();assert.equal(bookAtCap.width,680);
    await handle.press('End');assert.deepEqual(await paper.boundingBox(),bookAtCap,'Other panels must overlay the fixed reader beyond 760px');
    assert.equal((await side.boundingBox()).width,1440);
    let sideGrip=await handle.boundingBox();
    await page.mouse.move(sideGrip.x+sideGrip.width/2,sideGrip.y+sideGrip.height/2);await page.mouse.down();
    await page.mouse.move(1440-900,sideGrip.y+sideGrip.height/2,{steps:8});await page.mouse.up();
    assert.equal((await side.boundingBox()).width,900);assert.deepEqual(await paper.boundingBox(),bookAtCap);sharedWidth=900;
    await page.locator('.reader-resizable-panel > .reader-panel-close').click();assert.equal(await side.count(),0);
    await page.getByRole('button',{name:'Toggle chat',exact:true}).click();assert.equal((await side.boundingBox()).width,900);
   }
   await page.reload();await page.waitForFunction(()=>!!window.tabTest);
   for(const panel of ['contents','search','settings']){
    await page.getByLabel('Panel',{exact:true}).selectOption(panel);
    assert.equal((await page.locator('.reader-resizable-panel').boundingBox()).width,900,'Shared panel width survives reload');
   }
   await page.getByLabel('Panel',{exact:true}).selectOption('chat');
   assert.equal((await page.locator('.reader-chat-panel').boundingBox()).width,900,'Resizing another panel also updates the chat width');
   await page.setViewportSize({width:390,height:844});
   for(const panel of ['contents','search','settings']){
    await page.getByLabel('Panel',{exact:true}).selectOption(panel);
    assert.equal(await page.locator('.reader-panel-resize').isVisible(),false,'Desktop resizing must stay hidden on mobile');
    assert.ok((await page.locator('.reader-resizable-panel').boundingBox()).width<=390);
   }
   await page.getByLabel('Panel',{exact:true}).selectOption('chat');
   assert.equal(await page.locator('.reader-chat-tabbar').isVisible(),false);assert.equal(await textarea.isVisible(),true);
   assert.deepEqual(errors,[]);
  }finally{for(const request of requests)request.finish();await tick();await page.close()}
 });
 }finally{await browser?.close();await server.close()}
});
