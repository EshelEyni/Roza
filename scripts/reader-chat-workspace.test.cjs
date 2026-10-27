const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/node_modules/typescript');
const exports_ = {};
new Function('exports', ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,
  '../frontend/src/services/readerChatWorkspace.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(exports_);
const { ReaderChatWorkspace } = exports_;
const flush = () => new Promise(r => setImmediate(r));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b}); return {promise,resolve,reject}; };
const memory = () => { const values = new Map(); return { values, getItem:k=>values.get(k)||null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) }; };
const conv = (id, turns=[]) => ({id,title:id,turns,spoilersAllowed:false,createdAt:'2026-10-27',updatedAt:'2026-10-27'});
const turn = id => ({id,question:id,answer:'answer '+id,status:'completed',createdAt:'2026-10-27'});
function setup(api={}, storage=memory(), user='alice', book='book') {
 let n=0;
 const store=new ReaderChatWorkspace(book,user,{list:async()=>({items:[],nextCursor:null}),getById:async(_,id)=>conv(id),...api},()=>`request-${++n}`,()=>storage);
 store.initialize(); return {store,storage};
}

test('out-of-order replies update their own tabs, drafts, passage and unread state',async()=>{
 const a=deferred(),b=deferred();let creates=0;
 const {store}=setup({create:async()=>conv('server-'+ ++creates),send:(_book,id)=>id==='server-1'?a.promise:b.promise});
 const first=store.active.key;store.attach({cfi:'a-start',endCfi:'a-end',text:'A'});
 assert.equal(store.send('A','page-a'),true);store.setDraft('Next A');await flush();
 store.start({cfi:'b-start',text:'B'});const second=store.active.key;store.setSpoilersAllowed(true);
 assert.equal(store.send('B','page-b'),true);store.setDraft('Next B');await flush();
 b.resolve(conv('server-2',[turn('request-2')]));await flush();
 store.selectTab(first);a.resolve(conv('server-1',[turn('request-1')]));await flush();
 const tabs=store.getSnapshot().tabs;
 assert.equal(tabs[first].conversation.id,'server-1');assert.equal(tabs[second].conversation.id,'server-2');
 assert.equal(tabs[first].draft,'Next A');assert.equal(tabs[second].draft,'Next B');
 assert.equal(tabs[second].spoilersAllowed,true);assert.equal(tabs[second].unread,true);
 assert.equal(store.send('Next A','new-page'),true);
});

test('closing a sending tab keeps the request alive, history and undo recover it',async()=>{
 const reply=deferred();const {store}=setup({create:async()=>conv('saved'),send:()=>reply.promise});
 const key=store.active.key;store.send('Question','position');await flush();store.closeTab(key);
 assert.equal(store.getSnapshot().activeKey,null);reply.resolve(conv('saved',[turn('request-1')]));await flush();
 assert.equal(store.getSnapshot().tabs[key].conversation.turns.length,1);
 assert.equal(store.getSnapshot().tabs[key].unread,true);assert.equal(store.getSnapshot().items[0].id,'saved');
 store.reopenTab();assert.equal(store.active.key,key);assert.equal(store.active.pending,null);
 store.closeTab(key);await store.open('saved');assert.deepEqual(store.getSnapshot().openKeys,[key]);
});

test('same saved conversation opens once and a slow load cannot steal focus',async()=>{
 const one=deferred(),two=deferred();let reads=0;
 const {store}=setup({getById:(_,id)=>{reads++;return id==='one'?one.promise:two.promise}});
 const opening=store.open('one'),again=store.open('one');const first=store.active.key;
 const other=store.open('two');const second=store.active.key;
 one.resolve(conv('one'));await Promise.all([opening,again]);assert.equal(store.active.key,second);
 two.resolve(conv('two'));await other;assert.equal(reads,2);
 assert.equal(store.getSnapshot().openKeys.filter(k=>k===first).length,1);
});

