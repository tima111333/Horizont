import{A as e,D as t,E as n,G as r,H as i,J as a,K as o,Q as s,T as c,_ as l,a as u,at as d,b as f,c as p,ct as m,dt as h,f as g,ft as _,h as v,i as y,l as ee,lt as b,m as x,p as S,r as C,s as w,st as te,tt as T,u as E,v as D,w as O,y as k}from"./index-Rph-gfxM.js";import{t as A}from"./useScrollScene-C_OY7xky.js";var j=_(h(),1),M=f(),N=`
uniform vec3 uSun;
uniform vec3 uC;
uniform float uR;
uniform float uRa;
uniform float uTime;
uniform float uDust;
uniform float uSpin;
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
varying vec2 vUv;

vec2 sph(vec3 ro, vec3 rd, float r) {
  vec3 oc = ro - uC;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

vec3 surface(vec3 N, vec3 V) {
  // поворот координат поверхности вокруг оси планеты
  float cs = cos(uSpin), sn = sin(uSpin);
  vec3 P = vec3(cs * N.x + sn * N.z, N.y, -sn * N.x + cs * N.z);
  float c = fbm3(P * 2.1 + 3.7) + 0.35 * fbm3(P * 7.0);
  float land = smoothstep(0.02, 0.09, c);
  float m = fbm3(P * 11.0 + 9.0) * 0.5 + 0.5;
  vec3 green = vec3(0.07, 0.1, 0.045);
  vec3 tan = mix(vec3(0.3, 0.23, 0.14), vec3(0.5, 0.38, 0.24), m);
  vec3 landC = mix(green, tan, clamp(uDust + (m - 0.5) * 0.8, 0.0, 1.0));
  vec3 ocean = vec3(0.01, 0.035, 0.08);
  vec3 alb = mix(ocean, landC, land);
  vec3 q = P * 5.0 + vec3(uTime * 0.004, 0.0, 0.0);
  float cl = smoothstep(0.05, 0.55, fbm3(q + fbm3(q * 0.6) * 0.8));
  cl = max(cl, smoothstep(0.35, 0.7, fbm3(P * 14.0 - uTime * 0.003)) * 0.55);
  float ndl = dot(N, uSun);
  float day = smoothstep(-0.12, 0.25, ndl);
  vec3 col = alb * max(ndl, 0.0) * 2.0;
  vec3 H = normalize(uSun + V);
  col += vec3(1.0, 0.85, 0.65) * pow(max(dot(N, H), 0.0), 220.0) * (1.0 - land) * (1.0 - cl) * 2.5 * day;
  col = mix(col, vec3(0.9, 0.9, 0.88) * (max(ndl, 0.0) * 2.2 + 0.01), cl);
  float city = step(0.992, hash13(floor(P * 420.0))) * land * (1.0 - day) * (1.0 - cl);
  col += vec3(1.0, 0.68, 0.32) * city * 0.9;
  return col;
}

void main() {
  vec4 view = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  view /= view.w;
  vec3 ro = (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 rd = normalize((uCamWorld * vec4(view.xyz, 1.0)).xyz - ro);
  vec2 a = sph(ro, rd, uRa);
  if (a.y < 0.0 || a.x > 1e8) discard;
  vec2 p = sph(ro, rd, uR);
  bool hit = p.x > 0.0 && p.x < 1e8;
  float t0 = max(a.x, 0.0);
  float t1 = hit ? p.x : a.y;

  // атмосфера: 10 шагов по хорде, экспоненциальная плотность по высоте.
  // Рассеянный свет насыщается (1 - e^-τ), а не растёт бесконечно на скользящих лучах.
  float H = (uRa - uR) * 0.22;
  float od = 0.0;
  vec3 lit = vec3(0.0);
  float dt = (t1 - t0) / 10.0;
  for (int i = 0; i < 10; i++) {
    vec3 x = ro + rd * (t0 + (float(i) + 0.5) * dt);
    vec3 n = x - uC;
    float h = length(n) - uR;
    float d = exp(-max(h, 0.0) / H);
    od += d * dt;
    float mu = dot(normalize(n), uSun);
    float sunL = smoothstep(-0.2, 0.15, mu);
    vec3 tint = mix(vec3(1.0, 0.38, 0.1), vec3(0.24, 0.48, 1.0), smoothstep(-0.06, 0.3, mu));
    lit += d * dt * sunL * tint;
  }
  float tau = od / (H * 6.0);
  vec3 avgTint = lit / max(od, 1e-4);
  float ph = 0.8 + 1.2 * pow(max(dot(rd, uSun), 0.0), 5.0);
  vec3 atm = avgTint * (1.0 - exp(-tau)) * 1.15 * ph;
  float ext = exp(-tau * 0.6);

  if (hit) {
    vec3 X = ro + rd * p.x;
    vec3 N = normalize(X - uC);
    vec3 col = surface(N, -rd) * ext + atm;
    gl_FragColor = vec4(col, 1.0);
  } else {
    gl_FragColor = vec4(atm, 0.0);
  }
}
`;function ne({radius:e,center:t,sun:n,dust:r=.6,time:a,spin:o}){let s=k(e=>e.camera),c=(0,j.useMemo)(()=>new T({uniforms:{uSun:{value:n},uTime:a,uSpin:o??{value:0},uC:{value:t},uR:{value:e},uRa:{value:e*1.022},uDust:{value:r},uProjInv:{value:new i},uCamWorld:{value:new i}},vertexShader:`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 1.0, 1.0);
          }`,fragmentShader:g+N,transparent:!1,depthTest:!1,depthWrite:!1,blending:5,blendSrc:201,blendDst:205}),[n,a,o,t,e,r]);return D(()=>{s.updateMatrixWorld(),c.uniforms.uProjInv.value.copy(s.projectionMatrixInverse),c.uniforms.uCamWorld.value.copy(s.matrixWorld)},0),(0,M.jsx)(`mesh`,{material:c,frustumCulled:!1,renderOrder:-8,children:(0,M.jsx)(`planeGeometry`,{args:[2,2]})})}var P=7.6,F=3.4;new i,new s,new e,new b,new b(1,1,1);var I={z0:-2.35,z1:1.35},L=-.03,R=I.z0-.16-.05,z=new b(.86,.3,-.42).normalize(),B=2e3,V=new b(0,-2128,0),H=F/2+.45+.07-R,U=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};function W(){let e=u(`endurance`);return(0,j.useMemo)(()=>({ring:C(e.ring),hub:C(e.hub)}),[e])}function G(){let e=u(`hull`),t=u(`foil`),n=u(`tiles`);return(0,j.useMemo)(()=>{let i={map:y(e.map),normal:y(e.normal),rough:y(e.rough)},a=y(t),s=y(n),c=new r({color:`#b9b8b2`,map:i.map,normalMap:i.normal,normalScale:new m(.7,.7),roughnessMap:i.rough,roughness:1,metalness:.12,clearcoat:.3,clearcoatRoughness:.35}),l=new o({color:`#d6a24a`,metalness:1,roughness:.3,normalMap:a,normalScale:new m(1.1,1.1)}),u=new o({color:`#2b2c2f`,metalness:.65,roughness:.42,normalMap:i.normal,normalScale:new m(.4,.4)}),d=new o({color:`#a9aaa6`,metalness:.2,roughness:.62,normalMap:i.normal,normalScale:new m(.3,.3)}),f=new o({color:`#000000`,emissive:`#ffcf8a`,emissiveIntensity:2.4,toneMapped:!0}),p=new o({color:`#3b3733`,metalness:.9,roughness:.33,side:2}),h=new r({color:`#07090d`,metalness:.1,roughness:.04,clearcoat:1}),g=new o({map:s,metalness:.35,roughness:.5,color:`#9aa0b0`});return s.repeat.set(2,2),{hull:c,foil:l,dark:u,panel:d,glow:f,nozzle:p,glass:h,tile:g,fire:new o({color:`#000000`,emissive:`#bcd6ff`,emissiveIntensity:.2})}},[e,t,n])}var K=(()=>{let e=null;return()=>{if(e)return e;let t=document.createElement(`canvas`);t.width=t.height=128;let n=t.getContext(`2d`),r=n.createRadialGradient(64,64,0,64,64,64);return r.addColorStop(0,`rgba(255,255,255,1)`),r.addColorStop(.15,`rgba(255,255,255,0.55)`),r.addColorStop(.45,`rgba(255,255,255,0.12)`),r.addColorStop(1,`rgba(255,255,255,0)`),n.fillStyle=r,n.fillRect(0,0,128,128),e=new O(t),e}})();function q({geos:e,mats:t,shadows:n=!0,cull:r=!0}){return(0,M.jsx)(M.Fragment,{children:Object.keys(e).map(i=>(0,M.jsx)(`mesh`,{geometry:e[i],material:t[i],castShadow:n&&i!==`glow`,receiveShadow:n&&i!==`glow`,frustumCulled:r},i))})}var J=()=>new T({uniforms:{uT:{value:0},uI:{value:0}},vertexShader:`
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,fragmentShader:g+`
      uniform float uT;
      uniform float uI;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float along = clamp(vUv.y, 0.0, 1.0);            // 1 у сопла, 0 на конце
        // у вершины конуса нормаль вырождается — без защиты NaN, и bloom чернит весь кадр
        float edge = pow(clamp(abs(dot(normalize(vN + 1e-5), normalize(vV + 1e-5))), 1e-4, 1.0), 1.5);
        float n = vnoise(vec3(vUv.x * 6.0, along * 8.0 - uT * 30.0, uT * 3.0));
        // ударные «бриллианты» у сопла — полосы яркости
        float diamonds = 0.7 + 0.3 * sin(along * 60.0 - uT * 4.0);
        float body = pow(max(along, 1e-4), 1.6) * edge * (0.6 + 0.5 * n) * diamonds;
        vec3 col = mix(vec3(1.0, 0.55, 0.25), vec3(0.55, 0.75, 1.0), along * along * along) * body;
        gl_FragColor = vec4(col * uI * 3.0, 1.0);
      }`,transparent:!0,depthWrite:!1,blending:2,side:2});function Y({spin:r,burn:a,hover:o}){let c=G(),l=W(),u=(0,j.useRef)(null),f=(0,j.useMemo)(()=>J(),[]),p=(0,j.useMemo)(()=>{let e=new t(.34,4.2,20,1,!0);return e.translate(0,-2.1,0),e},[]),m=(0,j.useMemo)(()=>{let t=[];for(let n=2;n<12;n+=3){let r=n/12*Math.PI*2,a=new i().compose(new b(Math.cos(r)*P,Math.sin(r)*P,0),new s().setFromEuler(new e(0,0,r-Math.PI/2)),new b(1,1,1));for(let n of[-.55,.55])t.push({pos:new b(n,0,-1.9).applyMatrix4(a),rot:new e(-Math.PI/2,0,0)})}return t},[]),h=c.glow,g=c.fire,_=(0,j.useMemo)(()=>new d({map:K(),color:new n(.7,.82,1),blending:2,depthWrite:!1,transparent:!0}),[]);return A(`launch`,({t:e,dt:t})=>{u.current.rotation.z=r.angle,f.uniforms.uT.value=e;let n=.9+.1*Math.sin(e*40);f.uniforms.uI.value=a.v*n,g.emissiveIntensity=.2+a.v*40*n,_.opacity=a.v,_.color.setRGB(.7*3*n,2.46*n,3*n),h.emissiveIntensity=2.4+o.v*4+a.v*1.5}),(0,M.jsxs)(`group`,{ref:u,onPointerOver:e=>{e.stopPropagation(),x.hover3d=!0,w.to(o,{v:1,duration:.6,ease:`power3.out`,overwrite:!0})},onPointerOut:()=>{x.hover3d=!1,w.to(o,{v:0,duration:.9,ease:`power3.inOut`,overwrite:!0})},children:[(0,M.jsx)(q,{geos:l.ring,mats:c}),(0,M.jsx)(q,{geos:l.hub,mats:c}),m.map((e,t)=>(0,M.jsxs)(`group`,{children:[(0,M.jsx)(`mesh`,{geometry:p,material:f,position:e.pos,rotation:e.rot,frustumCulled:!1}),(0,M.jsx)(`sprite`,{material:_,position:[e.pos.x,e.pos.y,e.pos.z-.1],scale:1.3})]},t))]})}function X({spin:e,pos:r}){let i=G(),a=u(`ranger`),o=(0,j.useMemo)(()=>C(a),[a]),s=(0,j.useRef)(null),c=(0,j.useMemo)(()=>J(),[]),l=(0,j.useMemo)(()=>{let e=new t(.16,1.6,16,1,!0);return e.translate(0,-.8,0),e},[]),f=(0,j.useMemo)(()=>new b,[]),p=(0,j.useMemo)(()=>new b,[]),m=(0,j.useMemo)(()=>new d({map:K(),color:new n(.85,.92,1),blending:2,depthWrite:!1,transparent:!0,opacity:0}),[]),h=(0,j.useMemo)(()=>new d({map:K(),color:new n(1,.9,.7),blending:2,depthWrite:!1,transparent:!0,opacity:0}),[]),g=(0,j.useMemo)(()=>Array.from({length:5},()=>m.clone()),[m]);(0,j.useEffect)(()=>()=>g.forEach(e=>e.dispose()),[g]);let _=(0,j.useRef)([]),v=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2;return A(`launch`,({p:t,t:n})=>{let i=s.current;f.set(r.x,r.y-L,r.z),p.set(f.x+2.2+Math.sin(n*.4)*.06,f.y+1+Math.sin(n*.33)*.05,f.z+10);let a=v(U(.26,.48,t)),o=U(.48,.52,t),l=U(.26,.44,t);i.position.lerpVectors(p,f,a),i.position.z+=(1-o)*.3*a,i.position.z-=Math.sin(Math.PI*U(.515,.545,t))*.025;let u=U(.5,.52,t),d=(1-l)*.02;i.rotation.set(-.06*(1-l)+Math.sin(n*.5)*d,.14*(1-l)+Math.sin(n*.37)*d,.2*(1-l)+e.angle*u);let m=U(.2,.28,t)*(1-U(.49,.51,t));_.current.forEach((e,t)=>{if(!e)return;let r=Math.sin(n*(5.3+t*1.7)+t*11.1)*Math.sin(n*(2.1+t*.9)+t*3.7);e.material.opacity=m*Math.max(0,(r-.55)/.45)});let g=Math.sin(Math.PI*U(.505,.56,t));h.opacity=g,c.uniforms.uT.value=n,c.uniforms.uI.value=0}),(0,M.jsxs)(`group`,{ref:s,children:[(0,M.jsx)(q,{geos:o,mats:i,cull:!1}),[-.42,.42].map(e=>(0,M.jsx)(`mesh`,{geometry:l,material:c,position:[e,.02,1.65],rotation:[-Math.PI/2,0,0],frustumCulled:!1},e)),[[.22,.05,-2.05],[-.22,.05,-2.05],[.62,.12,1.4],[-.62,.12,1.4],[0,.26,-1.6]].map((e,t)=>(0,M.jsx)(`sprite`,{ref:e=>_.current[t]=e,material:g[t],position:e,scale:[.5,.5,1]},t)),(0,M.jsx)(`sprite`,{material:h,position:[0,L,R-.05],scale:[2.2,2.2,1]})]})}function Z({head:e}){let{curve:t,geo:r,mat:i,sprite:a}=(0,j.useMemo)(()=>{let e=new b(-90,0,-420);e.y=V.y+Math.sqrt(B*B-e.x*e.x-e.z*e.z);let t=e.clone().sub(V).normalize(),r=new c([e,e.clone().addScaledVector(t,30),new b(-60,-70,-250),new b(-22,-18,-90),new b(-3,0,6),new b(2.5,.6,26)]);return{curve:r,geo:new te(r,400,.3,10,!1),mat:new T({uniforms:{uHead:{value:0},uT:{value:0},uFade:{value:1}},vertexShader:`
        uniform float uHead;
        varying float vAge;
        varying float vA;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float v = uv.x;
          vAge = uHead - v;
          // след расползается со временем
          float grow = 1.0 + max(vAge, 0.0) * 30.0;
          vec3 p = position + normal * 0.3 * (grow - 1.0);
          vec4 w = modelMatrix * vec4(p, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          vA = step(0.0, vAge);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,fragmentShader:`
        uniform float uFade;
        varying float vAge;
        varying float vA;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          if (vA < 0.5) discard;
          float edge = pow(clamp(abs(dot(normalize(vN + 1e-5), normalize(vV))), 1e-4, 1.0), 2.0);
          float fade = exp(-vAge * 9.0);
          vec3 hot = vec3(1.0, 0.7, 0.4) * exp(-vAge * 120.0) * 6.0;
          vec3 smoke = vec3(0.75, 0.72, 0.7) * 0.25 * fade;
          gl_FragColor = vec4((hot + smoke) * uFade * edge, 1.0);
        }`,transparent:!0,depthWrite:!1,blending:2}),sprite:new d({map:(()=>{let e=document.createElement(`canvas`);e.width=e.height=64;let t=e.getContext(`2d`),n=t.createRadialGradient(32,32,0,32,32,32);return n.addColorStop(0,`rgba(255,255,255,1)`),n.addColorStop(.2,`rgba(255,220,170,0.8)`),n.addColorStop(1,`rgba(255,160,80,0)`),t.fillStyle=n,t.fillRect(0,0,64,64),new O(e)})(),color:new n(8,6,4),blending:2,depthWrite:!1})}},[]),o=(0,j.useRef)(null);return A(`launch`,({t:n})=>{i.uniforms.uHead.value=e.v,i.uniforms.uFade.value=e.fade,i.uniforms.uT.value=n;let r=Math.min(e.v,.999);t.getPoint(r,o.current.position);let a=o.current.position.distanceTo(l.pos),s=Math.max(.6,a*.022)*+(e.v>0&&e.v<.97);o.current.scale.setScalar(s)}),(0,j.useEffect)(()=>()=>r.dispose(),[r]),(0,M.jsxs)(M.Fragment,{children:[(0,M.jsx)(`mesh`,{geometry:r,material:i,frustumCulled:!1}),(0,M.jsx)(`sprite`,{ref:o,material:a})]})}function re({follow:e}){let t=(0,j.useRef)(null),n=(0,j.useMemo)(()=>new a,[]);return(0,j.useEffect)(()=>{let e=t.current;e.target=n,e.shadow.mapSize.set(v?1024:2048,v?1024:2048);let r=e.shadow.camera;r.left=-14,r.right=14,r.top=14,r.bottom=-14,r.near=1,r.far=80,r.updateProjectionMatrix(),e.shadow.bias=-3e-4,e.shadow.normalBias=.03,e.shadow.radius=2.5},[n]),A(`launch`,()=>{n.position.copy(e),t.current.position.copy(e).addScaledVector(z,40)}),(0,M.jsxs)(M.Fragment,{children:[(0,M.jsx)(`primitive`,{object:n}),(0,M.jsx)(`directionalLight`,{ref:t,castShadow:!0,intensity:5,color:`#fff4e4`}),(0,M.jsx)(`hemisphereLight`,{args:[`#0b0d14`,`#5d7db8`,.55]})]})}var Q=[[0,[5,4,34],[-70,-95,-330],40],[.12,[4,3.5,32],[-30,-40,-140],38],[.24,[9,3,30],[1,.5,18],34],[.36,[13,4.5,22],[0,0,7],36],[.5,[10,3,15],[0,0,3],38],[.62,[21,7,7],[0,0,0],42],[.76,[18,-4,-9],[0,0,0],44],[.88,[9,3.5,-24],[0,0,6],40],[1,[6,3,-30],[0,0,30],36]],$={pos:new c(Q.map(e=>new b(...e[1]))),look:new c(Q.map(e=>new b(...e[2])))};function ie(e){for(let t=0;t<Q.length-1;t++){let n=Q[t][0],r=Q[t+1][0];if(e<=r){let i=(e-n)/(r-n);return(t+i*i*(3-2*i))/(Q.length-1)}}return 1}var ae=e=>{for(let t=0;t<Q.length-1;t++)if(e<=Q[t+1][0]){let n=U(Q[t][0],Q[t+1][0],e);return Q[t][3]+(Q[t+1][3]-Q[t][3])*n}return Q[Q.length-1][3]};function oe(){let e=(0,j.useMemo)(()=>({value:0}),[]),t=(0,j.useMemo)(()=>({value:0}),[]),n=(0,j.useMemo)(()=>({angle:0,w:0}),[]),r=(0,j.useMemo)(()=>({v:0}),[]),i=(0,j.useMemo)(()=>({v:0}),[]),a=(0,j.useMemo)(()=>({v:0,fade:1}),[]),o=(0,j.useMemo)(()=>new b,[]),s=(0,j.useMemo)(()=>new b,[]),c=(0,j.useRef)(null),u=p([{pos:z.clone().multiplyScalar(30).toArray(),size:[3,3],color:`#fff6ea`,intensity:60,shape:`disc`},{pos:[0,-30,0],size:[120,120],color:`#4d6fa8`,intensity:.9},{pos:[0,-12,-40],size:[160,14],color:`#8fb0ff`,intensity:.8}],`#000000`,`launch`,1),{gl:d}=k();return A(`launch`,({p:d,t:f,dt:p,state:m})=>{m.scene.environment=u,m.scene.environmentIntensity=1,e.value=f,t.value=f*.002;let h=ie(d);$.pos.getPoint(h,l.pos),$.look.getPoint(h,l.look),l.fov=ae(d),l.near=.1,l.far=3e4,l.shake=.012+r.v*.03+U(.02,.1,d)*(1-U(.16,.24,d))*.05,a.v=U(.02,.24,d)*.62,a.fade=1-U(.2,.32,d),s.set(0,0,H);let g=U(.56,.76,d)*.32+i.v*x.pointer.sx*.08;n.w+=(g-n.w)*(1-Math.exp(-p*1.5)),n.angle+=n.w*p,r.v=U(.8,.86,d);let _=U(.84,1,d);o.set(0,0,_*_*70),c.current.position.copy(o),l.look.z+=o.z*.85,S.bloom=1+r.v*.5+i.v*.25}),(0,M.jsxs)(M.Fragment,{children:[(0,M.jsx)(ee,{kind:`home`,intensity:.9}),(0,M.jsx)(E,{kind:`home`,count:1600,gain:.9}),(0,M.jsx)(ne,{radius:B,center:V,sun:z,dust:.6,time:e,spin:t}),(0,M.jsx)(re,{follow:o}),(0,M.jsxs)(`group`,{ref:c,children:[(0,M.jsx)(Y,{spin:n,burn:r,hover:i}),(0,M.jsx)(X,{spin:n,pos:s})]}),(0,M.jsx)(Z,{head:a})]})}export{q as PartMeshes,z as SUN_DIR,oe as default,K as glowTexture,W as useEnduranceGeo,G as useShipMaterials};