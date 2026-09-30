import{A as e,B as t,C as n,E as r,H as i,J as a,K as o,R as s,S as c,T as l,W as u,_ as d,a as f,b as p,c as m,ct as h,dt as g,f as _,ft as v,g as ee,h as y,i as b,k as x,lt as S,m as C,o as w,p as T,s as E,tt as D,ut as O,v as k,w as te,y as A}from"./index-Rph-gfxM.js";import{t as j}from"./useScrollScene-C_OY7xky.js";import{r as M}from"./BufferGeometryUtils-DJ9BSjAh.js";import{n as N,r as P,t as F}from"./book-CX2gYFy2.js";var I=v(g(),1),L=p(),R=-2.2,z={z0:.9,z1:2.1,y0:.95,y1:2.3},B={x0:-.6,x1:1.2,h:2.12,d:.36},V=[.08,.5,.92,1.34,1.76,2.1],H=new S(1,-.55,-.42).normalize(),U={shelf:2,x:.36,w:.042,h:.27,d:.2},W=`0100001101001111`,G={x0:.05,z0:.55,z1:1.35,pitch:.058},K=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},q=`
uniform vec3 uL;
float windowLit(vec3 p) {
  if (p.x < ${R.toFixed(2)} || p.y < 0.0 || p.z < 0.0) return 0.0;
  float t = (p.x - (${R.toFixed(2)})) / uL.x;
  vec3 w = p - uL * t;
  vec2 q = vec2((w.z - ${z.z0.toFixed(2)}) / ${(z.z1-z.z0).toFixed(2)}, (w.y - ${z.y0.toFixed(2)}) / ${(z.y1-z.y0).toFixed(2)});
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return 0.0;
  // переплёт: 3 створки по ширине, 2 по высоте; края лучей мягкие (солнце не точка)
  vec2 g = fract(q * vec2(3.0, 2.0));
  float bar = smoothstep(0.0, 0.045, g.x) * smoothstep(1.0, 0.955, g.x) * smoothstep(0.0, 0.05, g.y) * smoothstep(1.0, 0.95, g.y);
  float edge = smoothstep(0.0, 0.03, q.x) * smoothstep(1.0, 0.97, q.x) * smoothstep(0.0, 0.03, q.y) * smoothstep(1.0, 0.97, q.y);
  // за полкой и в её толще света нет
  if (p.z < ${B.d.toFixed(2)} && p.x > ${B.x0.toFixed(2)} && p.x < ${B.x1.toFixed(2)} && p.y < ${B.h.toFixed(2)}) return 0.0;
  return bar * edge;
}
`;function J(){let e=f(`wood`),t=f(`planks`),n=f(`wallpaper`),r=f(`spines`),i=f(`cloth`),a=f(`pageEdge`);return(0,I.useMemo)(()=>{let s={map:b(e.map),normal:b(e.normal)};s.map.repeat.set(2,2),s.normal.repeat.set(2,2);let c=new o({map:s.map,normalMap:s.normal,normalScale:new h(.35,.35),roughness:.5,metalness:0}),l={map:b(t.map),normal:b(t.normal),rough:b(t.rough)};for(let e of[l.map,l.normal,l.rough])e.repeat.set(2.2,2.2);let u=new o({map:l.map,normalMap:l.normal,roughnessMap:l.rough,roughness:1,normalScale:new h(.6,.6)}),d=b(n);d.repeat.set(3,1.4);let f=new o({map:d,roughness:.92}),p=new o({color:`#b9ae98`,roughness:.8}),m=new o({map:b(a.map),normalMap:b(a.normal),normalScale:new h(.5,.5),roughness:.92});m.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <color_fragment>`,``)};let g=b(i.map),_=b(i.normal);return g.repeat.set(3,3),_.repeat.set(3,3),{shelfMat:c,floorMat:u,wallMat:f,paintMat:p,pages:m,cover:new o({map:g,normalMap:_,normalScale:new h(.45,.45),roughness:.82}),spines:r.map(e=>Y(b(e)))}},[e,t,n,r,i,a])}function Y(e){let t=new o({map:e,roughness:.78,metalness:0});return t.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <map_fragment>`,`float gilt = 0.0;
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          gilt = 1.0 - sampledDiffuseColor.a;
          diffuseColor.rgb *= sampledDiffuseColor.rgb;
        #endif`).replace(`#include <color_fragment>`,`#if defined( USE_COLOR )
          diffuseColor.rgb *= mix(vColor.rgb, vec3(1.0), gilt);
        #endif
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.6, 0.29), gilt);`).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
 roughnessFactor = mix(roughnessFactor, 0.32, gilt);`).replace(`#include <metalnessmap_fragment>`,`#include <metalnessmap_fragment>
 metalnessFactor = mix(metalnessFactor, 1.0, gilt);`)},t}var X=[`#6e2a22`,`#2c3b2a`,`#1f2a3d`,`#6b5130`,`#4b2233`,`#35352f`,`#7a6a4a`,`#233a3a`,`#5a3a1e`,`#2a2320`,`#8a7355`,`#3c2a1c`];function ne(){let t=M(42),n=[],i=B.x0+.035,a=B.x1-.035;for(let o=0;o<V.length-1;o++){let s=V[o]+.0125,c=V[o+1]-V[o]-.04,l=i+t()*.02,u=o===4?i+.95:a;for(;l<u-.02;){if(o===U.shelf&&l+.06>U.x-U.w/2&&l<U.x+U.w/2+.004){l=U.x+U.w/2+.006;continue}let i=t();if(i<.06){l+=.04+t()*.1;continue}if(i<.14&&u-l>.3){let i=2+Math.floor(t()*4),a=s,o=.22+t()*.08;for(let s=0;s<i;s++){let i=.025+t()*.03,s=.15+t()*.06;n.push({pos:new S(l+o/2+(t()-.5)*.015,a+i/2,B.d-.02-s/2),rot:new e(0,(t()-.5)*.12,Math.PI/2),size:new S(i,o,s),color:new r(X[Math.floor(t()*X.length)]),variant:Math.floor(t()*6)}),a+=i}l+=o+.01;continue}let a=.018+t()**1.5*.045,d=Math.min(c,.19+t()*.12),f=.13+t()*.09,p=i>.94?.2+t()*.12:0;n.push({pos:new S(l+a/2+Math.sin(p)*d*.5,s+d/2*Math.cos(p),B.d-.018-f/2-t()*.015),rot:new e(0,0,-p),size:new S(a,d,f),color:new r(X[Math.floor(t()*X.length)]).multiplyScalar(.75+t()*.45),variant:Math.floor(t()*6)}),l+=a+.001+(p?Math.sin(p)*d:0)}}return n}function re({m:e}){let t=(0,I.useMemo)(()=>{let t=ne(),n=F.map(e=>N(e)),r=new a,i=[];for(let r=0;r<n.length;r++)for(let n=0;n<e.spines.length;n++){let e=t.filter(e=>e.variant===n&&P(e.size.x)===r);e.length&&i.push({shape:r,v:n,list:e})}return i.map(({shape:t,v:i,list:a})=>{let o=new s(n[t],[e.cover,e.spines[i],e.pages],a.length);return a.forEach((e,t)=>{r.position.copy(e.pos),r.rotation.copy(e.rot),r.scale.copy(e.size),r.updateMatrix(),o.setMatrixAt(t,r.matrix),o.setColorAt(t,e.color)}),o.castShadow=!0,o.receiveShadow=!0,o})},[e]);return(0,L.jsx)(L.Fragment,{children:t.map((e,t)=>(0,L.jsx)(`primitive`,{object:e},t))})}function ie({m:e}){let{x0:t,x1:n,h:r,d:i}=B,a=n-t,o=(t+n)/2;return(0,L.jsxs)(`group`,{children:[[t+.015,n-.015].map(t=>(0,L.jsx)(`mesh`,{position:[t,r/2,i/2],material:e.shelfMat,castShadow:!0,receiveShadow:!0,children:(0,L.jsx)(`boxGeometry`,{args:[.03,r,i]})},t)),V.map(t=>(0,L.jsx)(`mesh`,{position:[o,t,i/2],material:e.shelfMat,castShadow:!0,receiveShadow:!0,children:(0,L.jsx)(`boxGeometry`,{args:[a-.03,.025,i]})},t)),(0,L.jsx)(`mesh`,{position:[o,r/2,.006],material:e.shelfMat,receiveShadow:!0,children:(0,L.jsx)(`boxGeometry`,{args:[a,r,.012]})}),(0,L.jsx)(`mesh`,{position:[o,.04,i-.01],material:e.shelfMat,castShadow:!0,receiveShadow:!0,children:(0,L.jsx)(`boxGeometry`,{args:[a,.08,.02]})}),(0,L.jsx)(`mesh`,{position:[o,r+.02,i/2+.01],material:e.shelfMat,castShadow:!0,receiveShadow:!0,children:(0,L.jsx)(`boxGeometry`,{args:[a+.06,.04,i+.04]})})]})}function ae(){let e=(0,I.useMemo)(()=>new o({color:`#c8a052`,metalness:1,roughness:.32}),[]),t=(0,I.useMemo)(()=>new o({color:`#8d8d88`,metalness:.4,roughness:.5}),[]),n=(0,I.useMemo)(()=>new o({color:`#1c1c1c`,roughness:.4}),[]);return(0,L.jsxs)(`group`,{position:[.95,V[4]+.0125,.2],"rotation-y":-.5,scale:.9,children:[(0,L.jsx)(`mesh`,{position:[0,.07,0],material:e,castShadow:!0,children:(0,L.jsx)(`cylinderGeometry`,{args:[.07,.07,.06,8]})}),[0,1,2,3].map(e=>{let n=e/4*Math.PI*2+Math.PI/4;return(0,L.jsxs)(`group`,{children:[(0,L.jsx)(`mesh`,{position:[Math.cos(n)*.09,.04,Math.sin(n)*.09],rotation:[Math.sin(n)*.5,0,-Math.cos(n)*.5],material:t,castShadow:!0,children:(0,L.jsx)(`cylinderGeometry`,{args:[.004,.004,.1,5]})}),(0,L.jsx)(`mesh`,{position:[Math.cos(n)*.115,.004,Math.sin(n)*.115],material:t,children:(0,L.jsx)(`cylinderGeometry`,{args:[.014,.014,.005,10]})})]},e)}),(0,L.jsx)(`mesh`,{position:[0,.13,0],material:t,castShadow:!0,children:(0,L.jsx)(`cylinderGeometry`,{args:[.055,.065,.07,6]})}),(0,L.jsx)(`mesh`,{position:[.02,.14,.055],"rotation-x":-.2,material:n,children:(0,L.jsx)(`boxGeometry`,{args:[.03,.022,.004]})}),(0,L.jsx)(`mesh`,{position:[0,.19,0],material:t,children:(0,L.jsx)(`cylinderGeometry`,{args:[.012,.012,.05,6]})})]})}function oe({m:e}){let t=(0,I.useMemo)(()=>new u({color:new r(2.4,1.45,.72),toneMapped:!0}),[]);return(0,L.jsxs)(`group`,{children:[(0,L.jsx)(`mesh`,{"rotation-x":-Math.PI/2,position:[.2,0,1.6],material:e.floorMat,receiveShadow:!0,children:(0,L.jsx)(`planeGeometry`,{args:[5.6,3.6]})}),(0,L.jsx)(`mesh`,{position:[.2,1.35,0],material:e.wallMat,receiveShadow:!0,children:(0,L.jsx)(`planeGeometry`,{args:[5.6,2.7]})}),(0,L.jsx)(`mesh`,{position:[.2,2.7,1.6],"rotation-x":Math.PI/2,material:e.paintMat,children:(0,L.jsx)(`planeGeometry`,{args:[5.6,3.6]})}),(0,L.jsx)(`mesh`,{position:[2.6,1.35,1.6],"rotation-y":-Math.PI/2,material:e.wallMat,receiveShadow:!0,children:(0,L.jsx)(`planeGeometry`,{args:[3.6,2.7]})}),[[z.z0/2,1.35,z.z0,2.7],[(z.z1+3.4)/2,1.35,3.4-z.z1,2.7],[(z.z0+z.z1)/2,z.y0/2,z.z1-z.z0,z.y0],[(z.z0+z.z1)/2,(z.y1+2.7)/2,z.z1-z.z0,2.7-z.y1]].map(([t,n,r,i],a)=>(0,L.jsx)(`mesh`,{position:[-2.3000000000000003,n,t],material:e.wallMat,castShadow:!0,receiveShadow:!0,children:(0,L.jsx)(`boxGeometry`,{args:[.2,i,r]})},a)),[1,2].map(t=>(0,L.jsx)(`mesh`,{position:[-2.25,(z.y0+z.y1)/2,z.z0+(z.z1-z.z0)*t/3],material:e.paintMat,castShadow:!0,children:(0,L.jsx)(`boxGeometry`,{args:[.05,z.y1-z.y0,.04]})},`v`+t)),(0,L.jsx)(`mesh`,{position:[-2.25,(z.y0+z.y1)/2,(z.z0+z.z1)/2],material:e.paintMat,castShadow:!0,children:(0,L.jsx)(`boxGeometry`,{args:[.05,.045,z.z1-z.z0]})}),(0,L.jsx)(`mesh`,{position:[-2.16,z.y0-.02,(z.z0+z.z1)/2],material:e.paintMat,castShadow:!0,receiveShadow:!0,children:(0,L.jsx)(`boxGeometry`,{args:[.2,.04,z.z1-z.z0+.16]})}),(0,L.jsx)(`mesh`,{position:[-3.4000000000000004,1.6,1.5],"rotation-y":Math.PI/2,material:t,children:(0,L.jsx)(`planeGeometry`,{args:[6,4]})}),(0,L.jsx)(`mesh`,{position:[.2,.05,.01],material:e.paintMat,children:(0,L.jsx)(`boxGeometry`,{args:[5.6,.1,.02]})})]})}function se({m:e}){let t=(0,I.useRef)(null),n=(0,I.useRef)(null),{tl:i,st:a}=(0,I.useMemo)(()=>{let e=V[U.shelf]+.0125+U.h/2,t=B.d-.02-U.d/2,n={x:U.x,y:e,z:t,rx:0,ry:0,rz:0,yaw:0},r=E.timeline({paused:!0});return r.to(n,{z:t+.09,yaw:.05,duration:.24,ease:`power2.inOut`}).to(n,{z:t+.13,rz:.03,duration:.08,ease:`power1.in`}).to(n,{rx:.55,y:e+.01,z:t+.16,duration:.12,ease:`power2.in`}).to(n,{rx:Math.PI/2+.05,ry:Math.PI/2-.12,rz:0,yaw:.3,y:U.w/2+.002,z:.78,x:U.x+.06,duration:.36,ease:`power2.in`}).to(n,{y:U.w/2+.018,ry:Math.PI/2-.22,duration:.08,ease:`power2.out`}).to(n,{y:U.w/2+.001,rx:Math.PI/2,ry:Math.PI/2,yaw:.42,duration:.12,ease:`bounce.out`}),{tl:r,st:n}},[]),o=(0,I.useMemo)(()=>new r(`#5e2a22`),[]),s=(0,I.useMemo)(()=>N(F[P(U.w)]),[]),c=(0,I.useMemo)(()=>{let t=e.cover.clone();t.color=o;let n=Y(e.spines[0].map);return n.color=o,[t,n,e.pages]},[e,o]);return j(`shelf`,({p:e})=>{i.progress(K(.3,.47,e)**1);let r=t.current,o=n.current;o.position.set(a.x,a.y,a.z),o.rotation.set(0,a.yaw,0),r.rotation.set(a.rx,a.ry,a.rz),$.copy(o.position)}),(0,L.jsx)(`group`,{ref:n,children:(0,L.jsx)(`mesh`,{ref:t,geometry:s,material:c,castShadow:!0,receiveShadow:!0,scale:[U.w,U.h,U.d]})})}function ce({u:e}){let{alpha:r,width:i}=(0,I.useMemo)(()=>{let e=1024,t=document.createElement(`canvas`);t.width=e,t.height=512;let n=t.getContext(`2d`);n.fillStyle=`#000`,n.fillRect(0,0,e,512);let r=M(5),i=16*G.pitch;for(let t=0;t<16;t++){let a=(t+.5)*G.pitch/i,o=(W[t]===`1`?.036:.012)/i;for(let i=0;i<9e3*(W[t]===`1`?2:1);i++){let t=(a+(r()+r()+r()-1.5)/1.5*o*.7)*e,i=r()*512;n.fillStyle=`rgba(255,255,255,${.25+r()*.5})`,n.fillRect(t,i,1+r()*1.5,1+r()*1.5)}}let a=new te(t);return a.colorSpace=``,{alpha:a,width:i}},[]),a=(0,I.useMemo)(()=>{let e=new o({color:`#cdbb9c`,roughness:1,alphaMap:r,transparent:!0,opacity:0,depthWrite:!1});return e.polygonOffset=!0,e.polygonOffsetFactor=-2,e},[r]),s=y?1200:3200,l=(0,I.useMemo)(()=>{let t=M(8),r=new Float32Array(s*3),i=new Float32Array(s);for(let e=0;e<s;e++){let n=Math.floor(t()*16),a=W[n]===`1`?.03:.01;r[e*3]=G.x0+(n+.5)*G.pitch+(t()-.5)*a,r[e*3+1]=t()*2.6,r[e*3+2]=G.z0+t()*(G.z1-G.z0),i[e]=t()}let a=new n;return a.setAttribute(`position`,new c(r,3)),a.setAttribute(`aR`,new c(i,1)),{g:a,m:new D({uniforms:{...e,uFall:{value:0},uPx:{value:800}},vertexShader:q+`
        attribute float aR;
        uniform float uTime;
        uniform float uFall;
        uniform float uPx;
        varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y - uTime * (0.35 + aR * 0.3), 2.6);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(0.004 * uPx / -mv.z, 1.0, 4.0);
          vA = windowLit(p) * uFall * step(aR, uFall) * (0.4 + 0.6 * aR);
        }`,fragmentShader:`
        varying float vA;
        void main() {
          if (vA < 0.01) discard;
          float d = length(gl_PointCoord - 0.5) * 2.0;
          gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * 2.2 * vA * (1.0 - d * d), 1.0);
        }`,transparent:!0,depthWrite:!1,blending:2})}},[e,s]),u=A(e=>e.size);return j(`shelf`,({p:e})=>{a.opacity=K(.58,.88,e)*.85,l.m.uniforms.uFall.value=K(.52,.62,e)*(1-K(.9,.98,e)*.7),l.m.uniforms.uPx.value=u.height/(2*Math.tan(t.degToRad(d.fov)/2))}),(0,L.jsxs)(L.Fragment,{children:[(0,L.jsx)(`mesh`,{"rotation-x":-Math.PI/2,position:[G.x0+i/2,.002,(G.z0+G.z1)/2],material:a,receiveShadow:!0,children:(0,L.jsx)(`planeGeometry`,{args:[i,G.z1-G.z0]})}),(0,L.jsx)(`points`,{geometry:l.g,material:l.m,frustumCulled:!1})]})}function le({u:e}){let{gl:t,scene:n,camera:r,size:a}=A(),o=y?.35:.5,{rt:s,mat:c,occl:l}=(0,I.useMemo)(()=>{let n=Math.max(2,Math.floor(a.width*t.getPixelRatio()*o)),r=Math.max(2,Math.floor(a.height*t.getPixelRatio()*o)),s=new O(n,r,{depthBuffer:!0});return s.depthTexture=new x(n,r),{rt:s,mat:new D({uniforms:{...e,uDepth:{value:s.depthTexture},uProjInv:{value:new i},uCamWorld:{value:new i},uNear:{value:.1},uFar:{value:100},uIntensity:{value:1},uSteps:{value:y?18:30}},vertexShader:`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,fragmentShader:_+q+`
        uniform sampler2D uDepth;
        uniform mat4 uProjInv;
        uniform mat4 uCamWorld;
        uniform float uNear;
        uniform float uFar;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uSteps;
        varying vec2 vUv;
        void main() {
          float z = texture2D(uDepth, vUv).r;
          vec4 clip = vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
          vec4 view = uProjInv * clip;
          view /= view.w;
          vec3 ro = (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec3 hit = (uCamWorld * vec4(view.xyz, 1.0)).xyz;
          vec3 rd = hit - ro;
          float tEnd = min(length(rd), 7.0);
          rd = normalize(rd);
          float stepL = tEnd / uSteps;
          // дизеринг старта — полосы шагов превращаются в незаметный шум
          float j = hash12(gl_FragCoord.xy + fract(uTime * 7.0) * 100.0);
          float acc = 0.0;
          for (int i = 0; i < 40; i++) {
            if (float(i) >= uSteps) break;
            vec3 p = ro + rd * (float(i) + j) * stepL;
            float lit = windowLit(p);
            if (lit > 0.0) {
              // пыль в воздухе неравномерна и медленно дрейфует
              float dust = 0.45 + 0.55 * vnoise(p * 3.2 + vec3(uTime * 0.05, -uTime * 0.02, 0.0));
              acc += lit * dust;
            }
          }
          acc *= stepL;
          // рассеяние вперёд: против света лучи ярче
          float ph = 0.3 + 0.9 * pow(max(dot(-rd, uL), 0.0), 4.0);
          vec3 col = vec3(1.0, 0.72, 0.45) * acc * ph * 0.55 * uIntensity;
          gl_FragColor = vec4(col, 1.0);
        }`,transparent:!0,depthTest:!1,depthWrite:!1,blending:2}),occl:new u({colorWrite:!1})}},[t,a,e,o]);(0,I.useEffect)(()=>()=>{s.depthTexture?.dispose(),s.dispose(),c.dispose()},[s,c]);let d=(0,I.useRef)(null),f=()=>{let e=r,i=d.current;i.visible=!1;let a=n.overrideMaterial,o=t.shadowMap.autoUpdate;t.shadowMap.autoUpdate=!1,n.overrideMaterial=l;let u=t.getRenderTarget();t.setRenderTarget(s),t.clear(!0,!0,!1),t.render(n,e),t.setRenderTarget(u),n.overrideMaterial=a,t.shadowMap.autoUpdate=o,i.visible=!0,c.uniforms.uProjInv.value.copy(e.projectionMatrixInverse),c.uniforms.uCamWorld.value.copy(e.matrixWorld)};return de(f),(0,I.useEffect)(()=>(w.set(`shelf`,f),()=>{w.delete(`shelf`)})),(0,L.jsx)(`mesh`,{ref:d,material:c,frustumCulled:!1,renderOrder:50,children:(0,L.jsx)(`planeGeometry`,{args:[2,2]})})}var ue=ee(`shelf`);function de(e){k(()=>{C.act===ue&&e()},0)}function fe({u:e}){let r=y?900:2600,{g:i,m:a}=(0,I.useMemo)(()=>{let t=M(12),i=new Float32Array(r*3),a=new Float32Array(r);for(let e=0;e<r;e++)i[e*3]=-2.1+t()*3.6,i[e*3+1]=t()*2.6,i[e*3+2]=.1+t()*2.6,a[e]=t();let o=new n;return o.setAttribute(`position`,new c(i,3)),o.setAttribute(`aR`,new c(a,1)),{g:o,m:new D({uniforms:{...e,uPx:{value:800}},vertexShader:q+`
        attribute float aR;
        uniform float uTime;
        uniform float uPx;
        varying float vA;
        varying float vB;
        void main() {
          vec3 p = position;
          // броуновское парение: медленный дрейф вниз и в стороны
          p += vec3(sin(uTime * 0.21 + aR * 50.0), sin(uTime * 0.17 + aR * 31.0) - uTime * 0.01, cos(uTime * 0.19 + aR * 17.0)) * 0.05;
          p.y = mod(p.y, 2.6);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float z = -mv.z;
          float coc = clamp(abs(z - 2.2) * 2.5, 0.0, 9.0);
          gl_PointSize = clamp(0.003 * uPx / z + coc, 1.0, 22.0);
          vB = coc;
          vA = windowLit(p) * (0.4 + 0.6 * aR);
        }`,fragmentShader:`
        varying float vA;
        varying float vB;
        void main() {
          if (vA < 0.01) discard;
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = mix(exp(-d * d * 6.0), smoothstep(1.0, 0.8, d) * 0.5, clamp(vB / 6.0, 0.0, 1.0));
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.6) * 1.8 * vA * a / (1.0 + vB * 0.35), 1.0);
        }`,transparent:!0,depthWrite:!1,blending:2})}},[e,r]),o=A(e=>e.size);return j(`shelf`,()=>{a.uniforms.uPx.value=o.height/(2*Math.tan(t.degToRad(d.fov)/2))}),(0,L.jsx)(`points`,{geometry:i,material:a,frustumCulled:!1})}function pe({u:e}){let t=(0,I.useRef)(null),n=(0,I.useMemo)(()=>new a,[]);(0,I.useEffect)(()=>{let e=t.current;e.target=n,e.shadow.mapSize.set(y?1024:2048,y?1024:2048);let r=e.shadow.camera;r.left=-2.6,r.right=2.6,r.top=2.4,r.bottom=-2.4,r.near=.5,r.far=12,r.updateProjectionMatrix(),e.shadow.bias=-4e-4,e.shadow.normalBias=.015,e.shadow.radius=4},[n]);let r=(0,I.useMemo)(()=>new S,[]);return j(`shelf`,()=>{r.copy(H).applyAxisAngle(new S(0,1,0),-C.pointer.sx*.07).applyAxisAngle(new S(0,0,1),C.pointer.sy*.05).normalize(),e.uL.value.copy(r),n.position.set(.4,.4,.6),t.current.position.copy(n.position).addScaledVector(r,-6)}),(0,L.jsxs)(L.Fragment,{children:[(0,L.jsx)(`primitive`,{object:n}),(0,L.jsx)(`directionalLight`,{ref:t,castShadow:!0,intensity:5.2,color:`#ffd2a0`}),(0,L.jsx)(`hemisphereLight`,{args:[`#6b6a72`,`#2a1c12`,.35]}),(0,L.jsx)(`pointLight`,{position:[.5,.25,.9],intensity:.9,distance:4.5,decay:2,color:`#ffb070`}),(0,L.jsx)(`pointLight`,{position:[1.5,1.8,2.8],intensity:.25,distance:5,decay:2,color:`#8a90a8`})]})}var Z=[[0,[1.6,1.5,3.4],[-1.6,1.45,1.3]],[.16,[1.45,1.42,3.1],[-1,1.25,.9]],[.3,[1.25,1.22,2.55],[.3,.95,.2]],[.44,[1.05,.95,2.25],[.42,.55,.45]],[.56,[.95,1.35,2.2],[.45,.12,.75]],[.8,[.72,2.1,1.95],[.5,0,.95]],[1,[.66,2.4,1.8],[.5,0,.95]]],Q={pos:new l(Z.map(e=>new S(...e[1]))),look:new l(Z.map(e=>new S(...e[2])))};function me(e){for(let t=0;t<Z.length-1;t++){let[n]=Z[t],[r]=Z[t+1];if(e<=r){let i=(e-n)/(r-n),a=i*i*(3-2*i);return(t+a)/(Z.length-1)}}return 1}var $=new S;function he(){let e=J(),t=(0,I.useMemo)(()=>({uL:{value:H.clone()},uTime:{value:0}}),[]),n=m([{pos:[-4,1.6,.3],size:[1.2,1.4],color:`#ffcf98`,intensity:6},{pos:[2,3,3],size:[4,2],color:`#8088a0`,intensity:.6},{pos:[0,-2,0],size:[5,5],color:`#3a2616`,intensity:.6}],`#0c0907`,`shelf`,.35);return j(`shelf`,({p:e,t:r,state:i})=>{i.scene.environment=n,i.scene.environmentIntensity=.35;let a=me(e);Q.pos.getPoint(a,d.pos),Q.look.getPoint(a,d.look);let o=K(.3,.38,e)*(1-K(.5,.6,e))*.55;d.look.lerp($,o),T.focus.copy(d.look).lerp($,K(.28,.34,e)*(1-K(.5,.58,e))),T.focusRange=2.2,T.bokeh=1.2,d.fov=38,d.near=.03,d.far=30,d.shake=.006,t.uTime.value=r,T.bloom=1}),(0,L.jsxs)(L.Fragment,{children:[(0,L.jsx)(pe,{u:t}),(0,L.jsx)(oe,{m:e}),(0,L.jsx)(ie,{m:e}),(0,L.jsx)(re,{m:e}),(0,L.jsx)(ae,{}),(0,L.jsx)(se,{m:e}),(0,L.jsx)(ce,{u:t}),(0,L.jsx)(fe,{u:t}),(0,L.jsx)(le,{u:t})]})}export{$ as bookPos,he as default,Y as spineMaterial};