test('history remains usable during sends; a failed tab leaves other requests and drafts intact',async()=>{
 const bad=deferred();const {store}=setup({create:async()=>conv('failed'),send:()=>bad.promise});
 store.send('One','original');const first=store.active.key;await flush();
 store.start();store.setDraft('Unrelated draft');const second=store.active.key;
 await store.loadHistory();assert.equal(store.getSnapshot().history,true);
 bad.reject(Error('Rate limit'));await flush();assert.equal(store.active.key,second);
 assert.equal(store.active.draft,'Unrelated draft');assert.equal(store.active.error,'');
 assert.equal(store.getSnapshot().tabs[first].error,'Rate limit');
});

test('three parallel sends accepted; fourth retains its draft and no hidden request is queued',async()=>{
 let sends=0,creates=0;const never=new Promise(()=>{});
 const {store}=setup({create:async()=>conv('c'+ ++creates),send:()=>{sends++;return never}});
 for(let i=0;i<3;i++){if(i)store.start();assert.equal(store.send('Q'+i,'position'),true);await flush()}
 store.start();store.setDraft('Fourth');assert.equal(store.send('Fourth','position'),false);
 assert.equal(store.active.draft,'Fourth');assert.equal(store.active.errorKey,'parallelLimit');assert.equal(sends,3);
});

test('reload preserves tab order, drafts, scroll, width, local passages, and account/book isolation',async()=>{
 const storage=memory();const {store}=setup({getById:async(_,id)=>conv(id,[turn('existing')])},storage);
 await store.open('saved');store.setDraft('Saved draft');store.rememberScroll(store.active.key,137,['existing']);const saved=store.active.key;
 store.start({cfi:'word',text:'word'});store.setDraft('Unsent draft');const local=store.active.key;store.setPanelWidth(620);store.flush();
 const restored=setup({},storage).store;await flush();
 assert.deepEqual(restored.getSnapshot().openKeys,store.getSnapshot().openKeys);assert.equal(restored.active.key,local);
 assert.equal(restored.active.draft,'Unsent draft');assert.equal(restored.active.passage.text,'word');
 assert.equal(restored.getSnapshot().tabs[saved].draft,'Saved draft');assert.equal(restored.getSnapshot().tabs[saved].scrollTop,137);
 assert.equal(restored.getSnapshot().panelWidth,620);
 assert.equal(setup({},storage,'bob').store.active.draft,'');assert.equal(setup({},storage,'alice','other-book').store.active.draft,'');
 assert.ok(!storage.values.get('roza-chat-workspace:v1:alice:book').includes('answer existing'));
});

test('refresh reconciles a pending request from the server without sending it again',async()=>{
 const storage=memory();const {store}=setup({create:async()=>conv('saved'),send:()=>new Promise(()=>{})},storage);
 store.send('Question','position');await flush();store.flush();let sends=0;
 const restored=setup({getById:async()=>conv('saved',[turn('request-1')]),send:async()=>{sends++;throw Error('must not send')}},storage).store;
 await flush();assert.equal(restored.active.pending,null);assert.equal(restored.active.sending,false);assert.equal(sends,0);
});

test('reloaded failed selection-only request retries its original position, passage and id',async()=>{
 const storage=memory();const api={create:async()=>conv('saved'),send:async()=>{throw Error('offline')}};
 const {store}=setup(api,storage);store.attach({cfi:'start',endCfi:'end',text:'Only a quote'});store.send('','old-position');await flush();store.flush();
 let sent;const restored=setup({send:async(_,__,body)=>{sent=body;return conv('saved',[turn(body.requestId)])}},storage).store;
 await flush();restored.setSpoilersAllowed(true);assert.equal(restored.send('', 'new-position',restored.active.pending.id),true);await flush();
 assert.equal(sent.requestId,'request-1');assert.equal(sent.currentCfi,'end');assert.equal(sent.spoilersAllowed,false);assert.equal(sent.passageCfi,'start');
});

