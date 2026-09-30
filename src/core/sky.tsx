// Звёздное небо двух видов:
//  1) живое поле ярких звёзд — инстансированные точки с мерцанием и глубиной;
//  2) запечённая кубическая карта (галактика + слабые звёзды) — фон для сцен и
//     источник для шейдеров, которые гнут лучи (червоточина, Гаргантюа).
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import noise from '../shaders/noise.glsl?raw'
import milky from '../shaders/milkyway.glsl?raw'
import { isLow } from '../story/store'

export function SkyProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export type SkyKind = 'home' | 'far'

interface SkyParams {
  seed: number
  galN: THREE.Vector3
  core: THREE.Vector3
  tintA: THREE.Color
  tintB: THREE.Color
  neb: THREE.Color
  bright: number
  width: number
  stars: number
  starGain: number
  warm: number
  nebK: number
  neb2: THREE.Color
}

const PARAMS: Record<SkyKind, SkyParams> = {
  home: {
    seed: 3.1,
    galN: new THREE.Vector3(0.25, 0.9, -0.36).normalize(),
    core: new THREE.Vector3(-0.8, 0.12, -0.58).normalize(),
    tintA: new THREE.Color(0.75, 0.78, 0.86),
    tintB: new THREE.Color(1.0, 0.8, 0.58),
    neb: new THREE.Color(0.9, 0.25, 0.3),
    bright: 0.06,
    width: 0.09,
    stars: 26000,
    starGain: 1,
    warm: 0,
    nebK: 0.15,
    neb2: new THREE.Color(0.2, 0.55, 0.65),
  },
  far: {
    seed: 11.7,
    galN: new THREE.Vector3(-0.2, 0.95, 0.24).normalize(),
    core: new THREE.Vector3(0.62, -0.05, -0.78).normalize(),
    tintA: new THREE.Color(0.95, 0.88, 0.78),
    tintB: new THREE.Color(1.0, 0.78, 0.5),
    neb: new THREE.Color(1.0, 0.32, 0.3),
    bright: 0.4,
    width: 0.18,
    stars: 60000,
    starGain: 1.3,
    warm: 0.25,
    // чужая галактика богаче: её видно в сфере — «хрустальный шар» должен читаться
    nebK: 0.6,
    neb2: new THREE.Color(0.25, 0.65, 0.8),
  },
}

/** цвет звезды по температуре — приближение планковского спектра, линейный RGB */
export function kelvin(t: number, out = new THREE.Color()) {
  const x = t / 100
  let r: number, g: number, b: number
  if (x <= 66) {
    r = 255
    g = 99.47 * Math.log(x) - 161.12
    b = x <= 19 ? 0 : 138.52 * Math.log(x - 10) - 305.04
  } else {
    r = 329.7 * Math.pow(x - 60, -0.1332)
    g = 288.12 * Math.pow(x - 60, -0.0755)
    b = 255
  }
  out.setRGB(
    Math.min(255, Math.max(0, r)) / 255,
    Math.min(255, Math.max(0, g)) / 255,
    Math.min(255, Math.max(0, b)) / 255,
    THREE.SRGBColorSpace,
  )
  return out
}

function rng(seed: number) {
  let s = Math.floor(seed * 9973) % 2147483647 || 1
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

interface StarOpts {
  count: number
  /** доля: только яркие (живое поле), только слабые (фон) или все */
  range: [number, number]
  radius: number
  seed: number
  galN: THREE.Vector3
  warm: number
}

/** геометрия звёзд: направление концентрируется к плоскости галактики */
function starGeometry(o: StarOpts) {
  const R = rng(o.seed)
  const pos: number[] = []
  const col: number[] = []
  const mag: number[] = []
  const ph: number[] = []
  const dep: number[] = []
  const v = new THREE.Vector3()
  const c = new THREE.Color()
  let guard = 0
  while (mag.length < o.count && guard++ < o.count * 40) {
    const m = Math.pow(R(), 5.5) // степенной закон: слабых на порядки больше
    if (m < o.range[0] || m >= o.range[1]) continue
    v.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1)
    const l = v.length()
    if (l > 1 || l < 0.05) continue
    v.divideScalar(l)
    const b = v.dot(o.galN)
    if (R() > 0.3 + 0.7 * Math.exp((-b * b) / 0.04)) continue
    pos.push(v.x * o.radius, v.y * o.radius, v.z * o.radius)
    const t = 2800 + Math.pow(R(), 1.6) * 11000 - o.warm * 1500
    kelvin(Math.max(2400, t), c)
    col.push(c.r, c.g, c.b)
    mag.push(m)
    ph.push(R())
    dep.push(Math.pow(R(), 3))
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('aMag', new THREE.Float32BufferAttribute(mag, 1))
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1))
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), o.radius * 1.01)
  return g
}

