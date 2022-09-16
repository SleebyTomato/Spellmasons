var app=function(){"use strict";function t(){}function e(t,e){for(const n in e)t[n]=e[n];return t}function n(t){return t()}function o(){return Object.create(null)}function r(t){t.forEach(n)}function c(t){return"function"==typeof t}function i(t,e){return t!=t?e==e:t!==e||t&&"object"==typeof t||"function"==typeof t}let l,s;function u(t,e){const n={};e=new Set(e);for(const o in t)e.has(o)||"$"===o[0]||(n[o]=t[o]);return n}function a(t,e){t.appendChild(e)}function d(t,e,n){t.insertBefore(e,n||null)}function f(t){t.parentNode.removeChild(t)}function p(t){return document.createElement(t)}function m(t){return document.createTextNode(t)}function $(){return m(" ")}function g(){return m("")}function h(t,e,n,o){return t.addEventListener(e,n,o),()=>t.removeEventListener(e,n,o)}function w(t,e,n){null==n?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n)}function k(t,e){const n=Object.getOwnPropertyDescriptors(t.__proto__);for(const o in e)null==e[o]?t.removeAttribute(o):"style"===o?t.style.cssText=e[o]:"__value"===o?t.value=t[o]=e[o]:n[o]&&n[o].set?t[o]=e[o]:w(t,o,e[o])}function v(t,e){t.value=null==e?"":e}function b(t,e,n,o){null===n?t.style.removeProperty(e):t.style.setProperty(e,n,o?"important":"")}function y(t){s=t}function x(){if(!s)throw new Error("Function called outside component initialization");return s}function R(t,e){const n=t.$$.callbacks[e.type];n&&n.slice().forEach((t=>t.call(this,e)))}const P=[],_=[],N=[],O=[],C=Promise.resolve();let M=!1;function S(t){N.push(t)}const j=new Set;let I=0;function E(){const t=s;do{for(;I<P.length;){const t=P[I];I++,y(t),G(t.$$)}for(y(null),P.length=0,I=0;_.length;)_.pop()();for(let t=0;t<N.length;t+=1){const e=N[t];j.has(e)||(j.add(e),e())}N.length=0}while(P.length);for(;O.length;)O.pop()();M=!1,j.clear(),y(t)}function G(t){if(null!==t.fragment){t.update(),r(t.before_update);const e=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,e),t.after_update.forEach(S)}}const T=new Set;let A;function L(){A={r:0,c:[],p:A}}function Y(){A.r||r(A.c),A=A.p}function F(t,e){t&&t.i&&(T.delete(t),t.i(e))}function U(t,e,n,o){if(t&&t.o){if(T.has(t))return;T.add(t),A.c.push((()=>{T.delete(t),o&&(n&&t.d(1),o())})),t.o(e)}else o&&o()}function K(t,e){const n=e.token={};function o(t,o,r,c){if(e.token!==n)return;e.resolved=c;let i=e.ctx;void 0!==r&&(i=i.slice(),i[r]=c);const l=t&&(e.current=t)(i);let s=!1;e.block&&(e.blocks?e.blocks.forEach(((t,n)=>{n!==o&&t&&(L(),U(t,1,1,(()=>{e.blocks[n]===t&&(e.blocks[n]=null)})),Y())})):e.block.d(1),l.c(),F(l,1),l.m(e.mount(),e.anchor),s=!0),e.block=l,e.blocks&&(e.blocks[o]=l),s&&E()}if((r=t)&&"object"==typeof r&&"function"==typeof r.then){const n=x();if(t.then((t=>{y(n),o(e.then,1,e.value,t),y(null)}),(t=>{if(y(n),o(e.catch,2,e.error,t),y(null),!e.hasCatch)throw t})),e.current!==e.pending)return o(e.pending,0),!0}else{if(e.current!==e.then)return o(e.then,1,e.value,t),!0;e.resolved=t}var r}function V(t){t&&t.c()}function B(t,e,o,i){const{fragment:l,on_mount:s,on_destroy:u,after_update:a}=t.$$;l&&l.m(e,o),i||S((()=>{const e=s.map(n).filter(c);u?u.push(...e):r(e),t.$$.on_mount=[]})),a.forEach(S)}function D(t,e){const n=t.$$;null!==n.fragment&&(r(n.on_destroy),n.fragment&&n.fragment.d(e),n.on_destroy=n.fragment=null,n.ctx=[])}function H(t,e){-1===t.$$.dirty[0]&&(P.push(t),M||(M=!0,C.then(E)),t.$$.dirty.fill(0)),t.$$.dirty[e/31|0]|=1<<e%31}function q(e,n,c,i,l,u,a,d=[-1]){const p=s;y(e);const m=e.$$={fragment:null,ctx:null,props:u,update:t,not_equal:l,bound:o(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(n.context||(p?p.$$.context:[])),callbacks:o(),dirty:d,skip_bound:!1,root:n.target||p.$$.root};a&&a(m.root);let $=!1;if(m.ctx=c?c(e,n.props||{},((t,n,...o)=>{const r=o.length?o[0]:n;return m.ctx&&l(m.ctx[t],m.ctx[t]=r)&&(!m.skip_bound&&m.bound[t]&&m.bound[t](r),$&&H(e,t)),n})):[],m.update(),$=!0,r(m.before_update),m.fragment=!!i&&i(m.ctx),n.target){if(n.hydrate){const t=function(t){return Array.from(t.childNodes)}(n.target);m.fragment&&m.fragment.l(t),t.forEach(f)}else m.fragment&&m.fragment.c();n.intro&&F(e.$$.fragment),B(e,n.target,n.anchor,n.customElement),E()}y(p)}class z{$destroy(){D(this,1),this.$destroy=t}$on(t,e){const n=this.$$.callbacks[t]||(this.$$.callbacks[t]=[]);return n.push(e),()=>{const t=n.indexOf(e);-1!==t&&n.splice(t,1)}}$set(t){var e;this.$$set&&(e=t,0!==Object.keys(e).length)&&(this.$$.skip_bound=!0,this.$$set(t),this.$$.skip_bound=!1)}}function J(n){let o,r,c,i,l,s=[{class:"button-wrapper"},n[1]],u={};for(let t=0;t<s.length;t+=1)u=e(u,s[t]);return{c(){o=p("button"),r=p("div"),c=m(n[0]),k(o,u)},m(t,e){d(t,o,e),a(o,r),a(r,c),o.autofocus&&o.focus(),i||(l=h(o,"click",n[2]),i=!0)},p(t,[e]){1&e&&function(t,e){e=""+e,t.wholeText!==e&&(t.data=e)}(c,t[0]),k(o,u=function(t,e){const n={},o={},r={$$scope:1};let c=t.length;for(;c--;){const i=t[c],l=e[c];if(l){for(const t in i)t in l||(o[t]=1);for(const t in l)r[t]||(n[t]=l[t],r[t]=1);t[c]=l}else for(const t in i)r[t]=1}for(const t in o)t in n||(n[t]=void 0);return n}(s,[{class:"button-wrapper"},2&e&&t[1]]))},i:t,o:t,d(t){t&&f(o),i=!1,l()}}}function W(t,n,o){const r=["text"];let c=u(n,r),{text:i}=n;return t.$$set=t=>{n=e(e({},n),function(t){const e={};for(const n in t)"$"!==n[0]&&(e[n]=t[n]);return e}(t)),o(1,c=u(n,r)),"text"in t&&o(0,i=t.text)},[i,c,function(e){R.call(this,t,e)}]}class Q extends z{constructor(t){super(),q(this,t,W,J,i,{text:0})}}function Z(e){let n,o,c,i,l,s,u,g,k,v,b,y,x,R,P;return n=new Q({props:{type:"button",text:"🠔 Back"}}),n.$on("click",e[2]),y=new Q({props:{text:"Toggle FPS/Latency Monitor"}}),y.$on("click",e[3]),{c(){V(n.$$.fragment),o=$(),c=p("div"),i=m("Total Volume:\r\n    "),l=p("input"),s=m("\r\n    Music Volume:\r\n    "),u=p("input"),g=m("\r\n    Sound Effects Volume:\r\n    "),k=p("input"),v=$(),b=p("div"),V(y.$$.fragment),w(l,"type","range"),l.value=100*window.volume,w(l,"min","0"),w(l,"max","100"),w(u,"type","range"),u.value=100*window.volumeMusic,w(u,"min","0"),w(u,"max","100"),w(k,"type","range"),k.value=100*window.volumeGame,w(k,"min","0"),w(k,"max","100")},m(t,e){B(n,t,e),d(t,o,e),d(t,c,e),a(c,i),a(c,l),a(c,s),a(c,u),a(c,g),a(c,k),d(t,v,e),d(t,b,e),B(y,b,null),x=!0,R||(P=[h(l,"input",X),h(u,"input",tt),h(k,"input",et)],R=!0)},p:t,i(t){x||(F(n.$$.fragment,t),F(y.$$.fragment,t),x=!0)},o(t){U(n.$$.fragment,t),U(y.$$.fragment,t),x=!1},d(t){D(n,t),t&&f(o),t&&f(c),t&&f(v),t&&f(b),D(y),R=!1,r(P)}}}function X(t){window.changeVolume(t.target.value/100)}function tt(t){window.changeVolumeMusic(t.target.value/100)}function et(t){window.changeVolumeGame(t.target.value/100)}function nt(t,e,n){let{setRoute:o}=e,{lastRoute:r}=e;return t.$$set=t=>{"setRoute"in t&&n(0,o=t.setRoute),"lastRoute"in t&&n(1,r=t.lastRoute)},[o,r,()=>o(r),()=>{window.monitorFPS()}]}class ot extends z{constructor(t){super(),q(this,t,nt,Z,i,{setRoute:0,lastRoute:1})}}function rt(e){let n,o,r,c;return n=new Q({props:{type:"button",text:"🠔 Back"}}),n.$on("click",e[2]),{c(){V(n.$$.fragment),o=$(),r=p("table"),r.innerHTML='<tr><td>Clear Active Spell</td> \n        <td><kbd class="hotkey-badge">Esc</kbd></td></tr> \n    <tr id="center-cam-info"><td>Free Look</td> \n        <td><kbd class="hotkey-badge">W</kbd> \n            <kbd class="hotkey-badge">A</kbd> \n            <kbd class="hotkey-badge">S</kbd> \n            <kbd class="hotkey-badge">D</kbd>\n            or Click and Drag Middle Mouse Button</td></tr> \n    <tr id="center-cam-tooltip"><td>Camera Follow Player</td> \n        <td><kbd class="hotkey-badge">Z</kbd></td></tr> \n    <tr><td>Ping Location</td> \n        <td><kbd class="hotkey-badge">C</kbd></td></tr> \n    <tr><td>Toggle Menu</td> \n        <td><kbd class="hotkey-badge">Esc</kbd></td></tr> \n    <tr><td>Inventory</td> \n        <td><kbd class="hotkey-badge">Tab</kbd>\n            /\n            <kbd class="hotkey-badge">i</kbd></td></tr> \n    <tr><td>View Walk Distance</td> \n        <td><kbd class="hotkey-badge">f</kbd></td></tr>',w(r,"id","keymapping")},m(t,e){B(n,t,e),d(t,o,e),d(t,r,e),c=!0},p:t,i(t){c||(F(n.$$.fragment,t),c=!0)},o(t){U(n.$$.fragment,t),c=!1},d(t){D(n,t),t&&f(o),t&&f(r)}}}function ct(t,e,n){let{setRoute:o}=e,{lastRoute:r}=e;return t.$$set=t=>{"setRoute"in t&&n(0,o=t.setRoute),"lastRoute"in t&&n(1,r=t.lastRoute)},[o,r,()=>o(r)]}class it extends z{constructor(t){super(),q(this,t,ct,rt,i,{setRoute:0,lastRoute:1})}}function lt(t){let e,n,o,r,c={ctx:t,current:null,token:null,hasCatch:!0,pending:gt,then:at,catch:ut,blocks:[,,,]};return K(window.setupPixiPromise,c),{c(){e=p("div"),n=$(),o=g(),c.block.c(),w(e,"id","websocket-pie-connection-status")},m(t,i){d(t,e,i),d(t,n,i),d(t,o,i),c.block.m(t,c.anchor=i),c.mount=()=>o.parentNode,c.anchor=o,r=!0},p(e,n){!function(t,e,n){const o=e.slice(),{resolved:r}=t;t.current===t.then&&(o[t.value]=r),t.current===t.catch&&(o[t.error]=r),t.block.p(o,n)}(c,t=e,n)},i(t){r||(F(c.block),r=!0)},o(t){for(let t=0;t<3;t+=1){U(c.blocks[t])}r=!1},d(t){t&&f(e),t&&f(n),t&&f(o),c.block.d(t),c.token=null,c=null}}}function st(e){let n,o,r,c,i,l,s,u,m,g,h;return o=new Q({props:{text:"Resume Game"}}),o.$on("click",wt),c=new Q({props:{text:"Options"}}),c.$on("click",e[17]),l=new Q({props:{text:"Key Mapping"}}),l.$on("click",e[18]),u=new Q({props:{text:"Customize Appearance"}}),u.$on("click",e[19]),g=new Q({props:{text:"Quit to Main Menu"}}),g.$on("click",e[15]),{c(){n=p("div"),V(o.$$.fragment),r=$(),V(c.$$.fragment),i=$(),V(l.$$.fragment),s=$(),V(u.$$.fragment),m=$(),V(g.$$.fragment),w(n,"class","list svelte-jyvijk")},m(t,e){d(t,n,e),B(o,n,null),a(n,r),B(c,n,null),a(n,i),B(l,n,null),a(n,s),B(u,n,null),a(n,m),B(g,n,null),h=!0},p:t,i(t){h||(F(o.$$.fragment,t),F(c.$$.fragment,t),F(l.$$.fragment,t),F(u.$$.fragment,t),F(g.$$.fragment,t),h=!0)},o(t){U(o.$$.fragment,t),U(c.$$.fragment,t),U(l.$$.fragment,t),U(u.$$.fragment,t),U(g.$$.fragment,t),h=!1},d(t){t&&f(n),D(o),D(c),D(l),D(u),D(g)}}}function ut(e){let n;return{c(){n=p("p"),n.textContent="Something went wrong loading assets",b(n,"color","red")},m(t,e){d(t,n,e)},p:t,i:t,o:t,d(t){t&&f(n)}}}function at(t){let e,n,o,r,c,i,l,s,u,m,h,k,v;n=new Q({props:{text:"New Run"}}),n.$on("click",t[11]),r=new Q({props:{text:"Multiplayer"}}),r.$on("click",t[12]),i=new Q({props:{text:"Options"}}),i.$on("click",t[20]),s=new Q({props:{text:"Key Mapping"}}),s.$on("click",t[21]);let b=!1===t[7]&&dt(t);return{c(){e=p("div"),V(n.$$.fragment),o=$(),V(r.$$.fragment),c=$(),V(i.$$.fragment),l=$(),V(s.$$.fragment),u=$(),m=p("br"),h=$(),b&&b.c(),k=g(),w(e,"class","list svelte-jyvijk")},m(t,f){d(t,e,f),B(n,e,null),a(e,o),B(r,e,null),a(e,c),B(i,e,null),a(e,l),B(s,e,null),d(t,u,f),d(t,m,f),d(t,h,f),b&&b.m(t,f),d(t,k,f),v=!0},p(t,e){!1===t[7]?b?(b.p(t,e),128&e&&F(b,1)):(b=dt(t),b.c(),F(b,1),b.m(k.parentNode,k)):b&&(L(),U(b,1,1,(()=>{b=null})),Y())},i(t){v||(F(n.$$.fragment,t),F(r.$$.fragment,t),F(i.$$.fragment,t),F(s.$$.fragment,t),F(b),v=!0)},o(t){U(n.$$.fragment,t),U(r.$$.fragment,t),U(i.$$.fragment,t),U(s.$$.fragment,t),U(b),v=!1},d(t){t&&f(e),D(n),D(r),D(i),D(s),t&&f(u),t&&f(m),t&&f(h),b&&b.d(t),t&&f(k)}}}function dt(t){let e,n,o,c,i,l,s,u,w,k,b,y,x;i=new Q({props:{disabled:t[10],text:"Connect"}}),i.$on("click",t[13]),s=new Q({props:{disabled:!t[10],text:"Disconnect"}}),s.$on("click",t[14]);let R=t[5]&&ft(),P=t[10]&&pt(t);return{c(){e=m("Server Url\r\n            "),n=p("div"),o=p("input"),c=$(),V(i.$$.fragment),l=$(),V(s.$$.fragment),u=$(),R&&R.c(),w=$(),P&&P.c(),k=g()},m(r,f){d(r,e,f),d(r,n,f),a(n,o),v(o,t[8]),a(n,c),B(i,n,null),a(n,l),B(s,n,null),d(r,u,f),R&&R.m(r,f),d(r,w,f),P&&P.m(r,f),d(r,k,f),b=!0,y||(x=[h(o,"input",t[22]),h(o,"keypress",t[23])],y=!0)},p(t,e){256&e&&o.value!==t[8]&&v(o,t[8]);const n={};1024&e&&(n.disabled=t[10]),i.$set(n);const r={};1024&e&&(r.disabled=!t[10]),s.$set(r),t[5]?R||(R=ft(),R.c(),R.m(w.parentNode,w)):R&&(R.d(1),R=null),t[10]?P?(P.p(t,e),1024&e&&F(P,1)):(P=pt(t),P.c(),F(P,1),P.m(k.parentNode,k)):P&&(L(),U(P,1,1,(()=>{P=null})),Y())},i(t){b||(F(i.$$.fragment,t),F(s.$$.fragment,t),F(P),b=!0)},o(t){U(i.$$.fragment,t),U(s.$$.fragment,t),U(P),b=!1},d(t){t&&f(e),t&&f(n),D(i),D(s),t&&f(u),R&&R.d(t),t&&f(w),P&&P.d(t),t&&f(k),y=!1,r(x)}}}function ft(t){let e,n;return{c(){e=m("Connecting...\r\n                "),n=p("div"),n.innerHTML='<div class="svelte-jyvijk"></div> \n                    <div class="svelte-jyvijk"></div> \n                    <div class="svelte-jyvijk"></div> \n                    <div class="svelte-jyvijk"></div>',w(n,"class","lds-ellipsis svelte-jyvijk")},m(t,o){d(t,e,o),d(t,n,o)},d(t){t&&f(e),t&&f(n)}}}function pt(t){let e,n,o,c,i,l,s,u,a,m;const w=[$t,mt],k=[];function b(t,e){return t[6]?0:1}return i=b(t),l=k[i]=w[i](t),{c(){e=p("p"),e.textContent="Game name",n=$(),o=p("input"),c=$(),l.c(),s=g()},m(r,l){d(r,e,l),d(r,n,l),d(r,o,l),v(o,t[9]),d(r,c,l),k[i].m(r,l),d(r,s,l),u=!0,a||(m=[h(o,"input",t[24]),h(o,"keypress",t[25])],a=!0)},p(t,e){512&e&&o.value!==t[9]&&v(o,t[9]);let n=i;i=b(t),i===n?k[i].p(t,e):(L(),U(k[n],1,1,(()=>{k[n]=null})),Y(),l=k[i],l?l.p(t,e):(l=k[i]=w[i](t),l.c()),F(l,1),l.m(s.parentNode,s))},i(t){u||(F(l),u=!0)},o(t){U(l),u=!1},d(t){t&&f(e),t&&f(n),t&&f(o),t&&f(c),k[i].d(t),t&&f(s),a=!1,r(m)}}}function mt(e){let n,o,r,c,i;return o=new Q({props:{text:"Host"}}),o.$on("click",e[16]),c=new Q({props:{text:"Join"}}),c.$on("click",e[16]),{c(){n=p("div"),V(o.$$.fragment),r=$(),V(c.$$.fragment),b(n,"display","flex")},m(t,e){d(t,n,e),B(o,n,null),a(n,r),B(c,n,null),i=!0},p:t,i(t){i||(F(o.$$.fragment,t),F(c.$$.fragment,t),i=!0)},o(t){U(o.$$.fragment,t),U(c.$$.fragment,t),i=!1},d(t){t&&f(n),D(o),D(c)}}}function $t(e){let n,o;return{c(){n=m("Joining...\r\n                    "),o=p("div"),o.innerHTML='<div class="svelte-jyvijk"></div> \n                        <div class="svelte-jyvijk"></div> \n                        <div class="svelte-jyvijk"></div> \n                        <div class="svelte-jyvijk"></div>',w(o,"class","lds-ellipsis svelte-jyvijk")},m(t,e){d(t,n,e),d(t,o,e)},p:t,i:t,o:t,d(t){t&&f(n),t&&f(o)}}}function gt(e){let n;return{c(){n=m("loading assets...")},m(t,e){d(t,n,e)},p:t,i:t,o:t,d(t){t&&f(n)}}}function ht(t){let e,n,o,r;const c=[st,lt],i=[];function l(t,e){return t[4]?0:1}return e=l(t),n=i[e]=c[e](t),{c(){n.c(),o=g()},m(t,n){i[e].m(t,n),d(t,o,n),r=!0},p(t,[r]){let s=e;e=l(t),e===s?i[e].p(t,r):(L(),U(i[s],1,1,(()=>{i[s]=null})),Y(),n=i[e],n?n.p(t,r):(n=i[e]=c[e](t),n.c()),F(n,1),n.m(o.parentNode,o))},i(t){r||(F(n),r=!0)},o(t){U(n),r=!1},d(t){i[e].d(t),t&&f(o)}}}function wt(){window.closeMenu()}function kt(t,e,n){let o,{setRoute:r}=e,{OPTIONS:c}=e,{KEY_MAPPING:i}=e,{PLAYER_CONFIG:l}=e,{inGame:s}=e,u=!1,a=!1;function d(){window.playMusic(),o&&w(),n(7,o=!1)}let f,p=new URLSearchParams(location.search),m=p.get("pieUrl"),$=p.get("game");function g(){n(10,f=window.isConnected()),n(5,u=!1)}function h(){if(m){console.log("Menu: Connect to server",m),n(5,u=!0);const t=new URL(location.href);return t.searchParams.set("pieUrl",m),window.history.pushState(null,null,t),window.connect_to_wsPie_server(m).catch(console.error).then(g)}return Promise.reject("No wsUrl defined to connect to")}function w(){window.pieDisconnect().then(g)}function k(){$?window.isConnected()?(console.log("Menu: Connect to game name",$),n(6,a=!0),window.joinRoom({name:$}).then((()=>{const t=new URL(location.href);t.searchParams.set("game",$),window.history.pushState(null,null,t)})).catch((t=>{console.error("Could not join room",t)})).then((()=>{n(6,a=!1)}))):console.error("Cannot join room until pieClient is connected to a pieServer"):console.log("Cannot join game until a gameName is provided")}window.tryAutoConnect=()=>{m&&(console.log("Menu: Start auto connect"),d(),h())};return t.$$set=t=>{"setRoute"in t&&n(0,r=t.setRoute),"OPTIONS"in t&&n(1,c=t.OPTIONS),"KEY_MAPPING"in t&&n(2,i=t.KEY_MAPPING),"PLAYER_CONFIG"in t&&n(3,l=t.PLAYER_CONFIG),"inGame"in t&&n(4,s=t.inGame)},[r,c,i,l,s,u,a,o,m,$,f,function(){window.playMusic(),n(7,o=!0),window.startSingleplayer().then((()=>{g()}))},d,h,w,function(){if(confirm("Are you sure you want to quit to Main Menu?")){const t=new URL(location.href);t.searchParams.delete("game"),t.searchParams.delete("pieUrl"),window.history.pushState(null,null,t),window.exitCurrentGame().then(g)}},k,()=>r(c),()=>r(i),()=>r(l),()=>r(c),()=>r(i),function(){m=this.value,n(8,m)},t=>{"Enter"==t.key&&h()},function(){$=this.value,n(9,$)},t=>{"Enter"==t.key&&k()}]}class vt extends z{constructor(t){super(),q(this,t,kt,ht,i,{setRoute:0,OPTIONS:1,KEY_MAPPING:2,PLAYER_CONFIG:3,inGame:4})}}function bt(t){let e,n,o,c,i,l,s,u,m,g,k,b,y;return e=new Q({props:{type:"button",text:"🠔 Back"}}),e.$on("click",t[5]),{c(){V(e.$$.fragment),n=$(),o=p("div"),c=p("label"),c.textContent="Robe Color",i=$(),l=p("input"),s=$(),u=p("label"),u.textContent="Player Name",m=$(),g=p("input"),w(c,"for","robe"),w(l,"type","color"),w(l,"name","robe"),w(u,"for","player-name"),w(g,"type","text"),w(g,"name","player-name")},m(r,f){B(e,r,f),d(r,n,f),d(r,o,f),a(o,c),a(o,i),a(o,l),v(l,t[3]),a(o,s),a(o,u),a(o,m),a(o,g),v(g,t[2]),k=!0,b||(y=[h(l,"input",t[6]),h(l,"blur",t[7]),h(g,"input",t[8]),h(g,"input",t[9])],b=!0)},p(t,[e]){8&e&&v(l,t[3]),4&e&&g.value!==t[2]&&v(g,t[2])},i(t){k||(F(e.$$.fragment,t),k=!0)},o(t){U(e.$$.fragment,t),k=!1},d(t){D(e,t),t&&f(n),t&&f(o),b=!1,r(y)}}}function yt(t,e,n){let{setRoute:o}=e,{lastRoute:r}=e,c=localStorage.getItem("player-name"),i=`#${parseInt(localStorage.getItem("player-color")).toString(16)}`;const l=t=>parseInt(t.slice(1),16);return t.$$set=t=>{"setRoute"in t&&n(0,o=t.setRoute),"lastRoute"in t&&n(1,r=t.lastRoute)},[o,r,c,i,l,()=>o(r),function(){i=this.value,n(3,i)},()=>{window.configPlayer({color:l(i),name:c})},function(){c=this.value,n(2,c)},()=>{window.configPlayer({color:l(i),name:c})}]}class xt extends z{constructor(t){super(),q(this,t,yt,bt,i,{setRoute:0,lastRoute:1})}}function Rt(e){let n,o,c,i,l,s,u,m;return{c(){n=p("div"),o=p("button"),o.textContent="Resume Tutorial",c=$(),i=p("button"),i.textContent="Options",l=$(),s=p("button"),s.textContent="Skip Tutorial",w(n,"class","list")},m(t,r){d(t,n,r),a(n,o),a(n,c),a(n,i),a(n,l),a(n,s),u||(m=[h(o,"click",_t),h(i,"click",e[2]),h(s,"click",Pt)],u=!0)},p:t,i:t,o:t,d(t){t&&f(n),u=!1,r(m)}}}function Pt(){confirm("Are you sure you want to skip the tutorial?")&&(window.skipTutorial(),window.exitCurrentGame())}function _t(){window.closeMenu()}function Nt(t,e,n){let{OPTIONS:o}=e,{setRoute:r}=e;return t.$$set=t=>{"OPTIONS"in t&&n(0,o=t.OPTIONS),"setRoute"in t&&n(1,r=t.setRoute)},[o,r,()=>r(o)]}class Ot extends z{constructor(t){super(),q(this,t,Nt,Rt,i,{OPTIONS:0,setRoute:1})}}function Ct(e){let n,o;return n=new Ot({props:{setRoute:e[3],OPTIONS:Gt}}),{c(){V(n.$$.fragment)},m(t,e){B(n,t,e),o=!0},p:t,i(t){o||(F(n.$$.fragment,t),o=!0)},o(t){U(n.$$.fragment,t),o=!1},d(t){D(n,t)}}}function Mt(t){let e,n;return e=new it({props:{setRoute:t[3],lastRoute:t[0]}}),{c(){V(e.$$.fragment)},m(t,o){B(e,t,o),n=!0},p(t,n){const o={};1&n&&(o.lastRoute=t[0]),e.$set(o)},i(t){n||(F(e.$$.fragment,t),n=!0)},o(t){U(e.$$.fragment,t),n=!1},d(t){D(e,t)}}}function St(t){let e,n;return e=new ot({props:{setRoute:t[3],lastRoute:t[0]}}),{c(){V(e.$$.fragment)},m(t,o){B(e,t,o),n=!0},p(t,n){const o={};1&n&&(o.lastRoute=t[0]),e.$set(o)},i(t){n||(F(e.$$.fragment,t),n=!0)},o(t){U(e.$$.fragment,t),n=!1},d(t){D(e,t)}}}function jt(t){let e,n;return e=new xt({props:{setRoute:t[3],lastRoute:t[0]}}),{c(){V(e.$$.fragment)},m(t,o){B(e,t,o),n=!0},p(t,n){const o={};1&n&&(o.lastRoute=t[0]),e.$set(o)},i(t){n||(F(e.$$.fragment,t),n=!0)},o(t){U(e.$$.fragment,t),n=!1},d(t){D(e,t)}}}function It(t){let e,n;return e=new vt({props:{setRoute:t[3],PLAYER_CONFIG:At,OPTIONS:Gt,KEY_MAPPING:Tt,inGame:t[2]}}),{c(){V(e.$$.fragment)},m(t,o){B(e,t,o),n=!0},p(t,n){const o={};4&n&&(o.inGame=t[2]),e.$set(o)},i(t){n||(F(e.$$.fragment,t),n=!0)},o(t){U(e.$$.fragment,t),n=!1},d(t){D(e,t)}}}function Et(t){let e,n,o,r,c,i,s;const u=[It,jt,St,Mt,Ct],a=[];function m(t,e){return t[1]==Lt?0:t[1]==At?1:t[1]==Gt?2:t[1]==Tt?3:t[1]==Yt?4:-1}return~(r=m(t))&&(c=a[r]=u[r](t)),{c(){var t,r;e=p("img"),o=$(),c&&c.c(),i=g(),t=e.src,r=n="ui/logo.png",l||(l=document.createElement("a")),l.href=r,t!==l.href&&w(e,"src","ui/logo.png"),w(e,"alt","Spellmasons logo"),w(e,"width","800")},m(t,n){d(t,e,n),d(t,o,n),~r&&a[r].m(t,n),d(t,i,n),s=!0},p(t,[e]){let n=r;r=m(t),r===n?~r&&a[r].p(t,e):(c&&(L(),U(a[n],1,1,(()=>{a[n]=null})),Y()),~r?(c=a[r],c?c.p(t,e):(c=a[r]=u[r](t),c.c()),F(c,1),c.m(i.parentNode,i)):c=null)},i(t){s||(F(c),s=!0)},o(t){U(c),s=!1},d(t){t&&f(e),t&&f(o),~r&&a[r].d(t),t&&f(i)}}}const Gt="OPTIONS",Tt="KEY_MAPPING",At="PLAYER_CONFIG",Lt="PLAY",Yt="TUTORIAL";function Ft(t,e,n){let o,r;console.log("Menu: Svelte menu is running");let c=!1;function i(t){console.log("Menu: Route:",t),n(0,o=r),n(1,r=t),window.updateInGameMenuStatus()}return window.updateInGameMenuStatus=()=>{n(2,c=void 0!==window.player)},i(Lt),window.setMenu=i,[o,r,c,i]}return new class extends z{constructor(t){super(),q(this,t,Ft,Et,i,{})}}({target:document.getElementById("menu-inner")||document.body,props:{}})}();
//# sourceMappingURL=svelte-bundle.js.map