test('storage failures do not block requests; invalid stored tabs are ignored',async()=>{
 let saved=false;const {store}=setup({create:async()=>conv('saved'),send:async()=>{saved=true;return conv('saved')}},{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});
 assert.equal(store.getSnapshot().storageWarning,true);assert.equal(store.send('Question','position'),true);await flush();assert.equal(saved,true);
 const storage=memory();storage.setItem('roza-chat-workspace:v1:alice:book',JSON.stringify({version:1,tabs:[null,{key:'__proto__',title:'bad',draft:''}],openKeys:['__proto__']}));
 assert.equal(setup({},storage).store.getSnapshot().openKeys.length,0);
});

test('a departed scope cannot write a late response into stored workspace',async()=>{
 const reply=deferred(),storage=memory();const {store}=setup({create:async()=>conv('saved'),send:()=>reply.promise},storage);
 store.send('Question','position');await flush();store.setSavingEnabled(false);
 const before=storage.values.get('roza-chat-workspace:v1:alice:book');reply.resolve(conv('saved',[turn('request-1')]));await flush();
 assert.equal(storage.values.get('roza-chat-workspace:v1:alice:book'),before);
});

test('deletion is distinct from closing, blocked while sending, and failed deletion keeps tabs',async()=>{
 let removes=0;const {store}=setup({remove:async()=>{removes++;throw Error('offline')}});
 await store.open('saved');const key=store.active.key;await store.remove('saved');
 assert.equal(removes,1);assert.ok(store.getSnapshot().tabs[key]);assert.equal(store.getSnapshot().historyError,'offline');
 store.closeTab(key);assert.equal(removes,1);await store.open('saved');assert.equal(store.active.key,key);
});

test('a selected passage reuses a pristine empty tab without overwriting a draft',()=>{
 const {store}=setup();const first=store.active.key;
 store.start({cfi:'first',text:'First passage'});assert.equal(store.active.key,first);assert.equal(store.getSnapshot().openKeys.length,1);
 store.setDraft('Keep this');store.start({cfi:'second',text:'Second passage'});
 assert.notEqual(store.active.key,first);assert.equal(store.getSnapshot().tabs[first].draft,'Keep this');
});

test('a slow history response cannot hide a conversation completed during the refresh',async()=>{
 const history=deferred();const {store}=setup({list:()=>history.promise,create:async()=>conv('fresh'),send:async()=>conv('fresh',[turn('request-1')])});
 const refreshing=store.loadHistory();store.setHistory(false);store.send('New question','position');await flush();
 const key=store.active.key;store.closeTab(key);history.resolve({items:[],nextCursor:null});await refreshing;
 assert.equal(store.getSnapshot().items[0].id,'fresh');
});


test('chat width has no fixed desktop maximum and survives reload independently of viewport',()=>{
 const storage=memory();const {store}=setup({},storage);
 store.setPanelWidth(1250);assert.equal(store.getSnapshot().panelWidth,1250);
 assert.equal(setup({},storage).store.getSnapshot().panelWidth,1250);
 store.setPanelWidth(10);assert.equal(store.getSnapshot().panelWidth,440);
 store.setPanelWidth(Infinity);assert.equal(store.getSnapshot().panelWidth,480);
});


test('all reader panels share one persisted width scoped to account and book',()=>{
 const storage=memory();const {store}=setup({},storage);
 store.setPanelWidth(900);assert.equal(setup({},storage).store.getSnapshot().panelWidth,900);
 store.setPanelWidth(700);assert.equal(setup({},storage).store.getSnapshot().panelWidth,700);
 assert.equal(setup({},storage,'bob').store.getSnapshot().panelWidth,480);
 assert.equal(setup({},storage,'alice','other-book').store.getSnapshot().panelWidth,480);
 const saved=JSON.parse(storage.getItem('roza-chat-workspace:v1:alice:book'));
 assert.equal(saved.panelWidth,700);assert.equal('sidePanelWidths' in saved,false);
});

