import{j as l,c,H as i}from"./index-BKuXz_yj.js";const m=({children:e,className:n="rounded-md bg-app-500 text-xl md:text-lg px-5 py-2 md:px-4 md:py-1 text-white hover:bg-app-600",addedClassName:r="",isSmall:a=!1,onClick:p,type:t="button",disabled:s=!1})=>(a&&(n=`${n} !text-lg !px-3 !py-1 md:!px-3 md:!py-0`),l.jsx("button",{onClick:p,className:`${n} ${r}`,type:t,disabled:s,children:e})),d=({msg:e=""})=>{const{t:n}=c();console.error(e);const r=e||n("ErrorMsg.msg");return l.jsx("p",{className:"my-1 text-xl text-red-500 sm:text-xl md:text-lg",children:r})},y=({children:e})=>l.jsx("main",{className:"relative flex h-full w-full flex-col items-center bg-app-100",children:e});var x={exports:{}};/*!
	Copyright (c) 2018 Jed Watson.
	Licensed under the MIT License (MIT), see
	http://jedwatson.github.io/classnames
*/(function(e){(function(){var n={}.hasOwnProperty;function r(){for(var t="",s=0;s<arguments.length;s++){var o=arguments[s];o&&(t=p(t,a(o)))}return t}function a(t){if(typeof t=="string"||typeof t=="number")return t;if(typeof t!="object")return"";if(Array.isArray(t))return r.apply(null,t);if(t.toString!==Object.prototype.toString&&!t.toString.toString().includes("[native code]"))return t.toString();var s="";for(var o in t)n.call(t,o)&&t[o]&&(s=p(s,o));return s}function p(t,s){return s?t?t+" "+s:t+s:t}e.exports?(r.default=r,e.exports=r):window.classNames=r})()})(x);var f=x.exports;const j=i(f),b=({children:e,onClick:n,className:r="text-4xl md:text-3xl font-bold text-app-800",addedClassName:a=""})=>l.jsx("h2",{className:`${r} ${a}`,onClick:n,children:e}),g=({children:e})=>l.jsx("section",{className:"relative flex w-full max-w-[1000px] flex-col justify-center gap-1 p-5",children:e});export{m as B,d as E,b as H,y as M,g as P,j as c};
