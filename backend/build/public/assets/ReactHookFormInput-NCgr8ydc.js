import{R as I,j as ue,c as gr}from"./index-BKuXz_yj.js";import{E as hr}from"./PageContent-D57lKvj_.js";var fe=e=>e.type==="checkbox",se=e=>e instanceof Date,L=e=>e==null;const Ye=e=>typeof e=="object";var S=e=>!L(e)&&!Array.isArray(e)&&Ye(e)&&!se(e),vr=e=>S(e)&&e.target?fe(e.target)?e.target.checked:e.target.value:e,_r=e=>e.substring(0,e.search(/\.\d+(\.|$)/))||e,br=(e,s)=>e.has(_r(s)),xr=e=>{const s=e.constructor&&e.constructor.prototype;return S(s)&&s.hasOwnProperty("isPrototypeOf")},Le=typeof window<"u"&&typeof window.HTMLElement<"u"&&typeof document<"u";function P(e){let s;const r=Array.isArray(e);if(e instanceof Date)s=new Date(e);else if(e instanceof Set)s=new Set(e);else if(!(Le&&(e instanceof Blob||e instanceof FileList))&&(r||S(e)))if(s=r?[]:{},!r&&!xr(e))s=e;else for(const n in e)e.hasOwnProperty(n)&&(s[n]=P(e[n]));else return e;return s}var ce=e=>Array.isArray(e)?e.filter(Boolean):[],A=e=>e===void 0,d=(e,s,r)=>{if(!s||!S(e))return r;const n=ce(s.split(/[,[\].]+?/)).reduce((u,l)=>L(u)?u:u[l],e);return A(n)||n===e?A(e[s])?r:e[s]:n},G=e=>typeof e=="boolean",Re=e=>/^\w*$/.test(e),er=e=>ce(e.replace(/["|']|\]/g,"").split(/\.|\[/)),F=(e,s,r)=>{let n=-1;const u=Re(s)?[s]:er(s),l=u.length,y=l-1;for(;++n<l;){const h=u[n];let R=r;if(n!==y){const U=e[h];R=S(U)||Array.isArray(U)?U:isNaN(+u[n+1])?{}:[]}if(h==="__proto__")return;e[h]=R,e=e[h]}return e};const He={BLUR:"blur",FOCUS_OUT:"focusout",CHANGE:"change"},q={onBlur:"onBlur",onChange:"onChange",onSubmit:"onSubmit",onTouched:"onTouched",all:"all"},W={max:"max",min:"min",maxLength:"maxLength",minLength:"minLength",pattern:"pattern",required:"required",validate:"validate"};I.createContext(null);var Vr=(e,s,r,n=!0)=>{const u={defaultValues:s._defaultValues};for(const l in e)Object.defineProperty(u,l,{get:()=>{const y=l;return s._proxyFormState[y]!==q.all&&(s._proxyFormState[y]=!n||q.all),e[y]}});return u},O=e=>S(e)&&!Object.keys(e).length,Fr=(e,s,r,n)=>{r(e);const{name:u,...l}=e;return O(l)||Object.keys(l).length>=Object.keys(s).length||Object.keys(l).find(y=>s[y]===q.all)},Ee=e=>Array.isArray(e)?e:[e];function Ar(e){const s=I.useRef(e);s.current=e,I.useEffect(()=>{const r=!e.disabled&&s.current.subject&&s.current.subject.subscribe({next:s.current.next});return()=>{r&&r.unsubscribe()}},[e.disabled])}var $=e=>typeof e=="string",mr=(e,s,r,n,u)=>$(e)?(n&&s.watch.add(e),d(r,e,u)):Array.isArray(e)?e.map(l=>(n&&s.watch.add(l),d(r,l))):(n&&(s.watchAll=!0),r),wr=(e,s,r,n,u)=>s?{...r[e],types:{...r[e]&&r[e].types?r[e].types:{},[n]:u||!0}}:{},We=e=>({isOnSubmit:!e||e===q.onSubmit,isOnBlur:e===q.onBlur,isOnChange:e===q.onChange,isOnAll:e===q.all,isOnTouch:e===q.onTouched}),Ze=(e,s,r)=>!r&&(s.watchAll||s.watch.has(e)||[...s.watch].some(n=>e.startsWith(n)&&/^\.\w+/.test(e.slice(n.length))));const oe=(e,s,r,n)=>{for(const u of r||Object.keys(e)){const l=d(e,u);if(l){const{_f:y,...h}=l;if(y){if(y.refs&&y.refs[0]&&s(y.refs[0],u)&&!n)break;if(y.ref&&s(y.ref,y.name)&&!n)break;oe(h,s)}else S(h)&&oe(h,s)}}};var Dr=(e,s,r)=>{const n=ce(d(e,r));return F(n,"root",s[r]),F(e,r,n),e},Te=e=>e.type==="file",J=e=>typeof e=="function",_e=e=>{if(!Le)return!1;const s=e?e.ownerDocument:0;return e instanceof(s&&s.defaultView?s.defaultView.HTMLElement:HTMLElement)},ve=e=>$(e),Ce=e=>e.type==="radio",be=e=>e instanceof RegExp;const Ke={value:!1,isValid:!1},ze={value:!0,isValid:!0};var rr=e=>{if(Array.isArray(e)){if(e.length>1){const s=e.filter(r=>r&&r.checked&&!r.disabled).map(r=>r.value);return{value:s,isValid:!!s.length}}return e[0].checked&&!e[0].disabled?e[0].attributes&&!A(e[0].attributes.value)?A(e[0].value)||e[0].value===""?ze:{value:e[0].value,isValid:!0}:ze:Ke}return Ke};const Ge={isValid:!1,value:null};var tr=e=>Array.isArray(e)?e.reduce((s,r)=>r&&r.checked&&!r.disabled?{isValid:!0,value:r.value}:s,Ge):Ge;function Je(e,s,r="validate"){if(ve(e)||Array.isArray(e)&&e.every(ve)||G(e)&&!e)return{type:r,message:ve(e)?e:"",ref:s}}var te=e=>S(e)&&!be(e)?e:{value:e,message:""},Qe=async(e,s,r,n,u)=>{const{ref:l,refs:y,required:h,maxLength:R,minLength:U,min:m,max:_,pattern:de,validate:Z,name:T,valueAsNumber:Fe,mount:K,disabled:z}=e._f,b=d(s,T);if(!K||z)return{};const j=y?y[0]:l,H=v=>{n&&j.reportValidity&&(j.setCustomValidity(G(v)?"":v||""),j.reportValidity())},D={},Y=Ce(l),ye=fe(l),Q=Y||ye,ee=(Fe||Te(l))&&A(l.value)&&A(b)||_e(l)&&l.value===""||b===""||Array.isArray(b)&&!b.length,M=wr.bind(null,T,r,D),ge=(v,x,E,p=W.maxLength,B=W.minLength)=>{const N=v?x:E;D[T]={type:v?p:B,message:N,ref:l,...M(v?p:B,N)}};if(u?!Array.isArray(b)||!b.length:h&&(!Q&&(ee||L(b))||G(b)&&!b||ye&&!rr(y).isValid||Y&&!tr(y).isValid)){const{value:v,message:x}=ve(h)?{value:!!h,message:h}:te(h);if(v&&(D[T]={type:W.required,message:x,ref:j,...M(W.required,x)},!r))return H(x),D}if(!ee&&(!L(m)||!L(_))){let v,x;const E=te(_),p=te(m);if(!L(b)&&!isNaN(b)){const B=l.valueAsNumber||b&&+b;L(E.value)||(v=B>E.value),L(p.value)||(x=B<p.value)}else{const B=l.valueAsDate||new Date(b),N=ne=>new Date(new Date().toDateString()+" "+ne),ie=l.type=="time",ae=l.type=="week";$(E.value)&&b&&(v=ie?N(b)>N(E.value):ae?b>E.value:B>new Date(E.value)),$(p.value)&&b&&(x=ie?N(b)<N(p.value):ae?b<p.value:B<new Date(p.value))}if((v||x)&&(ge(!!v,E.message,p.message,W.max,W.min),!r))return H(D[T].message),D}if((R||U)&&!ee&&($(b)||u&&Array.isArray(b))){const v=te(R),x=te(U),E=!L(v.value)&&b.length>+v.value,p=!L(x.value)&&b.length<+x.value;if((E||p)&&(ge(E,v.message,x.message),!r))return H(D[T].message),D}if(de&&!ee&&$(b)){const{value:v,message:x}=te(de);if(be(v)&&!b.match(v)&&(D[T]={type:W.pattern,message:x,ref:l,...M(W.pattern,x)},!r))return H(x),D}if(Z){if(J(Z)){const v=await Z(b,s),x=Je(v,j);if(x&&(D[T]={...x,...M(W.validate,x.message)},!r))return H(x.message),D}else if(S(Z)){let v={};for(const x in Z){if(!O(v)&&!r)break;const E=Je(await Z[x](b,s),j,x);E&&(v={...E,...M(x,E.message)},H(E.message),r&&(D[T]=v))}if(!O(v)&&(D[T]={ref:j,...v},!r))return D}}return H(!0),D};function Er(e,s){const r=s.slice(0,-1).length;let n=0;for(;n<r;)e=A(e)?n++:e[s[n++]];return e}function kr(e){for(const s in e)if(e.hasOwnProperty(s)&&!A(e[s]))return!1;return!0}function k(e,s){const r=Array.isArray(s)?s:Re(s)?[s]:er(s),n=r.length===1?e:Er(e,r),u=r.length-1,l=r[u];return n&&delete n[l],u!==0&&(S(n)&&O(n)||Array.isArray(n)&&kr(n))&&k(e,r.slice(0,-1)),e}var ke=()=>{let e=[];return{get observers(){return e},next:u=>{for(const l of e)l.next&&l.next(u)},subscribe:u=>(e.push(u),{unsubscribe:()=>{e=e.filter(l=>l!==u)}}),unsubscribe:()=>{e=[]}}},xe=e=>L(e)||!Ye(e);function X(e,s){if(xe(e)||xe(s))return e===s;if(se(e)&&se(s))return e.getTime()===s.getTime();const r=Object.keys(e),n=Object.keys(s);if(r.length!==n.length)return!1;for(const u of r){const l=e[u];if(!n.includes(u))return!1;if(u!=="ref"){const y=s[u];if(se(l)&&se(y)||S(l)&&S(y)||Array.isArray(l)&&Array.isArray(y)?!X(l,y):l!==y)return!1}}return!0}var sr=e=>e.type==="select-multiple",Sr=e=>Ce(e)||fe(e),Se=e=>_e(e)&&e.isConnected,ir=e=>{for(const s in e)if(J(e[s]))return!0;return!1};function Ve(e,s={}){const r=Array.isArray(e);if(S(e)||r)for(const n in e)Array.isArray(e[n])||S(e[n])&&!ir(e[n])?(s[n]=Array.isArray(e[n])?[]:{},Ve(e[n],s[n])):L(e[n])||(s[n]=!0);return s}function ar(e,s,r){const n=Array.isArray(e);if(S(e)||n)for(const u in e)Array.isArray(e[u])||S(e[u])&&!ir(e[u])?A(s)||xe(r[u])?r[u]=Array.isArray(e[u])?Ve(e[u],[]):{...Ve(e[u])}:ar(e[u],L(s)?{}:s[u],r[u]):r[u]=!X(e[u],s[u]);return r}var he=(e,s)=>ar(e,s,Ve(s)),nr=(e,{valueAsNumber:s,valueAsDate:r,setValueAs:n})=>A(e)?e:s?e===""?NaN:e&&+e:r&&$(e)?new Date(e):n?n(e):e;function pe(e){const s=e.ref;if(!(e.refs?e.refs.every(r=>r.disabled):s.disabled))return Te(s)?s.files:Ce(s)?tr(e.refs).value:sr(s)?[...s.selectedOptions].map(({value:r})=>r):fe(s)?rr(e.refs).value:nr(A(s.value)?e.ref.value:s.value,e)}var pr=(e,s,r,n)=>{const u={};for(const l of e){const y=d(s,l);y&&F(u,l,y._f)}return{criteriaMode:r,names:[...e],fields:u,shouldUseNativeValidation:n}},le=e=>A(e)?e:be(e)?e.source:S(e)?be(e.value)?e.value.source:e.value:e,Lr=e=>e.mount&&(e.required||e.min||e.max||e.maxLength||e.minLength||e.pattern||e.validate);function Xe(e,s,r){const n=d(e,r);if(n||Re(r))return{error:n,name:r};const u=r.split(".");for(;u.length;){const l=u.join("."),y=d(s,l),h=d(e,l);if(y&&!Array.isArray(y)&&r!==l)return{name:r};if(h&&h.type)return{name:l,error:h};u.pop()}return{name:r}}var Rr=(e,s,r,n,u)=>u.isOnAll?!1:!r&&u.isOnTouch?!(s||e):(r?n.isOnBlur:u.isOnBlur)?!e:(r?n.isOnChange:u.isOnChange)?e:!0,Tr=(e,s)=>!ce(d(e,s)).length&&k(e,s);const Cr={mode:q.onSubmit,reValidateMode:q.onChange,shouldFocusError:!0};function Or(e={}){let s={...Cr,...e},r={submitCount:0,isDirty:!1,isLoading:J(s.defaultValues),isValidating:!1,isSubmitted:!1,isSubmitting:!1,isSubmitSuccessful:!1,isValid:!1,touchedFields:{},dirtyFields:{},validatingFields:{},errors:s.errors||{},disabled:s.disabled||!1},n={},u=S(s.defaultValues)||S(s.values)?P(s.defaultValues||s.values)||{}:{},l=s.shouldUnregister?{}:P(u),y={action:!1,mount:!1,watch:!1},h={mount:new Set,unMount:new Set,array:new Set,watch:new Set},R,U=0;const m={isDirty:!1,dirtyFields:!1,validatingFields:!1,touchedFields:!1,isValidating:!1,isValid:!1,errors:!1},_={values:ke(),array:ke(),state:ke()},de=We(s.mode),Z=We(s.reValidateMode),T=s.criteriaMode===q.all,Fe=t=>i=>{clearTimeout(U),U=setTimeout(t,i)},K=async t=>{if(m.isValid||t){const i=s.resolver?O((await Q()).errors):await M(n,!0);i!==r.isValid&&_.state.next({isValid:i})}},z=(t,i)=>{(m.isValidating||m.validatingFields)&&((t||Array.from(h.mount)).forEach(a=>{a&&(i?F(r.validatingFields,a,i):k(r.validatingFields,a))}),_.state.next({validatingFields:r.validatingFields,isValidating:!O(r.validatingFields)}))},b=(t,i=[],a,c,f=!0,o=!0)=>{if(c&&a){if(y.action=!0,o&&Array.isArray(d(n,t))){const g=a(d(n,t),c.argA,c.argB);f&&F(n,t,g)}if(o&&Array.isArray(d(r.errors,t))){const g=a(d(r.errors,t),c.argA,c.argB);f&&F(r.errors,t,g),Tr(r.errors,t)}if(m.touchedFields&&o&&Array.isArray(d(r.touchedFields,t))){const g=a(d(r.touchedFields,t),c.argA,c.argB);f&&F(r.touchedFields,t,g)}m.dirtyFields&&(r.dirtyFields=he(u,l)),_.state.next({name:t,isDirty:v(t,i),dirtyFields:r.dirtyFields,errors:r.errors,isValid:r.isValid})}else F(l,t,i)},j=(t,i)=>{F(r.errors,t,i),_.state.next({errors:r.errors})},H=t=>{r.errors=t,_.state.next({errors:r.errors,isValid:!1})},D=(t,i,a,c)=>{const f=d(n,t);if(f){const o=d(l,t,A(a)?d(u,t):a);A(o)||c&&c.defaultChecked||i?F(l,t,i?o:pe(f._f)):p(t,o),y.mount&&K()}},Y=(t,i,a,c,f)=>{let o=!1,g=!1;const V={name:t},w=!!(d(n,t)&&d(n,t)._f&&d(n,t)._f.disabled);if(!a||c){m.isDirty&&(g=r.isDirty,r.isDirty=V.isDirty=v(),o=g!==V.isDirty);const C=w||X(d(u,t),i);g=!!(!w&&d(r.dirtyFields,t)),C||w?k(r.dirtyFields,t):F(r.dirtyFields,t,!0),V.dirtyFields=r.dirtyFields,o=o||m.dirtyFields&&g!==!C}if(a){const C=d(r.touchedFields,t);C||(F(r.touchedFields,t,a),V.touchedFields=r.touchedFields,o=o||m.touchedFields&&C!==a)}return o&&f&&_.state.next(V),o?V:{}},ye=(t,i,a,c)=>{const f=d(r.errors,t),o=m.isValid&&G(i)&&r.isValid!==i;if(e.delayError&&a?(R=Fe(()=>j(t,a)),R(e.delayError)):(clearTimeout(U),R=null,a?F(r.errors,t,a):k(r.errors,t)),(a?!X(f,a):f)||!O(c)||o){const g={...c,...o&&G(i)?{isValid:i}:{},errors:r.errors,name:t};r={...r,...g},_.state.next(g)}},Q=async t=>{z(t,!0);const i=await s.resolver(l,s.context,pr(t||h.mount,n,s.criteriaMode,s.shouldUseNativeValidation));return z(t),i},ee=async t=>{const{errors:i}=await Q(t);if(t)for(const a of t){const c=d(i,a);c?F(r.errors,a,c):k(r.errors,a)}else r.errors=i;return i},M=async(t,i,a={valid:!0})=>{for(const c in t){const f=t[c];if(f){const{_f:o,...g}=f;if(o){const V=h.array.has(o.name);z([c],!0);const w=await Qe(f,l,T,s.shouldUseNativeValidation&&!i,V);if(z([c]),w[o.name]&&(a.valid=!1,i))break;!i&&(d(w,o.name)?V?Dr(r.errors,w,o.name):F(r.errors,o.name,w[o.name]):k(r.errors,o.name))}g&&await M(g,i,a)}}return a.valid},ge=()=>{for(const t of h.unMount){const i=d(n,t);i&&(i._f.refs?i._f.refs.every(a=>!Se(a)):!Se(i._f.ref))&&Ae(t)}h.unMount=new Set},v=(t,i)=>(t&&i&&F(l,t,i),!X(Oe(),u)),x=(t,i,a)=>mr(t,h,{...y.mount?l:A(i)?u:$(t)?{[t]:i}:i},a,i),E=t=>ce(d(y.mount?l:u,t,e.shouldUnregister?d(u,t,[]):[])),p=(t,i,a={})=>{const c=d(n,t);let f=i;if(c){const o=c._f;o&&(!o.disabled&&F(l,t,nr(i,o)),f=_e(o.ref)&&L(i)?"":i,sr(o.ref)?[...o.ref.options].forEach(g=>g.selected=f.includes(g.value)):o.refs?fe(o.ref)?o.refs.length>1?o.refs.forEach(g=>(!g.defaultChecked||!g.disabled)&&(g.checked=Array.isArray(f)?!!f.find(V=>V===g.value):f===g.value)):o.refs[0]&&(o.refs[0].checked=!!f):o.refs.forEach(g=>g.checked=g.value===f):Te(o.ref)?o.ref.value="":(o.ref.value=f,o.ref.type||_.values.next({name:t,values:{...l}})))}(a.shouldDirty||a.shouldTouch)&&Y(t,f,a.shouldTouch,a.shouldDirty,!0),a.shouldValidate&&ne(t)},B=(t,i,a)=>{for(const c in i){const f=i[c],o=`${t}.${c}`,g=d(n,o);(h.array.has(t)||!xe(f)||g&&!g._f)&&!se(f)?B(o,f,a):p(o,f,a)}},N=(t,i,a={})=>{const c=d(n,t),f=h.array.has(t),o=P(i);F(l,t,o),f?(_.array.next({name:t,values:{...l}}),(m.isDirty||m.dirtyFields)&&a.shouldDirty&&_.state.next({name:t,dirtyFields:he(u,l),isDirty:v(t,o)})):c&&!c._f&&!L(o)?B(t,o,a):p(t,o,a),Ze(t,h)&&_.state.next({...r}),_.values.next({name:y.mount?t:void 0,values:{...l}})},ie=async t=>{y.mount=!0;const i=t.target;let a=i.name,c=!0;const f=d(n,a),o=()=>i.type?pe(f._f):vr(t),g=V=>{c=Number.isNaN(V)||V===d(l,a,V)};if(f){let V,w;const C=o(),re=t.type===He.BLUR||t.type===He.FOCUS_OUT,cr=!Lr(f._f)&&!s.resolver&&!d(r.errors,a)&&!f._f.deps||Rr(re,d(r.touchedFields,a),r.isSubmitted,Z,de),we=Ze(a,h,re);F(l,a,C),re?(f._f.onBlur&&f._f.onBlur(t),R&&R(0)):f._f.onChange&&f._f.onChange(t);const De=Y(a,C,re,!1),dr=!O(De)||we;if(!re&&_.values.next({name:a,type:t.type,values:{...l}}),cr)return m.isValid&&K(),dr&&_.state.next({name:a,...we?{}:De});if(!re&&we&&_.state.next({...r}),s.resolver){const{errors:$e}=await Q([a]);if(g(C),c){const yr=Xe(r.errors,n,a),je=Xe($e,n,yr.name||a);V=je.error,a=je.name,w=O($e)}}else z([a],!0),V=(await Qe(f,l,T,s.shouldUseNativeValidation))[a],z([a]),g(C),c&&(V?w=!1:m.isValid&&(w=await M(n,!0)));c&&(f._f.deps&&ne(f._f.deps),ye(a,w,V,De))}},ae=(t,i)=>{if(d(r.errors,i)&&t.focus)return t.focus(),1},ne=async(t,i={})=>{let a,c;const f=Ee(t);if(s.resolver){const o=await ee(A(t)?t:f);a=O(o),c=t?!f.some(g=>d(o,g)):a}else t?(c=(await Promise.all(f.map(async o=>{const g=d(n,o);return await M(g&&g._f?{[o]:g}:g)}))).every(Boolean),!(!c&&!r.isValid)&&K()):c=a=await M(n);return _.state.next({...!$(t)||m.isValid&&a!==r.isValid?{}:{name:t},...s.resolver||!t?{isValid:a}:{},errors:r.errors}),i.shouldFocus&&!c&&oe(n,ae,t?f:h.mount),c},Oe=t=>{const i={...y.mount?l:u};return A(t)?i:$(t)?d(i,t):t.map(a=>d(i,a))},Ue=(t,i)=>({invalid:!!d((i||r).errors,t),isDirty:!!d((i||r).dirtyFields,t),error:d((i||r).errors,t),isValidating:!!d(r.validatingFields,t),isTouched:!!d((i||r).touchedFields,t)}),lr=t=>{t&&Ee(t).forEach(i=>k(r.errors,i)),_.state.next({errors:t?r.errors:{}})},Me=(t,i,a)=>{const c=(d(n,t,{_f:{}})._f||{}).ref,f=d(r.errors,t)||{},{ref:o,message:g,type:V,...w}=f;F(r.errors,t,{...w,...i,ref:c}),_.state.next({name:t,errors:r.errors,isValid:!1}),a&&a.shouldFocus&&c&&c.focus&&c.focus()},ur=(t,i)=>J(t)?_.values.subscribe({next:a=>t(x(void 0,i),a)}):x(t,i,!0),Ae=(t,i={})=>{for(const a of t?Ee(t):h.mount)h.mount.delete(a),h.array.delete(a),i.keepValue||(k(n,a),k(l,a)),!i.keepError&&k(r.errors,a),!i.keepDirty&&k(r.dirtyFields,a),!i.keepTouched&&k(r.touchedFields,a),!i.keepIsValidating&&k(r.validatingFields,a),!s.shouldUnregister&&!i.keepDefaultValue&&k(u,a);_.values.next({values:{...l}}),_.state.next({...r,...i.keepDirty?{isDirty:v()}:{}}),!i.keepIsValid&&K()},Ne=({disabled:t,name:i,field:a,fields:c,value:f})=>{if(G(t)&&y.mount||t){const o=t?void 0:A(f)?pe(a?a._f:d(c,i)._f):f;F(l,i,o),Y(i,o,!1,!1,!0)}},me=(t,i={})=>{let a=d(n,t);const c=G(i.disabled);return F(n,t,{...a||{},_f:{...a&&a._f?a._f:{ref:{name:t}},name:t,mount:!0,...i}}),h.mount.add(t),a?Ne({field:a,disabled:i.disabled,name:t,value:i.value}):D(t,!0,i.value),{...c?{disabled:i.disabled}:{},...s.progressive?{required:!!i.required,min:le(i.min),max:le(i.max),minLength:le(i.minLength),maxLength:le(i.maxLength),pattern:le(i.pattern)}:{},name:t,onChange:ie,onBlur:ie,ref:f=>{if(f){me(t,i),a=d(n,t);const o=A(f.value)&&f.querySelectorAll&&f.querySelectorAll("input,select,textarea")[0]||f,g=Sr(o),V=a._f.refs||[];if(g?V.find(w=>w===o):o===a._f.ref)return;F(n,t,{_f:{...a._f,...g?{refs:[...V.filter(Se),o,...Array.isArray(d(u,t))?[{}]:[]],ref:{type:o.type,name:t}}:{ref:o}}}),D(t,!1,void 0,o)}else a=d(n,t,{}),a._f&&(a._f.mount=!1),(s.shouldUnregister||i.shouldUnregister)&&!(br(h.array,t)&&y.action)&&h.unMount.add(t)}}},Pe=()=>s.shouldFocusError&&oe(n,ae,h.mount),or=t=>{G(t)&&(_.state.next({disabled:t}),oe(n,(i,a)=>{const c=d(n,a);c&&(i.disabled=c._f.disabled||t,Array.isArray(c._f.refs)&&c._f.refs.forEach(f=>{f.disabled=c._f.disabled||t}))},0,!1))},Ie=(t,i)=>async a=>{let c;a&&(a.preventDefault&&a.preventDefault(),a.persist&&a.persist());let f=P(l);if(_.state.next({isSubmitting:!0}),s.resolver){const{errors:o,values:g}=await Q();r.errors=o,f=g}else await M(n);if(k(r.errors,"root"),O(r.errors)){_.state.next({errors:{}});try{await t(f,a)}catch(o){c=o}}else i&&await i({...r.errors},a),Pe(),setTimeout(Pe);if(_.state.next({isSubmitted:!0,isSubmitting:!1,isSubmitSuccessful:O(r.errors)&&!c,submitCount:r.submitCount+1,errors:r.errors}),c)throw c},fr=(t,i={})=>{d(n,t)&&(A(i.defaultValue)?N(t,P(d(u,t))):(N(t,i.defaultValue),F(u,t,P(i.defaultValue))),i.keepTouched||k(r.touchedFields,t),i.keepDirty||(k(r.dirtyFields,t),r.isDirty=i.defaultValue?v(t,P(d(u,t))):v()),i.keepError||(k(r.errors,t),m.isValid&&K()),_.state.next({...r}))},Be=(t,i={})=>{const a=t?P(t):u,c=P(a),f=O(t),o=f?u:c;if(i.keepDefaultValues||(u=a),!i.keepValues){if(i.keepDirtyValues)for(const g of h.mount)d(r.dirtyFields,g)?F(o,g,d(l,g)):N(g,d(o,g));else{if(Le&&A(t))for(const g of h.mount){const V=d(n,g);if(V&&V._f){const w=Array.isArray(V._f.refs)?V._f.refs[0]:V._f.ref;if(_e(w)){const C=w.closest("form");if(C){C.reset();break}}}}n={}}l=e.shouldUnregister?i.keepDefaultValues?P(u):{}:P(o),_.array.next({values:{...o}}),_.values.next({values:{...o}})}h={mount:i.keepDirtyValues?h.mount:new Set,unMount:new Set,array:new Set,watch:new Set,watchAll:!1,focus:""},y.mount=!m.isValid||!!i.keepIsValid||!!i.keepDirtyValues,y.watch=!!e.shouldUnregister,_.state.next({submitCount:i.keepSubmitCount?r.submitCount:0,isDirty:f?!1:i.keepDirty?r.isDirty:!!(i.keepDefaultValues&&!X(t,u)),isSubmitted:i.keepIsSubmitted?r.isSubmitted:!1,dirtyFields:f?[]:i.keepDirtyValues?i.keepDefaultValues&&l?he(u,l):r.dirtyFields:i.keepDefaultValues&&t?he(u,t):i.keepDirty?r.dirtyFields:{},touchedFields:i.keepTouched?r.touchedFields:{},errors:i.keepErrors?r.errors:{},isSubmitSuccessful:i.keepIsSubmitSuccessful?r.isSubmitSuccessful:!1,isSubmitting:!1})},qe=(t,i)=>Be(J(t)?t(l):t,i);return{control:{register:me,unregister:Ae,getFieldState:Ue,handleSubmit:Ie,setError:Me,_executeSchema:Q,_getWatch:x,_getDirty:v,_updateValid:K,_removeUnmounted:ge,_updateFieldArray:b,_updateDisabledField:Ne,_getFieldArray:E,_reset:Be,_resetDefaultValues:()=>J(s.defaultValues)&&s.defaultValues().then(t=>{qe(t,s.resetOptions),_.state.next({isLoading:!1})}),_updateFormState:t=>{r={...r,...t}},_disableForm:or,_subjects:_,_proxyFormState:m,_setErrors:H,get _fields(){return n},get _formValues(){return l},get _state(){return y},set _state(t){y=t},get _defaultValues(){return u},get _names(){return h},set _names(t){h=t},get _formState(){return r},set _formState(t){r=t},get _options(){return s},set _options(t){s={...s,...t}}},trigger:ne,register:me,handleSubmit:Ie,watch:ur,setValue:N,getValues:Oe,reset:qe,resetField:fr,clearErrors:lr,unregister:Ae,setError:Me,setFocus:(t,i={})=>{const a=d(n,t),c=a&&a._f;if(c){const f=c.refs?c.refs[0]:c.ref;f.focus&&(f.focus(),i.shouldSelect&&f.select())}},getFieldState:Ue}}function Br(e={}){const s=I.useRef(),r=I.useRef(),[n,u]=I.useState({isDirty:!1,isValidating:!1,isLoading:J(e.defaultValues),isSubmitted:!1,isSubmitting:!1,isSubmitSuccessful:!1,isValid:!1,submitCount:0,dirtyFields:{},touchedFields:{},validatingFields:{},errors:e.errors||{},disabled:e.disabled||!1,defaultValues:J(e.defaultValues)?void 0:e.defaultValues});s.current||(s.current={...Or(e),formState:n});const l=s.current.control;return l._options=e,Ar({subject:l._subjects.state,next:y=>{Fr(y,l._proxyFormState,l._updateFormState)&&u({...l._formState})}}),I.useEffect(()=>l._disableForm(e.disabled),[l,e.disabled]),I.useEffect(()=>{if(l._proxyFormState.isDirty){const y=l._getDirty();y!==n.isDirty&&l._subjects.state.next({isDirty:y})}},[l,n.isDirty]),I.useEffect(()=>{e.values&&!X(e.values,r.current)?(l._reset(e.values,l._options.resetOptions),r.current=e.values,u(y=>({...y}))):l._resetDefaultValues()},[e.values,l]),I.useEffect(()=>{e.errors&&l._setErrors(e.errors)},[e.errors,l]),I.useEffect(()=>{l._state.mount||(l._updateValid(),l._state.mount=!0),l._state.watch&&(l._state.watch=!1,l._subjects.state.next({...l._formState})),l._removeUnmounted()}),I.useEffect(()=>{e.shouldUnregister&&l._subjects.values.next({values:l._getWatch()})},[e.shouldUnregister,l]),s.current.formState=Vr(n,l),s.current}const qr=({children:e,onSubmit:s,className:r="mt-5 rounded-lg bg-app-200 px-6 py-4 text-app-800 w-full flex flex-col gap-1"})=>ue.jsx("form",{onSubmit:s,className:r,children:e}),$r=({label:e,htmlFor:s,children:r,fieldError:n})=>ue.jsxs("div",{className:"mb-4 text-2xl md:text-xl",children:[ue.jsx("label",{className:"mb-2 block cursor-pointer text-3xl font-bold text-app-800 md:text-2xl",htmlFor:s,children:e}),r,n&&ue.jsx(hr,{msg:n.message})]}),jr=({register:e,placeholder:s,name:r,type:n="text",trigger:u,required:l})=>{const{t:y}=gr();function h(){if(r==="email")return{value:/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i,message:y("invalidEmail")}}function R(){switch(r){case"username":case"password":case"passwordConfirm":case"currentPassword":case"newPassword":case"newPasswordConfirm":return{value:20,message:y(`formValidation.maxLength.${r}`)};case"fullname":case"email":return{value:50,message:y(`formValidation.maxLength.${r}`)};default:return}}function U(){switch(r){case"username":case"fullname":case"email":return{value:3,message:y(`formValidation.minLength.${r}`)};case"password":case"passwordConfirm":case"currentPassword":case"newPassword":case"newPasswordConfirm":return{value:8,message:y(`formValidation.minLength.${r}`)};default:return}}return ue.jsx("input",{id:r,type:n,className:"w-full max-w-96 rounded border border-app-300 p-2",...e(r,{required:l,pattern:h(),maxLength:R(),minLength:U()}),placeholder:s,onBlur:()=>l&&u&&u(r),autoComplete:"off"})};export{qr as F,$r as I,jr as R,Br as u};
