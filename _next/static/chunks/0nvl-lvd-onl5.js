(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,37052,(e,t,r)=>{"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n={DecodeError:function(){return g},MiddlewareNotFoundError:function(){return x},MissingStaticPage:function(){return w},NormalizeError:function(){return v},PageNotFoundError:function(){return b},SP:function(){return y},ST:function(){return h},WEB_VITALS:function(){return i},execOnce:function(){return a},getDisplayName:function(){return f},getLocationOrigin:function(){return l},getURL:function(){return c},isAbsoluteUrl:function(){return u},isResSent:function(){return d},loadGetInitialProps:function(){return m},normalizeRepeatedSlashes:function(){return p},stringifyError:function(){return _}};for(var o in n)Object.defineProperty(r,o,{enumerable:!0,get:n[o]});let i=["CLS","FCP","FID","INP","LCP","TTFB"];function a(e){let t,r=!1;return function(){for(var n=arguments.length,o=Array(n),i=0;i<n;i++)o[i]=arguments[i];return r||(r=!0,t=e(...o)),t}}let s=/^[a-zA-Z][a-zA-Z\d+\-.]*?:/,u=e=>s.test(e);function l(){let{protocol:e,hostname:t,port:r}=window.location;return`${e}//${t}${r?":"+r:""}`}function c(){let{href:e}=window.location,t=l();return e.substring(t.length)}function f(e){return"string"==typeof e?e:e.displayName||e.name||"Unknown"}function d(e){return e.finished||e.headersSent}function p(e){let t=e.split("?");return t[0].replace(/\\/g,"/").replace(/\/\/+/g,"/")+(t[1]?`?${t.slice(1).join("?")}`:"")}async function m(e,t){let r=t.res||t.ctx&&t.ctx.res;if(!e.getInitialProps)return t.ctx&&t.Component?{pageProps:await m(t.Component,t.ctx)}:{};let n=await e.getInitialProps(t);if(r&&d(r))return n;if(!n)throw Object.defineProperty(Error(`"${f(e)}.getInitialProps()" should resolve to an object. But found "${n}" instead.`),"__NEXT_ERROR_CODE",{value:"E1025",enumerable:!1,configurable:!0});return n}let y="u">typeof performance,h=y&&["mark","measure","getEntriesByName"].every(e=>"function"==typeof performance[e]);class g extends Error{}class v extends Error{}class b extends Error{constructor(e){super(),this.code="ENOENT",this.name="PageNotFoundError",this.message=`Cannot find module for page: ${e}`}}class w extends Error{constructor(e,t){super(),this.message=`Failed to load static file for page: ${e} ${t}`}}class x extends Error{constructor(){super(),this.code="ENOENT",this.message="Cannot find the middleware module"}}function _(e){return JSON.stringify({message:e.message,stack:e.stack})}},11930,(e,t,r)=>{var n={229:function(e){var t,r,n,o=e.exports={};function i(){throw Error("setTimeout has not been defined")}function a(){throw Error("clearTimeout has not been defined")}try{t="function"==typeof setTimeout?setTimeout:i}catch(e){t=i}try{r="function"==typeof clearTimeout?clearTimeout:a}catch(e){r=a}function s(e){if(t===setTimeout)return setTimeout(e,0);if((t===i||!t)&&setTimeout)return t=setTimeout,setTimeout(e,0);try{return t(e,0)}catch(r){try{return t.call(null,e,0)}catch(r){return t.call(this,e,0)}}}var u=[],l=!1,c=-1;function f(){l&&n&&(l=!1,n.length?u=n.concat(u):c=-1,u.length&&d())}function d(){if(!l){var e=s(f);l=!0;for(var t=u.length;t;){for(n=u,u=[];++c<t;)n&&n[c].run();c=-1,t=u.length}n=null,l=!1,function(e){if(r===clearTimeout)return clearTimeout(e);if((r===a||!r)&&clearTimeout)return r=clearTimeout,clearTimeout(e);try{r(e)}catch(t){try{return r.call(null,e)}catch(t){return r.call(this,e)}}}(e)}}function p(e,t){this.fun=e,this.array=t}function m(){}o.nextTick=function(e){var t=Array(arguments.length-1);if(arguments.length>1)for(var r=1;r<arguments.length;r++)t[r-1]=arguments[r];u.push(new p(e,t)),1!==u.length||l||s(d)},p.prototype.run=function(){this.fun.apply(null,this.array)},o.title="browser",o.browser=!0,o.env={},o.argv=[],o.version="",o.versions={},o.on=m,o.addListener=m,o.once=m,o.off=m,o.removeListener=m,o.removeAllListeners=m,o.emit=m,o.prependListener=m,o.prependOnceListener=m,o.listeners=function(e){return[]},o.binding=function(e){throw Error("process.binding is not supported")},o.cwd=function(){return"/"},o.chdir=function(e){throw Error("process.chdir is not supported")},o.umask=function(){return 0}}},o={};function i(e){var t=o[e];if(void 0!==t)return t.exports;var r=o[e]={exports:{}},a=!0;try{n[e](r,r.exports,i),a=!1}finally{a&&delete o[e]}return r.exports}i.ab="/ROOT/frontend/node_modules/next/dist/compiled/process/",t.exports=i(229)},2105,(e,t,r)=>{"use strict";var n,o;t.exports=(null==(n=e.g.process)?void 0:n.env)&&"object"==typeof(null==(o=e.g.process)?void 0:o.env)?e.g.process:e.r(11930)},71054,(e,t,r)=>{"use strict";var n=Symbol.for("react.transitional.element");function o(e,t,r){var o=null;if(void 0!==r&&(o=""+r),void 0!==t.key&&(o=""+t.key),"key"in t)for(var i in r={},t)"key"!==i&&(r[i]=t[i]);else r=t;return{$$typeof:n,type:e,key:o,ref:void 0!==(t=r.ref)?t:null,props:r}}r.Fragment=Symbol.for("react.fragment"),r.jsx=o,r.jsxs=o},63716,(e,t,r)=>{"use strict";t.exports=e.r(71054)},8196,(e,t,r)=>{"use strict";var n=e.i(2105),o=Symbol.for("react.transitional.element"),i=Symbol.for("react.portal"),a=Symbol.for("react.fragment"),s=Symbol.for("react.strict_mode"),u=Symbol.for("react.profiler"),l=Symbol.for("react.consumer"),c=Symbol.for("react.context"),f=Symbol.for("react.forward_ref"),d=Symbol.for("react.suspense"),p=Symbol.for("react.memo"),m=Symbol.for("react.lazy"),y=Symbol.for("react.activity"),h=Symbol.iterator,g={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},v=Object.assign,b={};function w(e,t,r){this.props=e,this.context=t,this.refs=b,this.updater=r||g}function x(){}function _(e,t,r){this.props=e,this.context=t,this.refs=b,this.updater=r||g}w.prototype.isReactComponent={},w.prototype.setState=function(e,t){if("object"!=typeof e&&"function"!=typeof e&&null!=e)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,t,"setState")},w.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")},x.prototype=w.prototype;var E=_.prototype=new x;E.constructor=_,v(E,w.prototype),E.isPureReactComponent=!0;var S=Array.isArray;function j(){}var k={H:null,A:null,T:null,S:null},O=Object.prototype.hasOwnProperty;function T(e,t,r){var n=r.ref;return{$$typeof:o,type:e,key:t,ref:void 0!==n?n:null,props:r}}function P(e){return"object"==typeof e&&null!==e&&e.$$typeof===o}var $=/\/+/g;function C(e,t){var r,n;return"object"==typeof e&&null!==e&&null!=e.key?(r=""+e.key,n={"=":"=0",":":"=2"},"$"+r.replace(/[=:]/g,function(e){return n[e]})):t.toString(36)}function N(e,t,r){if(null==e)return e;var n=[],a=0;return!function e(t,r,n,a,s){var u,l,c,f=typeof t;("undefined"===f||"boolean"===f)&&(t=null);var d=!1;if(null===t)d=!0;else switch(f){case"bigint":case"string":case"number":d=!0;break;case"object":switch(t.$$typeof){case o:case i:d=!0;break;case m:return e((d=t._init)(t._payload),r,n,a,s)}}if(d)return s=s(t),d=""===a?"."+C(t,0):a,S(s)?(n="",null!=d&&(n=d.replace($,"$&/")+"/"),e(s,r,n,"",function(e){return e})):null!=s&&(P(s)&&(u=s,l=n+(null==s.key||t&&t.key===s.key?"":(""+s.key).replace($,"$&/")+"/")+d,s=T(u.type,l,u.props)),r.push(s)),1;d=0;var p=""===a?".":a+":";if(S(t))for(var y=0;y<t.length;y++)f=p+C(a=t[y],y),d+=e(a,r,n,f,s);else if("function"==typeof(y=null===(c=t)||"object"!=typeof c?null:"function"==typeof(c=h&&c[h]||c["@@iterator"])?c:null))for(t=y.call(t),y=0;!(a=t.next()).done;)f=p+C(a=a.value,y++),d+=e(a,r,n,f,s);else if("object"===f){if("function"==typeof t.then)return e(function(e){switch(e.status){case"fulfilled":return e.value;case"rejected":throw e.reason;default:switch("string"==typeof e.status?e.then(j,j):(e.status="pending",e.then(function(t){"pending"===e.status&&(e.status="fulfilled",e.value=t)},function(t){"pending"===e.status&&(e.status="rejected",e.reason=t)})),e.status){case"fulfilled":return e.value;case"rejected":throw e.reason}}throw e}(t),r,n,a,s);throw Error("Objects are not valid as a React child (found: "+("[object Object]"===(r=String(t))?"object with keys {"+Object.keys(t).join(", ")+"}":r)+"). If you meant to render a collection of children, use an array instead.")}return d}(e,n,"","",function(e){return t.call(r,e,a++)}),n}function R(e){if(-1===e._status){var t=e._result;(t=t()).then(function(t){(0===e._status||-1===e._status)&&(e._status=1,e._result=t)},function(t){(0===e._status||-1===e._status)&&(e._status=2,e._result=t)}),-1===e._status&&(e._status=0,e._result=t)}if(1===e._status)return e._result.default;throw e._result}var A="function"==typeof reportError?reportError:function(e){if("object"==typeof window&&"function"==typeof window.ErrorEvent){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:"object"==typeof e&&null!==e&&"string"==typeof e.message?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if("object"==typeof n.default&&"function"==typeof n.default.emit)return void n.default.emit("uncaughtException",e);console.error(e)};r.Activity=y,r.Children={map:N,forEach:function(e,t,r){N(e,function(){t.apply(this,arguments)},r)},count:function(e){var t=0;return N(e,function(){t++}),t},toArray:function(e){return N(e,function(e){return e})||[]},only:function(e){if(!P(e))throw Error("React.Children.only expected to receive a single React element child.");return e}},r.Component=w,r.Fragment=a,r.Profiler=u,r.PureComponent=_,r.StrictMode=s,r.Suspense=d,r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=k,r.__COMPILER_RUNTIME={__proto__:null,c:function(e){return k.H.useMemoCache(e)}},r.cache=function(e){return function(){return e.apply(null,arguments)}},r.cacheSignal=function(){return null},r.cloneElement=function(e,t,r){if(null==e)throw Error("The argument must be a React element, but you passed "+e+".");var n=v({},e.props),o=e.key;if(null!=t)for(i in void 0!==t.key&&(o=""+t.key),t)O.call(t,i)&&"key"!==i&&"__self"!==i&&"__source"!==i&&("ref"!==i||void 0!==t.ref)&&(n[i]=t[i]);var i=arguments.length-2;if(1===i)n.children=r;else if(1<i){for(var a=Array(i),s=0;s<i;s++)a[s]=arguments[s+2];n.children=a}return T(e.type,o,n)},r.createContext=function(e){return(e={$$typeof:c,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null}).Provider=e,e.Consumer={$$typeof:l,_context:e},e},r.createElement=function(e,t,r){var n,o={},i=null;if(null!=t)for(n in void 0!==t.key&&(i=""+t.key),t)O.call(t,n)&&"key"!==n&&"__self"!==n&&"__source"!==n&&(o[n]=t[n]);var a=arguments.length-2;if(1===a)o.children=r;else if(1<a){for(var s=Array(a),u=0;u<a;u++)s[u]=arguments[u+2];o.children=s}if(e&&e.defaultProps)for(n in a=e.defaultProps)void 0===o[n]&&(o[n]=a[n]);return T(e,i,o)},r.createRef=function(){return{current:null}},r.forwardRef=function(e){return{$$typeof:f,render:e}},r.isValidElement=P,r.lazy=function(e){return{$$typeof:m,_payload:{_status:-1,_result:e},_init:R}},r.memo=function(e,t){return{$$typeof:p,type:e,compare:void 0===t?null:t}},r.startTransition=function(e){var t=k.T,r={};k.T=r;try{var n=e(),o=k.S;null!==o&&o(r,n),"object"==typeof n&&null!==n&&"function"==typeof n.then&&n.then(j,A)}catch(e){A(e)}finally{null!==t&&null!==r.types&&(t.types=r.types),k.T=t}},r.unstable_useCacheRefresh=function(){return k.H.useCacheRefresh()},r.use=function(e){return k.H.use(e)},r.useActionState=function(e,t,r){return k.H.useActionState(e,t,r)},r.useCallback=function(e,t){return k.H.useCallback(e,t)},r.useContext=function(e){return k.H.useContext(e)},r.useDebugValue=function(){},r.useDeferredValue=function(e,t){return k.H.useDeferredValue(e,t)},r.useEffect=function(e,t){return k.H.useEffect(e,t)},r.useEffectEvent=function(e){return k.H.useEffectEvent(e)},r.useId=function(){return k.H.useId()},r.useImperativeHandle=function(e,t,r){return k.H.useImperativeHandle(e,t,r)},r.useInsertionEffect=function(e,t){return k.H.useInsertionEffect(e,t)},r.useLayoutEffect=function(e,t){return k.H.useLayoutEffect(e,t)},r.useMemo=function(e,t){return k.H.useMemo(e,t)},r.useOptimistic=function(e,t){return k.H.useOptimistic(e,t)},r.useReducer=function(e,t,r){return k.H.useReducer(e,t,r)},r.useRef=function(e){return k.H.useRef(e)},r.useState=function(e){return k.H.useState(e)},r.useSyncExternalStore=function(e,t,r){return k.H.useSyncExternalStore(e,t,r)},r.useTransition=function(){return k.H.useTransition()},r.version="19.2.6"},9768,(e,t,r)=>{"use strict";t.exports=e.r(8196)},60253,(e,t,r)=>{"use strict";r._=function(e){return e&&e.__esModule?e:{default:e}}},78545,(e,t,r)=>{"use strict";function n(e){if("function"!=typeof WeakMap)return null;var t=new WeakMap,r=new WeakMap;return(n=function(e){return e?r:t})(e)}r._=function(e,t){if(!t&&e&&e.__esModule)return e;if(null===e||"object"!=typeof e&&"function"!=typeof e)return{default:e};var r=n(t);if(r&&r.has(e))return r.get(e);var o={__proto__:null},i=Object.defineProperty&&Object.getOwnPropertyDescriptor;for(var a in e)if("default"!==a&&Object.prototype.hasOwnProperty.call(e,a)){var s=i?Object.getOwnPropertyDescriptor(e,a):null;s&&(s.get||s.set)?Object.defineProperty(o,a,s):o[a]=e[a]}return o.default=e,r&&r.set(e,o),o}},95215,(e,t,r)=>{"use strict";Object.defineProperty(r,"__esModule",{value:!0}),Object.defineProperty(r,"HeadManagerContext",{enumerable:!0,get:function(){return n}});let n=e.r(60253)._(e.r(9768)).default.createContext({})},10021,(e,t,r)=>{"use strict";Object.defineProperty(r,"__esModule",{value:!0}),Object.defineProperty(r,"warnOnce",{enumerable:!0,get:function(){return n}});let n=e=>{}},59647,e=>{"use strict";let t,r;var n,o=e.i(9768);let i={data:""},a=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,s=/\/\*[^]*?\*\/|  +/g,u=/\n+/g,l=(e,t)=>{let r="",n="",o="";for(let i in e){let a=e[i];"@"==i[0]?"i"==i[1]?r=i+" "+a+";":n+="f"==i[1]?l(a,i):i+"{"+l(a,"k"==i[1]?"":t)+"}":"object"==typeof a?n+=l(a,t?t.replace(/([^,])+/g,e=>i.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):i):null!=a&&(i="-"==i[1]?i:i.replace(/[A-Z]/g,"-$&").toLowerCase(),o+=l.p?l.p(i,a):i+":"+a+";")}return r+(t&&o?t+"{"+o+"}":o)+n},c={},f=e=>{if("object"==typeof e){let t="";for(let r in e)t+=r+f(e[r]);return t}return e};function d(e){let t,r,n=this||{},o=e.call?e(n.p):e;return((e,t,r,n,o)=>{var i;let d=f(e),p=c[d]||(c[d]=(e=>{let t=0,r=11;for(;t<e.length;)r=101*r+e.charCodeAt(t++)>>>0;return"go"+r})(d));if(!c[p]){let t=d!==e?e:(e=>{let t,r,n=[{}];for(;t=a.exec(e.replace(s,""));)t[4]?n.shift():t[3]?(r=t[3].replace(u," ").trim(),n.unshift(n[0][r]=n[0][r]||{})):n[0][t[1]]=t[2].replace(u," ").trim();return n[0]})(e);c[p]=l(o?{["@keyframes "+p]:t}:t,r?"":"."+p)}let m=r&&c.g;return r&&(c.g=c[p]),i=c[p],m?t.data=t.data.replace(m,i):-1===t.data.indexOf(i)&&(t.data=n?i+t.data:t.data+i),p})(o.unshift?o.raw?(t=[].slice.call(arguments,1),r=n.p,o.reduce((e,n,o)=>{let i=t[o];if(i&&i.call){let e=i(r),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;i=t?"."+t:e&&"object"==typeof e?e.props?"":l(e,""):!1===e?"":e}return e+n+(null==i?"":i)},"")):o.reduce((e,t)=>Object.assign(e,t&&t.call?t(n.p):t),{}):o,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||i})(n.target),n.g,n.o,n.k)}d.bind({g:1});let p,m,y,h=d.bind({k:1});function g(e,t){let r=this||{};return function(){let n=arguments;function o(i,a){let s=Object.assign({},i),u=s.className||o.className;r.p=Object.assign({theme:m&&m()},s),r.o=/go\d/.test(u),s.className=d.apply(r,n)+(u?" "+u:""),t&&(s.ref=a);let l=e;return e[0]&&(l=s.as||e,delete s.as),y&&l[0]&&y(s),p(l,s)}return t?t(o):o}}var v=(e,t)=>"function"==typeof e?e(t):e,b=(t=0,()=>(++t).toString()),w=()=>{if(void 0===r){let e=matchMedia("(prefers-reduced-motion: reduce)");r=!e||e.matches}return r},x="default",_=(e,t)=>{let{toastLimit:r}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,r)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:n}=t;return _(e,{type:+!!e.toasts.find(e=>e.id===n.id),toast:n});case 3:let{toastId:o}=t;return{...e,toasts:e.toasts.map(e=>e.id===o||void 0===o?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let i=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+i}))}}},E=[],S={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},j={},k=function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:x;j[t]=_(j[t]||S,e),E.forEach(e=>{let[r,n]=e;r===t&&n(j[t])})},O=e=>Object.keys(j).forEach(t=>k(e,t)),T=function(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:x;return t=>{k(t,e)}},P={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},$=function(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:x,[r,n]=(0,o.useState)(j[t]||S),i=(0,o.useRef)(j[t]);(0,o.useEffect)(()=>(i.current!==j[t]&&n(j[t]),E.push([t,n]),()=>{let e=E.findIndex(e=>{let[r]=e;return r===t});e>-1&&E.splice(e,1)}),[t]);let a=r.toasts.map(t=>{var r,n,o;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(r=e[t.type])?void 0:r.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(n=e[t.type])?void 0:n.duration)||(null==e?void 0:e.duration)||P[t.type],style:{...e.style,...null==(o=e[t.type])?void 0:o.style,...t.style}}});return{...r,toasts:a}},C=function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"blank",r=arguments.length>2?arguments[2]:void 0;return{createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...r,id:(null==r?void 0:r.id)||b()}},N=e=>(t,r)=>{let n,o=C(t,e,r);return T(o.toasterId||(n=o.id,Object.keys(j).find(e=>j[e].toasts.some(e=>e.id===n))))({type:2,toast:o}),o.id},R=(e,t)=>N("blank")(e,t);R.error=N("error"),R.success=N("success"),R.loading=N("loading"),R.custom=N("custom"),R.dismiss=(e,t)=>{let r={type:3,toastId:e};t?T(t)(r):O(r)},R.dismissAll=e=>R.dismiss(void 0,e),R.remove=(e,t)=>{let r={type:4,toastId:e};t?T(t)(r):O(r)},R.removeAll=e=>R.remove(void 0,e),R.promise=(e,t,r)=>{let n=R.loading(t.loading,{...r,...null==r?void 0:r.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let o=t.success?v(t.success,e):void 0;return o?R.success(o,{id:n,...r,...null==r?void 0:r.success}):R.dismiss(n),e}).catch(e=>{let o=t.error?v(t.error,e):void 0;o?R.error(o,{id:n,...r,...null==r?void 0:r.error}):R.dismiss(n)}),e};var A=function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"default",{toasts:r,pausedAt:n}=$(e,t),i=(0,o.useRef)(new Map).current,a=(0,o.useCallback)(function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1e3;if(i.has(e))return;let r=setTimeout(()=>{i.delete(e),s({type:4,toastId:e})},t);i.set(e,r)},[]);(0,o.useEffect)(()=>{if(n)return;let e=Date.now(),o=r.map(r=>{if(r.duration===1/0)return;let n=(r.duration||0)+r.pauseDuration-(e-r.createdAt);if(n<0){r.visible&&R.dismiss(r.id);return}return setTimeout(()=>R.dismiss(r.id,t),n)});return()=>{o.forEach(e=>e&&clearTimeout(e))}},[r,n,t]);let s=(0,o.useCallback)(T(t),[t]),u=(0,o.useCallback)(()=>{s({type:5,time:Date.now()})},[s]),l=(0,o.useCallback)((e,t)=>{s({type:1,toast:{id:e,height:t}})},[s]),c=(0,o.useCallback)(()=>{n&&s({type:6,time:Date.now()})},[n,s]),f=(0,o.useCallback)((e,t)=>{let{reverseOrder:n=!1,gutter:o=8,defaultPosition:i}=t||{},a=r.filter(t=>(t.position||i)===(e.position||i)&&t.height),s=a.findIndex(t=>t.id===e.id),u=a.filter((e,t)=>t<s&&e.visible).length;return a.filter(e=>e.visible).slice(...n?[u+1]:[0,u]).reduce((e,t)=>e+(t.height||0)+o,0)},[r]);return(0,o.useEffect)(()=>{r.forEach(e=>{if(e.dismissed)a(e.id,e.removeDelay);else{let t=i.get(e.id);t&&(clearTimeout(t),i.delete(e.id))}})},[r,a]),{toasts:r,handlers:{updateHeight:l,startPause:u,endPause:c,calculateOffset:f}}},I=h`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,H=h`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,D=h`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,M=g("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${I} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${H} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${D} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,L=h`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,z=g("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${L} 1s linear infinite;
`,F=h`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,U=h`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,q=g("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${F} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${U} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,B=g("div")`
  position: absolute;
`,V=g("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,W=h`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,X=g("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${W} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,J=e=>{let{toast:t}=e,{icon:r,type:n,iconTheme:i}=t;return void 0!==r?"string"==typeof r?o.createElement(X,null,r):r:"blank"===n?null:o.createElement(V,null,o.createElement(z,{...i}),"loading"!==n&&o.createElement(B,null,"error"===n?o.createElement(M,{...i}):o.createElement(q,{...i})))},Z=g("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,G=g("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,K=o.memo(e=>{let{toast:t,position:r,style:n,children:i}=e,a=t.height?((e,t)=>{let r=e.includes("top")?1:-1,[n,o]=w()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*r}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*r}%,-1px) scale(.6); opacity:0;}
`];return{animation:t?`${h(n)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${h(o)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(t.position||r||"top-center",t.visible):{opacity:0},s=o.createElement(J,{toast:t}),u=o.createElement(G,{...t.ariaProps},v(t.message,t));return o.createElement(Z,{className:t.className,style:{...a,...n,...t.style}},"function"==typeof i?i({icon:s,message:u}):o.createElement(o.Fragment,null,s,u))});n=o.createElement,l.p=void 0,p=n,m=void 0,y=void 0;var Y=e=>{let{id:t,className:r,style:n,onHeightUpdate:i,children:a}=e,s=o.useCallback(e=>{if(e){let r=()=>{i(t,e.getBoundingClientRect().height)};r(),new MutationObserver(r).observe(e,{subtree:!0,childList:!0,characterData:!0})}},[t,i]);return o.createElement("div",{ref:s,className:r,style:n},a)},Q=d`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`;e.s(["Toaster",0,e=>{let{reverseOrder:t,position:r="top-center",toastOptions:n,gutter:i,children:a,toasterId:s,containerStyle:u,containerClassName:l}=e,{toasts:c,handlers:f}=A(n,s);return o.createElement("div",{"data-rht-toaster":s||"",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...u},className:l,onMouseEnter:f.startPause,onMouseLeave:f.endPause},c.map(e=>{let n,s,u=e.position||r,l=f.calculateOffset(e,{reverseOrder:t,gutter:i,defaultPosition:r}),c=(n=u.includes("top"),s=u.includes("center")?{justifyContent:"center"}:u.includes("right")?{justifyContent:"flex-end"}:{},{left:0,right:0,display:"flex",position:"absolute",transition:w()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${l*(n?1:-1)}px)`,...n?{top:0}:{bottom:0},...s});return o.createElement(Y,{id:e.id,key:e.id,onHeightUpdate:f.updateHeight,className:e.visible?Q:"",style:c},"custom"===e.type?v(e.message,e):a?a(e):o.createElement(K,{toast:e,position:u}))}))},"default",0,R],59647)},35612,e=>{"use strict";let t="veltrade_ref";e.s(["captureReferral",0,function(){try{let e=new URLSearchParams(window.location.search),r=e.get("ref")||e.get("referral")||e.get("r");if(r&&r.trim()){let e={code:r.trim(),capturedAt:Date.now(),expiresAt:Date.now()+2592e6};localStorage.setItem(t,JSON.stringify(e))}}catch(e){console.error("refTracker capture error:",e)}},"clearReferral",0,function(){try{localStorage.removeItem(t)}catch{}},"getReferral",0,function(){try{let e=localStorage.getItem(t);if(!e)return null;let r=JSON.parse(e);if(Date.now()>r.expiresAt)return localStorage.removeItem(t),null;return r.code}catch{return null}}])},12352,e=>{"use strict";var t=e.i(63716),r=e.i(9768),n=e.i(59647),o=e.i(35612);e.s(["default",0,function(e){let{Component:i,pageProps:a}=e;return(0,r.useEffect)(()=>{(0,o.captureReferral)()},[]),(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(i,{...a}),(0,t.jsx)(n.Toaster,{position:"top-right",toastOptions:{duration:4e3}})]})}])},39855,(e,t,r)=>{let n="/_app";(window.__NEXT_P=window.__NEXT_P||[]).push([n,()=>e.r(12352)]),t.hot&&t.hot.dispose(function(){window.__NEXT_P.push([n])})},60749,e=>{e.v(t=>Promise.all(["static/chunks/0cx0h37te6fco.js"].map(t=>e.l(t))).then(()=>t(14028)))},72031,e=>{e.v(t=>Promise.all(["static/chunks/06nrazb4lvfq..js"].map(t=>e.l(t))).then(()=>t(38439)))}]);