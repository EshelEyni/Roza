const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(path,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').resolve(__dirname,'..',path),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:name=>{if(name in imports)return imports[name];throw Error(name);}});return exports;}
const {ReaderChatWorkspace}=load('src/services/readerChatWorkspace.ts',{});
const {useReaderPanelActions}=load('src/hooks/reader/useReaderPanels.ts',{'../../services/readerAiLimits':{readerAiLimits:{passage:12000}},react:{},'react-dom':{flushSync:fn=>fn()}});
for(const mobile of [false,true])for(const reuse of [false,true])test('auto submission mobile='+mobile+' reuse='+reuse,async()=>{
 const calls=[];
 const api={create:async()=>({id:'conversation',turns:[]}),send:async(...args)=>{calls.push(args);return {id:'conversation',turns:[{question:args[2].question,answer:'Explanation'}]};}};
 const store=new ReaderChatWorkspace('book',undefined,api,()=> 'request',()=>undefined);
 const original=store.getSnapshot().activeKey;
 if(!reuse)store.setDraft('Keep my draft',original);
 let panel,closed=false;
 const actions=useReaderPanelActions({mobile,shell:{current:null},chat:{start:store.start,forTab:key=>({send:q=>store.send(q,'visible-page',undefined,key)})},textSelection:{text:'countenanced',word:'countenanced',cfi:'word-start',endCfi:'word-end'},setPanel:value=>{panel=value;},closeLookup:()=>{closed=true;}});
 const question="";
 actions.askAi(true);
 const state=store.getSnapshot(),tab=state.tabs[state.activeKey];
 assert.equal(panel,'chat');assert.equal(closed,true);assert.equal(tab.pending.question,question);assert.equal(tab.sending,true);assert.equal(tab.pending.passage.text,'countenanced');
 if(reuse)assert.equal(state.activeKey,original);else{assert.notEqual(state.activeKey,original);assert.equal(state.tabs[original].draft,'Keep my draft');}
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,1);assert.equal(calls[0][2].question,question);assert.equal(calls[0][2].passageCfi,'word-start');assert.equal(calls[0][2].passageEndCfi,'word-end');assert.equal(calls[0][2].currentCfi,'word-end');
 assert.equal(store.getSnapshot().tabs[state.activeKey].conversation.turns[0].answer,'Explanation');
});