test('legacy per-panel widths migrate to the existing shared chat width',()=>{
 const storage=memory();const {store}=setup({},storage);store.setPanelWidth(800);
 const key='roza-chat-workspace:v1:alice:book',saved=JSON.parse(storage.getItem(key));
 saved.sidePanelWidths={contents:900,search:700,settings:500};storage.setItem(key,JSON.stringify(saved));
 const restored=setup({},storage).store;assert.equal(restored.getSnapshot().panelWidth,800);
 restored.setPanelWidth(1000);
 const updated=JSON.parse(storage.getItem(key));assert.equal(updated.panelWidth,1000);assert.equal('sidePanelWidths' in updated,false);
});

test('legacy workspace migrates to one group without losing order, active tab or shared width',async()=>{
 const storage=memory();const {store}=setup({},storage);await store.open('one');await store.open('two');store.setDraft('Keep me');store.setPanelWidth(900);
 const key='roza-chat-workspace:v1:alice:book',saved=JSON.parse(storage.getItem(key));delete saved.groups;delete saved.focusedGroupId;delete saved.groupRatio;storage.setItem(key,JSON.stringify(saved));
 const restored=setup({},storage).store;await flush();const s=restored.getSnapshot();
 assert.equal(s.groups.length,1);assert.deepEqual(s.groups[0].keys,saved.openKeys);assert.equal(s.activeKey,saved.activeKey);assert.equal(restored.active.draft,'Keep me');assert.equal(s.panelWidth,900);
});

test('two visible groups send independently and neither visible answer is marked unread',async()=>{
 const a=deferred(),b=deferred();let creates=0;const {store}=setup({create:async()=>conv('c'+ ++creates),send:(_,id)=>id==='c1'?a.promise:b.promise});
 const first=store.active.key;store.send('A','a-position');store.setDraft('Draft A');await flush();
 const secondGroup=store.splitGroup();assert.equal(store.active,undefined);assert.equal(store.getSnapshot().panelWidth,720);
 store.start(undefined,secondGroup);const second=store.active.key;store.send('B','b-position');store.setDraft('Draft B');await flush();
 store.setTabViewing(first,true);store.setTabViewing(second,true);b.resolve(conv('c2',[turn('request-2')]));a.resolve(conv('c1',[turn('request-1')]));await flush();
 const s=store.getSnapshot();assert.equal(s.tabs[first].draft,'Draft A');assert.equal(s.tabs[second].draft,'Draft B');assert.equal(s.tabs[first].unread,false);assert.equal(s.tabs[second].unread,false);
 store.setDraft('Explicit A',first);assert.equal(store.active.draft,'Draft B');assert.equal(store.getSnapshot().tabs[first].draft,'Explicit A');
});

test('moving a sending tab keeps the request, original boundary and draft attached to its key',async()=>{
 const response=deferred();let body;const {store}=setup({create:async()=>conv('one'),send:(_,__,request)=>{body=request;return response.promise}});
 const key=store.active.key;store.attach({cfi:'start',endCfi:'end',text:'Selected'});store.send('Question','position');store.setDraft('Unsent');await flush();
 const target=store.splitGroup();store.moveTab(key,target);assert.equal(store.active.key,key);assert.equal(store.getSnapshot().groups[0].keys.length,0);
 response.resolve(conv('one',[turn('request-1')]));await flush();assert.equal(store.active.draft,'Unsent');assert.equal(body.currentCfi,'end');assert.equal(store.active.conversation.turns.length,1);
 assert.equal(store.getSnapshot().groups.flatMap(g=>g.keys).filter(id=>id===key).length,1);
});

test('conversations open uniquely and explicit beside moves the existing chat',async()=>{
 const {store}=setup();await store.open('saved');const key=store.active.key,source=store.getSnapshot().focusedGroupId;
 const target=store.splitGroup();assert.notEqual(source,target);assert.equal(store.active,undefined);
 await store.open('saved',target);assert.equal(store.getSnapshot().focusedGroupId,source);
 await store.open('saved',source,true);assert.equal(store.getSnapshot().focusedGroupId,target);
 assert.equal(store.getSnapshot().groups.flatMap(g=>g.keys).filter(id=>id===key).length,1);
});

