const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/node_modules/typescript');
const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../frontend/src/services/readerSelectionEdge.ts'),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const moduleExports={}; new Function('exports',source)(moduleExports);
const {readerSelectionEdge}=moduleExports;
const host={left:100,right:600,top:50,bottom:350},frame={left:100,top:50,right:1600,bottom:350};
function doc(rects) {return {body:{},createTreeWalker:()=>{let first=true;return {nextNode:()=>first?(first=false,{textContent:'text'}):null}},createRange:()=>({selectNodeContents:()=>{},getClientRects:()=>rects})};}
const rect=(left,top)=>({left,right:left+400,top,bottom:top+20,width:400,height:20});
const text=doc([rect(0,10),rect(0,100),rect(0,230),rect(600,270)]);
test('middle row at right edge cannot advance',()=>assert.equal(readerSelectionEdge(text,frame,host,{x:595,y:160}),undefined));
test('last visible row at right edge advances',()=>assert.equal(readerSelectionEdge(text,frame,host,{x:595,y:290}),'next'));
test('first visible row at left edge goes back',()=>assert.equal(readerSelectionEdge(text,frame,host,{x:105,y:65}),'prev'));
test('middle row at left edge cannot go back',()=>assert.equal(readerSelectionEdge(text,frame,host,{x:105,y:160}),undefined));
test('last row away from right edge cannot advance',()=>assert.equal(readerSelectionEdge(text,frame,host,{x:350,y:290}),undefined));
test('empty content and points outside the viewport never turn pages',()=>{assert.equal(readerSelectionEdge(doc([]),frame,host,{x:595,y:290}),undefined);assert.equal(readerSelectionEdge(text,frame,host,{x:595,y:400}),undefined)});
