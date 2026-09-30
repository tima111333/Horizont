import{B as e,C as t,D as n,E as r,F as i,H as a,I as o,J as s,L as c,O as l,R as u,S as d,T as f,Z as p,_ as m,b as h,dt as g,f as _,ft as v,h as y,j as b,lt as x,nt as S,p as C,tt as w,x as T}from"./index-Rph-gfxM.js";import{t as E}from"./useScrollScene-C_OY7xky.js";import{n as D,r as O,t as k}from"./BufferGeometryUtils-DJ9BSjAh.js";var A=v(g(),1),j=h(),M=120,N=1400,P=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},F=`
uniform float uWhite;
uniform float uDusk;   // к титрам станция уходит в вечер
vec3 haze(vec3 col, vec3 wp) {
  vec3 v = wp - cameraPosition;
  float d = length(v);
  // у оси воздух светлее — там солнце
  float f = 1.0 - exp(-d * 0.0018);
  vec3 hz = mix(vec3(0.5, 0.64, 0.8), vec3(0.9, 0.9, 0.84), smoothstep(40.0, 0.0, length(wp.xy)) * 0.6);
  vec3 dusk = vec3(0.16, 0.12, 0.13);
  hz = mix(hz, dusk, uDusk);
  col *= mix(vec3(1.0), vec3(0.42, 0.34, 0.3), uDusk);
  col = mix(col, hz, clamp(f, 0.0, 1.0));
  return mix(col, vec3(0.95, 0.96, 0.97), uWhite);
}
`;function I({u:e}){let t=(0,A.useMemo)(()=>new w({uniforms:e,vertexShader:`
          varying vec3 vW;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,fragmentShader:_+F+`
          uniform float uTime;
          varying vec3 vW;
          float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
          void main() {
            float th = atan(vW.y, vW.x);
            vec2 s = vec2(th * ${M.toFixed(1)}, vW.z);    // развёртка поверхности, метры
            // наделы: сетка 34×46 м, повёрнутая и слегка искажённая
            vec2 q = s + vec2(snoise(vec3(s * 0.004, 1.0)), snoise(vec3(s * 0.004, 7.0))) * 18.0;
            vec2 cell = floor(q / vec2(34.0, 46.0));
            vec2 f = fract(q / vec2(34.0, 46.0));
            float r = h12(cell);
            vec3 crop;
            if (r < 0.3) crop = vec3(0.1, 0.2, 0.05);            // зелёное поле
            else if (r < 0.55) crop = vec3(0.5, 0.38, 0.13);      // пшеница — снова растёт
            else if (r < 0.7) crop = vec3(0.22, 0.15, 0.09);      // пашня
            else if (r < 0.85) crop = vec3(0.16, 0.26, 0.08);
            else crop = vec3(0.07, 0.14, 0.05);                   // сады
            // рядки посева внутри надела
            // рядки посева: заметны вблизи, вдали сходят на нет (иначе муар)
            float rowFade = exp(-length(vW - cameraPosition) * 0.012);
            float rows = 1.0 - (0.05 + 0.08 * rowFade) + (0.05 + 0.08 * rowFade) * sin((r > 0.5 ? f.x : f.y) * 90.0);
            crop *= rows * (0.85 + 0.3 * vnoise(vec3(s * 0.08, 2.0)));
            // межи
            vec2 e = min(f, 1.0 - f);
            crop = mix(vec3(0.2, 0.2, 0.14), crop, smoothstep(0.0, 0.03, min(e.x, e.y)));
            // дороги вдоль оси и кольцевые
            float road = 1.0 - smoothstep(1.4, 2.4, abs(mod(s.x + 60.0, 190.0) - 95.0));
            road = max(road, 1.0 - smoothstep(1.2, 2.2, abs(mod(s.y, 240.0) - 120.0)));
            crop = mix(crop, vec3(0.42, 0.4, 0.36), road);
            // река петляет вдоль станции
            float river = abs(s.x - 40.0 - 55.0 * sin(s.y * 0.006) - 20.0 * sin(s.y * 0.017));
            float water = 1.0 - smoothstep(5.0, 7.5, river);
            crop = mix(crop, vec3(0.08, 0.16, 0.2), water);
            crop += vec3(0.25, 0.3, 0.32) * water * pow(vnoise(vec3(s * 0.3, uTime * 0.4)), 4.0);
            // свет от оси падает почти вертикально — поверхность ровно освещена
            vec3 col = crop * 1.35;
            // окна домов зажигаются к вечеру
            float lamp = step(0.995, h12(floor(s * 0.35))) * (1.0 - water) * uDusk;
            col += vec3(2.2, 1.4, 0.6) * lamp;
            gl_FragColor = vec4(haze(col, vW), 1.0);
          }`,side:1}),[e]);return(0,j.jsx)(`mesh`,{material:t,"rotation-x":Math.PI/2,frustumCulled:!1,children:(0,j.jsx)(`cylinderGeometry`,{args:[M,M,N,256,32,!0]})})}var L=(e,t,n)=>{let r=Math.sin(e*12.9898+t*78.233+n*37.719)*43758.5453;return r-Math.floor(r)};function R(e,n,r){let i=new t;i.setAttribute(`position`,e.attributes.position),i.setAttribute(`normal`,e.attributes.normal),e.index&&i.setIndex(e.index);let a=i.attributes.position,o=new Float32Array(a.count).fill(n),s=new Float32Array(a.count);for(let e=0;e<a.count;e++)s[e]=r(a.getX(e),a.getY(e),a.getZ(e));return i.setAttribute(`aPart`,new d(o,1)),i.setAttribute(`aAO`,new d(s,1)),i}var z=e=>{let n=new t;return n.setAttribute(`position`,e.attributes.position),n.setAttribute(`normal`,e.attributes.normal),e.index&&n.setIndex(e.index),n.index?n:D(n)};function B(){let e=O(31),t=[R(new l(.16,.28,2.4,6,1).translate(0,1.2,0),2,(e,t)=>.55+t*.15)];for(let n=0;n<3;n++){let r=1.35-n*.2+e()*.25,a=z(new i(r,1)),o=a.attributes.position;for(let e=0;e<o.count;e++){let t=o.getX(e),r=o.getY(e),i=o.getZ(e),a=.82+.3*L(t+n,r,i);o.setXYZ(e,t*a,r*a*.9,i*a)}a.computeVertexNormals();let s=n/3*Math.PI*2+e();a.translate(Math.cos(s)*.55*(n?1:.2),3.2+n*.55,Math.sin(s)*.55*(n?1:.2)),t.push(R(a,0,(e,t,n)=>.45+.55*Math.min(1,Math.max(0,(t-2.2)/2.6))*(.7+.3*Math.min(1,Math.hypot(e,n)/1.4))))}return k(t)}function V(){let e=[R(new l(.12,.22,1.6,5,1).translate(0,.8,0),2,()=>.5)];for(let t=0;t<3;t++){let r=z(new n(1.7-t*.45,2.6-t*.3,9,2)),i=r.attributes.position;for(let e=0;e<i.count;e++){let n=i.getX(e),r=i.getZ(e),a=.85+.3*L(n,i.getY(e)+t,r);i.setX(e,n*a),i.setZ(e,r*a)}r.computeVertexNormals(),r.translate(0,2+t*1.35,0),e.push(R(r,0,(e,t)=>.4+.6*Math.min(1,Math.max(0,(t-1.2)/4.2))))}return k(e)}function H(){let e=[];e.push(R(new T(7,3.6,5).translate(0,1.8,0),0,(e,t)=>.75+t*.07));let t=new S;t.moveTo(-2.5,0),t.lineTo(0,2.1),t.lineTo(2.5,0),t.lineTo(-2.5,0);for(let n of[-3.5,3.5]){let r=new b(t,{depth:.01,bevelEnabled:!1});r.rotateY(Math.PI/2).translate(n,3.6,0),e.push(R(r,0,()=>.9))}let n=Math.atan2(2.1,2.5),r=Math.hypot(2.5,2.1)+.45;for(let t of[-1,1]){let i=new T(7.8,.14,r);i.translate(0,0,-t*r*.5),i.rotateX(-t*n),i.translate(0,5.7,0),e.push(R(i,1,()=>1))}e.push(R(new T(.6,1.6,.6).translate(1.8,5.2,-.9),0,()=>.8));for(let t of[-2.52,2.52])for(let n of[-2.4,-.8,.8,2.4])e.push(R(new T(.8,1,.06).translate(n,2.2,t),3,()=>1));return e.push(R(new T(.9,1.8,.06).translate(-1.6,.9,2.53),4,()=>1)),k(e.map(e=>e.index?e.toNonIndexed():e))}function U({u:e}){let{trees:t,houses:n,mat:i}=(0,A.useMemo)(()=>{let t=O(2067),n=H(),i=[B(),V()],o=[-345,-155,35,225],c=[-600,-360,-120,120,360,600],l=e=>40+55*Math.sin(e*.006)+20*Math.sin(e*.017),d=(e,t,n)=>o.some(t=>Math.abs(e-t)<n)||c.some(e=>Math.abs(t-e)<n),f=(e,t,n)=>Math.abs(e-l(t))<n,p=new s,m=new a,h=new x,g=new x,_=new x,v=(e,t,n,r)=>{let i=e/M;g.set(-Math.cos(i),-Math.sin(i),0);let a=new x(-Math.sin(i),Math.cos(i),0);return h.copy(n===`axis`?new x(0,0,1):a),_.crossVectors(h,g),m.makeBasis(h,g,_),p.quaternion.setFromRotationMatrix(m),p.position.set(Math.cos(i)*119.8,Math.sin(i)*119.8,t),p.scale.setScalar(r),p.updateMatrix(),p.matrix},b=[],S=[],C=y?4:7;for(let e of o)for(let t of c)if(!f(e,t,30)){S.push([e,t]);for(let n of[-1,1]){for(let r=1;r<=C;r++)for(let i of[-1,1])b.push(v(e+n*5.5,t+i*(6+r*7.5),`axis`,.5).clone());for(let r=1;r<=Math.ceil(C/2);r++)for(let i of[-1,1])b.push(v(e+i*(6+r*7.5),t+n*5.5,`ring`,.5).clone())}}let T=new u(n,void 0,b.length);b.forEach((e,n)=>{T.setMatrixAt(n,e),T.setColorAt(n,new r().setHSL(.07+t()*.05,.25,.46+t()*.2))});let E=y?4e3:12e3,D=i.map(e=>new u(e,void 0,E)),k=[0,0],A=0,j=0,P=0,I=0;for(let e=0;j<E&&e<E*6;e++){(j%24==0||e%40==0)&&(P=(t()-.5)*Math.PI*2*M,I=(t()-.5)*N*.92,A=t()<.62?0:1);let n=P+(t()-.5)*12,i=I+(t()-.5)*26;if(d(n,i,4)||f(n,i,9)||S.some(([e,t])=>Math.abs(n-e)<70&&Math.abs(i-t)<70))continue;let a=v(n,i,`axis`,.36+t()*.34),o=k[A]++;D[A].setMatrixAt(o,a),D[A].setColorAt(o,A?new r().setHSL(.36+t()*.05,.42,.07+t()*.04):new r().setHSL(.22+t()*.08,.5,.1+t()*.07)),j++}D.forEach((e,t)=>e.count=k[t]);let L=new w({uniforms:e,vertexShader:`
        attribute float aPart;
        attribute float aAO;
        varying vec3 vW;
        varying vec3 vN;
        varying vec3 vC;
        varying float vPart;
        varying float vAO;
        varying float vHash;
        void main() {
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vC = instanceColor;
          vPart = aPart;
          vAO = aAO;
          vec3 o = instanceMatrix[3].xyz;
          vHash = fract(sin(dot(o, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,fragmentShader:F+`
        varying vec3 vW;
        varying vec3 vN;
        varying vec3 vC;
        varying float vPart;
        varying float vAO;
        varying float vHash;
        void main() {
          // свет — от оси: направление к центру сечения
          vec3 L = normalize(vec3(-vW.xy, 0.0));
          vec3 N = normalize(vN);
          float d = max(dot(N, L), 0.0);
          vec3 base = vC;
          // крыши: черепица или шифер — по дому; ствол; окна и дверь
          if (vPart > 0.5 && vPart < 1.5) base = mix(vec3(0.36, 0.13, 0.08), vec3(0.2, 0.21, 0.23), step(0.62, vHash));
          else if (vPart > 1.5 && vPart < 2.5) base = vec3(0.14, 0.1, 0.07);
          else if (vPart > 2.5) base = vec3(0.04, 0.05, 0.06);
          // мягкое небо со всех сторон цилиндра + прямой свет оси
          vec3 col = base * (0.32 + 1.05 * d) * vAO;
          // окна к вечеру зажигаются — не все
          if (vPart > 2.5 && vPart < 3.5) col += vec3(2.0, 1.25, 0.55) * uDusk * step(0.3, fract(vHash * 7.3));
          gl_FragColor = vec4(haze(col, vW), 1.0);
        }`});return D.forEach(e=>{e.material=L,e.frustumCulled=!1}),T.material=L,T.frustumCulled=!1,{trees:D,houses:T,mat:L}},[e]);return(0,A.useEffect)(()=>()=>{t.forEach(e=>e.geometry.dispose()),n.geometry.dispose(),i.dispose()},[t,n,i]),(0,j.jsxs)(j.Fragment,{children:[t.map((e,t)=>(0,j.jsx)(`primitive`,{object:e},t)),(0,j.jsx)(`primitive`,{object:n})]})}function W({u:e}){let{sun:t,cap:n}=(0,A.useMemo)(()=>({sun:new w({uniforms:e,vertexShader:`
        varying vec3 vW;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,fragmentShader:F+`
        varying vec3 vW;
        varying vec2 vUv;
        void main() {
          // сегменты светильника с тонкими перемычками
          float seg = smoothstep(0.0, 0.02, fract(vUv.y * 24.0)) * smoothstep(1.0, 0.98, fract(vUv.y * 24.0));
          vec3 col = vec3(6.0, 5.6, 4.8) * (0.35 + 0.65 * seg) * mix(1.0, 0.3, uDusk) + vec3(1.2, 0.5, 0.2) * uDusk * seg;
          gl_FragColor = vec4(mix(col, vec3(0.95, 0.96, 0.97), uWhite), 1.0);
        }`}),cap:new w({uniforms:e,vertexShader:`
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,fragmentShader:F+`
        varying vec3 vW;
        void main() {
          float r = length(vW.xy) / ${M.toFixed(1)};
          float a = atan(vW.y, vW.x);
          // торец: тёмный металл, радиальные рёбра, кольцо окон к космосу
          float ribs = smoothstep(0.92, 1.0, abs(sin(a * 12.0)));
          float win = smoothstep(0.55, 0.57, r) * smoothstep(0.8, 0.78, r) * (1.0 - ribs);
          vec3 col = vec3(0.12, 0.13, 0.15) * (0.8 + 0.4 * ribs);
          col += vec3(0.02, 0.03, 0.06) * win + vec3(0.9, 0.85, 0.7) * win * step(0.97, fract(a * 40.0 / 6.283));
          gl_FragColor = vec4(haze(col, vW), 1.0);
        }`,side:2})}),[e]);return(0,j.jsxs)(j.Fragment,{children:[(0,j.jsx)(`mesh`,{material:t,"rotation-x":Math.PI/2,frustumCulled:!1,children:(0,j.jsx)(`cylinderGeometry`,{args:[1.4,1.4,N,24,1,!0]})}),[-700,N/2].map(e=>(0,j.jsx)(`mesh`,{material:n,position:[0,0,e],frustumCulled:!1,children:(0,j.jsx)(`circleGeometry`,{args:[M,96]})},e))]})}function G({u:e}){let t=y?60:130,{geo:n,mat:r}=(0,A.useMemo)(()=>{let n=O(33),r=new p(1,1),i=new c;i.index=r.index,i.setAttribute(`position`,r.attributes.position),i.setAttribute(`uv`,r.attributes.uv);let a=new Float32Array(t*4);for(let e=0;e<t;e++){let t=n()*Math.PI*2,r=62+n()*26;a[e*4]=Math.cos(t)*r,a[e*4+1]=Math.sin(t)*r,a[e*4+2]=(n()-.5)*N*.9,a[e*4+3]=10+n()*22}return i.setAttribute(`aC`,new o(a,4)),i.instanceCount=t,{geo:i,mat:new w({uniforms:e,vertexShader:`
        attribute vec4 aC;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vW;
        varying float vSeed;
        void main() {
          vUv = uv;
          vSeed = aC.w;
          vec3 center = aC.xyz + vec3(0.0, 0.0, uTime * 1.2);
          center.z = mod(center.z + ${(N/2).toFixed(1)}, ${N.toFixed(1)}) - ${(N/2).toFixed(1)};
          // билборд, развёрнутый к камере
          vec3 toCam = normalize(cameraPosition - center);
          vec3 right = normalize(cross(vec3(0.0, 0.0, 1.0), toCam));
          if (length(cross(vec3(0.0, 0.0, 1.0), toCam)) < 0.01) right = vec3(1.0, 0.0, 0.0);
          vec3 up = cross(toCam, right);
          vec3 wp = center + (right * position.x * 1.8 + up * position.y) * aC.w;
          vW = wp;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,fragmentShader:_+F+`
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vW;
        varying float vSeed;
        void main() {
          vec2 q = vUv - 0.5;
          float n = vfbm(vec3(vUv * vec2(3.0, 2.0) + vSeed, uTime * 0.02), 5);
          float shape = smoothstep(0.5, 0.15, length(q * vec2(1.0, 1.5)) - (n - 0.5) * 0.35);
          float a = shape * smoothstep(0.35, 0.6, n);
          if (a < 0.01) discard;
          // освещены со стороны оси, в тени — с земли
          float lit = 0.75 + 0.25 * smoothstep(-0.3, 0.4, q.y);
          vec3 col = vec3(1.0, 0.98, 0.95) * lit * 1.3 * mix(1.0, 0.35, uDusk);
          gl_FragColor = vec4(haze(col, vW), a * 0.85);
        }`,transparent:!0,depthWrite:!1})}},[e,t]);return(0,A.useEffect)(()=>()=>{n.dispose(),r.dispose()},[n,r]),(0,j.jsx)(`mesh`,{geometry:n,material:r,frustumCulled:!1,renderOrder:4})}var K=[[0,[0,-70,420],[0,-80,300],50],[.2,[4,-92,330],[0,-100,200],46],[.45,[10,-104,200],[-6,-86,20],50],[.7,[4,-80,120],[0,-20,-200],56],[1,[0,-44,70],[0,0,-500],62]],q={pos:new f(K.map(e=>new x(...e[1]))),look:new f(K.map(e=>new x(...e[2])))};function J(e){for(let t=0;t<K.length-1;t++){let n=K[t][0],r=K[t+1][0];if(e<=r){let i=(e-n)/(r-n);return(t+i*i*(3-2*i))/(K.length-1)}}return 1}function Y(){let t=(0,A.useMemo)(()=>({uTime:{value:0},uWhite:{value:1},uDusk:{value:0}}),[]);return E(`epilogue`,({p:n,t:r})=>{let i=J(n);q.pos.getPoint(i,m.pos),q.look.getPoint(i,m.look);let a=K[0][3];for(let t=0;t<K.length-1;t++)if(n<=K[t+1][0]){a=e.lerp(K[t][3],K[t+1][3],P(K[t][0],K[t+1][0],n));break}m.fov=a,m.near=.5,m.far=3e3,m.shake=.03,t.uTime.value=r,t.uWhite.value=1-P(0,.16,n),t.uDusk.value=P(.66,.9,n),C.bloom=.9}),(0,j.jsxs)(j.Fragment,{children:[(0,j.jsx)(I,{u:t}),(0,j.jsx)(U,{u:t}),(0,j.jsx)(W,{u:t}),(0,j.jsx)(G,{u:t})]})}export{Y as default};