const starVert = /* glsl */ `
attribute vec3 aColor;
attribute float aMag;
attribute float aPhase;
attribute float aDepth;
uniform float uTime;
uniform float uTwinkle;
uniform float uPx;
uniform float uGain;
varying vec3 vColor;
varying float vSoft;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // мерцание: у каждой звезды своя фаза и две частоты
  float tw = 1.0 + uTwinkle * (0.32 * sin(uTime * (1.1 + aPhase * 2.3) + aPhase * 40.0)
                             + 0.18 * sin(uTime * (3.3 + aPhase * 1.7) + aPhase * 91.0));
  // «глубина»: часть звёзд чуть вне фокуса — крупнее и мягче при той же энергии
  float blur = 1.0 + aDepth * 0.9;
  float size = (1.5 + aMag * 5.0) * uPx * blur;
  gl_PointSize = max(size, 1.5);
  float energy = (0.18 + aMag * aMag * 9.0) * tw * uGain;
  vColor = aColor * energy / (blur * blur);
  vSoft = aDepth;
}
`
const starFrag = /* glsl */ `
varying vec3 vColor;
varying float vSoft;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d2 = dot(q, q) * 4.0;
  float k = mix(7.0, 2.6, vSoft);
  float a = exp(-d2 * k) - exp(-k);
  if (a <= 0.001) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
}
`

function starMaterial(px: number, twinkle: number, gain: number, transparent = true) {
  return new THREE.ShaderMaterial({
    vertexShader: starVert,
    fragmentShader: starFrag,
    uniforms: {
      uTime: { value: 0 },
      uTwinkle: { value: twinkle },
      uPx: { value: px },
      uGain: { value: gain },
    },
    // живое поле рисуется в непрозрачном списке до планет (renderOrder), аддитивно
    transparent,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

function milkyMaterial(p: SkyParams) {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: noise + milky,
    uniforms: {
      uGalN: { value: p.galN },
      uCore: { value: p.core },
      uTintA: { value: p.tintA },
      uTintB: { value: p.tintB },
      uNeb: { value: p.neb },
      uBright: { value: p.bright },
      uWidth: { value: p.width },
      uSeed: { value: p.seed },
      uNebK: { value: p.nebK },
      uNeb2: { value: p.neb2 },
    },
    side: THREE.BackSide,
    depthWrite: false,
  })
}

/** Далёкая спиральная галактика — только для «чужого» неба */
function farGalaxy() {
  const tex = (() => {
    const s = 512
    const cv = document.createElement('canvas')
    cv.width = cv.height = s
    const ctx = cv.getContext('2d')!
    const img = ctx.createImageData(s, s)
    const R = rng(5.5)
    const d = img.data
    for (let i = 0; i < 26000; i++) {
      const arm = i % 2
      const t = Math.pow(R(), 0.8) * 3.4
      const r = 0.04 + t * 0.12
      const a = t * 2.2 + arm * Math.PI + (R() - 0.5) * 0.7
      const x = Math.floor(s / 2 + Math.cos(a) * r * s * 0.5 + (R() - 0.5) * 18)
      const y = Math.floor(s / 2 + Math.sin(a) * r * s * 0.5 + (R() - 0.5) * 18)
      if (x < 0 || y < 0 || x >= s || y >= s) continue
      const k = (y * s + x) * 4
      const b = 20 + R() * 40
      d[k] = Math.min(255, d[k] + b)
      d[k + 1] = Math.min(255, d[k + 1] + b * 0.85)
      d[k + 2] = Math.min(255, d[k + 2] + b * (0.7 + 0.5 * R()))
      d[k + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    ctx.globalCompositeOperation = 'lighter'
    ctx.filter = 'blur(6px)'
    ctx.drawImage(cv, 0, 0)
    ctx.filter = 'none'
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.18)
    g.addColorStop(0, 'rgba(255,236,200,1)')
    g.addColorStop(0.3, 'rgba(255,210,150,0.45)')
    g.addColorStop(1, 'rgba(255,190,120,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(2.2, 2.0, 1.8) }),
  )
  m.position.set(-0.45, 0.28, -0.85).normalize().multiplyScalar(3500)
  m.lookAt(0, 0, 0)
  m.rotateZ(0.6)
  m.rotateX(1.05)
  return m
}

// ─── кэш запечённых небес с подсчётом ссылок ─────────────────────────────────
const cache = new Map<string, { rt: THREE.WebGLCubeRenderTarget; refs: number; timer?: number }>()

function bake(gl: THREE.WebGLRenderer, kind: SkyKind, withBright: boolean) {
  const p = PARAMS[kind]
  const size = isLow ? 512 : 1024
  const rt = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  })
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0)
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(5000, 64, 32), milkyMaterial(p))
  scene.add(sphere)
  const px = size / 1024
  const faint = new THREE.Points(
    starGeometry({ count: isLow ? p.stars * 0.6 : p.stars, range: [0, 0.035], radius: 4000, seed: p.seed, galN: p.galN, warm: p.warm }),
    starMaterial(px, 0, p.starGain),
  )
  const bright = new THREE.Points(
    starGeometry({ count: 900, range: [0.035, 1.01], radius: 4000, seed: p.seed + 1, galN: p.galN, warm: p.warm }),
    starMaterial(px, 0, p.starGain),
  )
  scene.add(faint)
  // для фона обычных сцен яркие звёзды рисует живой Starfield — в куб их не кладём
  if (withBright) scene.add(bright)
  else {
    bright.geometry.dispose()
    ;(bright.material as THREE.Material).dispose()
  }
  if (kind === 'far') scene.add(farGalaxy())
  const cam = new THREE.CubeCamera(1, 10000, rt)
  const prevTarget = gl.getRenderTarget()
  cam.update(gl, scene)
  gl.setRenderTarget(prevTarget)
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose()
    const mat = m.material as THREE.Material | undefined
    if (mat) {
      ;(mat as THREE.MeshBasicMaterial).map?.dispose()
      mat.dispose()
    }
  })
  return rt
}

