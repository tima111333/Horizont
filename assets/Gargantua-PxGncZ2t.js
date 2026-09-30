import{B as e,E as t,H as n,Q as r,V as i,_ as a,a as o,at as s,b as c,c as l,d as u,dt as d,f,ft as p,g as m,h,lt as g,m as _,p as v,r as y,tt as b,v as x,y as S}from"./index-Rph-gfxM.js";import{t as C}from"./useScrollScene-C_OY7xky.js";import{PartMeshes as w,glowTexture as T,useEnduranceGeo as E,useShipMaterials as D}from"./Launch-C2UOj6Pv.js";var O=p(d(),1),k=`// Гаргантюа. Фотоны летят по уравнению Шварцшильда в виде «ньютоновской»
// силы a = -3/2 · h² · x / r⁵ (единицы: радиус горизонта rs = 1, h — удельный
// момент луча). Интегратор — полунеявный Эйлер с шагом, растущим с радиусом.
// Тонкий диск в плоскости y = 0: при каждом пересечении луч набирает свет диска
// и теряет прозрачность. Верхняя и нижняя дуги над тенью — это дальняя часть
// того же диска, увиденная через искривление: их никто не рисует отдельно.
uniform samplerCube uSky;
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;      // позиция камеры в единицах rs
uniform float uTime;
uniform float uSteps;
uniform float uDiskIn;
uniform float uDiskOut;
uniform float uDoppler;
uniform float uGain;
uniform float uSkyGain;
uniform mat3 uSkyRot;
varying vec2 vUv;

#define PI 3.14159265

// цвет по «температуре» 0..1: от тёмно-красного через золото к бело-жёлтому
vec3 heat(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 a = vec3(0.55, 0.12, 0.02);
  vec3 b = vec3(1.0, 0.55, 0.15);
  vec3 c = vec3(1.0, 0.9, 0.72);
  vec3 d = vec3(1.0, 0.98, 0.94);
  if (t < 0.35) return mix(a, b, t / 0.35);
  if (t < 0.7) return mix(b, c, (t - 0.35) / 0.35);
  return mix(c, d, (t - 0.7) / 0.3);
}

// плотность и цвет диска в точке пересечения
vec4 disk(vec3 p, vec3 photonDir) {
  float r = length(p.xz);
  if (r < uDiskIn || r > uDiskOut) return vec4(0.0);
  float phi = atan(p.z, p.x);
  // кеплеровское вращение: внутренние кольца обгоняют внешние, почти незаметно
  float w = pow(r, -1.5) * 0.9;
  float ang = phi + w * uTime;
  vec3 q = vec3(r * 3.2, cos(ang) * 2.2, sin(ang) * 2.2);
  float n = fbm3(q) * 0.5 + 0.5;
  float n2 = fbm3(q * vec3(2.6, 1.6, 1.6) + 7.0) * 0.5 + 0.5;
  float streaks = 0.7 + 0.3 * sin(r * 17.0 + n * 9.0 + n2 * 4.0);
  float dens = smoothstep(0.15, 0.8, n) * (0.45 + 0.55 * n2) * streaks;
  // мягкие края: внутренний обрыв у ISCO и затухание к внешнему краю
  dens *= smoothstep(uDiskIn, uDiskIn + 0.35, r) * smoothstep(uDiskOut, uDiskOut * 0.62, r);

  // профиль яркости тонкого диска: T ∝ r^-3/4 (1 - √(rin/r))^1/4
  float x = uDiskIn / r;
  float T = pow(x, 0.75) * pow(max(1.0 - sqrt(x * 0.85), 0.0), 0.25) * 1.25;
  // доплер: вещество летит по кругу вокруг +y; фотон к камере — против хода луча
  float v = sqrt(0.5 / max(r - 1.0, 0.2));
  v = min(v, 0.7);
  vec3 vel = normalize(vec3(-p.z, 0.0, p.x)) * v;
  float gamma = 1.0 / sqrt(1.0 - v * v);
  float D = 1.0 / (gamma * (1.0 - dot(vel, photonDir)));
  // гравитационное красное смещение у горизонта
  float grav = sqrt(max(1.0 - 1.0 / r, 0.0));
  float boost = mix(1.0, pow(D * grav, 3.0), uDoppler);
  float temp = T * mix(1.0, D * grav, uDoppler * 0.6);
  vec3 col = heat(temp * 0.95) * T * T * 2.5 * boost;
  return vec4(col, clamp(dens * 1.4, 0.0, 0.97));
}

void main() {
  vec4 view = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  view /= view.w;
  vec3 wo = (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 rd = normalize((uCamWorld * vec4(view.xyz, 1.0)).xyz - wo);

  vec3 pos = uCamPos;
  vec3 vel = rd;
  vec3 hvec = cross(pos, vel);
  float h2 = dot(hvec, hvec);

  vec3 acc = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  float glow = 0.0;

  for (int i = 0; i < 400; i++) {
    if (float(i) >= uSteps) break;
    float r2 = dot(pos, pos);
    float r = sqrt(r2);
    if (r < 1.0) { captured = true; break; }
    if (r > 80.0 && dot(pos, vel) > 0.0) break;
    float dt = clamp(0.05 * r, 0.012, 2.5);
    // ближе к фотонной сфере — мельче шаг
    dt *= mix(0.45, 1.0, smoothstep(1.4, 3.0, r));
    vec3 a = -1.5 * h2 * pos / (r2 * r2 * r);
    vec3 prev = pos;
    vel += a * dt;
    pos += vel * dt;
    // лёгкое свечение вокруг тени — рассеянный свет горячего газа
    glow += exp(-abs(pos.y) * 4.0) * smoothstep(9.0, 2.5, r) * dt * 0.003;
    if (prev.y * pos.y < 0.0) {
      float t = prev.y / (prev.y - pos.y);
      vec3 hit = mix(prev, pos, t);
      vec4 d = disk(hit, -normalize(vel));
      acc += trans * d.rgb * d.a;
      trans *= 1.0 - d.a;
      if (trans < 0.02) break;
    }
  }
  vec3 col = acc;
  if (!captured && trans > 0.02) col += trans * textureCube(uSky, uSkyRot * normalize(vel)).rgb * uSkyGain;
  col += vec3(1.0, 0.7, 0.4) * glow * trans;
  gl_FragColor = vec4(col * uGain, 1.0);
}
`,A=c(),j=m(`gargantua`),M=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},N=e.lerp,P=[[0,46,.2,-.35],[.3,30,.15,-.2],[.6,19,.1,.05],[.82,12.5,.06,.18],[1,2.2,.02,.3]];function F(e){for(let t=0;t<P.length-1;t++){let[n,r,i,a]=P[t],[o,s,c,l]=P[t+1];if(e<=o){let t=M(n,o,e);return[Math.exp(N(Math.log(r),Math.log(s),t)),N(i,c,t),N(a,l,t)]}}let t=P[P.length-1];return[t[1],t[2],t[3]]}function I(){let{camera:e}=S(),t=u(`far`),a=(0,O.useMemo)(()=>new b({uniforms:{uSky:{value:t},uProjInv:{value:new n},uCamWorld:{value:new n},uCamPos:{value:new g(0,2,30)},uTime:{value:0},uSteps:{value:h?150:320},uDiskIn:{value:2.6},uDiskOut:{value:13},uDoppler:{value:.55},uGain:{value:1},uSkyGain:{value:1},uSkyRot:{value:new i().setFromMatrix4(new n().makeRotationFromQuaternion(new r().setFromUnitVectors(new g(0,0,-1),new g(-.2,.95,.24).normalize())))}},vertexShader:`
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,fragmentShader:f+k,depthTest:!1,depthWrite:!1}),[t]);return(0,O.useEffect)(()=>()=>a.dispose(),[a]),x(()=>{_.act===j&&(e.updateMatrixWorld(),a.uniforms.uProjInv.value.copy(e.projectionMatrixInverse),a.uniforms.uCamWorld.value.copy(e.matrixWorld),a.uniforms.uCamPos.value.copy(e.position))},0),C(`gargantua`,({t:e,p:t})=>{a.uniforms.uTime.value=e*.35,a.uniforms.uSteps.value=(h?150:320)+M(.85,1,t)*80,a.uniforms.uGain.value=1-M(.93,1,t)*.9}),(0,A.jsx)(`mesh`,{material:a,frustumCulled:!1,renderOrder:-10,children:(0,A.jsx)(`planeGeometry`,{args:[2,2]})})}var L=.52,R=.88,z=.075,B=new g(0,0,4.5),V=new g,H=new g,U=new g,W=new g,G=new g(0,1,0);function K(e,t,n){let[r,i,a]=F(e);t.set(Math.sin(a)*Math.cos(i),Math.sin(i),Math.cos(a)*Math.cos(i)).multiplyScalar(r),n.set(0,N(-.6,0,M(.6,1,e)),0)}var q=new g,J=new g(0,0,1);function Y(e,t,n){K(e,V,H),U.subVectors(H,V).normalize(),W.crossVectors(U,G).normalize();let r=M(0,.5,e),i=M(.56,.95,e);t.copy(V).addScaledVector(U,7.5+i*7).addScaledVector(W,N(-3.4,1.6,r)+i*i*12).add(new g(0,-.45+r*.25+i*2.5,0)),q.copy(U).multiplyScalar(-.62+i*.3).addScaledVector(W,.7-r*.15).addScaledVector(G,.3).normalize(),n.setFromUnitVectors(J,q)}function X(){let e=D(),n=E(),i=o(`ranger`),a=(0,O.useMemo)(()=>y(i),[i]),c=(0,O.useRef)(null),l=(0,O.useRef)(null),u=(0,O.useRef)(null),d=(0,O.useRef)(0),f=(0,O.useMemo)(()=>new s({map:T(),color:new t(.75,.85,1),blending:2,depthWrite:!1,transparent:!0,opacity:0}),[]),p=(0,O.useMemo)(()=>new s({map:T(),color:new t(1,.85,.65),blending:2,depthWrite:!1,transparent:!0,opacity:0}),[]);(0,O.useEffect)(()=>()=>{f.dispose(),p.dispose()},[f,p]);let m=(0,O.useMemo)(()=>new g,[]),h=(0,O.useMemo)(()=>new r,[]),_=(0,O.useMemo)(()=>new g,[]),v=(0,O.useMemo)(()=>new g(0,0,0),[]);return C(`gargantua`,({p:e,t,dt:n})=>{let r=c.current;Y(e,r.position,r.quaternion),r.visible=e<.97,d.current+=n*.25,l.current.rotation.z=d.current;let i=M(.55,.6,e)*(1-M(.9,.97,e));f.opacity=i*(.85+.15*Math.sin(t*37));let a=u.current;if(e<L)a.position.copy(r.position).add(B.clone().multiplyScalar(z).applyQuaternion(r.quaternion)),a.quaternion.copy(r.quaternion),a.scale.setScalar(z),p.opacity=0;else{Y(L,m,h),_.copy(m).add(B.clone().multiplyScalar(z).applyQuaternion(h));let n=M(L,R,e),r=n*n*n;a.position.lerpVectors(_,v,r),a.position.addScaledVector(new g(0,.25,0),Math.sin(n*Math.PI)*(1-n)),a.lookAt(v),a.rotateY(Math.PI),a.rotateZ(n*1.6),a.quaternion.slerp(h,1-M(L,.5800000000000001,e));let i=a.position.length();a.scale.setScalar(z*M(2.4,4.5,i)),p.opacity=M(.53,.5700000000000001,e)*M(2.4,5,i)*(.8+.2*Math.sin(t*29))}}),(0,A.jsxs)(A.Fragment,{children:[(0,A.jsxs)(`group`,{ref:c,scale:z,children:[(0,A.jsx)(`group`,{ref:l,children:(0,A.jsx)(w,{geos:n.ring,mats:e,shadows:!1,cull:!1})}),(0,A.jsx)(w,{geos:n.hub,mats:e,shadows:!1,cull:!1}),(0,A.jsx)(`sprite`,{material:f,position:[0,0,-3.2],scale:[9,9,1]})]}),(0,A.jsxs)(`group`,{ref:u,scale:1e-4,children:[(0,A.jsx)(w,{geos:a,mats:e,shadows:!1,cull:!1}),(0,A.jsx)(`sprite`,{material:p,position:[0,.02,2],scale:[3.6,3.6,1]})]})]})}function Z(){let e=l([{pos:[0,0,-30],size:[90,8],color:`#ffc27a`,intensity:3},{pos:[0,10,-28],size:[40,3],color:`#ffd9a8`,intensity:1.2}],`#000000`,`gargantua`,.8),t=(0,O.useMemo)(()=>new g,[]);return C(`gargantua`,({p:n,t:r,state:i})=>{i.scene.environment=e,i.scene.environmentIntensity=.8;let[o,s,c]=F(n),l=c+Math.sin(r*.03)*.02;t.set(Math.sin(l)*Math.cos(s),Math.sin(s),Math.cos(l)*Math.cos(s)),a.pos.copy(t).multiplyScalar(o),a.look.set(0,N(-.6,0,M(.6,1,n)),0),a.fov=N(34,50,M(.55,1,n)),a.near=.01,a.far=1e3,a.shake=.004+M(.85,1,n)*.02,a.roll=-.08+Math.sin(r*.05)*.01,v.bloom=1+M(.6,.9,n)*.3}),(0,A.jsxs)(A.Fragment,{children:[(0,A.jsx)(I,{}),(0,A.jsx)(X,{}),(0,A.jsx)(`directionalLight`,{position:[0,1,-10],intensity:2.2,color:`#ffc98a`}),(0,A.jsx)(`ambientLight`,{intensity:.05})]})}export{Z as default};