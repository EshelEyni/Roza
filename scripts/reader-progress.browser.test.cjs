const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
test('saved progress defaults across books and sessions on desktop and mobile', {timeout:120000},async t=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'frontend/node_modules/vite/dist/node/index.js')));
 const {default:react}=await import(pathToFileURL(path.join(root,'frontend/node_modules/@vitejs/plugin-react/dist/index.mjs')));
 const aliases=['react','react-dom','i18next','react-i18next','react-icons','axios'].map(name=>({find:name,replacement:path.join(root,'frontend/node_modules',name).replaceAll('\\','/')}));
 const server=await createServer({configFile:false,appType:'custom',root,cacheDir:path.join(root,'.test-cache/vite-progress'),resolve:{alias:aliases},plugins:[react()],server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});
 server.middlewares.use('/progress-test',async(_,res)=>{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/progress-test','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-progress.tsx"></script></body></html>'))});
 await server.listen();let browser;
 try{browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 for(const mobile of [false,true])await t.test(mobile?'mobile':'desktop',async()=>{
  let saved={defaultProgressDisplay:'percentage'},writes=0,failNext=false;
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile});
  await context.route('**/api/reader/progress-settings',async route=>{
   if(route.request().method()==='PATCH'){if(failNext){failNext=false;return route.fulfill({status:500,json:{message:'Save failed'}})}saved=route.request().postDataJSON();writes++}
   await route.fulfill({json:{status:'success',data:saved}});
  });
  let page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>console.error('PAGE ERROR',e.message));const url=server.resolvedUrls.local[0]+'progress-test';
  const indicator=()=>page.locator(mobile?'.reader-mobile-progress .reader-reading-remaining':'.reader-percent');
  const select=()=>page.getByRole('combobox',{name:/Default Reading Progress Display/});
  const expectText=async text=>{await page.waitForFunction(({selector,text})=>document.querySelector(selector)?.textContent===text,{selector:mobile?'.reader-mobile-progress .reader-reading-remaining':'.reader-percent',text})};
  const waitSaved=()=>page.waitForFunction(()=>[...document.querySelectorAll('[role="status"]')].some(n=>n.textContent==='Saved for your account'));
  await page.goto(url);await waitSaved();await expectText('42%');
  for(const [mode,text]of [['section','Section: 7 left'],['book','Book: 90 left'],['percentage','42%']]){
   await select().selectOption(mode);await waitSaved();await expectText(text);assert.equal(saved.defaultProgressDisplay,mode);
   if(mobile)await page.locator('.reader-sheet-backdrop').click({position:{x:10,y:10}});else await page.locator('.reader-panel-close').click();const count=writes;await indicator().click();await expectText(mode==='percentage'?'Section: 7 left':mode==='section'?'Book: 90 left':'42%');assert.equal(writes,count);assert.equal(saved.defaultProgressDisplay,mode);
   await page.getByRole('button',{name:'Switch book'}).click();await waitSaved();await expectText(text);
   await page.close();await context.clearCookies();page=await context.newPage();await page.goto(url);await page.evaluate(()=>localStorage.clear());await page.reload();await waitSaved();await expectText(text);assert.equal(await select().inputValue(),mode);
  }
  failNext=true;await select().selectOption('book');await page.getByRole('button',{name:'Try again',exact:true}).waitFor();await page.getByRole('button',{name:'Try again',exact:true}).click();await waitSaved();assert.equal(saved.defaultProgressDisplay,'book');
  await context.close();
 });
 }finally{await browser?.close();await server.close()}
});
