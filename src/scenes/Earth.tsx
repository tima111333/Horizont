// Акт 0. Поле пшеницы на закате, пыльная буря на горизонте.
import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import noise from '../shaders/noise.glsl?raw'
import atmo from '../shaders/earthAtmo.glsl?raw'
import dustFrag from '../shaders/dust.glsl?raw'
import { useScrollScene } from '../hooks/useScrollScene'
import { rig } from '../core/rig'
import { fx } from '../core/fx'
import { S, isLow } from '../story/store'
import { mulberry } from '../models/wheat'
import { ROAD_X, WHEAT_ARGS } from '../models/wheatConfig'
import { toGeometry, useAsset, type WheatRing } from '../core/assets'

const SUN = new THREE.Vector3(0.44, 0.075, -1).normalize()

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// ─── общие юниформы атмосферы ────────────────────────────────────────────────
function useAtmo() {
  return useMemo(
    () => ({
      uSunDir: { value: SUN.clone() },
      uStorm: { value: 0 },
      uDust: { value: 0 },
      uSunVis: { value: 1 },
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
    }),
    [],
  )
}
type Atmo = ReturnType<typeof useAtmo>

// ─── небо ───────────────────────────────────────────────────────────────────
function Sky({ u }: { u: Atmo }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            // чуть ближе дальней плоскости: ровно на ней треугольники неба отсекаются через кадр
            gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
          }`,
        fragmentShader:
          atmo +
          /* glsl */ `
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
          }`,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [u],
  )
  const ref = useRef<THREE.Mesh>(null)
  useScrollScene('earth', () => ref.current?.position.copy(u.uCam.value))
  return (
    <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[3000, 48, 24]} />
    </mesh>
  )
}

// ─── земля: почва у ног, дальнее поле — шейдером до горизонта ─────────────
function Ground({ u }: { u: Atmo }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { ...u, uRoad: { value: ROAD_X } },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader:
          noise +
          atmo +
          /* glsl */ `
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
          }`,
      }),
    [u],
  )
  return (
    <mesh material={mat} rotation-x={-Math.PI / 2} position={[0, 0, -1500]} frustumCulled={false}>
      <planeGeometry args={[9000, 6000, 1, 1]} />
    </mesh>
  )
}

// ─── пшеница ────────────────────────────────────────────────────────────────
const wheatVert = /* glsl */ `
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
`
const wheatFrag = /* glsl */ `
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
`

function Wheat({ u }: { u: Atmo }) {
  // пучки и их раскладка посчитаны в воркере заранее — здесь только обёртка
  const rings = useAsset<WheatRing[]>('wheat', WHEAT_ARGS)
  const { geos, mat } = useMemo(() => {
    const geos = rings.map((r) => {
      const g = toGeometry(r.geo, true) as THREE.InstancedBufferGeometry
      if (!g.attributes.aInst) {
        g.setAttribute('aInst', new THREE.InstancedBufferAttribute(r.inst, 4))
        g.setAttribute('aVar', new THREE.InstancedBufferAttribute(r.vars, 3))
      }
      g.instanceCount = r.n
      return g
    })
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...u, uWind: { value: 1 }, uWindDir: { value: new THREE.Vector2(0.92, 0.38).normalize() } },
      vertexShader: noise + wheatVert,
      fragmentShader: atmo + wheatFrag,
      side: THREE.DoubleSide,
    })
    return { geos, mat }
  }, [u, rings])
  // геометрия общая с кэшем ассетов — освобождаем только материал
  useEffect(() => () => mat.dispose(), [mat])
  useScrollScene('earth', ({ p }) => {
    // к приходу бури ветер крепчает
    mat.uniforms.uWind.value = 0.8 + smooth(0.45, 0.95, p) * 1.3
  })
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={mat} frustumCulled={false} />
      ))}
    </>
  )
}

// ─── буря ───────────────────────────────────────────────────────────────────
const stormVert = /* glsl */ `
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
`

function Storm({ u }: { u: Atmo }) {
  const layers = isLow ? 2 : 3
  const { geo, mats } = useMemo(() => {
    // дуга от -1.7 до 1.5 рад; правый край «открывается» к солнцу по мере прихода бури
    const geo = new THREE.PlaneGeometry(3.2, 1, isLow ? 96 : 160, 24)
    geo.translate(-0.1, 0.5, 0)
    const mats = Array.from({ length: layers }, (_, i) => {
      const m = new THREE.ShaderMaterial({
        uniforms: {
          ...u,
          uR: { value: 1400 },
          uH: { value: 300 },
          uCenter: { value: new THREE.Vector3(0, -2, -10) },
          uLayer: { value: i },
          uHeight: { value: 300 },
          uOpacity: { value: 1 },
          uParallax: { value: new THREE.Vector2() },
          uOct: { value: isLow ? 3 : 5 - i },
          uEdge: { value: 0.3 },
        },
        vertexShader: stormVert,
        fragmentShader: noise + atmo + dustFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      return m
    })
    return { geo, mats }
  }, [u, layers])
  useEffect(() => () => geo.dispose(), [geo])

  useScrollScene('earth', ({ p }) => {
    const s = smooth(0.08, 0.97, p)
    const R0 = THREE.MathUtils.lerp(1500, 330, Math.pow(s, 1.25))
    const H0 = THREE.MathUtils.lerp(300, 620, Math.sqrt(s))
    const edge = THREE.MathUtils.lerp(0.18, 1.35, smooth(0.3, 0.92, p))
    mats.forEach((m, i) => {
      const k = [1, 0.78, 0.6][i]
      m.uniforms.uR.value = R0 * k
      m.uniforms.uH.value = H0 * [1, 0.62, 0.34][i] * 1.25
      m.uniforms.uHeight.value = H0 * [1, 0.62, 0.34][i]
      m.uniforms.uOpacity.value = [1, 0.8, 0.55][i]
      m.uniforms.uEdge.value = edge - i * 0.08
      // параллакс слоёв от курсора: ближний слой смещается сильнее
      m.uniforms.uParallax.value.set(S.pointer.sx * (8 + i * 16), S.pointer.sy * (3 + i * 5))
    })
  })

  return (
    <>
      {mats.map((m, i) => (
        <mesh key={i} geometry={geo} material={m} frustumCulled={false} renderOrder={-5 + i} />
      ))}
    </>
  )
}

// ─── пыль в воздухе ─────────────────────────────────────────────────────────
function Motes({ u }: { u: Atmo }) {
  const count = isLow ? 1400 : 4200
  const { geo, mat } = useMemo(() => {
    const R = mulberry(77)
    const pos = new Float32Array(count * 3)
    const rnd = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = R() * 60 - 30
      pos[i * 3 + 1] = R() * 16
      pos[i * 3 + 2] = R() * 60 - 30
      rnd[i] = R()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aR', new THREE.BufferAttribute(rnd, 1))
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...u, uPx: { value: 600 }, uAmount: { value: 0.3 } },
      vertexShader: /* glsl */ `
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
        }`,
      fragmentShader:
        atmo +
        /* glsl */ `
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
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [u, count])
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  useScrollScene('earth', ({ p }) => {
    mat.uniforms.uPx.value = (size.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(rig.fov) / 2))
    mat.uniforms.uAmount.value = 0.3 + smooth(0.5, 0.95, p) * 0.7
  })
  useEffect(() => () => geo.dispose(), [geo])
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />
}

