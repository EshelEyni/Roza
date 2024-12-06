import{x as m,c as f,j as n,r as C,h as v,D as w,B as p,E as I}from"./index-BnA0ap6K.js";import{B as k,c as D,H as N}from"./PageContent-ihS0kPnQ.js";import{A as M}from"./Article-bNPJyB0o.js";import{P}from"./P-DF0eyyfW.js";import{H as E}from"./Input-f5-EZKHG.js";import{a as b,H as y,G as A,P as H}from"./PageTitle-Vu_PU7SK.js";const O=()=>{const{filterBy:e,onSetFilterBy:t}=m(),i=["chapters","characters","themes","plotlines","notes"],{t:o}=f();return n.jsx("section",{className:"flex flex-wrap gap-3 sm:gap-2",children:i.map(s=>n.jsx(k,{className:D("rounded-md px-4 py-2 text-xl focus:outline-none focus:ring-2 focus:ring-app-500 focus:ring-offset-2 md:px-4 md:py-1 md:text-lg",{"bg-app-500 text-white":e===s,"bg-white text-app-500":e!==s}),onClick:()=>t(s),children:o(s)},s))})},S=({dataItem:e,type:t,isEdit:i=!1})=>{const[o,s]=C.useState(!0),a=v(),{t:r}=f(),{getTitle:l,getText:c}=w(),d=l(e,t),u=c(e,t),B=o?u.slice(0,200):u;function h(){a(`${t}/${e.id}`)}function x(){a(`/book-edit/${e.bookId}/${t}/${e.id}`)}function g(){i?x():h()}function T(j){j.stopPropagation(),s(!o)}return n.jsxs(M,{onClick:g,children:[d&&n.jsx(E,{children:d}),n.jsxs(P,{addedClassName:"h-full",children:[B,u.length>200&&n.jsxs("span",{onClick:T,className:"z-10 cursor-pointer text-app-500",children:["...",r(o?"showMore":"showLess")]})]})]})},U=({isRendered:e,type:t,isEdit:i=!1})=>{const{book:o,updateBook:s}=m();function a(c){if(!o)return;const d={...o,[t]:c};s(d)}function r(c){return n.jsx(S,{dataItem:c,type:t,isEdit:i})}if(!e||!o)return null;const l=o[t];return n.jsx(b,{items:l,renderItem:r,dragEndCallback:a,isCursorPointer:!0})},W=()=>{const{pageTitle:e,onGoToDetails:t}=m();function i(){t({isGoToRootPage:!0})}return n.jsxs(y,{children:[n.jsx(N,{onClick:i,children:e}),n.jsx(A,{})]})},q=({isEdit:e=!1})=>{const{book:t,isSuccessBook:i,onNavigateToEdit:o,onArchiveBook:s,onSetReadMode:a}=m(),{updateBook:r}=p(),{t:l}=f();function c(d){if(!t)return;const u=d.target.value;r({...t,name:u})}return!i||!t?null:n.jsx(H,{isEdit:e,entityType:"book",entityName:t.name,handleInputChange:c,onNavigateToEdit:o,modalName:"archiveBook",onDeleteEntity:s,archiveTitle:l("archiveBookMsg.title"),archiveMsg:l("archiveBookMsg.msg"),onSetReadMode:a})},J=()=>{const{book:e,filterBy:t}=m(),{updateBook:i}=p(e==null?void 0:e.filterBy),{t:o}=f();function s(){if(!e)return;const a=t,r=I({bookId:e.id,type:a});i({...e,[a]:[...e[a],r]})}return e?n.jsx(k,{onClick:s,addedClassName:"self-end",children:o(`BtnAddBookItem.${t}`)}):null};export{W as B,q as a,O as b,J as c,U as d};