test('closing the last tab collapses its group; undo recreates it and merge preserves focus and all tabs',()=>{
 const {store}=setup();const first=store.active.key,target=store.splitGroup();store.start(undefined,target);const second=store.active.key;
 store.closeTab(second);assert.equal(store.getSnapshot().groups.length,1);store.reopenTab();assert.equal(store.getSnapshot().groups.length,2);assert.equal(store.active.key,second);
 store.mergeGroups();assert.equal(store.getSnapshot().groups.length,1);assert.equal(store.active.key,second);assert.deepEqual(new Set(store.getSnapshot().groups[0].keys),new Set([first,second]));
});

test('chat group selection, ratio and focused group survive reload with shared width',async()=>{
 const storage=memory(),{store}=setup({},storage);await store.open('saved');const first=store.active.key;
 const group=store.splitGroup();store.start(undefined,group);store.setDraft('Second conversation');const second=store.active.key;
 store.setGroupRatio(.62);store.setPanelWidth(1000);store.flush();
 const restored=setup({},storage).store;await flush();const s=restored.getSnapshot();assert.deepEqual(s.groups,store.getSnapshot().groups);assert.equal(s.groupRatio,.62);assert.equal(s.panelWidth,1000);assert.equal(s.activeKey,second);
 assert.ok(s.openKeys.includes(first));assert.equal(setup({},storage,'bob').store.getSnapshot().groups.length,1);
});

test('restoring corrupt groups rejects duplicate and unknown keys without losing legacy conversations',()=>{
 const storage=memory(),{store}=setup({},storage);store.flush();const key='roza-chat-workspace:v1:alice:book',saved=JSON.parse(storage.getItem(key)),first=store.active.key;
 saved.groups=[{id:'group-one',keys:[first,'__proto__','tool-search'],activeKey:first},{id:'group-two',keys:[first,'unknown','tool-search'],activeKey:'unknown'}];
 storage.setItem(key,JSON.stringify(saved));const s=setup({},storage).store.getSnapshot();assert.deepEqual(s.groups[0].keys,[first]);assert.equal(s.groups.length,1);assert.equal(s.groups[0].activeKey,first);
});

test('closing a visible pending group marks its eventual response unread',async()=>{
 const response=deferred(),{store}=setup({create:async()=>conv('saved'),send:()=>response.promise});
 const key=store.active.key;store.send('Question','position');await flush();store.setTabViewing(key,true);store.closeTab(key);
 response.resolve(conv('saved',[turn('request-1')]));await flush();assert.equal(store.getSnapshot().tabs[key].unread,true);
});


test('obsolete book-tool tabs are removed from stored AI groups without losing chats or shared width',()=>{
 const storage=memory(),{store}=setup({},storage);store.setDraft('Keep the chat');store.setPanelWidth(920);store.flush();
 const key='roza-chat-workspace:v1:alice:book',saved=JSON.parse(storage.getItem(key)),first=store.active.key;
 saved.groups=[{id:'group-chat',keys:[first,'tool-contents'],activeKey:'tool-contents'},{id:'group-tools',keys:['tool-search','tool-settings'],activeKey:'tool-search'}];saved.focusedGroupId='group-tools';
 storage.setItem(key,JSON.stringify(saved));const restored=setup({},storage).store,s=restored.getSnapshot();
 assert.equal(s.groups.length,1);assert.deepEqual(s.groups[0].keys,[first]);assert.equal(s.activeKey,first);assert.equal(restored.active.draft,'Keep the chat');assert.equal(s.panelWidth,920);
 restored.flush();assert.equal(JSON.stringify(JSON.parse(storage.getItem(key)).groups).includes('tool-'),false);
});
