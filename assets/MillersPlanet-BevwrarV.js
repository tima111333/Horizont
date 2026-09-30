import{$ as e,B as t,C as n,P as r,S as i,T as a,U as o,X as s,Y as c,Z as l,_ as u,b as d,ct as f,dt as p,et as m,f as h,ft as g,g as _,h as v,lt as y,m as b,p as x,rt as S,tt as C,ut as w,v as T,y as E,z as D}from"./index-Rph-gfxM.js";import{t as O}from"./useScrollScene-C_OY7xky.js";var k=g(p(),1),A=`// Рябь от курсора: двумерное волновое уравнение на сетке 256×256 (пинг-понг).
// R — высота сейчас, G — высота на прошлом шаге. Капля от курсора — гауссов импульс.
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uDrop;       // координаты капли в UV области, x < 0 — капли нет
uniform float uDropR;
uniform float uDropK;
varying vec2 vUv;

void main() {
  vec2 c = texture2D(uPrev, vUv).rg;
  float h = c.r;
  float hp = c.g;
  float n = texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r;
  float s = texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r;
  float e = texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r;
  float w = texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r;
  // схема «чехарда»: h' = 2h - h_prev + c²∇²h, с затуханием
  float lap = n + s + e + w - 4.0 * h;
  float next = (2.0 * h - hp + 0.45 * lap) * 0.986;
  if (uDrop.x >= 0.0) {
    float d = length((vUv - uDrop) / uTexel);
    next -= uDropK * exp(-d * d / (uDropR * uDropR));
  }
  // края гасят волну — нет отражения от границы области
  vec2 edge = smoothstep(0.0, 0.08, vUv) * smoothstep(1.0, 0.92, vUv);
  next *= edge.x * edge.y;
  gl_FragColor = vec4(next, h, 0.0, 1.0);
}
`,j=d(),M=_(`miller`),N=new y(-.42,.3,-.86).normalize(),P={cx:.6,cz:-7,size:20,res:v?192:256},F=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},I=`
uniform vec3 uGarg;
uniform float uGloom;   // 0..1 — небо темнеет, когда волна закрывает свет
vec3 skyColor(vec3 d) {
  float h = max(d.y, -0.2);
  vec3 horizon = vec3(0.7, 0.76, 0.78);
  vec3 zenith = vec3(0.3, 0.37, 0.42);
  vec3 c = mix(horizon, zenith, pow(max(smoothstep(0.0, 0.75, h), 1e-6), 0.65));
  // яркая полоса у горизонта — свет через тонкую облачность
  c += vec3(0.14, 0.15, 0.14) * exp(-h * h * 160.0);
  // Гаргантюа за дымкой: диск темнее неба, тонкое кольцо фотонов, пояс аккреционного диска
  float a = acos(clamp(dot(d, uGarg), -1.0, 1.0));
  float R = 0.085;
  vec3 gx = normalize(cross(uGarg, vec3(0.0, 1.0, 0.0)));
  vec3 gy = cross(gx, uGarg);
  vec2 q = vec2(dot(d, gx), dot(d, gy)) / R;
  float disk = smoothstep(1.03, 0.97, a / R);
  float rr = (a / R - 1.03) * 30.0;
  float ring = exp(-rr * rr);
  float qb = q.y * 13.0;
  float band = exp(-qb * qb) * smoothstep(2.4, 1.1, abs(q.x)) * (1.0 - disk * 0.6);
  float qa = (length(q) - 1.1) * 16.0;
  float arcs = exp(-qa * qa) * smoothstep(-0.2, 0.6, abs(q.y));
  vec3 g = vec3(1.0, 0.94, 0.84);
  vec3 glow = g * (ring * 0.5 + band * 0.55 + arcs * 0.25) + g * exp(-a * a * 60.0) * 0.08;
  c = mix(c, c * 0.7, disk * 0.8);
  c += glow * 0.42;
  c *= 1.0 - uGloom * 0.55;
  return c;
}
vec3 applyHaze(vec3 col, vec3 wp, vec3 cam) {
  vec3 v = wp - cam;
  float dist = length(v);
  float f = 1.0 - exp(-dist * 0.00017);
  vec3 dir = v / max(dist, 1e-3);
  vec3 hz = skyColor(normalize(vec3(dir.x, 0.015, dir.z)));
  return mix(col, hz, clamp(f, 0.0, 1.0));
}
`;function L({u:e}){let t=(0,k.useMemo)(()=>new C({uniforms:e,vertexShader:`
          varying vec3 vDir;
          void main() {
            vDir = position;
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            // чуть ближе дальней плоскости: ровно на ней треугольники неба отсекаются через кадр
            gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
          }`,fragmentShader:h+I+`
          uniform float uTime;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            vec3 c = skyColor(d);
            // облачный покров: крупные тёмные гряды и светлые разрывы
            vec2 cq = d.xz / max(d.y + 0.08, 0.04);
            float cl = fbm3(vec3(cq * 0.35, uTime * 0.008)) + 0.5 * fbm3(vec3(cq * 1.1 + 3.0, uTime * 0.01));
            c *= 1.0 + cl * 0.16 * smoothstep(0.02, 0.35, d.y) * (1.0 - uGloom);
            gl_FragColor = vec4(c, 1.0);
          }`,side:1,depthWrite:!1}),[e]),n=(0,k.useRef)(null),r=E(e=>e.camera);return O(`miller`,()=>n.current?.position.copy(r.position)),(0,j.jsx)(`mesh`,{ref:n,material:t,renderOrder:-10,frustumCulled:!1,children:(0,j.jsx)(`sphereGeometry`,{args:[5e3,48,24]})})}function R(){let e=v?260:420,t=v?300:520,r=new Float32Array(e*t*3);for(let n=0;n<t;n++){let i=n/(t-1),a=60-(Math.exp(i*Math.log(9060))-1);for(let t=0;t<e;t++){let i=t/(e-1)*2-1,o=Math.sign(i)*Math.abs(i)**1.8*9e3,s=(n*e+t)*3;r[s]=o,r[s+1]=0,r[s+2]=a}}let a=[];for(let n=0;n<t-1;n++)for(let t=0;t<e-1;t++){let r=n*e+t;a.push(r,r+1,r+e,r+1,r+e+1,r+e)}let o=new n;return o.setAttribute(`position`,new i(r,3)),o.setIndex(a),o.boundingSphere=new S(new y(0,0,-4e3),12e3),o}var z=`
uniform float uWaveZ;
uniform float uWaveH;
uniform float uWaveW;
uniform float uTime;
// высота большой волны: крутой фронт к зрителю, пологая спина, неровный гребень
float bigWave(vec2 p) {
  float u = (p.y - uWaveZ) / uWaveW;
  float prof = u > 0.0 ? exp(-u * u * 5.0) : exp(-u * u * 0.35);
  float lat = 0.72 + 0.2 * sin(p.x * 0.0009 + 1.3) + 0.08 * sin(p.x * 0.0041 + uTime * 0.05);
  lat *= smoothstep(9000.0, 2500.0, abs(p.x));
  return uWaveH * prof * lat;
}
// длинная пологая зыбь на мелководье
float swell(vec2 p) {
  return 0.035 * sin(p.y * 0.21 + uTime * 0.9) + 0.02 * sin(p.x * 0.13 + p.y * 0.17 + uTime * 0.7);
}
`;function B({u:e,ripple:t}){let n=(0,k.useMemo)(()=>R(),[]),r=(0,k.useMemo)(()=>new C({uniforms:{...e,uRipple:{value:null},uRippleRect:{value:new y(P.cx,P.cz,P.size)}},vertexShader:z+`
          varying vec3 vW;
          varying vec3 vN;
          varying float vH;
          void main() {
            vec3 p = position;
            float h = bigWave(p.xz);
            float e = max(2.0, abs(p.z) * 0.004);
            float hx = bigWave(p.xz + vec2(e, 0.0));
            float hz = bigWave(p.xz + vec2(0.0, e));
            p.y = h + swell(p.xz);
            vN = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
            vH = h / max(uWaveH, 1.0);
            vec4 w = modelMatrix * vec4(p, 1.0);
            vW = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,fragmentShader:h+I+`
          uniform float uTime;
          // настоящая позиция камеры с дыханием и параллаксом, а не базовая точка ракурса
          #define uCam cameraPosition
          uniform sampler2D uRipple;
          uniform vec3 uRippleRect;
          uniform float uWaveH;
          uniform float uWaveZ;
          varying vec3 vW;
          varying vec3 vN;
          varying float vH;

          // мелкая рябь: сумма направленных волн + шум, высота в метрах
          float ripples(vec2 p) {
            float h = 0.0;
            h += 0.006 * sin(dot(p, vec2(0.8, 0.6)) * 3.1 + uTime * 1.9);
            h += 0.005 * sin(dot(p, vec2(-0.5, 0.86)) * 4.3 + uTime * 2.4);
            h += 0.003 * sin(dot(p, vec2(0.97, -0.24)) * 7.9 + uTime * 3.1);
            h += 0.003 * sin(dot(p, vec2(-0.2, -0.98)) * 11.3 + uTime * 3.7);
            h += 0.012 * vnoise(vec3(p * 1.3, uTime * 0.5)) + 0.006 * vnoise(vec3(p * 3.7, uTime * 0.9));
            return h;
          }

          vec3 seabed(vec2 p) {
            float n = vfbm(vec3(p * 0.9, 0.0), 4);
            float stones = smoothstep(0.62, 0.7, vnoise(vec3(p * 2.6, 3.0)));
            vec3 sand = mix(vec3(0.2, 0.2, 0.19), vec3(0.3, 0.3, 0.28), n);
            return mix(sand, vec3(0.18, 0.19, 0.18), stones * 0.7);
          }

          void main() {
            vec3 V = normalize(uCam - vW);
            float dist = length(vW - uCam);
            vec2 p = vW.xz;
            vec3 n = normalize(vN);
            // рябь гаснет с расстоянием — иначе муар
            float fade = exp(-dist * 0.07);
            if (fade > 0.01) {
              float e = 0.04;
              float h0 = ripples(p);
              float hx = ripples(p + vec2(e, 0.0));
              float hz = ripples(p + vec2(0.0, e));
              n = normalize(n + vec3(-(hx - h0) / e, 0.0, -(hz - h0) / e) * fade * 1.3);
            }
            // рябь от курсора
            vec2 ruv = (p - uRippleRect.xy) / uRippleRect.z + 0.5;
            float rip = 0.0;
            if (ruv.x > 0.0 && ruv.x < 1.0 && ruv.y > 0.0 && ruv.y < 1.0) {
              float t = 1.0 / 256.0;
              float c0 = texture2D(uRipple, ruv).r;
              float cx = texture2D(uRipple, ruv + vec2(t, 0.0)).r;
              float cz = texture2D(uRipple, ruv + vec2(0.0, t)).r;
              vec2 g = vec2(cx - c0, cz - c0) * 18.0;
              n = normalize(n + vec3(-g.x, 0.0, -g.y));
              rip = abs(c0);
            }

            // стекающая по фронту вода: вертикальные струи в нормали
            float face = smoothstep(0.05, 0.3, vH);
            if (face > 0.0) {
              float st = vnoise(vec3(p.x * 0.09, vW.y * 0.012 - uTime * 0.4, 1.0)) - 0.5;
              float st2 = vnoise(vec3(p.x * 0.35, vW.y * 0.03 - uTime * 0.9, 5.0)) - 0.5;
              n = normalize(n + vec3(st * 0.5 + st2 * 0.25, 0.0, 0.0) * face);
            }
            // отражение неба — и самой волны: если луч уходит под гребень, в воде тёмная стена
            vec3 R = reflect(-V, n);
            R.y = abs(R.y) + 0.01;
            vec3 refl = skyColor(normalize(R));
            float toWave = max(p.y - uWaveZ, 1.0);
            float waveElev = uWaveH * 0.8 / toWave;
            float rElev = R.y / max(length(R.xz), 1e-3);
            float inWave = smoothstep(waveElev * 1.05, waveElev * 0.9, rElev) * step(0.0, -R.z) * (1.0 - face);
            refl = mix(refl, mix(vec3(0.06, 0.12, 0.13), skyColor(vec3(0.0, 0.02, -1.0)), 0.45) * (1.0 - uGloom * 0.4), inWave * 0.85);
            // pow() от отрицательного числа — NaN, а bloom размазывает его в чёрное пятно
            float cosT = clamp(dot(n, V), 0.0, 1.0);
            float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);

            // преломление: дно на глубине ~0.45 м, вода съедает красный по длине пути
            float depth = 0.45 + vH * uWaveH;
            float path = depth / max(cosT, 0.08);
            vec2 off = n.xz * 0.12;
            vec3 bed = seabed(p + off);
            // каустики: светлые нити от ряби
            float caus = pow(clamp(1.0 - abs(snoise(vec3((p + off) * 2.2, uTime * 0.7))), 0.0, 1.0), 6.0) * 0.5;
            bed *= 0.85 + caus;
            vec3 absorb = exp(-vec3(0.55, 0.16, 0.12) * path);
            vec3 deep = mix(vec3(0.05, 0.13, 0.14), vec3(0.015, 0.05, 0.06), face);
            vec3 refr = bed * absorb + deep * (1.0 - absorb);

            vec3 col = mix(refr, refl, F);
            // тело волны: тонкий гребень просвечивает бирюзой
            float thin = smoothstep(0.35, 0.95, vH) * pow(1.0 - cosT, 1.5);
            col += vec3(0.08, 0.3, 0.28) * thin * 1.2;
            // пена на гребне и у подножия фронта
            float foamN = vnoise(vec3(p * 0.05, uTime * 0.3)) * 0.6 + vnoise(vec3(p * 0.2, uTime)) * 0.4;
            float foam = smoothstep(0.86, 0.99, vH) * smoothstep(0.4, 0.75, foamN) * 0.8;
            foam += smoothstep(0.03, 0.08, vH) * smoothstep(0.16, 0.06, vH) * smoothstep(0.62, 0.85, foamN) * 0.25;
            col = mix(col, vec3(0.86, 0.9, 0.9), clamp(foam, 0.0, 1.0));
            col += vec3(0.06) * rip * 6.0;
            col = applyHaze(col, vW, uCam);
            // последняя страховка: битый пиксель не должен уйти в bloom
            if (any(isnan(col)) || any(isinf(col))) col = vec3(0.6, 0.66, 0.68);
            gl_FragColor = vec4(max(col, 0.0), 1.0);
          }`}),[e]);return O(`miller`,()=>{r.uniforms.uRipple.value=t.tex}),(0,k.useEffect)(()=>()=>{n.dispose(),r.dispose()},[n,r]),(0,j.jsx)(`mesh`,{geometry:n,material:r,frustumCulled:!1})}function V(){let{gl:t,camera:n}=E(),i=(0,k.useMemo)(()=>{let e={type:r,minFilter:D,magFilter:D,depthBuffer:!1},t=new w(P.res,P.res,e),n=new w(P.res,P.res,e),i=new C({uniforms:{uPrev:{value:null},uTexel:{value:new f(1/P.res,1/P.res)},uDrop:{value:new f(-1,-1)},uDropR:{value:2.2},uDropK:{value:0}},vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:A,depthTest:!1,depthWrite:!1}),a=new m,s=new o(new l(2,2),i);return s.frustumCulled=!1,a.add(s),{a:t,b:n,mat:i,scene:a,cam:new c(-1,1,1,-1,0,1),cur:t,last:new f(-9,-9),tex:t.texture}},[]);(0,k.useEffect)(()=>()=>{i.a.dispose(),i.b.dispose(),i.mat.dispose()},[i]);let a=(0,k.useMemo)(()=>new e,[]),u=(0,k.useMemo)(()=>new s(new y(0,1,0),0),[]),d=(0,k.useMemo)(()=>new y,[]),p=(0,k.useMemo)(()=>new f,[]);return T(()=>{if(b.act!==M)return;p.set(b.pointer.x,b.pointer.y),a.setFromCamera(p,n);let e=!1;if(b.pointer.moved&&a.ray.intersectPlane(u,d)){let t=(d.x-P.cx)/P.size+.5,n=(d.z-P.cz)/P.size+.5,r=t-i.last.x,a=n-i.last.y,o=Math.hypot(r,a);t>.02&&t<.98&&n>.02&&n<.98&&o>.002&&(i.mat.uniforms.uDrop.value.set(t,n),i.mat.uniforms.uDropK.value=Math.min(.25,o*6),e=!0),i.last.set(t,n)}e||i.mat.uniforms.uDrop.value.set(-1,-1);let r=t.getRenderTarget();for(let e=0;e<2;e++){let n=i.cur,r=n===i.a?i.b:i.a;i.mat.uniforms.uPrev.value=n.texture,t.setRenderTarget(r),t.render(i.scene,i.cam),i.cur=r,e===0&&i.mat.uniforms.uDrop.value.set(-1,-1)}t.setRenderTarget(r),i.tex=i.cur.texture},0),i}function H({u:e}){let{geo:t,mat:n}=(0,k.useMemo)(()=>{let t=new l(18e3,1,400,1);return t.translate(0,.5,0),{geo:t,mat:new C({uniforms:e,vertexShader:z+`
        varying vec2 vP;
        varying vec3 vW;
        void main() {
          vec3 p = position;
          // лента стоит на гребне: низ — на вершине волны, верх — выше и ветром назад
          float top = bigWave(vec2(p.x, uWaveZ));
          float y = top * (0.93 + p.y * 0.45);
          vec3 wp = vec3(p.x, y, uWaveZ + 6.0 - p.y * uWaveW * 0.6);
          vP = vec2(p.x, p.y);
          vW = wp;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,fragmentShader:h+I+`
        uniform float uTime;
        uniform float uWaveH;
        varying vec2 vP;
        varying vec3 vW;
        void main() {
          float n = vfbm(vec3(vP.x * 0.004, vP.y * 2.0 - uTime * 0.15, uTime * 0.05), 5);
          float a = smoothstep(0.35, 0.75, n) * smoothstep(1.0, 0.1, vP.y) * smoothstep(0.0, 0.08, vP.y);
          a *= smoothstep(120.0, 260.0, uWaveH);
          vec3 c = vec3(0.82, 0.87, 0.88);
          c = applyHaze(c, vW, cameraPosition);
          gl_FragColor = vec4(c, a * 0.75);
        }`,transparent:!0,depthWrite:!1,side:2})}},[e]);return(0,k.useEffect)(()=>()=>{t.dispose(),n.dispose()},[t,n]),(0,j.jsx)(`mesh`,{geometry:t,material:n,frustumCulled:!1,renderOrder:3})}var U=[[0,[0,1.7,6],[-6,.6,-40],40],[.3,[.5,1.6,2],[-2,1.2,-60],38],[.55,[1.2,1.5,-2],[3,6,-120],42],[.8,[1,1.45,-4],[2,60,-240],50],[1,[.8,1.3,-5],[0,110,-200],56]],W={pos:new a(U.map(e=>new y(...e[1]))),look:new a(U.map(e=>new y(...e[2])))};function G(e){for(let t=0;t<U.length-1;t++){let n=U[t][0],r=U[t+1][0];if(e<=r){let i=(e-n)/(r-n);return(t+i*i*(3-2*i))/(U.length-1)}}return 1}function K(){let e=(0,k.useMemo)(()=>({uGarg:{value:N},uGloom:{value:0},uTime:{value:0},uCam:{value:new y},uWaveZ:{value:-7e3},uWaveH:{value:260},uWaveW:{value:420}}),[]),n=V();return O(`miller`,({p:n,t:r})=>{let i=G(n);W.pos.getPoint(i,u.pos),W.look.getPoint(i,u.look);let a=U[0][3];for(let e=0;e<U.length-1;e++)if(n<=U[e+1][0]){a=t.lerp(U[e][3],U[e+1][3],F(U[e][0],U[e+1][0],n));break}u.fov=a,u.near=.1,u.far=12e3;let o=F(.45,1,n);e.uWaveZ.value=t.lerp(-7200,-320,o**1.6),e.uWaveH.value=t.lerp(240,420,o),e.uWaveW.value=t.lerp(460,230,o),e.uGloom.value=F(.7,1,n),u.shake=.01+F(.75,1,n)*.04,e.uTime.value=r,e.uCam.value.copy(u.pos),x.bloom=1,x.focus.copy(u.look),x.focusRange=400,x.bokeh=.8}),(0,j.jsxs)(j.Fragment,{children:[(0,j.jsx)(L,{u:e}),(0,j.jsx)(B,{u:e,ripple:n}),(0,j.jsx)(H,{u:e})]})}export{K as default};