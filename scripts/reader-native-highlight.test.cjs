const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('../frontend/node_modules/typescript');
const exportsObject={};
new Function('exports',ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../frontend/src/services/readerNativeHighlight.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(exportsObject);
const {bindNativeHighlight}=exportsObject;
function setup(supported=true){
  const registry=new Map(), listeners=new Map(), styles=[];
  const doc={defaultView:supported?{CSS:{highlights:registry},Highlight:class{constructor(range){this.range=range}}}:{},head:{append:style=>styles.push(style)},createElement:()=>({textContent:'',remove(){this.removed=true}})};
  const element={style:{removeProperty(key){delete this[key]}},dataset:{}};
  const annotation={mark:{range:{startContainer:{ownerDocument:doc}},element},on:(name,callback)=>listeners.set(name,callback),off:name=>listeners.delete(name)};
  return {doc,registry,listeners,styles,element,annotation};
}
test('native text highlights use exact opaque foreground/background colors',()=>{
 const host=setup(); const cleanup=bindNativeHighlight(host.annotation,'#e7d8bd','#6b4f3a');
 assert.equal(host.registry.size,1);
 assert.match(host.styles[0].textContent,/background-color:#e7d8bd;color:#6b4f3a;/);
 assert.equal(host.element.style.fill,'transparent');
 assert.ok(host.element.dataset.readerNativeHighlight);
 cleanup(); assert.equal(host.registry.size,0); assert.equal(host.listeners.size,0); assert.equal(host.styles[0].removed,true);
});
test('chapter teardown can null the EPUB mark element before native cleanup',()=>{
 const host=setup();const cleanup=bindNativeHighlight(host.annotation,'#e7d8bd','#6b4f3a');
 host.annotation.mark.element=null;
 assert.doesNotThrow(cleanup);assert.equal(host.registry.size,0);assert.equal(host.styles[0].removed,true);
});
test('unsupported native highlights leave the EPUB fallback untouched',()=>{
 const host=setup(false);const cleanup=bindNativeHighlight(host.annotation,'#e7d8bd','#6b4f3a');
 assert.equal(host.registry.size,0);assert.equal(host.element.style.fill,undefined);cleanup();
});
