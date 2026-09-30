import{B as e,C as t,I as n,M as r,O as i,S as a,T as o,Z as s,_ as c,a as l,b as u,ct as d,dt as f,f as p,ft as m,h,it as g,j as _,lt as v,m as y,n as b,nt as x,ot as S,p as C,t as w,tt as T,x as E,y as D}from"./index-Rph-gfxM.js";import{t as O}from"./useScrollScene-C_OY7xky.js";import{r as k,t as A}from"./BufferGeometryUtils-DJ9BSjAh.js";var j=m(f(),1),M=`// Общая атмосфера пролога: небо, дымка, пыль. Её подклеивают все материалы\r
// сцены — небо, земля, пшеница, буря, ферма, — чтобы дымка совпадала пиксель в пиксель.\r
uniform vec3 uSunDir;\r
uniform float uStorm;    // 0..1 — насколько близко буря\r
uniform float uDust;     // 0..1 — пыль в воздухе (к концу акта заливает кадр)\r
uniform float uSunVis;   // видимость солнца сквозь пыль\r
\r
vec3 skyColor(vec3 d) {\r
  float h = d.y;\r
  float sd = max(dot(d, uSunDir), 0.0);\r
  vec3 zenith = mix(vec3(0.07, 0.085, 0.115), vec3(0.09, 0.065, 0.045), uStorm);\r
  vec3 horizon = mix(vec3(0.62, 0.36, 0.18), vec3(0.36, 0.2, 0.1), uStorm);\r
  float t = pow(smoothstep(-0.03, 0.55, h), 0.55);\r
  vec3 c = mix(horizon, zenith, t);\r
  // рассеяние Ми вокруг солнца: широкое тёплое гало и плотное ядро\r
  c += vec3(1.0, 0.5, 0.2) * pow(sd, 12.0) * 0.4 * uSunVis;\r
  c += vec3(1.0, 0.66, 0.34) * pow(sd, 160.0) * 0.9 * uSunVis;\r
  // диск солнца, сплюснутый у горизонта не будем — он и так низко\r
  float disk = smoothstep(0.99965, 0.99985, sd);\r
  c += vec3(14.0, 7.5, 3.2) * disk * uSunVis;\r
  // ниже горизонта — пыльная дымка, продолжает небо\r
  c = mix(c, horizon * 0.62, smoothstep(0.0, -0.08, h));\r
  return c;\r
}\r
\r
/** цвет дымки в направлении d — небо у горизонта + рассеяние к солнцу */\r
vec3 hazeColor(vec3 d) {\r
  float sd = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);\r
  vec3 base = mix(vec3(0.46, 0.29, 0.16), vec3(0.3, 0.18, 0.1), uStorm);\r
  base += vec3(0.9, 0.46, 0.18) * pow(sd, 10.0) * 0.4 * uSunVis;\r
  vec3 dustC = vec3(0.22, 0.135, 0.07);\r
  return mix(base, dustC, uDust);\r
}\r
\r
/** экспоненциальная дымка с падением плотности по высоте */\r
vec3 applyHaze(vec3 col, vec3 wp, vec3 camPos) {\r
  vec3 v = wp - camPos;\r
  float dist = length(v);\r
  vec3 d = v / max(dist, 1e-3);\r
  float dens = mix(0.0011, 0.0024, uStorm) + uDust * 0.06;\r
  float hf = exp(-max(wp.y, 0.0) * 0.004);\r
  float f = 1.0 - exp(-dist * dens * hf);\r
  return mix(col, hazeColor(d), clamp(f, 0.0, 1.0));\r
}\r
`,N=`// Стена пыльной бури. Геометрия — дуга цилиндра вокруг поля; объём имитируется\r
// «клубящимся» шумом (сумма модулей симплекса даёт округлые клубы), а свет —\r
// разницей плотности в сторону солнца: где к солнцу пыль редеет, там край клуба\r
// освещён. Одна лишняя выборка вместо полноценного марша.\r
uniform float uTime;\r
uniform float uLayer;\r
uniform float uHeight;\r
uniform float uOpacity;\r
uniform vec2 uParallax;\r
uniform vec3 uCam;\r
uniform float uOct;\r
uniform float uR;\r
uniform float uEdge;\r
varying vec2 vWall;     // x — метры вдоль дуги, y — высота\r
varying vec3 vWorld;\r
varying vec3 vTangent;\r
varying vec3 vNormalW;\r
\r
float billow(vec3 p, float oct) {\r
  float a = 0.5, s = 0.0;\r
  for (int i = 0; i < 5; i++) {\r
    if (float(i) >= oct) break;\r
    s += a * (1.0 - abs(snoise(p)));\r
    p = p * 2.03 + vec3(4.1, 1.3, 7.7);\r
    a *= 0.5;\r
  }\r
  return s;\r
}\r
\r
// высота верхнего края стены в точке x: крупные башни + клубы помельче\r
float topAt(vec2 q, float t) {\r
  float towers = snoise(vec3(q.x * 0.5, uLayer * 3.1, t * 0.12)) * 0.5 + 0.5;\r
  float puffs = billow(vec3(q.x * 2.2, q.y * 1.4 - t * 0.6, t * 0.5 + uLayer * 7.0), uOct);\r
  return uHeight * (0.5 + 0.38 * towers + 0.32 * puffs);\r
}\r
\r
float density(vec2 w) {\r
  vec2 q = (w + uParallax) / 170.0;\r
  float t = uTime * 0.04;\r
  float top = topAt(q, t);\r
  // мягкость края зависит от высоты: у макушек рыхлее\r
  float soft = 22.0 + 0.08 * top;\r
  float d = smoothstep(top, top - soft, w.y);\r
  // правый фланг рваный и тает — сквозь него пробивается солнце\r
  float th = w.x / max(uR, 1.0);\r
  float frayed = snoise(vec3(q * 1.7, t)) * 0.12;\r
  d *= smoothstep(uEdge + 0.05, uEdge - 0.4, th + frayed);\r
  return d;\r
}\r
\r
void main() {\r
  float d = density(vWall);\r
  if (d < 0.004) discard;\r
  vec3 L = normalize(uSunDir);\r
  // направление на солнце в плоскости стены\r
  vec2 toSun = normalize(vec2(dot(L, vTangent), max(L.y, 0.0) + 0.5));\r
  float dl = density(vWall + toSun * 30.0);\r
  float edgeLit = clamp((d - dl) * 1.6, 0.0, 1.0);\r
  // фактура внутри стены: перекатывающиеся валы пыли, только яркостью\r
  vec2 q = (vWall + uParallax) / 120.0;\r
  float roll = billow(vec3(q.x, q.y - uTime * 0.03, uTime * 0.02 + uLayer), 3.0);\r
\r
  vec3 V = normalize(vWorld - uCam);\r
  // контровой свет через редкую пыль около солнца\r
  float back = pow(max(dot(V, L), 0.0), 10.0) * pow(1.0 - d, 1.5) * 2.4;\r
  float hh = clamp(vWall.y / max(uHeight, 1.0), 0.0, 1.2);\r
  vec3 body = mix(vec3(0.06, 0.036, 0.02), vec3(0.14, 0.085, 0.045), hh);\r
  vec3 lit = vec3(0.95, 0.55, 0.27);\r
  body *= 0.7 + 0.6 * roll;\r
  vec3 col = body + lit * edgeLit * edgeLit * 0.45 * uSunVis + vec3(1.0, 0.5, 0.2) * back * uSunVis;\r
  // стена должна читаться на горизонте — дымку на неё кладём тоньше\r
  col = applyHaze(col, uCam + (vWorld - uCam) * 0.4, uCam);\r
  gl_FragColor = vec4(col, d * uOpacity);\r
}\r
`,P=u(),F=new v(.44,.075,-1).normalize(),I=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2,L=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};function R(){return(0,j.useMemo)(()=>({uSunDir:{value:F.clone()},uStorm:{value:0},uDust:{value:0},uSunVis:{value:1},uTime:{value:0},uCam:{value:new v}}),[])}function z({u:e}){let t=(0,j.useMemo)(()=>new T({uniforms:e,vertexShader:`
          varying vec3 vDir;
          void main() {
            vDir = position;
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            // чуть ближе дальней плоскости: ровно на ней треугольники неба отсекаются через кадр
            gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
          }`,fragmentShader:M+`
          uniform float uTime;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            vec3 c = skyColor(d);
            // слоистые перистые облака, подсвеченные снизу закатом
            vec2 q = d.xz / max(d.y + 0.06, 0.02);
            float cl = sin(q.x * 0.9 + sin(q.y * 0.35 + uTime * 0.01) * 2.0) * 0.5 + 0.5;
            cl *= smoothstep(0.02, 0.2, d.y) * smoothstep(0.7, 0.2, d.y);
            c = mix(c, c * vec3(1.15, 0.95, 0.8), cl * 0.18 * (1.0 - uStorm));
            c = mix(c, hazeColor(d), uDust);
            gl_FragColor = vec4(c, 1.0);
          }`,side:1,depthWrite:!1}),[e]),n=(0,j.useRef)(null);return O(`earth`,()=>n.current?.position.copy(e.uCam.value)),(0,P.jsx)(`mesh`,{ref:n,material:t,renderOrder:-10,frustumCulled:!1,children:(0,P.jsx)(`sphereGeometry`,{args:[3e3,48,24]})})}function B({u:e}){let t=(0,j.useMemo)(()=>new T({uniforms:{...e,uRoad:{value:16}},vertexShader:`
          varying vec3 vWorld;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,fragmentShader:p+M+`
          uniform float uTime;
          uniform vec3 uCam;
          uniform float uRoad;
          varying vec3 vWorld;
          void main() {
            vec2 p = vWorld.xz;
            float dist = length(p - uCam.xz);
            float n = vfbm(vec3(p * 0.05, 1.0), 4);
            float n2 = vfbm(vec3(p * 0.6, 3.0), 3);
            vec3 soil = vec3(0.13, 0.085, 0.05) * (0.7 + 0.5 * n2);
            // дальнее поле: колосья, волны ветра, неравномерная спелость
            float gust = snoise(vec3(p * 0.045 - vec2(0.9, 0.35) * uTime * 0.55, uTime * 0.05));
            vec3 field = mix(vec3(0.55, 0.38, 0.17), vec3(0.8, 0.6, 0.3), n);
            field *= 0.82 + 0.3 * max(gust, 0.0);
            // ряды посева — гасим, когда полоса становится мельче пикселя
            float row = abs(fract(p.x / 0.3) - 0.5) * 2.0;
            float fw = fwidth(p.x / 0.3);
            field *= 1.0 - 0.18 * (1.0 - smoothstep(0.3, 0.9, row)) * (1.0 - smoothstep(0.2, 0.8, fw));
            vec3 alb = mix(soil * 0.5, field, smoothstep(6.0, 34.0, dist));
            // грунтовая дорога с колеёй
            float r = abs(p.x - uRoad);
            float road = 1.0 - smoothstep(2.4, 3.0, r);
            float rut = 1.0 - smoothstep(0.1, 0.35, abs(r - 0.9));
            vec3 dirt = vec3(0.3, 0.21, 0.13) * (0.8 + 0.3 * n2) * (1.0 - rut * 0.25);
            alb = mix(alb, dirt, road);

            vec3 V = normalize(vWorld - uCam);
            float back = pow(max(dot(V, uSunDir), 0.0), 4.0);
            vec3 sunC = vec3(1.0, 0.68, 0.4) * 1.4 * uSunVis;
            vec3 amb = mix(vec3(0.2, 0.18, 0.18), vec3(0.24, 0.16, 0.1), uStorm) * 0.5;
            float ndl = 0.35 + 0.25 * max(gust, 0.0); // поле освещено скользящим светом
            vec3 col = alb * (sunC * ndl + amb) + alb * vec3(1.0, 0.55, 0.25) * back * 0.8 * uSunVis * (1.0 - road);
            col = applyHaze(col, vWorld, uCam);
            gl_FragColor = vec4(col, 1.0);
          }`}),[e]);return(0,P.jsx)(`mesh`,{material:t,"rotation-x":-Math.PI/2,position:[0,0,-1500],frustumCulled:!1,children:(0,P.jsx)(`planeGeometry`,{args:[9e3,6e3,1,1]})})}var V=`
attribute vec4 aInst;
attribute vec3 aVar;
attribute float aH;
attribute float aPart;
attribute vec2 aUV;
uniform float uTime;
uniform float uWind;
uniform vec2 uWindDir;
varying vec3 vWorld;
varying vec3 vN;
varying float vH;
varying float vPart;
varying vec3 vVar;
varying float vGust;
varying vec2 vUV;
void main() {
  vUV = aUV;
  float c = cos(aInst.z), s = sin(aInst.z);
  vec3 p = position * aInst.w;
  p = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  vec3 n = vec3(c * normal.x - s * normal.z, normal.y, s * normal.x + c * normal.z);
  vec3 wp = vec3(aInst.x, 0.0, aInst.y) + p;
  // порывы — волны, бегущие по полю; считаются по позиции пучка, чтобы стебли гнулись вместе
  float g = snoise(vec3(aInst.xy * 0.045 - uWindDir * uTime * 0.55, uTime * 0.05));
  float flutter = sin(uTime * (2.2 + aVar.z * 1.5) + aVar.z * 30.0 + aInst.x * 0.7) * 0.06;
  float bend = (0.16 + 0.5 * max(g, 0.0) + flutter) * uWind;
  float k = pow(aH, 1.7);
  wp.xz += uWindDir * bend * k * aInst.w;
  wp.y -= bend * bend * k * 0.35 * aInst.w;
  vGust = g;
  vWorld = wp;
  vN = n;
  vH = aH;
  vPart = aPart;
  vVar = aVar;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`,H=`
uniform vec3 uCam;
varying vec3 vWorld;
varying vec3 vN;
varying float vH;
varying float vPart;
varying vec3 vVar;
varying float vGust;
varying vec2 vUV;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCam - vWorld);
  vec3 L = uSunDir;

  float ripe = vVar.y;
  vec3 stalk = mix(vec3(0.26, 0.19, 0.08), vec3(0.5, 0.37, 0.17), ripe);
  vec3 ear = mix(vec3(0.36, 0.27, 0.1), vec3(0.66, 0.47, 0.21), ripe * ripe);
  vec3 leafC = mix(vec3(0.26, 0.2, 0.1), vec3(0.4, 0.3, 0.14), ripe);
  vec3 alb = vPart < 0.5 ? stalk : vPart < 1.5 ? ear : vPart < 2.5 ? leafC : ear * 1.1;
  alb *= 0.8 + 0.35 * vVar.x;
  // колоски: колос собран из чередующихся чешуек — полосы вдоль оси со сдвигом по граням
  if (vPart > 0.5 && vPart < 1.5) {
    float row = fract(vUV.x * 14.0 + step(0.5, fract(vUV.y * 2.0)) * 0.5);
    float scale = smoothstep(0.0, 0.25, row) * smoothstep(1.0, 0.55, row);
    alb *= 0.78 + 0.3 * scale;
  }
  if (vPart < 0.5) alb *= 0.85 + 0.15 * sin(vUV.y * 6.283 * 3.0);

  // глубина в поле: низ стеблей в собственной тени
  float ao = mix(0.08, 1.0, pow(clamp(vH, 0.0, 1.0), 1.2));
  float ndl = max(dot(N, L), 0.0);
  // контровой свет: только в конусе вокруг солнца и сильнее по краю силуэта
  float cs = max(dot(-V, L), 0.0);
  float cone = pow(cs, 26.0) + pow(cs, 5.0) * 0.08;
  float rim = 1.0 - abs(dot(N, V));
  // просвет: ости светятся на контровом, зерно — умеренно, стебель — меньше всего
  float thin = vPart > 3.5 ? 1.7 : vPart > 2.5 ? 4.0 : vPart > 0.5 ? 1.5 : 0.8;
  if (vPart > 3.5) alb *= 0.9 + 0.2 * smoothstep(0.0, 1.0, vUV.x); // кончик колоска светлее
  vec3 sunC = vec3(1.0, 0.66, 0.38) * 1.25 * uSunVis;
  vec3 skyAmb = mix(vec3(0.15, 0.14, 0.15), vec3(0.17, 0.11, 0.07), uStorm);
  vec3 grnAmb = vec3(0.07, 0.045, 0.02);
  vec3 amb = mix(grnAmb, skyAmb, N.y * 0.5 + 0.5);
  vec3 col = alb * (sunC * ndl + amb) * ao;
  col += alb * vec3(1.0, 0.55, 0.2) * cone * thin * (0.15 + 1.6 * rim * rim * rim) * 1.5 * uSunVis * smoothstep(0.35, 0.85, vH);
  // блеск наклонённых порывом стеблей
  col *= 1.0 + 0.3 * max(vGust, 0.0) * vH;
  col = applyHaze(col, vWorld, uCam);
  gl_FragColor = vec4(col, 1.0);
}
`;function U({u:e}){let t=l(`wheat`,w),{geos:r,mat:i}=(0,j.useMemo)(()=>({geos:t.map(e=>{let t=b(e.geo,!0);return t.attributes.aInst||(t.setAttribute(`aInst`,new n(e.inst,4)),t.setAttribute(`aVar`,new n(e.vars,3))),t.instanceCount=e.n,t}),mat:new T({uniforms:{...e,uWind:{value:1},uWindDir:{value:new d(.92,.38).normalize()}},vertexShader:p+V,fragmentShader:M+H,side:2})}),[e,t]);return(0,j.useEffect)(()=>()=>i.dispose(),[i]),O(`earth`,({p:e})=>{i.uniforms.uWind.value=.8+L(.45,.95,e)*1.3}),(0,P.jsx)(P.Fragment,{children:r.map((e,t)=>(0,P.jsx)(`mesh`,{geometry:e,material:i,frustumCulled:!1},t))})}var W=`
uniform float uR;
uniform float uH;
uniform vec3 uCenter;
varying vec2 vWall;
varying vec3 vWorld;
varying vec3 vTangent;
varying vec3 vNormalW;
void main() {
  float th = position.x;           // азимут от направления -z
  float y = position.y * uH;
  vec3 wp = uCenter + vec3(sin(th) * uR, y, -cos(th) * uR);
  vWall = vec2(th * uR, y);
  vWorld = wp;
  vTangent = vec3(cos(th), 0.0, sin(th));
  vNormalW = -vec3(sin(th), 0.0, -cos(th));
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;function G({u:t}){let n=h?2:3,{geo:r,mats:i}=(0,j.useMemo)(()=>{let e=new s(3.2,1,h?96:160,24);return e.translate(-.1,.5,0),{geo:e,mats:Array.from({length:n},(e,n)=>new T({uniforms:{...t,uR:{value:1400},uH:{value:300},uCenter:{value:new v(0,-2,-10)},uLayer:{value:n},uHeight:{value:300},uOpacity:{value:1},uParallax:{value:new d},uOct:{value:h?3:5-n},uEdge:{value:.3}},vertexShader:W,fragmentShader:p+M+N,transparent:!0,depthWrite:!1,side:2}))}},[t,n]);return(0,j.useEffect)(()=>()=>r.dispose(),[r]),O(`earth`,({p:t})=>{let n=L(.08,.97,t),r=e.lerp(1500,330,n**1.25),a=e.lerp(300,620,Math.sqrt(n)),o=e.lerp(.18,1.35,L(.3,.92,t));i.forEach((e,t)=>{let n=[1,.78,.6][t];e.uniforms.uR.value=r*n,e.uniforms.uH.value=a*[1,.62,.34][t]*1.25,e.uniforms.uHeight.value=a*[1,.62,.34][t],e.uniforms.uOpacity.value=[1,.8,.55][t],e.uniforms.uEdge.value=o-t*.08,e.uniforms.uParallax.value.set(y.pointer.sx*(8+t*16),y.pointer.sy*(3+t*5))})}),(0,P.jsx)(P.Fragment,{children:i.map((e,t)=>(0,P.jsx)(`mesh`,{geometry:r,material:e,frustumCulled:!1,renderOrder:-5+t},t))})}function K({u:n}){let r=h?1400:4200,{geo:i,mat:o}=(0,j.useMemo)(()=>{let e=k(77),i=new Float32Array(r*3),o=new Float32Array(r);for(let t=0;t<r;t++)i[t*3]=e()*60-30,i[t*3+1]=e()*16,i[t*3+2]=e()*60-30,o[t]=e();let s=new t;return s.setAttribute(`position`,new a(i,3)),s.setAttribute(`aR`,new a(o,1)),{geo:s,mat:new T({uniforms:{...n,uPx:{value:600},uAmount:{value:.3}},vertexShader:`
        attribute float aR;
        uniform float uTime;
        uniform vec3 uCam;
        uniform float uPx;
        uniform float uAmount;
        uniform float uStorm;
        varying float vA;
        varying float vB;
        varying vec3 vW;
        void main() {
          vec3 box = vec3(60.0, 16.0, 60.0);
          vec3 wind = vec3(2.6, 0.15, 1.1) * (1.0 + uStorm * 2.0);
          vec3 p = position + wind * uTime * (0.6 + aR * 0.8);
          p.y += sin(uTime * 0.7 + aR * 40.0) * 0.4;
          // коробка частиц всегда вокруг камеры — бесконечное облако без пересоздания
          p = mod(p - uCam + box * 0.5, box) - box * 0.5 + uCam;
          p.y = mod(p.y, 16.0);
          vW = p;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float z = -mv.z;
          // ближние пылинки — не в фокусе: крупный мягкий диск
          float coc = clamp(abs(z - 6.0) * 0.35, 0.0, 5.0);
          gl_PointSize = clamp((0.012 + aR * 0.012) * uPx / max(z, 0.1) + coc, 1.0, 40.0);
          vB = coc;
          vA = step(aR, uAmount) * smoothstep(28.0, 8.0, z) * smoothstep(0.3, 1.2, z);
        }`,fragmentShader:M+`
        uniform vec3 uCam;
        varying float vA;
        varying float vB;
        varying vec3 vW;
        void main() {
          if (vA < 0.01) discard;
          vec2 q = gl_PointCoord - 0.5;
          float d = length(q) * 2.0;
          float a = mix(exp(-d * d * 5.0), smoothstep(1.0, 0.75, d) * 0.6, clamp(vB / 4.0, 0.0, 1.0));
          vec3 V = normalize(vW - uCam);
          // прямое рассеяние: пылинки против солнца вспыхивают
          float ph = 0.05 + 2.2 * pow(max(dot(V, uSunDir), 0.0), 12.0) * uSunVis;
          vec3 c = vec3(1.0, 0.72, 0.45) * ph;
          gl_FragColor = vec4(c * a * vA / (1.0 + vB * 0.5), 1.0);
        }`,transparent:!0,depthWrite:!1,blending:2})}},[n,r]),s=D(e=>e.size),l=D(e=>e.viewport.dpr);return O(`earth`,({p:t})=>{o.uniforms.uPx.value=s.height*l/(2*Math.tan(e.degToRad(c.fov)/2)),o.uniforms.uAmount.value=.3+L(.5,.95,t)*.7}),(0,j.useEffect)(()=>()=>i.dispose(),[i]),(0,P.jsx)(`points`,{geometry:i,material:o,frustumCulled:!1,renderOrder:5})}function q({u:e}){let{geo:n,glass:a,poles:o,wires:c,mat:l,glassMat:u,wireMat:d,fan:f}=(0,j.useMemo)(()=>{let n=[],a=(e,t,r,i,a=0)=>{e.rotateY(a),e.translate(t,r,i),n.push(e.index?e.toNonIndexed():e)},o=(e,t,n)=>{let r=new x;r.moveTo(-e/2-.4,0),r.lineTo(0,t),r.lineTo(e/2+.4,0),r.lineTo(-e/2-.4,0);let i=new _(r,{depth:n+.8,bevelEnabled:!1});return i.translate(0,0,-(n+.8)/2),i},c=-150;a(new E(11,6.2,8),-58,3.1,c,.3),a(o(11,3.6,8),-58,6.2,c,.3),a(new E(1.1,3,1.1),-55,8.6,-151,.3),a(new E(11.6,.25,3.2),-57.1,3,-144.8,.3);for(let e=0;e<5;e++)a(new i(.1,.1,3,6),-62.6+e*2.4+1.3,1.5,-143.6,.3);let l=-190;a(new E(14,7,20),-96,3.5,l,-.2);{let e=new x;e.moveTo(-7.6,0),e.lineTo(-5.5,3.6),e.lineTo(0,5.6),e.lineTo(5.5,3.6),e.lineTo(7.6,0);let t=new _(e,{depth:20.6,bevelEnabled:!1});t.translate(0,0,-10.3),a(t,-96,7,l,-.2)}for(let[e,t,n,r]of[[-113,-176,3.2,17],[-120,-183,2.6,14]])a(new i(n,n,r,24),e,r/2,t),a(new g(n,24,8,0,Math.PI*2,0,Math.PI/2),e,r,t);let u=-118;for(let e=0;e<4;e++){let t=e/4*Math.PI*2+Math.PI/4,n=new i(.06,.09,13,5);n.rotateZ(Math.cos(t)*.07),n.rotateX(-Math.sin(t)*.07),a(n,-30+Math.cos(t)*.95,6.5,u+Math.sin(t)*.95)}for(let e=1;e<5;e++){let t=e*2.6,n=2-t*.12;a(new E(n,.06,.06),-30,t,u+n/2),a(new E(n,.06,.06),-30,t,u-n/2),a(new E(.06,.06,n),-30+n/2,t,u),a(new E(.06,.06,n),-30-n/2,t,u)}a(new E(.3,.3,2.4),-30,13.1,-117.6),a(new E(.04,1.2,1.8),-30,13.3,-115.8);for(let e=20;e>-420;e-=6)a(new i(.07,.08,1.3,5),12.4,.65,e);let d=A(n);d.computeVertexNormals();let f=[],p=(e,t,n)=>{let r=new s(1.1,1.4);r.rotateY(.3),r.translate(e,t,n),f.push(r)},m=Math.cos(.3),h=Math.sin(.3);for(let[e,t]of[[-3,1.7],[2.5,1.7],[-3,4.6],[.2,4.6]])p(-58+e*m+4.02*h,t,c-e*h+4.02*m);let y=A(f),b=[];for(let e=0;e<14;e++){let t=new E(.28,1.5,.02);t.translate(0,.95,0),t.rotateY(.35),t.rotateZ(e/14*Math.PI*2),b.push(t)}let C=new S(1.5,.03,4,32);b.push(C.toNonIndexed());let w=A(b.map(e=>e.index?e.toNonIndexed():e)),D=[],O=[],k=[];for(let e=30;e>-1600;e-=42)k.push(e);k.forEach((e,t)=>{let n=19.8+Math.sin(t*1.7)*.2,r=Math.sin(t*2.3)*.03,a=new i(.11,.15,9,6);a.rotateZ(r),a.translate(n,4.5,e),D.push(a.toNonIndexed());let o=new E(2.4,.12,.12);if(o.translate(n,8.3,e),D.push(o.toNonIndexed()),t<k.length-1){let r=k[t+1],i=19.8+Math.sin((t+1)*1.7)*.2;for(let t of[-1,0,1])for(let a=0;a<10;a++){let o=a/10,s=(a+1)/10,c=e=>8.4-Math.sin(Math.PI*e)*.55;O.push(n+t+(i-n)*o,c(o),e+(r-e)*o),O.push(n+t+(i-n)*s,c(s),e+(r-e)*s)}}});let j=A(D),N=new t;N.setAttribute(`position`,new r(O,3));let P=new T({uniforms:e,vertexShader:`
        varying vec3 vWorld;
        varying vec3 vN;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,fragmentShader:M+`
        uniform vec3 uCam;
        varying vec3 vWorld;
        varying vec3 vN;
        void main() {
          vec3 N = normalize(vN);
          vec3 alb = vec3(0.2, 0.16, 0.13);
          float ndl = max(dot(N, uSunDir), 0.0);
          vec3 col = alb * (vec3(1.0, 0.68, 0.4) * 2.4 * ndl * uSunVis + vec3(0.3, 0.26, 0.24) * (0.4 + 0.3 * N.y));
          col = applyHaze(col, vWorld, uCam);
          gl_FragColor = vec4(col, 1.0);
        }`}),F=new T({uniforms:e,vertexShader:`
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,fragmentShader:M+`
        uniform vec3 uCam;
        varying vec3 vWorld;
        void main() {
          vec3 col = vec3(3.2, 1.7, 0.7);
          col = applyHaze(col, vWorld, uCam);
          gl_FragColor = vec4(col, 1.0);
        }`}),I={geo:w,pos:new v(-30,13.1,-118.9)};return{geo:d,glass:y,poles:j,wires:N,mat:P,glassMat:F,wireMat:new T({uniforms:e,vertexShader:`
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,fragmentShader:M+`
        uniform vec3 uCam;
        varying vec3 vWorld;
        void main() {
          gl_FragColor = vec4(applyHaze(vec3(0.05, 0.04, 0.035), vWorld, uCam), 1.0);
        }`}),fan:I}},[e]),p=(0,j.useRef)(null);return O(`earth`,({dt:e,p:t})=>{p.current&&(p.current.rotation.z-=e*(1.4+t*3))}),(0,j.useEffect)(()=>()=>{[n,a,o,c,f.geo].forEach(e=>e.dispose()),l.dispose(),u.dispose(),d.dispose()},[n,a,o,c,f,l,u,d]),(0,P.jsxs)(P.Fragment,{children:[(0,P.jsx)(`mesh`,{geometry:n,material:l}),(0,P.jsx)(`mesh`,{geometry:a,material:u}),(0,P.jsx)(`mesh`,{geometry:o,material:l}),(0,P.jsx)(`lineSegments`,{geometry:c,material:d}),(0,P.jsx)(`mesh`,{ref:p,geometry:f.geo,material:l,position:f.pos,"rotation-y":0})]})}var J={pos:new o([new v(.4,1.32,3),new v(.2,1.4,-4),new v(-.6,1.9,-11),new v(-2,4.2,-19),new v(-3.2,5.6,-26),new v(-3.8,4.6,-31)]),look:new o([new v(7,1.5,-45),new v(5,1.9,-52),new v(2,4,-60),new v(-22,10,-110),new v(-12,22,-160),new v(-8,16,-150)])};function Y(){let t=R();return O(`earth`,({p:n,t:r})=>{let i=I(n);J.pos.getPoint(i,c.pos),J.look.getPoint(i,c.look),c.fov=e.lerp(34,44,L(.3,.7,n)),c.near=.05,c.far=5e3,c.shake=.01+L(.6,1,n)*.018,c.roll=Math.sin(r*.13)*.004,t.uTime.value=r,t.uCam.value.copy(c.pos);let a=L(.12,.95,n);t.uStorm.value=a*.85,t.uSunVis.value=e.lerp(1,.18,L(.62,.9,n)),t.uDust.value=L(.84,1,n),C.bloom=1+(1-L(.6,.9,n))*.2,C.focus.copy(c.look),C.focusRange=60,C.bokeh=1.3*(1-L(.25,.45,n))}),(0,P.jsxs)(P.Fragment,{children:[(0,P.jsx)(z,{u:t}),(0,P.jsx)(B,{u:t}),(0,P.jsx)(q,{u:t}),(0,P.jsx)(G,{u:t}),(0,P.jsx)(U,{u:t}),(0,P.jsx)(K,{u:t})]})}export{Y as default};