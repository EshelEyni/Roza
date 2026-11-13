const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const JSZip=require('../frontend/node_modules/jszip');const root=path.resolve(__dirname,'..');
async function epub(){const zip=new JSZip();zip.file('mimetype','application/epub+zip');zip.file('META-INF/container.xml','<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');zip.file('book.opf','<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">navigation</dc:identifier><dc:title>Navigation</dc:title><dc:language>en</dc:language></metadata><manifest>'+Array.from({length:8},(_,i)=>'<item id="c'+i+'" href="c'+i+'.xhtml" media-type="application/xhtml+xml"/>').join('')+'</manifest><spine>'+Array.from({length:8},(_,i)=>'<itemref idref="c'+i+'"/>').join('')+'</spine></package>');for(let i=0;i<8;i++)zip.file('c'+i+'.xhtml','<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Chapter '+i+'</title></head><body><p id="note">'+(i===0?'<a epub:type="noteref" href="c7.xhtml#note">Note 1</a> ':'')+Array.from({length:600},(_,j)=>'chapter'+i+'word'+j).join(' ')+'</p></body></html>');return zip.generateAsync({type:'nodebuffer'});}
test('Go Back dismisses on the next EPUB page change on desktop and mobile', {timeout:120000},async()=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'frontend/node_modules/vite/dist/node/index.js')));const {default:react}=await import(pathToFileURL(path.join(root,'frontend/node_modules/@vitejs/plugin-react/dist/index.mjs')));const file=await epub();const aliases=['react','react-dom','epubjs','react-icons','i18next','react-i18next','axios'].map(name=>({find:name,replacement:path.join(root,'frontend/node_modules',name).replaceAll('\\','/')}));const server=await createServer({configFile:false,appType:'custom',root,cacheDir:path.join(root,'frontend/node_modules/.vite-navigation-test'),plugins:[react()],resolve:{alias:aliases},optimizeDeps:{entries:['scripts/fixtures/reader-navigation.tsx']},server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});
 server.middlewares.use('/api/reader/navigation/file',(_,res)=>{res.setHeader('Content-Type','application/epub+zip');res.end(file)});server.middlewares.use('/api/',(_,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'success',data:{}}))});
 server.middlewares.use('/navigation-test',async(_,res)=>{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/navigation-test','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}.reader-shell{height:100vh}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-navigation.tsx"></script></body></html>'))});await server.listen();let browser;
 try{browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});const page=await browser.newPage({viewport:{width:1280,height:850}});const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>localStorage.removeItem('roza-reader:fixture:navigation'));await page.goto(server.resolvedUrls.local[0]+'navigation-test');await page.waitForFunction(()=>window.navigationTest?.reader.locationsReady&&/^Page/.test(window.navigationTest.reader.pageLabel),null,{timeout:45000});

 const button=page.getByRole('button',{name:/Go back to page/});
 const cfi=()=>page.evaluate(()=>window.navigationTest.reader.location.start.cfi);
 const prepare=async()=>{
   await page.reload();await page.waitForFunction(()=>window.navigationTest?.reader.locationsReady&&/^Page/.test(window.navigationTest.reader.pageLabel),null,{timeout:45000});
   const origin=await cfi();await page.evaluate(()=>window.navigationTest.reader.onProgressNavigate(.8));await button.waitFor({timeout:15000});return origin;
 };
 for(const mobile of [false,true]){
   await page.setViewportSize({width:mobile?390:1280,height:850});
   for(const direction of ['Next','Previous']){
     await prepare();const landing=await cfi();
     await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
     assert.equal(await button.isVisible(),true,'Document events do not dismiss Go Back');
     await page.getByRole('button',{name:direction+' page or section',exact:true}).click();
     await page.waitForFunction(previous=>window.navigationTest.reader.location.start.cfi!==previous&&!window.navigationTest.reader.returnPoint,landing);
     assert.equal(await button.count(),0,'Page movement dismisses the button');
   }
   const origin=await prepare();await button.click();
   await page.waitForFunction(expected=>window.navigationTest.reader.location.start.cfi===expected&&!window.navigationTest.reader.returnPoint,origin);
   assert.equal(await cfi(),origin,'Go Back still returns to the saved page');
 }
 assert.deepEqual(errors,[]);
 }finally{await browser?.close();await server.close()}
});
