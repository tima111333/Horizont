import{A as e,B as t,H as n,N as r,Q as i,U as a,V as o,Y as s,Z as c,_ as l,b as u,c as d,d as f,dt as p,et as m,f as h,ft as g,g as _,h as v,lt as y,m as b,p as x,q as S,tt as C,ut as w,v as T,y as E}from"./index-Rph-gfxM.js";import{t as D}from"./useScrollScene-C_OY7xky.js";import{PartMeshes as O,useEnduranceGeo as k,useShipMaterials as A}from"./Launch-C2UOj6Pv.js";var j=g(p(),1),M=`// Червоточина: метрика ds² = -dt² + dl² + r(l)²dΩ² с цилиндрической горловиной\r
// длиной 2a и «линзой» ширины M снаружи (форма как в James et al., 2015).\r
// Метрика сферически симметрична, поэтому судьба луча зависит только от\r
// положения камеры l_c и угла луча к оси — один проход считает таблицу из\r
// тысяч лучей (LUT), а полноэкранный проход лишь читает её.\r
\r
// #define LUT — часть для расчёта таблицы, иначе — отрисовка\r
#define PI 3.14159265\r
\r
uniform float uA;   // полудлина горловины (в радиусах горловины)\r
uniform float uM;   // ширина линзирующей области\r
uniform float uLc;  // положение камеры по l\r
\r
float rOf(float l) {\r
  float x = max(abs(l) - uA, 0.0);\r
  float X = 2.0 * x / (PI * uM);\r
  return 1.0 + uM * (X * atan(X) - 0.5 * log(1.0 + X * X));\r
}\r
float drOf(float l) {\r
  float x = max(abs(l) - uA, 0.0);\r
  float X = 2.0 * x / (PI * uM);\r
  return sign(l) * (2.0 / PI) * atan(X);\r
}\r
\r
#ifdef LUT\r
uniform float uN;\r
varying vec2 vUv;\r
\r
// производные состояния (l, phi, p) по аффинному параметру\r
vec3 deriv(vec3 s, float b) {\r
  float r = rOf(s.x);\r
  return vec3(s.z, b / (r * r), b * b * drOf(s.x) / (r * r * r));\r
}\r
\r
void main() {\r
  float i = floor(vUv.x * uN);\r
  float alpha = (i + 0.5) / uN * PI;      // угол от направления «внутрь»\r
  float nl = -cos(alpha);\r
  float rc = rOf(uLc);\r
  float b = rc * sin(alpha);\r
  vec3 s = vec3(uLc, 0.0, nl);\r
  float far = 40.0 + abs(uLc);\r
  for (int k = 0; k < 600; k++) {\r
    // уходит на бесконечность — дальше прямая, досчитаем аналитически\r
    if (abs(s.x) > far && s.z * sign(s.x) > 0.0) break;\r
    // шаг: мелкий у горловины и у точки разворота, крупный вдали\r
    float h = clamp(0.015 + 0.04 * max(abs(s.x) - uA, 0.0), 0.015, 1.5);\r
    vec3 k1 = deriv(s, b);\r
    vec3 k2 = deriv(s + 0.5 * h * k1, b);\r
    vec3 k3 = deriv(s + 0.5 * h * k2, b);\r
    vec3 k4 = deriv(s + h * k3, b);\r
    s += h / 6.0 * (k1 + 2.0 * k2 + 2.0 * k3 + k4);\r
  }\r
  float rf = rOf(s.x);\r
  float phi = s.y + asin(clamp(b / rf, 0.0, 1.0));\r
  gl_FragColor = vec4(phi, sign(s.x), 0.0, 1.0);\r
}\r
#else\r
\r
uniform sampler2D uLut;\r
uniform float uN;\r
uniform samplerCube uSkyA;\r
uniform samplerCube uSkyB;\r
uniform mat3 uRotB;\r
uniform vec3 uAxis;      // e_l — радиальное направление камеры в мире\r
uniform mat4 uProjInv;\r
uniform mat4 uCamWorld;\r
uniform float uStreak;   // растяжка от скорости прокрутки\r
uniform float uDisp;     // хроматическая дисперсия в горловине\r
uniform float uGain;\r
varying vec2 vUv;\r
\r
// судьба луча с углом alpha: (phi, сторона)\r
vec2 lut(float alpha) {\r
  float u = alpha / PI * uN - 0.5;\r
  float i0 = clamp(floor(u), 0.0, uN - 1.0);\r
  float f = clamp(u - i0, 0.0, 1.0);\r
  vec2 a = texelFetch(uLut, ivec2(int(i0), 0), 0).xy;\r
  vec2 c = texelFetch(uLut, ivec2(int(min(i0 + 1.0, uN - 1.0)), 0), 0).xy;\r
  // на границе вселенных углы не смешиваем — берём ближайший луч\r
  if (a.y != c.y) return f < 0.5 ? a : c;\r
  return vec2(mix(a.x, c.x, f), a.y);\r
}\r
\r
vec3 skyFor(vec3 A, vec3 B, float alpha) {\r
  vec2 v = lut(alpha);\r
  // одна точка выхода: компилятор D3D иначе ругается на «неинициализированный» результат\r
  vec3 c;\r
  if (v.y > 0.0) c = textureCube(uSkyA, cos(v.x) * A + sin(v.x) * B).rgb;\r
  else c = textureCube(uSkyB, uRotB * (-cos(v.x) * A + sin(v.x) * B)).rgb;\r
  return c;\r
}\r
\r
void main() {\r
  vec4 view = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);\r
  view /= view.w;\r
  vec3 ro = (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;\r
  vec3 d = normalize((uCamWorld * vec4(view.xyz, 1.0)).xyz - ro);\r
  vec3 A = uAxis;\r
  float nl = dot(d, A);\r
  vec3 perp = d - nl * A;\r
  float pl = length(perp);\r
  vec3 B = pl > 1e-5 ? perp / pl : normalize(cross(A, vec3(0.0, 1.0, 0.1)));\r
  float alpha = acos(clamp(-nl, -1.0, 1.0));\r
\r
  vec3 col;\r
  if (uDisp > 0.001) {\r
    // дисперсия: красный и синий идут по чуть разным траекториям\r
    col.r = skyFor(A, B, alpha * (1.0 + uDisp)).r;\r
    col.g = skyFor(A, B, alpha).g;\r
    col.b = skyFor(A, B, alpha * (1.0 - uDisp)).b;\r
  } else col = skyFor(A, B, alpha);\r
\r
  // растяжка звёзд от скорости: несколько лучей ближе к оси полёта\r
  if (uStreak > 0.001) {\r
    vec3 acc = col;\r
    float w = 1.0;\r
    for (int k = 1; k <= 5; k++) {\r
      float t = float(k) / 5.0;\r
      float wk = 1.0 - t * 0.6;\r
      acc += skyFor(A, B, alpha * (1.0 - uStreak * t)) * wk;\r
      w += wk;\r
    }\r
    col = acc / w;\r
  }\r
  gl_FragColor = vec4(col * uGain, 1.0);\r
}\r
#endif\r
`,N=u(),P=`
// плотность колец по радиусу: щели, деление Кассини, тонкая структура
float ringDensity(float r) {
  float x = (r - 1.24) / (2.27 - 1.24);
  if (x < 0.0 || x > 1.0) return 0.0;
  float d = 0.25 + 0.5 * smoothstep(0.0, 0.12, x);          // внутреннее кольцо C — тусклое
  d += 0.45 * smoothstep(0.26, 0.3, x) * (1.0 - smoothstep(0.58, 0.6, x)); // яркое кольцо B
  d *= 1.0 - 0.95 * smoothstep(0.595, 0.605, x) * (1.0 - smoothstep(0.66, 0.67, x)); // деление Кассини
  d *= 1.0 - 0.6 * smoothstep(0.86, 0.865, x) * (1.0 - smoothstep(0.875, 0.88, x)); // щель Энке
  d *= 0.75 + 0.25 * sin(x * 420.0) * sin(x * 130.0 + 1.3);
  d *= smoothstep(1.0, 0.95, x);
  return clamp(d, 0.0, 1.0);
}
`;function F({position:t,radius:n,sun:r,tilt:a=[.42,0,.2],time:o}){let{planet:s,ring:c,uniforms:l}=(0,j.useMemo)(()=>{let e={uSun:{value:r},uTime:o,uR:{value:n},uC:{value:new y(...t)},uN:{value:new y(0,1,0)}};return{planet:new C({uniforms:e,vertexShader:`
        varying vec3 vW;
        varying vec3 vL;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vL = position;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,fragmentShader:h+P+`
        uniform vec3 uSun;
        uniform float uTime;
        uniform float uR;
        uniform vec3 uC;
        uniform vec3 uN;
        varying vec3 vW;
        varying vec3 vL;
        void main() {
          vec3 N = normalize(vW - uC);
          vec3 loc = normalize(vL);
          float lat = loc.y;
          // полосы по широте, слегка завихрённые
          float w = fbm3(vec3(loc.x * 3.0, lat * 18.0, loc.z * 3.0 + uTime * 0.002)) * 0.08;
          float band = sin((lat + w) * 38.0) * 0.5 + 0.5;
          float band2 = sin((lat + w * 1.5) * 91.0) * 0.5 + 0.5;
          vec3 alb = mix(vec3(0.62, 0.5, 0.34), vec3(0.86, 0.76, 0.56), band);
          alb *= 0.88 + 0.12 * band2;
          alb = mix(alb, vec3(0.62, 0.66, 0.68), smoothstep(0.75, 0.95, abs(lat)));
          float ndl = dot(N, uSun);
          float lit = smoothstep(-0.05, 0.25, ndl) * max(ndl, 0.0) * 0.85 + 0.15 * smoothstep(-0.1, 0.4, ndl);
          // тень колец: луч к солнцу пересекает плоскость колец
          float t = -dot(vW - uC, uN) / dot(uSun, uN);
          if (t > 0.0) {
            vec3 hit = vW + uSun * t;
            float rr = length(hit - uC) / uR;
            lit *= 1.0 - 0.85 * ringDensity(rr);
          }
          vec3 col = alb * lit * 1.35;
          // лимб темнеет, атмосфера чуть светится по краю
          vec3 V = normalize(cameraPosition - vW);
          float mu = max(dot(N, V), 0.0);
          col *= 0.55 + 0.45 * pow(mu, 0.4);
          col += vec3(0.9, 0.75, 0.55) * pow(1.0 - mu, 5.0) * max(ndl, 0.0) * 0.4;
          gl_FragColor = vec4(col, 1.0);
        }`}),ring:new C({uniforms:e,vertexShader:`
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,fragmentShader:P+`
        uniform vec3 uSun;
        uniform float uR;
        uniform vec3 uC;
        uniform vec3 uN;
        varying vec3 vW;
        void main() {
          float r = length(vW - uC) / uR;
          float d = ringDensity(r);
          if (d < 0.01) discard;
          // тень планеты на кольцах
          vec3 oc = vW - uC;
          float b = dot(oc, uSun);
          float c = dot(oc, oc) - uR * uR;
          float shadow = (b < 0.0 && b * b - c > 0.0) ? 0.04 : 1.0;
          vec3 V = normalize(cameraPosition - vW);
          // кольца из льда: при взгляде против солнца светятся рассеянием вперёд
          float fwd = pow(max(dot(-V, uSun), 0.0), 6.0);
          float lit = abs(dot(uSun, uN)) * 1.6 + fwd * 1.8;
          vec3 alb = mix(vec3(0.62, 0.52, 0.4), vec3(0.86, 0.78, 0.64), smoothstep(0.3, 0.8, d));
          gl_FragColor = vec4(alb * lit * shadow * 0.75, d * 0.9);
        }`,transparent:!0,depthWrite:!1,side:2}),uniforms:e}},[r,o,n,t]),u=(0,j.useMemo)(()=>new i().setFromEuler(new e(...a)),[a]);return l.uN.value.set(0,1,0).applyQuaternion(u),(0,N.jsxs)(`group`,{position:t,quaternion:u,children:[(0,N.jsx)(`mesh`,{material:s,children:(0,N.jsx)(`sphereGeometry`,{args:[n,128,64]})}),(0,N.jsx)(`mesh`,{material:c,"rotation-x":-Math.PI/2,renderOrder:1,children:(0,N.jsx)(`ringGeometry`,{args:[n*1.22,n*2.3,256,1]})})]})}var I=_(`wormhole`),L=12,R=.6,z=.2,B=v?2048:4096,V=new y(.18,.1,1).normalize(),H=new y(-.35,.28,.9).normalize(),U=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};function W(e){let t=2*Math.max(Math.abs(e)-R,0)/(Math.PI*z);return 1+z*(t*Math.atan(t)-.5*Math.log(1+t*t))}function G(e,t){let n=e.length,r=[],i=[];for(let i=0;i<n-1;i++)r.push((t[i+1]-t[i])/(e[i+1]-e[i]));i.push(r[0]);for(let e=1;e<n-1;e++)i.push(r[e-1]*r[e]<=0?0:(r[e-1]+r[e])/2);i.push(r[n-2]);for(let e=0;e<n-1;e++){if(r[e]===0){i[e]=i[e+1]=0;continue}let t=i[e]/r[e],n=i[e+1]/r[e],a=t*t+n*n;if(a>9){let o=3/Math.sqrt(a);i[e]=o*t*r[e],i[e+1]=o*n*r[e]}}return r=>{if(r<=e[0])return t[0];if(r>=e[n-1])return t[n-1];let a=0;for(;r>e[a+1];)a++;let o=e[a+1]-e[a],s=(r-e[a])/o,c=s*s,l=c*s;return(2*l-3*c+1)*t[a]+(l-2*c+s)*o*i[a]+(-2*l+3*c)*t[a+1]+(l-c)*o*i[a+1]}}var K=G([0,.28,.52,.62,.7,.78,1],[36,13,3.2,.9,-.9,-3.4,-26]);function q(){let{gl:t,camera:i}=E(),l=f(`home`),u=f(`far`),{lut:d,lutScene:p,lutCam:h,lutMat:g,mat:_}=(0,j.useMemo)(()=>{let t=new w(B,1,{type:r,minFilter:S,magFilter:S,depthBuffer:!1,generateMipmaps:!1}),i={uA:{value:R},uM:{value:z},uLc:{value:30},uN:{value:B}},d=new C({defines:{LUT:``},uniforms:i,vertexShader:`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:M,depthTest:!1,depthWrite:!1}),f=new m,p=new a(new c(2,2),d);p.frustumCulled=!1,f.add(p);let h=new s(-1,1,1,-1,0,1),g=new o().setFromMatrix4(new n().makeRotationFromEuler(new e(.7,2.1,-.4)));return{lut:t,lutScene:f,lutCam:h,lutMat:d,mat:new C({uniforms:{...i,uLut:{value:t.texture},uSkyA:{value:l},uSkyB:{value:u},uRotB:{value:g},uAxis:{value:V.clone()},uProjInv:{value:new n},uCamWorld:{value:new n},uStreak:{value:0},uDisp:{value:0},uGain:{value:1.3}},vertexShader:`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,fragmentShader:M,depthTest:!1,depthWrite:!1})}},[l,u]);return(0,j.useEffect)(()=>()=>{d.dispose(),g.dispose(),_.dispose()},[d,g,_]),T(()=>{if(b.act!==I)return;let e=t.getRenderTarget();t.setRenderTarget(d),t.render(p,h),t.setRenderTarget(e),i.updateMatrixWorld(),_.uniforms.uProjInv.value.copy(i.projectionMatrixInverse),_.uniforms.uCamWorld.value.copy(i.matrixWorld)},0),D(`wormhole`,({p:e})=>{let t=K(e);g.uniforms.uLc.value=t;let n=U(.5,.64,e)*(1-U(.74,.86,e));_.uniforms.uStreak.value=Math.min(.3,b.speed*.18+n*.015),_.uniforms.uDisp.value=n*.004,_.uniforms.uGain.value=1.25+n*.6}),(0,N.jsx)(`mesh`,{material:_,frustumCulled:!1,renderOrder:-10,children:(0,N.jsx)(`planeGeometry`,{args:[2,2]})})}function J(){let e=A(),n=k(),r=(0,j.useRef)(null),i=(0,j.useRef)(0);return D(`wormhole`,({p:e,dt:n})=>{let a=r.current,o=K(e)-7,s=W(o);a.visible=o>1.25,a.position.copy(V).multiplyScalar(s*L),a.lookAt(0,0,0),i.current+=n*.3,a.rotateZ(i.current);let c=t.clamp((o-1.25)/1.2,0,1);a.scale.setScalar(.32*(.35+.65*c))}),(0,N.jsx)(`group`,{ref:r,children:(0,N.jsxs)(`group`,{"rotation-y":Math.PI,children:[(0,N.jsx)(O,{geos:n.ring,mats:e,shadows:!1}),(0,N.jsx)(O,{geos:n.hub,mats:e,shadows:!1})]})})}function Y(){let e=(0,j.useMemo)(()=>({value:0}),[]),t=d([{pos:H.clone().multiplyScalar(30).toArray(),size:[2,2],color:`#fff3e0`,intensity:40,shape:`disc`},{pos:[-30,5,-10],size:[30,30],color:`#b89a70`,intensity:.5}],`#000000`,`wormhole`,1),n=(0,j.useRef)(null);return D(`wormhole`,({p:r,t:i,state:a})=>{a.scene.environment=t,e.value=i;let o=K(r),s=W(o)*L;l.pos.copy(V).multiplyScalar(s);let c=1-U(.08,.34,r),u=new y().copy(l.pos).addScaledVector(V,-20);u.add(new y(-7,-1.5,0).multiplyScalar(c)),l.look.copy(u),l.fov=42+U(.52,.64,r)*18*(1-U(.74,.9,r)),l.near=.1,l.far=2e4,l.shake=.01+U(.5,.62,r)*(1-U(.76,.84,r))*.06,l.roll=Math.sin(i*.2)*.01+U(.55,.8,r)*.35,n.current.visible=o>0,x.bloom=1+U(.55,.66,r)*.4}),(0,N.jsxs)(N.Fragment,{children:[(0,N.jsx)(q,{}),(0,N.jsxs)(`group`,{ref:n,children:[(0,N.jsx)(F,{position:[-330,-70,-160],radius:95,sun:H,time:e,tilt:[.35,.3,.25]}),(0,N.jsx)(J,{}),(0,N.jsx)(`directionalLight`,{position:H.clone().multiplyScalar(100).toArray(),intensity:3.5,color:`#fff2e0`}),(0,N.jsx)(`hemisphereLight`,{args:[`#1a1a22`,`#3a2c1c`,.25]})]})]})}export{Y as default};