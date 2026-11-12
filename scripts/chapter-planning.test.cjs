const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/node_modules/typescript');
require.extensions['.ts'] = (m,p) => m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p);
const {validatePlanning} = require('../backend/src/controllers/book/planningValidation.ts');
const {bookSchema} = require('../backend/src/models/books/schemas/bookSchema.ts');
const {Schema,model} = require('../backend/node_modules/mongoose');
const bookId='222222222222222222222222', chapterId='333333333333333333333333', entityId='444444444444444444444444';
const fixture=()=>({name:'A novel',userId:'111111111111111111111111',chapters:[{id:chapterId,bookId,name:'פרק',planning:{themes:[{entityId}],characters:[{entityId,note:'A turning point'}],plotlines:[{entityId,note:'The letter arrives'}]}}],themes:[{id:entityId,bookId,name:'Memory',color:'#aa9988'}],characters:[{id:entityId,bookId,name:'Mara'}],plotlines:[{id:entityId,bookId,name:'Letter'}],taskBoard:{lists:[{id:'list',title:'Research',cards:[{id:'task',title:'Research',chapterId,completed:true,createdAt:'2026-11-01',updatedAt:'2026-11-01'}]}]}});
test('validates local references regardless of chapter order or archive state',()=>{const b=fixture();validatePlanning(b,bookId);b.chapters.unshift({id:'555555555555555555555555',bookId});b.chapters.reverse();b.characters[0].isArchived=true;b.chapters[0].isArchived=true;validatePlanning(b,bookId);assert.equal(b.taskBoard.lists[0].cards[0].chapterId,chapterId);});
test('rejects cross-book task and entity references, mismatched ownership, duplicates and malformed planning',()=>{for(const mutate of [b=>b.taskBoard.lists[0].cards[0].chapterId='foreign',b=>b.chapters[0].planning.themes[0].entityId='foreign',b=>b.characters[0].bookId='foreign',b=>b.chapters[0].planning.themes.push({entityId}),b=>b.chapters[0].planning.characters='invalid',b=>b.chapters[0].planning=null]){const b=fixture();mutate(b);assert.throws(()=>validatePlanning(b,bookId));}});
test('schema round trip preserves links, contribution notes, task completion and colors',()=>{const Model=model('ChapterPlanningTest',bookSchema);const b=new Model(fixture());assert.equal(b.validateSync(),undefined);const restored=new Model(JSON.parse(JSON.stringify(b)));assert.equal(restored.chapters[0].planning.plotlines[0].note,'The letter arrives');assert.equal(restored.themes[0].color,'#aa9988');assert.equal(restored.taskBoard.lists[0].cards[0].completed,true);assert.equal(restored.taskBoard.lists[0].cards[0].chapterId,chapterId);});
test('legacy books and chapters require no destructive migration',()=>{const Model=model('LegacyPlanningTest',bookSchema);const b=new Model({name:'Legacy',userId:'111111111111111111111111',chapters:[{bookId,name:'Existing'}]});assert.equal(b.validateSync(),undefined);assert.equal(b.chapters[0].planning,undefined);assert.equal(b.taskBoard,undefined);validatePlanning(b.toObject(),bookId);});
test('schema rejects invalid colors and overlong chapter notes',()=>{const Model=model('InvalidPlanningTest',bookSchema);const b=fixture();b.themes[0].color='red';b.chapters[0].planning.characters[0].note='x'.repeat(50001);const error=new Model(b).validateSync();assert.ok(error.errors['themes.0.color']);assert.ok(error.errors['chapters.0.planning.characters.0.note']);});

test('character schema no longer supports role or general notes; chapter notes remain',()=>{
  const Model=model('RemovedCharacterFieldsTest',bookSchema);
  const data=fixture();data.characters[0].role='Unused';data.characters[0].notes='Unused';
  const b=new Model(data).toObject();
  assert.equal(b.characters[0].role,undefined);
  assert.equal(b.characters[0].notes,undefined);
  assert.equal(b.chapters[0].planning.characters[0].note,'A turning point');
});

const {chapterBoard, withChapterBoard} = require('../frontend/src/components/WritingStudio/planningModel.ts');
const {moveTask} = require('../frontend/src/components/WritingStudio/taskBoardModel.ts');
test('two chapters own list titles, cards and ordering; global tasks stay unchanged through persistence',()=>{
 let book=fixture(); const second='555555555555555555555555'; book.chapters.push({id:second,bookId,name:'Second'});
 const global=structuredClone(book.taskBoard);
 let one=chapterBoard(book,chapterId); one.lists[0].title='First only';
 one.lists.push({id:'new',title:'Extra',cards:[]}); one=moveTask(one,'new','list');
 book=withChapterBoard(book,chapterId,one);
 let two=chapterBoard(book,second); two.lists[0].title='Second only';
 book=withChapterBoard(book,second,two);
 book.chapters[0].annotations=[{id:'general-a',general:true,anchor:null,quote:'',content:'First note'},{id:'general-b',general:true,anchor:null,quote:'',content:'Another note'}];
 book.chapters[1].annotations=[{id:'general-c',general:true,anchor:null,quote:'',content:'Second note'}];
 const Model=model('IndependentChapterBoards',bookSchema);const doc=new Model(book);assert.equal(doc.validateSync(),undefined);
 const restored=new Model(JSON.parse(JSON.stringify(doc)));
 assert.equal(restored.chapters[0].taskBoard.lists[0].title,'Extra');
 assert.equal(restored.chapters[0].taskBoard.lists[1].title,'First only');
 assert.equal(restored.chapters[1].taskBoard.lists[0].title,'Second only');
 assert.equal(restored.chapters[1].taskBoard.lists[0].cards.length,0);
 assert.equal(restored.chapters[0].annotations[0].general,true);
 assert.equal(restored.chapters[0].annotations[0].anchor,null);
 assert.equal(restored.chapters[1].annotations[0].content,'Second note');
 assert.deepEqual(book.taskBoard,global);
});
