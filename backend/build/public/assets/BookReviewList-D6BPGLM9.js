import{u as p,h as u,a as A,t as y,e as x,i as E,j as e,r as R,v as h,c as b}from"./index-BnA0ap6K.js";import{H as L,E as C,B as N}from"./PageContent-ihS0kPnQ.js";import{I as M,E as P,A as G,a as T,G as D,b as H,B as S}from"./EntityListTitleContainer-B5IRMdBa.js";import{A as q}from"./Article-bNPJyB0o.js";import{H as Q}from"./Input-f5-EZKHG.js";function $(){const t=p(),s=u(),{mutate:i,isPending:o}=A({mutationFn:async a=>y.add(a),onSuccess:a=>{t.invalidateQueries({queryKey:["reviews"]}),s(`/review/${a.id}`)}});return{addBookReview:i,isPendingAddBookReview:o}}const F=({review:t})=>{const{loggedInUser:s}=x(),i=t.createdAt?E(t.createdAt,(s==null?void 0:s.language)||"en"):null,o=u();function a(){o(`/review/${t.id}`)}const c=[{label:"reviews",value:t.reviews.length},{label:"references",value:t.references.length},{label:"createdAt",value:i}];return e.jsxs(q,{onClick:a,children:[e.jsx(Q,{children:t.name}),e.jsx(M,{list:c})]})},J=({reviews:t,errorReviews:s,isLoadingReviews:i,isErrorReviews:o,isNoReviews:a,isHomePage:c=!1,paginationIdx:m,intersectionRef:v})=>{const{loggedInUser:n}=x(),[d,f]=R.useState(h()),{addBookReview:j}=$(),{t:r}=b(),w=u();function k(){w("/reviews")}function B(l){f({...d,[l.target.name]:l.target.value})}function g(){!d.name||!(n!=null&&n.id)||(j({...d,userId:n==null?void 0:n.id}),f(h()))}return e.jsxs("section",{className:"w-full",children:[e.jsxs(P,{children:[e.jsx(L,{children:r("reviews")}),!c&&e.jsx(G,{title:r("btnAddReview"),defaultValue:d.name,handleInputChange:B,onAddEntity:g,placeholder:r("bookName")})]}),o&&e.jsx(C,{msg:s instanceof Error?s.message:""}),a&&e.jsx(T,{msg:r("EmptyMsg.books")}),!!t&&e.jsx(D,{children:t.map(l=>e.jsx(H,{children:e.jsx(F,{review:l})},l.id))}),i&&e.jsx(S,{}),!!t&&m&&t.length>=m*12&&!!v&&e.jsx("div",{ref:v,className:"h-12 w-full bg-transparent"}),c&&e.jsx("div",{className:"mt-3 flex items-center justify-end",children:e.jsx(N,{onClick:k,children:r("seeAll.reviews")})})]})};export{J as B};