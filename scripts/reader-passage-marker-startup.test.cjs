const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname,'../frontend/src',file),'utf8');
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const exports = {};
  new Function('require','exports',code)(name => dependencies[name],exports);
  return exports;
}
test('translation page tracking mounts before the EPUB manager exists and clears only on page change', async () => {
  const effects=[], listeners=new Map(), added=[], removed=[];
  const rendition = {
    location: undefined,
    currentLocation: () => { throw new Error('EPUB manager is not initialized'); },
    on: (event, callback) => listeners.set(event,callback),
    off: event => listeners.delete(event),
    annotations: {highlight: (...args) => added.push(args), remove: (...args) => removed.push(args)},
  };
  const { ReaderPassageMarker } = load('services/readerPassageMarker.ts');
  const { useReaderPassageMarker } = load('hooks/reader/useReaderPassageMarker.ts',{
    react: {useCallback:fn=>fn,useRef:initial=>({current:initial}),useState:initial=>[initial,()=>{}],
      useMemo:fn=>fn(),useEffect:fn=>effects.push(fn)},
    '../../services/readerPassageMarker':{ReaderPassageMarker},
    '../../services/readerChatPresentation':{readerPassageKey:p=>p.cfi},
    '../../services/readerSelectionRange':{},
  });
  const marker = useReaderPassageMarker({renditionRef:{current:rendition},stateRef:{current:{preferences:{}}}});
  const cleanups = effects.map(effect=>effect());
  const page = {start:{cfi:'page-one-start'},end:{cfi:'page-one-end'}};
  listeners.get('relocated')(page);
  await marker.markPassage({cfi:'word',text:'word'},'blue');
  assert.equal(added.length,1);
  listeners.get('relocated')(page);
  assert.equal(removed.length,0);
  listeners.get('relocated')({start:{cfi:'page-two-start'},end:{cfi:'page-two-end'}});
  assert.deepEqual(removed,[['word','highlight']]);
  cleanups.forEach(cleanup=>cleanup?.());
  assert.equal(listeners.size,0);
});