// ─── ферма, мельница, столбы — силуэты в дымке ──────────────────────────────
function Farm({ u }: { u: Atmo }) {
  const { geo, glass, poles, wires, mat, glassMat, wireMat, fan } = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) => {
      g.rotateY(ry)
      g.translate(x, y, z)
      parts.push(g.index ? g.toNonIndexed() : g)
    }
    const gable = (w: number, h: number, d: number) => {
      const s = new THREE.Shape()
      s.moveTo(-w / 2 - 0.4, 0)
      s.lineTo(0, h)
      s.lineTo(w / 2 + 0.4, 0)
      s.lineTo(-w / 2 - 0.4, 0)
      const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.8, bevelEnabled: false })
      g.translate(0, 0, -(d + 0.8) / 2)
      return g
    }
    // дом: два этажа, веранда, труба
    const HX = -58
    const HZ = -150
    add(new THREE.BoxGeometry(11, 6.2, 8), HX, 3.1, HZ, 0.3)
    add(gable(11, 3.6, 8), HX, 6.2, HZ, 0.3)
    add(new THREE.BoxGeometry(1.1, 3, 1.1), HX + 3, 8.6, HZ - 1, 0.3)
    add(new THREE.BoxGeometry(11.6, 0.25, 3.2), HX + 0.9, 3.0, HZ + 5.2, 0.3)
    for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), HX - 4.6 + i * 2.4 + 1.3, 1.5, HZ + 6.4, 0.3)
    // амбар с ломаной крышей
    const BX = -96
    const BZ = -190
    add(new THREE.BoxGeometry(14, 7, 20), BX, 3.5, BZ, -0.2)
    {
      const s = new THREE.Shape()
      s.moveTo(-7.6, 0)
      s.lineTo(-5.5, 3.6)
      s.lineTo(0, 5.6)
      s.lineTo(5.5, 3.6)
      s.lineTo(7.6, 0)
      const g = new THREE.ExtrudeGeometry(s, { depth: 20.6, bevelEnabled: false })
      g.translate(0, 0, -10.3)
      add(g, BX, 7, BZ, -0.2)
    }
    // силосные башни
    for (const [x, z, r, h] of [
      [-113, -176, 3.2, 17],
      [-120, -183, 2.6, 14],
    ]) {
      add(new THREE.CylinderGeometry(r, r, h, 24), x, h / 2, z)
      add(new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), x, h, z)
    }
    // ветряк-насос: решётчатая башня из четырёх ног
    const WX = -30
    const WZ = -118
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const leg = new THREE.CylinderGeometry(0.06, 0.09, 13, 5)
      leg.rotateZ(Math.cos(a) * 0.07)
      leg.rotateX(-Math.sin(a) * 0.07)
      add(leg, WX + Math.cos(a) * 0.95, 6.5, WZ + Math.sin(a) * 0.95)
    }
    for (let k = 1; k < 5; k++) {
      const y = k * 2.6
      const w = 2.0 - y * 0.12
      add(new THREE.BoxGeometry(w, 0.06, 0.06), WX, y, WZ + w / 2)
      add(new THREE.BoxGeometry(w, 0.06, 0.06), WX, y, WZ - w / 2)
      add(new THREE.BoxGeometry(0.06, 0.06, w), WX + w / 2, y, WZ)
      add(new THREE.BoxGeometry(0.06, 0.06, w), WX - w / 2, y, WZ)
    }
    add(new THREE.BoxGeometry(0.3, 0.3, 2.4), WX, 13.1, WZ + 0.4)
    // хвост-флюгер
    add(new THREE.BoxGeometry(0.04, 1.2, 1.8), WX, 13.3, WZ + 2.2)
    // изгородь вдоль дороги
    for (let z = 20; z > -420; z -= 6) add(new THREE.CylinderGeometry(0.07, 0.08, 1.3, 5), ROAD_X - 3.6, 0.65, z)

    const geo = mergeGeometries(parts)!
    geo.computeVertexNormals()

    // окна: тёплый свет в доме — единственный живой огонь в кадре
    const gParts: THREE.BufferGeometry[] = []
    const win = (x: number, y: number, z: number) => {
      const g = new THREE.PlaneGeometry(1.1, 1.4)
      g.rotateY(0.3)
      g.translate(x, y, z)
      gParts.push(g)
    }
    const c = Math.cos(0.3)
    const s = Math.sin(0.3)
    for (const [lx, ly] of [
      [-3, 1.7],
      [2.5, 1.7],
      [-3, 4.6],
      [0.2, 4.6],
    ]) {
      win(HX + lx * c + 4.02 * s, ly, HZ - lx * s + 4.02 * c)
    }
    const glass = mergeGeometries(gParts)!

    // лопасти ветряка отдельно — вращаются
    const bl: THREE.BufferGeometry[] = []
    for (let i = 0; i < 14; i++) {
      const g = new THREE.BoxGeometry(0.28, 1.5, 0.02)
      g.translate(0, 0.95, 0)
      g.rotateY(0.35)
      g.rotateZ((i / 14) * Math.PI * 2)
      bl.push(g)
    }
    const ring = new THREE.TorusGeometry(1.5, 0.03, 4, 32)
    bl.push(ring.toNonIndexed())
    const fanGeo = mergeGeometries(bl.map((g) => (g.index ? g.toNonIndexed() : g)))!

    // телеграфные столбы вдоль дороги до горизонта + провода-цепные линии
    const poleParts: THREE.BufferGeometry[] = []
    const wirePts: number[] = []
    const polesZ: number[] = []
    for (let z = 30; z > -1600; z -= 42) polesZ.push(z)
    polesZ.forEach((z, i) => {
      const x = ROAD_X + 3.8 + Math.sin(i * 1.7) * 0.2
      const lean = Math.sin(i * 2.3) * 0.03
      const pole = new THREE.CylinderGeometry(0.11, 0.15, 9, 6)
      pole.rotateZ(lean)
      pole.translate(x, 4.5, z)
      poleParts.push(pole.toNonIndexed())
      const arm = new THREE.BoxGeometry(2.4, 0.12, 0.12)
      arm.translate(x, 8.3, z)
      poleParts.push(arm.toNonIndexed())
      if (i < polesZ.length - 1) {
        const z2 = polesZ[i + 1]
        const x2 = ROAD_X + 3.8 + Math.sin((i + 1) * 1.7) * 0.2
        for (const o of [-1, 0, 1]) {
          const N = 10
          for (let k = 0; k < N; k++) {
            const t0 = k / N
            const t1 = (k + 1) / N
            const sag = (t: number) => 8.4 - Math.sin(Math.PI * t) * 0.55
            wirePts.push(x + o + (x2 - x) * t0, sag(t0), z + (z2 - z) * t0)
            wirePts.push(x + o + (x2 - x) * t1, sag(t1), z + (z2 - z) * t1)
          }
        }
      }
    })
    const poles = mergeGeometries(poleParts)!
    const wires = new THREE.BufferGeometry()
    wires.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3))

    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        varying vec3 vN;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader:
        atmo +
        /* glsl */ `
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
        }`,
    })
    const glassMat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader:
        atmo +
        /* glsl */ `
        uniform vec3 uCam;
        varying vec3 vWorld;
        void main() {
          vec3 col = vec3(3.2, 1.7, 0.7);
          col = applyHaze(col, vWorld, uCam);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    const fan = { geo: fanGeo, pos: new THREE.Vector3(WX, 13.1, WZ - 0.9) }
    const wireMat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader:
        atmo +
        /* glsl */ `
        uniform vec3 uCam;
        varying vec3 vWorld;
        void main() {
          gl_FragColor = vec4(applyHaze(vec3(0.05, 0.04, 0.035), vWorld, uCam), 1.0);
        }`,
    })
    return { geo, glass, poles, wires, mat, glassMat, wireMat, fan }
  }, [u])
  const fanRef = useRef<THREE.Mesh>(null)
  useScrollScene('earth', ({ dt, p }) => {
    if (fanRef.current) fanRef.current.rotation.z -= dt * (1.4 + p * 3)
  })
  useEffect(
    () => () => {
      ;[geo, glass, poles, wires, fan.geo].forEach((g) => g.dispose())
      mat.dispose()
      glassMat.dispose()
      wireMat.dispose()
    },
    [geo, glass, poles, wires, fan, mat, glassMat, wireMat],
  )
  return (
    <>
      <mesh geometry={geo} material={mat} />
      <mesh geometry={glass} material={glassMat} />
      <mesh geometry={poles} material={mat} />
      <lineSegments geometry={wires} material={wireMat} />
      <mesh ref={fanRef} geometry={fan.geo} material={mat} position={fan.pos} rotation-y={0} />
    </>
  )
}

// ─── ракурсы ────────────────────────────────────────────────────────────────
const KEYS = {
  pos: new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.4, 1.32, 3),
    new THREE.Vector3(0.2, 1.4, -4),
    new THREE.Vector3(-0.6, 1.9, -11),
    new THREE.Vector3(-2.0, 4.2, -19),
    new THREE.Vector3(-3.2, 5.6, -26),
    new THREE.Vector3(-3.8, 4.6, -31),
  ]),
  look: new THREE.CatmullRomCurve3([
    new THREE.Vector3(7, 1.5, -45),
    new THREE.Vector3(5, 1.9, -52),
    new THREE.Vector3(2, 4, -60),
    new THREE.Vector3(-22, 10, -110),
    new THREE.Vector3(-12, 22, -160),
    new THREE.Vector3(-8, 16, -150),
  ]),
}

export default function Earth() {
  const u = useAtmo()

  useScrollScene('earth', ({ p, t }) => {
    const e = ease(p)
    KEYS.pos.getPoint(e, rig.pos)
    KEYS.look.getPoint(e, rig.look)
    rig.fov = THREE.MathUtils.lerp(34, 44, smooth(0.3, 0.7, p))
    rig.near = 0.05
    rig.far = 5000
    rig.shake = 0.01 + smooth(0.6, 1, p) * 0.018
    rig.roll = Math.sin(t * 0.13) * 0.004

    u.uTime.value = t
    u.uCam.value.copy(rig.pos)
    const storm = smooth(0.12, 0.95, p)
    u.uStorm.value = storm * 0.85
    // солнце уходит за правый фланг бури, остаётся тусклым диском в пыли
    u.uSunVis.value = THREE.MathUtils.lerp(1, 0.18, smooth(0.62, 0.9, p))
    u.uDust.value = smooth(0.84, 1.0, p)
    fx.bloom = 1 + (1 - smooth(0.6, 0.9, p)) * 0.2
    // низко в колосьях: резкость на горизонте, ближние колосья — мягким боке
    fx.focus.copy(rig.look)
    fx.focusRange = 60
    fx.bokeh = 1.3 * (1 - smooth(0.25, 0.45, p))
  })

  return (
    <>
      <Sky u={u} />
      <Ground u={u} />
      <Farm u={u} />
      <Storm u={u} />
      <Wheat u={u} />
      <Motes u={u} />
    </>
  )
}
