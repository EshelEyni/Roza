if(!self.define){let e,s={};const i=(i,n)=>(i=new URL(i+".js",n).href,s[i]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=i,e.onload=s,document.head.appendChild(e)}else e=i,importScripts(i),s()})).then((()=>{let e=s[i];if(!e)throw new Error(`Module ${i} didn’t register its module`);return e})));self.define=(n,l)=>{const r=e||("document"in self?document.currentScript.src:"")||location.href;if(s[r])return;let o={};const t=e=>i(e,r),a={module:{uri:r},exports:o,require:t};s[r]=Promise.all(n.map((e=>a[e]||t(e)))).then((e=>(l(...e),o)))}}define(["./workbox-d7aee56d"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"assets/Article-bNPJyB0o.js",revision:null},{url:"assets/BookDetails-BAdLKQSg.js",revision:null},{url:"assets/BookEdit-BidUGUB_.js",revision:null},{url:"assets/BookList-B-5W8_Sw.js",revision:null},{url:"assets/BookReviewDetails-slNFn1q_.js",revision:null},{url:"assets/BookReviewEdit-CFNsthfc.js",revision:null},{url:"assets/BookReviewList-D6BPGLM9.js",revision:null},{url:"assets/BookReviewsPage-DhvYuW_P.js",revision:null},{url:"assets/BooksPage-Cb9B-Zms.js",revision:null},{url:"assets/BtnAddBookItem-BNZX48_s.js",revision:null},{url:"assets/EntityFilter-CoLLb01m.js",revision:null},{url:"assets/EntityListTitleContainer-B5IRMdBa.js",revision:null},{url:"assets/EntityListTitleContainer-bRDj4i0-.css",revision:null},{url:"assets/HomePage-CWPG2qPk.js",revision:null},{url:"assets/html2canvas.esm-CBrSDip1.js",revision:null},{url:"assets/index-BnA0ap6K.js",revision:null},{url:"assets/index-DxhlBc04.css",revision:null},{url:"assets/index.es-B2iaY6NS.js",revision:null},{url:"assets/Input-f5-EZKHG.js",revision:null},{url:"assets/P-DF0eyyfW.js",revision:null},{url:"assets/PageContent-ihS0kPnQ.js",revision:null},{url:"assets/PageNotFound-CYAc_Pnj.js",revision:null},{url:"assets/PageTitle-Vu_PU7SK.js",revision:null},{url:"assets/ProfileDetails-Cl41IyKY.js",revision:null},{url:"assets/purify.es-DGIRlouP.js",revision:null},{url:"assets/ReactHookFormInput-DRzq2zkO.js",revision:null},{url:"assets/ReferenceList-ClZCRj7m.js",revision:null},{url:"assets/SlateEditor-D5fy1hEl.js",revision:null},{url:"assets/TextElement-qOP0c2bH.js",revision:null},{url:"index.html",revision:"2fc83a5b1ffd4615f45c3f34c9df74c5"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"images/icon-512x512.png",revision:"84afb2105f87b7278c7743304e8e5905"},{url:"images/android-chrome-192x192.png",revision:"b108932d8d895744abb2bf704345cf59"},{url:"images/android-chrome-512x512.png",revision:"e56b9f84a2a41a4012c2dcb81daa47ce"},{url:"images/apple-touch-icon.png",revision:"f1ff4a86080752ca5c2c8e7ae68cc027"},{url:"images/favicon-16x16.png",revision:"1fc67d3622856036759ddb50717062be"},{url:"images/favicon-32x32.png",revision:"a1049c288af0dcf48fe09a0e832a574c"},{url:"images/icon-144x144.png",revision:"1725e641b567d2c508e3d9be4a533837"},{url:"images/icon-192x192.png",revision:"e2e114852a2c46d76e149ee7bbd73c48"},{url:"images/icon-48x48.png",revision:"04ff9d1b24f2266e8e5566e4a96913c1"},{url:"images/icon-512X512.png",revision:"84afb2105f87b7278c7743304e8e5905"},{url:"images/icon-72x72.png",revision:"cbfcd98731458d0589fe24916bfbc206"},{url:"images/icon-96x96.png",revision:"f84809b3461acf59720a805c6ce48622"},{url:"fonts/Alef-Bold.ttf",revision:"8e20e41787356b5b17d1c21906f13814"},{url:"fonts/Alef-Regular.ttf",revision:"a48691ee78e81c10adb960071eaeed7e"},{url:"fonts/Bellefair-Regular.ttf",revision:"6566fe827248188ca21e3dd8a4162308"},{url:"manifest.webmanifest",revision:"291e873618baf536208ebd322ba15909"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("/offline.html"))),e.registerRoute(/\/api\/.*/,new e.NetworkFirst({cacheName:"api-cache",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:50,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|tiff|ttf|woff|woff2|eot)$/,new e.CacheFirst({cacheName:"static-resources",plugins:[]}),"GET")}));