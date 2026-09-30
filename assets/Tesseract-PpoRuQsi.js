import{E as e,I as t,L as n,O as r,S as i,Z as a,_ as o,b as s,dt as c,ft as l,h as u,lt as d,m as f,p,tt as m,x as h}from"./index-Rph-gfxM.js";import{t as g}from"./useScrollScene-C_OY7xky.js";import{r as _,t as v}from"./BufferGeometryUtils-DJ9BSjAh.js";import{n as y,r as b,t as x}from"./book-CX2gYFy2.js";var S=l(c(),1),C=s(),w=new d(2.6,2.2,2.6),T=u?new d(5,5,7):new d(9,9,11),E=[`#7a3322`,`#314a33`,`#24324d`,`#8a6436`,`#57283b`,`#474740`,`#9a8358`,`#2a4848`,`#6d4722`,`#3a302a`,`#b48c52`,`#4c3622`],D=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};function O(){let t=_(606),n=[],r=(e,t,r,a,o,s)=>{e.translate(a,o,s);let c=e.attributes.position.count,l=new Float32Array(c*3),u=new Float32Array(c);for(let e=0;e<c;e++)l[e*3]=t.r,l[e*3+1]=t.g,l[e*3+2]=t.b,u[e]=r;e.setAttribute(`color`,new i(l,3)),e.setAttribute(`aPart`,new i(u,1)),n.push(e.index?e.toNonIndexed():e)},o=x.map(e=>y(e,5)),s=(e,t,r,a,s,c,l,u)=>{let d=o[b(e)].clone(),f=new Float32Array(d.attributes.position.count).fill(1),p=d.groups[2];for(let e=p.start;e<p.start+p.count;e++)f[e]=2;d.clearGroups(),d.scale(e,t,r),u&&d.rotateY(Math.PI),d.translate(s,c,l);let m=new Float32Array(f.length*3);for(let e=0;e<f.length;e++)m[e*3]=a.r,m[e*3+1]=a.g,m[e*3+2]=a.b;d.setAttribute(`color`,new i(m,3)),d.setAttribute(`aPart`,new i(f,1)),n.push(d)},c=new e(`#3d2716`);r(new h(w.x,.05,.42),c,0,0,-w.y/2+.05,0),r(new h(.05,w.y,.42),c,0,-w.x/2+.025,0,0);let l=-w.x/2+.07;for(;l<w.x/2-.06;){let n=.025+t()**1.6*.06,r=.22+t()*.16,i=.18+t()*.1,a=new e(E[Math.floor(t()*E.length)]).multiplyScalar(.7+t()*.5);if(t()<.07){l+=.05+t()*.08;continue}s(n,r,i,a,l+n/2,-w.y/2+.075+r/2,(t()-.5)*.04,t()<.55),l+=n+.002}return r(new a(w.x-.1,.4),new e(1,.8,.5),3,0,-w.y/2+.28,-.22),v(n)}function k(){let r=_(77),i=u?5:9,a=new h(1,1,1),o=new n;o.index=a.index,o.setAttribute(`position`,a.attributes.position),o.setAttribute(`normal`,a.attributes.normal);let s=T.x*T.y*i,c=new Float32Array(s*3),l=new Float32Array(s*4),d=new Float32Array(s*3),f=0;for(let t=0;t<T.x;t++)for(let n=0;n<T.y;n++)for(let a=0;a<i;a++){c[f*3]=t,c[f*3+1]=n,c[f*3+2]=0,l[f*4]=(r()-.5)*w.x*.95,l[f*4+1]=-w.y/2+.1+r()*.32,l[f*4+2]=.008+r()*.03,l[f*4+3]=r();let i=new e(E[Math.floor(r()*E.length)]);d[f*3]=i.r,d[f*3+1]=i.g,d[f*3+2]=i.b,f++}return o.setAttribute(`aBase`,new t(c,3)),o.setAttribute(`aOff`,new t(l,4)),o.setAttribute(`aCol`,new t(d,3)),o.instanceCount=s,o}function A(){let e=new r(1,1,1,5,64,!0);e.rotateZ(Math.PI/2);let i=new n;i.index=e.index,i.setAttribute(`position`,e.attributes.position),i.setAttribute(`normal`,e.attributes.normal);let a=T.y*T.z,o=new Float32Array(a*3),s=0;for(let e=0;e<T.y;e++)for(let t=0;t<T.z;t++)o[s*3]=0,o[s*3+1]=e,o[s*3+2]=t,s++;return i.setAttribute(`aBase`,new t(o,3)),i.instanceCount=a,i}var j=`
uniform vec3 uCell;
uniform vec3 uGrid;
uniform vec3 uCamCell;
vec3 wrapCell(vec3 base) {
  vec3 c = base - uCamCell;
  c = mod(c + floor(uGrid * 0.5), uGrid) - floor(uGrid * 0.5) + uCamCell;
  return c;
}
`,M=`
uniform float uTime;
uniform vec3 uFogCol;
uniform float uFog;
uniform float uFocus;
vec3 fogIt(vec3 col, float dist) {
  return mix(col, uFogCol, 1.0 - exp(-dist * uFog));
}
`;function N(){let r=(0,S.useMemo)(()=>({uCell:{value:w},uGrid:{value:T},uCamCell:{value:new d},uTime:{value:0},uFogCol:{value:new e(.02,.018,.022)},uFog:{value:.07},uFocus:{value:0},uShiver:{value:0},uFocusCell:{value:new d}}),[]),{cells:i,cellMat:a,strands:s,strandMat:c,strings:l,stringMat:u}=(0,S.useMemo)(()=>{let e=O(),i=new n;i.index=e.index;for(let t of Object.keys(e.attributes))i.setAttribute(t,e.attributes[t]);let a=T.x*T.y*T.z,o=new Float32Array(a*3),s=0;for(let e=0;e<T.x;e++)for(let t=0;t<T.y;t++)for(let n=0;n<T.z;n++)o[s*3]=e,o[s*3+1]=t,o[s*3+2]=n,s++;return i.setAttribute(`aBase`,new t(o,3)),i.instanceCount=a,{cells:i,cellMat:new m({uniforms:r,vertexColors:!0,vertexShader:j+`
        attribute vec3 aBase;
        attribute float aPart;
        uniform vec3 uFocusCell;
        varying vec3 vCol;
        varying vec3 vN;
        varying vec3 vW;
        varying float vPart;
        varying float vHash;
        varying float vFocus;
        varying vec2 vUv;
        float h13(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
        void main() {
          vec3 cell = wrapCell(aBase);
          vec3 wp = position + cell * uCell;
          vW = wp;
          vN = normal;
          vCol = color;
          vPart = aPart;
          vUv = uv;
          vHash = h13(cell);
          vFocus = step(distance(cell, uFocusCell), 0.1);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,fragmentShader:M+`
        varying vec3 vCol;
        varying vec3 vN;
        varying vec3 vW;
        varying float vPart;
        varying float vHash;
        varying float vFocus;
        varying vec2 vUv;
        void main() {
          vec3 N = normalize(vN);
          float dist = distance(cameraPosition, vW);
          // свет изнутри комнаты: тёплый из-за полки (+z), холодный отражённый спереди
          vec3 key = vec3(1.0, 0.72, 0.42) * (0.35 + 0.65 * max(dot(N, normalize(vec3(0.2, 0.5, 1.0))), 0.0));
          vec3 fill = vec3(0.25, 0.32, 0.5) * max(dot(N, normalize(vec3(-0.3, -0.2, -1.0))), 0.0) * 0.6;
          vec3 base = vCol;
          if (vPart > 1.5 && vPart < 2.5) {
            // срез страниц: пожелтевшая бумага, тонкие листы поперёк
            float sheet = 0.82 + 0.18 * step(0.35, fract(vUv.x * 48.0 + vHash * 3.0));
            base = vec3(0.6, 0.52, 0.38) * sheet;
          }
          vec3 col = base * (key * 1.1 + fill);
          // у каждой ячейки — свой момент времени: одни комнаты светлее, другие в сумерках
          float moment = 0.45 + 0.55 * vHash;
          col *= moment;
          if (vPart > 2.5) {
            // щель света, в «той самой» комнате — ярче и дышит
            float breathe = 0.85 + 0.15 * sin(uTime * (0.6 + vHash) + vHash * 20.0);
            // мягкое свечение: ярче к середине щели, края тают — не плоская белая плашка
            float v = pow(sin(3.14159 * clamp(vUv.y, 0.0, 1.0)), 1.5);
            float hx = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
            col = vec3(1.0, 0.62, 0.3) * (0.5 + 1.1 * vHash) * breathe * v * hx;
            col *= 1.0 + vFocus * uFocus * 4.0;
          }
          col += vec3(1.0, 0.75, 0.45) * vFocus * uFocus * 0.4;
          gl_FragColor = vec4(fogIt(col, dist), 1.0);
        }`}),strands:k(),strandMat:new m({uniforms:r,vertexShader:j+`
        attribute vec3 aBase;
        attribute vec4 aOff;
        attribute vec3 aCol;
        varying vec3 vCol;
        varying vec3 vW;
        varying float vGlow;
        varying float vZ;
        void main() {
          vec3 cell = wrapCell(vec3(aBase.xy, 0.0));
          float len = uGrid.z * uCell.z;
          vec3 p = position;
          p.x *= aOff.z;
          p.y *= aOff.z * 1.4;
          p.z *= len;
          vec3 wp = vec3(cell.x * uCell.x + aOff.x, cell.y * uCell.y + aOff.y, cameraPosition.z) + p;
          vW = wp;
          vCol = aCol;
          vGlow = aOff.w;
          vZ = p.z / len;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,fragmentShader:M+`
        varying vec3 vCol;
        varying vec3 vW;
        varying float vGlow;
        varying float vZ;
        void main() {
          float dist = distance(cameraPosition, vW);
          // нить мерцает бегущими вдоль оси времени импульсами
          float pulse = pow(0.5 + 0.5 * sin(vW.z * 1.3 + uTime * 2.2 + vGlow * 30.0), 8.0);
          vec3 col = vCol * (0.6 + 1.4 * vGlow) + vec3(1.0, 0.75, 0.45) * pulse * vGlow * 1.6;
          gl_FragColor = vec4(fogIt(col, dist), 1.0);
        }`}),strings:A(),stringMat:new m({uniforms:r,vertexShader:j+`
        attribute vec3 aBase;
        uniform float uShiver;
        uniform float uTime;
        varying vec3 vW;
        varying float vA;
        void main() {
          vec3 cell = wrapCell(vec3(0.0, aBase.yz));
          float len = uGrid.x * uCell.x;
          vec3 p = position;
          float x = p.x * len;
          // стоячая волна на струне: амплитуда — от скорости курсора
          float wave = sin(x * 0.9 - uTime * 7.0 + cell.z * 1.7) * uShiver * 0.06;
          vec3 wp = vec3(cameraPosition.x + x, cell.y * uCell.y + CELL_Y_EDGE + wave + p.y * 0.006, cell.z * uCell.z + CELL_Z_EDGE + p.z * 0.006);
          vW = wp;
          vA = 1.0;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`.replace(`CELL_Y_EDGE`,(w.y/2).toFixed(3)).replace(`CELL_Z_EDGE`,(w.z/2).toFixed(3)),fragmentShader:M+`
        uniform float uShiver;
        varying vec3 vW;
        varying float vA;
        void main() {
          float dist = distance(cameraPosition, vW);
          vec3 col = vec3(1.0, 0.78, 0.45) * (1.6 + uShiver * 2.0);
          gl_FragColor = vec4(fogIt(col, dist), 1.0);
        }`})}},[r]);(0,S.useEffect)(()=>()=>{[i,s,l].forEach(e=>e.dispose()),[a,c,u].forEach(e=>e.dispose())},[i,s,l,a,c,u]);let h=(0,S.useMemo)(()=>({x:0,y:0,lx:0,ly:0,speed:0}),[]);return g(`tesseract`,({p:e,t,dt:n})=>{let i=1-Math.exp(-n*1.6),a=f.pointer.x*w.x*1.4,s=f.pointer.y*w.y*1.1,c=(a-h.x)*i,l=(s-h.y)*i;h.x+=c,h.y+=l,h.speed+=(Math.min(1,Math.hypot(c,l)*18)-h.speed)*(1-Math.exp(-n*5));let u=1-D(0,.14,e),d=-e*26-u*u*18;o.ownPointer=!0,o.pos.set(h.x+Math.sin(t*.21)*.15,h.y+.35+Math.sin(t*.17)*.1,d),h.lx+=(f.pointer.x*1.2-h.lx)*i,h.ly+=(f.pointer.y*.8-h.ly)*i,o.look.set(o.pos.x+h.lx,o.pos.y+h.ly-.15,d-6),o.fov=55+u*25,o.near=.05,o.far=80,o.shake=.006,o.roll=Math.sin(t*.1)*.03+h.lx*-.04,r.uTime.value=t,r.uCamCell.value.set(Math.floor(o.pos.x/w.x+.5),Math.floor(o.pos.y/w.y+.5),Math.floor(o.pos.z/w.z+.5)),r.uShiver.value=h.speed,r.uFocus.value=D(.58,.66,e)*(1-D(.93,1,e)),r.uFocusCell.value.set(r.uCamCell.value.x,r.uCamCell.value.y,r.uCamCell.value.z-2),r.uFog.value=.075+u*.25,p.bloom=1.1+r.uFocus.value*.4}),(0,C.jsxs)(C.Fragment,{children:[(0,C.jsx)(`mesh`,{geometry:i,material:a,frustumCulled:!1}),(0,C.jsx)(`mesh`,{geometry:s,material:c,frustumCulled:!1}),(0,C.jsx)(`mesh`,{geometry:l,material:u,frustumCulled:!1})]})}export{N as default};