function getSky(gl: THREE.WebGLRenderer, kind: SkyKind) {
  let e = cache.get(kind)
  if (!e) {
    e = { rt: bake(gl, kind, true), refs: 0 }
    cache.set(kind, e)
  }
  return e.rt.texture
}

/**
 * Запечённое небо. Кубы живут всё время: перепекать при возврате к акту —
 * это рывок в сотни миллисекунд. Поэтому оба запекаются заранее, на стартовом экране.
 */
export function useSky(kind: SkyKind) {
  const gl = useThree((s) => s.gl)
  return useMemo(() => getSky(gl, kind), [gl, kind])
}

/** запечь небеса по одному на кадр, пока зритель на стартовом экране */
export function prebakeSkies(gl: THREE.WebGLRenderer) {
  return new Promise<void>((done) => {
    const kinds: SkyKind[] = ['home', 'far']
    const step = () => {
      const k = kinds.shift()
      if (!k) return done()
      getSky(gl, k)
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

/** фон-небо для обычных сцен; живой Starfield поверх берёт другой набор ярких звёзд */
export function SkyBackground({ kind, intensity = 1 }: { kind: SkyKind; intensity?: number }) {
  const tex = useSky(kind)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            // чуть ближе дальней плоскости: ровно на ней треугольники неба отсекаются через кадр
            gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
          }`,
        fragmentShader: /* glsl */ `
          uniform samplerCube uSky;
          uniform float uI;
          varying vec3 vDir;
          void main() { gl_FragColor = vec4(textureCube(uSky, normalize(vDir)).rgb * uI, 1.0); }`,
        uniforms: { uSky: { value: tex }, uI: { value: intensity } },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [tex, intensity],
  )
  const ref = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => ref.current?.position.copy(camera.position))
  return (
    <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
      <boxGeometry args={[100, 100, 100]} />
    </mesh>
  )
}

/**
 * Живое поле ярких звёзд: инстансированные точки, мерцание по синусоиде с
 * фазой на звезду, часть звёзд «не в фокусе» — крупнее и мягче.
 */
export function Starfield({ kind = 'home', count = 1400, gain = 1, radius = 3000 }: { kind?: SkyKind; count?: number; gain?: number; radius?: number }) {
  const p = PARAMS[kind]
  const geo = useMemo(
    () => starGeometry({ count: isLow ? count * 0.5 : count, range: [0.035, 1.01], radius, seed: p.seed + 2, galN: p.galN, warm: p.warm }),
    [count, radius, p],
  )
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const mat = useMemo(() => starMaterial(1, 1, gain * p.starGain, false), [gain, p])
  const ref = useRef<THREE.Points>(null)
  const camera = useThree((s) => s.camera)
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt
    // размер точки в пикселях от высоты кадра: 1.0 при 1024 пикс на 90°
    const cam = camera as THREE.PerspectiveCamera
    mat.uniforms.uPx.value = (size.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / 512
    ref.current?.position.copy(camera.position)
  })
  useEffect(() => () => geo.dispose(), [geo])
  return <points ref={ref} geometry={geo} material={mat} renderOrder={-9} frustumCulled={false} />
}
