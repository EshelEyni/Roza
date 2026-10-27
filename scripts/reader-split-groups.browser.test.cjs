const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const until=async predicate=>{for(let n=0;n<200;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20))}throw Error('Timed out waiting for request')};

test('split workspace: real views stay independent across groups, moves, standalone panels, restore and mobile',{timeout:120000},async t=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'frontend/node_modules/vite/dist/node/index.js')));
 const {default:react}=await import(pathToFileURL(path.join(root,'frontend/node_modules/@vitejs/plugin-react/dist/index.mjs')));
 const alias=['react','react-dom','i18next','react-i18next','react-icons','axios'].map(name=>({find:name,replacement:path.join(root,'frontend/node_modules',name).replaceAll('\\','/')}));
 const server=await createServer({configFile:false,appType:'custom',root,cacheDir:path.join(root,'frontend/node_modules/.vite-reader-split-test'),
  optimizeDeps:{entries:['scripts/fixtures/reader-chat-tabs.tsx']},resolve:{alias},plugins:[react()],server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});
 server.middlewares.use('/split-test',async(_,res)=>{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/split-test',
  '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{height:100%;margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}button{cursor:pointer;background:none;border:0;font:inherit}p,h1,h2,h3,h4{margin:0}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-chat-tabs.tsx"></script></body></html>'))});
 await server.listen();let browser;
 try{browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 for(const lang of ['en','he'])await t.test(lang,async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],saved=new Map(),requests=[];let number=0;
  const conversation=id=>({id,title:id,turns:[],spoilersAllowed:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/reader/**',async route=>{
   const request=route.request(),segments=new URL(request.url()).pathname.split('/'),id=decodeURIComponent(segments[5]||''),respond=data=>route.fulfill({json:{status:'success',data}});
   if(request.method()==='GET'&&!id)return respond({items:[...saved.values()].map(({turns,...summary})=>summary),nextCursor:null});
   if(request.method()==='POST'&&!id){const created=conversation('Conversation '+ ++number);saved.set(created.id,created);return respond(created)}
   if(request.method()==='GET')return respond(saved.get(id));
   if(request.method()==='DELETE'){saved.delete(id);return respond(null)}
   if(request.method()==='POST'&&segments[6]==='messages'){
    const body=request.postDataJSON();let finish;const pending=new Promise(resolve=>finish=resolve);requests.push({id,body,finish});await pending;
    const old=saved.get(id),updated={...old,turns:[...old.turns,{id:body.requestId,question:body.question,answer:'Answer for '+body.question,status:'completed',currentCfi:body.currentCfi,createdAt:new Date().toISOString()}]};saved.set(id,updated);return respond(updated);
   }
   throw Error('Unexpected fixture request '+request.url());
  });
  const labels=lang==='he'?{split:'פיצול לצד',merge:'איחוד עמודות',all:'כל השיחות',send:'שליחה',newSecond:'שיחה חדשה בקבוצה 2',moveFirst:'העברת הטאב הנבחר מקבוצה 1 לצד',divider:'חלוקת הרוחב בין קבוצות הטאבים',undo:'פתיחה מחדש'}
   :{split:'Split beside',merge:'Merge columns',all:'All conversations',send:'Send',newSecond:'New conversation in group 2',moveFirst:'Move selected tab from group 1 beside',divider:'Resize the two tab groups',undo:'Reopen tab'};
  try{
   await page.goto(server.resolvedUrls.local[0]+'split-test?lang='+lang);await page.waitForFunction(()=>!!window.tabTest);
   const snapshot=()=>page.evaluate(()=>window.tabTest.snapshot()),input=key=>page.locator('#reader-chat-question-'+key),view=key=>page.locator('#reader-group-view-'+key);
   assert.equal((await snapshot()).groups.length,1);
   assert.equal(await page.locator('.reader-groups-actions > .reader-icon-button').evaluate(button=>{const r=button.getBoundingClientRect();return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),true,'AI settings and the sheet close button must have separate hit areas');
   const first=(await snapshot()).activeKey,g1=(await snapshot()).focusedGroupId;
   await input(first).fill('Question A');await view(first).getByRole('button',{name:labels.send,exact:true}).click();await until(()=>requests.length===1);await input(first).fill('Draft A');
   await page.getByRole('button',{name:labels.split,exact:true}).click();assert.equal(await page.locator('.reader-group-empty').count(),1);
   const g2=(await snapshot()).focusedGroupId;await page.getByRole('button',{name:labels.newSecond,exact:true}).click();
   const second=(await snapshot()).activeKey;assert.equal(await page.locator('.reader-chat-compose textarea:visible').count(),2);
   await input(second).fill('Question B');await view(second).getByRole('button',{name:labels.send,exact:true}).click();await until(()=>requests.length===2);await input(second).fill('Draft B');
   requests[1].finish();requests[0].finish();await page.waitForFunction(()=>Object.values(window.tabTest.snapshot().tabs).every(tab=>!tab.sending));
   let s=await snapshot();assert.equal(s.tabs[first].unread,false);assert.equal(s.tabs[second].unread,false);assert.equal(await input(first).inputValue(),'Draft A');assert.equal(await input(second).inputValue(),'Draft B');
   assert.equal(await input(second).evaluate(node=>node===document.activeElement),true,'Background answer must not steal focus');
   assert.match(await view(first).innerText(),/Answer for Question A/);assert.match(await view(second).innerText(),/Answer for Question B/);
   if(process.env.CHAT_TABS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.CHAT_TABS_SCREENSHOT_DIR,'implemented-split-'+lang+'.png')});
   const bookBefore=await page.locator('.reader-paper').boundingBox();const divider=page.getByRole('separator',{name:labels.divider,exact:true});
   await divider.focus();await divider.press(lang==='he'?'ArrowLeft':'ArrowRight');const ratio=(await snapshot()).groupRatio;
   assert.notEqual(ratio,.5);assert.deepEqual(await page.locator('.reader-paper').boundingBox(),bookBefore,'Internal divider must not move the reader');
   await page.getByRole('button',{name:labels.moveFirst,exact:true}).click();s=await snapshot();assert.equal(s.groups.find(g=>g.keys.includes(first)).id,g2);assert.equal(s.groups.find(g=>g.id===g1).keys.length,0);
   await page.locator('[data-reader-tab-key="'+second+'"]').dragTo(page.locator('.reader-group-empty'));
   s=await snapshot();assert.equal(s.groups.find(g=>g.keys.includes(second)).id,g1);assert.equal(await input(second).inputValue(),'Draft B');
   // Book tools are standalone panels, never internal chat tabs or split columns.
   const chatGroupsBeforeTools=(await snapshot()).groups;
   for(const panel of ['contents','search','settings']){
    await page.getByLabel('Panel',{exact:true}).selectOption(panel);
    await page.waitForSelector('.reader-group-grid',{state:'detached'});
    assert.equal(await page.getByRole('tablist').count(),0,'Only AI chat may have internal tabs');
    assert.equal(await page.getByRole('button',{name:labels.split,exact:true}).count(),0,'Standalone tools may not split into chat groups');
    const selector=panel==='contents'?'.reader-contents':panel==='search'?'.reader-search':'.reader-settings';
    assert.equal(await page.locator(selector).isVisible(),true);
    assert.equal(await page.getByRole('separator').count(),1,'A standalone panel has only the outer resize grip');
    const grip=page.getByRole('separator');await grip.press('Home');for(let i=0;i<16;i++)await grip.press('ArrowLeft');
    const fixedBook=await page.locator('.reader-paper').boundingBox();await grip.press('End');assert.deepEqual(await page.locator('.reader-paper').boundingBox(),fixedBook,'Standalone tools retain overlay expansion above 760px');
    const rect=await page.locator('.reader-resizable-panel').boundingBox(),handle=await grip.boundingBox();
    await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width-900,handle.y+handle.height/2,{steps:6});await page.mouse.up();
    assert.equal((await page.locator('.reader-resizable-panel').boundingBox()).width,900);
    assert.deepEqual((await snapshot()).groups,chatGroupsBeforeTools,'Opening or resizing a book tool must not alter AI groups');
    if(panel==='search'){
     await page.locator('#reader-search-input').fill('house');await page.locator('#reader-search-input').press('Enter');
     await page.waitForFunction(()=>document.querySelectorAll('.reader-search-result').length>0);
    }
   }
   await page.getByLabel('Panel',{exact:true}).selectOption('chat');await page.waitForSelector('.reader-group-grid');
   assert.deepEqual((await snapshot()).groups,chatGroupsBeforeTools);assert.equal(await input(first).inputValue(),'Draft A');assert.equal(await input(second).inputValue(),'Draft B');
   assert.equal((await page.locator('.reader-chat-panel').boundingBox()).width,900,'Book tools and AI chat share only the outer width');
   await page.locator('.reader-groups-heading').getByRole('button',{name:labels.all,exact:true}).click();
   assert.equal(await page.locator('[data-reader-history-id^="tool-"]').count(),0,'The conversation list contains no book tools');
   await page.keyboard.press('Escape');
   await page.getByRole('button',{name:labels.merge,exact:true}).click();assert.equal((await snapshot()).groups.length,1);
   await page.getByRole('button',{name:labels.split,exact:true}).click();const empty=(await snapshot()).focusedGroupId;
   await page.locator('.reader-group-empty .reader-button').first().click();
   await page.locator('[data-reader-history-id="Conversation 1"] button').first().click();
   s=await snapshot();assert.equal(s.groups.flatMap(g=>g.keys).filter(key=>key===first).length,1);
   // Explicit beside opening moves the existing conversation instead of duplicating it.
   await page.locator('.reader-groups-heading').getByRole('button',{name:labels.all,exact:true}).click();
   await page.locator('[data-reader-history-id="Conversation 1"] button').nth(1).click();
   s=await snapshot();assert.equal(s.groups.find(g=>g.keys.includes(first)).id,empty);
   const beforeReload=s.groups;await page.reload();await page.waitForFunction(()=>window.tabTest&&Object.values(window.tabTest.snapshot().tabs).every(tab=>!tab.loading));
   s=await snapshot();assert.deepEqual(s.groups,beforeReload);assert.equal(s.groupRatio,ratio);assert.equal(s.tabs[first].draft,'Draft A');assert.equal(s.tabs[second].draft,'Draft B');
   await page.locator('[aria-label="'+(lang==='he'?'סגירת טאב: Conversation 1':'Close tab: Conversation 1')+'"]').click();assert.equal((await snapshot()).groups.length,1);
   await page.getByRole('button',{name:labels.undo,exact:true}).click();assert.equal((await snapshot()).groups.length,2);
   for(const width of [1100,1280,1440,1920]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(40);const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,widths:[...document.querySelectorAll('.reader-group-heading')].map(e=>e.getBoundingClientRect().width)}));assert.equal(layout.overflow,false);assert.ok(layout.widths.every(w=>w>=339),JSON.stringify(layout))}
   await page.setViewportSize({width:390,height:844});await page.waitForSelector('.reader-group-grid',{state:'detached'});assert.equal(await page.locator('.reader-group-grid').count(),0);assert.equal(await page.locator('.reader-chat-compose textarea:visible').count(),1);
   await page.setViewportSize({width:1440,height:1000});await page.waitForSelector('.reader-group-grid');assert.equal((await snapshot()).groups.length,2);
   assert.deepEqual(errors,[]);
  }finally{requests.forEach(request=>request.finish());await page.close()}
 });
 }finally{await browser?.close();await server.close()}
});
