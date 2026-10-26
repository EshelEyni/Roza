const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
function load(name) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../frontend/src/services/'+name+'.ts'),'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS} }).outputText;
  const exported = {};
  new Function('require', 'exports', code)(name => load(name.replace('./','')), exported);
  return exported;
}
const { bindReaderContents } = load('bindReaderContents');
function setup() {
  const doc = new EventTarget();
  // Normalize capture options because Node's EventTarget differs from browser DOM.
  const remove = doc.removeEventListener.bind(doc);
  doc.removeEventListener = (type, callback, options) => remove(type, callback, typeof options === 'boolean' ? {capture:options} : options);
  doc.getSelection = () => ({toString: () => ''});
  const calls = [];
  const runtime = {mobileRef:{current:false}, stateRef:{current:{preferences:{flow:'paginated'}}}, panelRef:{current:null}, selectionRef:{current:null}};
  let frameTitle;
  doc.defaultView = {frameElement:{setAttribute:(_,value)=>frameTitle=value}};
  const stop = bindReaderContents({document:doc, addStylesheetRules:rules=>calls.push(rules)}, runtime, {onSelectionChange:()=>calls.push('selection'), closeLookup:()=>calls.push('dismiss')}, {onKey:()=>calls.push('key'), enabled:()=>true, move:d=>calls.push(d), title:'Test book'});
  return {doc,calls,runtime,stop,get title(){return frameTitle;}};
}
test('iframe listeners are detached before the book is reinitialized', () => {
  const s=setup();
  s.doc.dispatchEvent(new Event('keydown'));
  s.doc.dispatchEvent(new Event('selectionchange'));
  s.doc.dispatchEvent(new Event('pointerdown'));
  assert.deepEqual(s.calls.slice(1), ['key','selection','dismiss']);
  s.stop();
  const count=s.calls.length;
  for(const type of ['keydown','selectionchange','pointerdown']) s.doc.dispatchEvent(new Event(type));
  assert.equal(s.calls.length,count);
});
test('untrusted book links are blocked and the link listener is cleaned up', () => {
  const s=setup();
  const link={closest:()=>({getAttribute:()=> 'https://example.com'})};
  function click(){const event=new Event('click',{cancelable:true}); Object.defineProperty(event,'target',{value:link}); s.doc.dispatchEvent(event); return event;}
  assert.equal(click().defaultPrevented,true);
  s.stop();
  assert.equal(click().defaultPrevented,false);
});
test('book selection remains native and each iframe gets its own title', () => {
  const s=setup();
  assert.equal(s.title,'Test book');
  assert.equal(s.calls[0]['html, body']['user-select'],'text');
  s.runtime.mobileRef.current=true;
  s.doc.dispatchEvent(new Event('pointerdown'));
  assert.equal(s.calls.includes('dismiss'),false);
  s.stop();
});
