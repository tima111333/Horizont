// Акт II. Старт с Земли, стыковка «Рейнджера» с кольцом «Эндюранс», раскрутка
// кольца и включение маршевых двигателей. Земля — лучевым проходом снизу.
import { useEffect, useMemo, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import * as THREE from 'three'
import noise from '../shaders/noise.glsl?raw'
import { useScrollScene } from '../hooks/useScrollScene'
import { rig } from '../core/rig'
import { fx } from '../core/fx'
import { S, isLow } from '../story/store'
import { SkyBackground, Starfield } from '../core/sky'
import { Planet } from '../components/Planet'
import { useEnvMap } from '../core/envmap'
import { HUB_LEN, RANGER_DOCK_FACE, RANGER_DOCK_Y, RING_R, type Part } from '../models/endurance'
import type { Img } from '../models/textures'
import { toParts, toTexture, useAsset, type SerialGeo } from '../core/assets'

export const SUN_DIR = new THREE.Vector3(0.86, 0.3, -0.42).normalize()
const EARTH_R = 2000
const EARTH_C = new THREE.Vector3(0, -EARTH_R - 128, 0)
// передняя плоскость узла хаба (тор r 0.56, трубка 0.07) + вылет кольца «Рейнджера»
const DOCK_Z = HUB_LEN / 2 + 0.45 + 0.07 - RANGER_DOCK_FACE

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// ─── материалы корабля ──────────────────────────────────────────────────────
/** геометрия «Эндюранса» из воркера — общая для всех сцен, где он появляется */
export function useEnduranceGeo() {
  const e = useAsset<{ ring: Partial<Record<Part, SerialGeo>>; hub: Partial<Record<Part, SerialGeo>> }>('endurance')
  return useMemo(() => ({ ring: toParts<Part>(e.ring), hub: toParts<Part>(e.hub) }), [e])
}

export function useShipMaterials() {
  const hI = useAsset<{ map: Img; normal: Img; rough: Img }>('hull')
  const foilI = useAsset<Img>('foil')
  const tileI = useAsset<Img>('tiles')
  return useMemo(() => {
    const h = { map: toTexture(hI.map), normal: toTexture(hI.normal), rough: toTexture(hI.rough) }
    const foilN = toTexture(foilI)
    const tile = toTexture(tileI)
    // белая краска по металлу: диэлектрик с лаком, а не зеркало
    const hull = new THREE.MeshPhysicalMaterial({
      color: '#b9b8b2',
      map: h.map,
      normalMap: h.normal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: h.rough,
      roughness: 1,
      metalness: 0.12,
      clearcoat: 0.3,
      clearcoatRoughness: 0.35,
    })
    const foil = new THREE.MeshStandardMaterial({ color: '#d6a24a', metalness: 1, roughness: 0.3, normalMap: foilN, normalScale: new THREE.Vector2(1.1, 1.1) })
    const dark = new THREE.MeshStandardMaterial({ color: '#2b2c2f', metalness: 0.65, roughness: 0.42, normalMap: h.normal, normalScale: new THREE.Vector2(0.4, 0.4) })
    // радиаторы и люки: матовая белая эмаль, темнее обшивки — иначе на солнце они выбеливаются в плоские пятна
    const panel = new THREE.MeshStandardMaterial({ color: '#a9aaa6', metalness: 0.2, roughness: 0.62, normalMap: h.normal, normalScale: new THREE.Vector2(0.3, 0.3) })
    const glow = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffcf8a', emissiveIntensity: 2.4, toneMapped: true })
    const nozzle = new THREE.MeshStandardMaterial({ color: '#3b3733', metalness: 0.9, roughness: 0.33, side: THREE.DoubleSide })
    const glass = new THREE.MeshPhysicalMaterial({ color: '#07090d', metalness: 0.1, roughness: 0.04, clearcoat: 1 })
    const tileM = new THREE.MeshStandardMaterial({ map: tile, metalness: 0.35, roughness: 0.5, color: '#9aa0b0' })
    tile.repeat.set(2, 2)
    // горло сопла: гаснет в покое, раскаляется при включении двигателей
    const fire = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#bcd6ff', emissiveIntensity: 0.2 })
    const set: Record<Part, THREE.Material> = { hull, foil, dark, panel, glow, nozzle, glass, tile: tileM, fire }
    return set
  }, [hI, foilI, tileI])
}

/** мягкий круглый блик для факелов и огней — виден под любым углом */
export const glowTexture = (() => {
  let t: THREE.Texture | null = null
  return () => {
    if (t) return t
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const x = c.getContext('2d')!
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.15, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.45, 'rgba(255,255,255,0.12)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 128, 128)
    t = new THREE.CanvasTexture(c)
    return t
  }
})()

export function PartMeshes({ geos, mats, shadows = true, cull = true }: { geos: Partial<Record<Part, THREE.BufferGeometry>>; mats: Record<Part, THREE.Material>; shadows?: boolean; cull?: boolean }) {
  return (
    <>
      {(Object.keys(geos) as Part[]).map((k) => (
        <mesh key={k} geometry={geos[k]} material={mats[k]} castShadow={shadows && k !== 'glow'} receiveShadow={shadows && k !== 'glow'} frustumCulled={cull} />
      ))}
    </>
  )
}

// ─── факел двигателя: конус с шумом, голубое ядро, тёплая кромка ─────────────
const plumeMat = () =>
  new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uI: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader:
      noise +
      /* glsl */ `
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
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })

// ─── корабль ────────────────────────────────────────────────────────────────
function Endurance({ spin, burn, hover }: { spin: { angle: number }; burn: { v: number }; hover: { v: number } }) {
  const mats = useShipMaterials()
  const geo = useEnduranceGeo()
  const ring = useRef<THREE.Group>(null)
  const plume = useMemo(() => plumeMat(), [])
  const plumeGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.34, 4.2, 20, 1, true)
    g.translate(0, -2.1, 0)
    return g
  }, [])
  // сопла двигательных модулей в координатах кольца
  const nozzles = useMemo(() => {
    const out: { pos: THREE.Vector3; rot: THREE.Euler }[] = []
    for (let i = 2; i < 12; i += 3) {
      const a = (i / 12) * Math.PI * 2
      const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a - Math.PI / 2)), new THREE.Vector3(1, 1, 1))
      for (const x of [-0.55, 0.55]) out.push({ pos: new THREE.Vector3(x, 0, -1.9).applyMatrix4(m), rot: new THREE.Euler(-Math.PI / 2, 0, 0) })
    }
    return out
  }, [])
  const glowMat = mats.glow as THREE.MeshStandardMaterial
  const fireMat = mats.fire as THREE.MeshStandardMaterial
  const flare = useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(0.7, 0.82, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    [],
  )

  useScrollScene('launch', ({ t, dt }) => {
    ring.current!.rotation.z = spin.angle
    plume.uniforms.uT.value = t
    const flick = 0.9 + 0.1 * Math.sin(t * 40)
    plume.uniforms.uI.value = burn.v * flick
    fireMat.emissiveIntensity = 0.2 + burn.v * 40 * flick
    flare.opacity = burn.v
    flare.color.setRGB(0.7 * 3 * flick, 0.82 * 3 * flick, 3 * flick)
    // наведение: окна ярче, модули «откликаются» лёгким доворотом кольца
    glowMat.emissiveIntensity = 2.4 + hover.v * 4 + burn.v * 1.5
    void dt
  })

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    S.hover3d = true
    gsap.to(hover, { v: 1, duration: 0.6, ease: 'power3.out', overwrite: true })
  }
  const onOut = () => {
    S.hover3d = false
    gsap.to(hover, { v: 0, duration: 0.9, ease: 'power3.inOut', overwrite: true })
  }

  return (
    <group ref={ring} onPointerOver={onOver} onPointerOut={onOut}>
      <PartMeshes geos={geo.ring} mats={mats} />
      <PartMeshes geos={geo.hub} mats={mats} />
      {nozzles.map((n, i) => (
        <group key={i}>
          <mesh geometry={plumeGeo} material={plume} position={n.pos} rotation={n.rot} frustumCulled={false} />
          <sprite material={flare} position={[n.pos.x, n.pos.y, n.pos.z - 0.1]} scale={1.3} />
        </group>
      ))}
    </group>
  )
}

function Ranger({ spin, pos }: { spin: { angle: number }; pos: THREE.Vector3 }) {
  const mats = useShipMaterials()
  const rI = useAsset<Partial<Record<Part, SerialGeo>>>('ranger')
  const geo = useMemo(() => toParts<Part>(rI), [rI])
  const ref = useRef<THREE.Group>(null)
  const plume = useMemo(() => plumeMat(), [])
  const plumeGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.16, 1.6, 16, 1, true)
    g.translate(0, -0.8, 0)
    return g
  }, [])
  const dock = useMemo(() => new THREE.Vector3(), [])
  const hold = useMemo(() => new THREE.Vector3(), [])
  const rcs = useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(0.85, 0.92, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }),
    [],
  )
  const flash = useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(1, 0.9, 0.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }),
    [],
  )
  const puffs = useRef<(THREE.Sprite | null)[]>([])
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
  useScrollScene('launch', ({ p, t }) => {
    const g = ref.current!
    // точка стыковки: кольцо к кольцу, ось узла совпадает с осью хаба
    dock.set(pos.x, pos.y - RANGER_DOCK_Y, pos.z)
    // ожидание: в нескольких метрах перед узлом, чуть сбоку и под углом, мелкие поправки
    hold.set(dock.x + 2.2 + Math.sin(t * 0.4) * 0.06, dock.y + 1.0 + Math.sin(t * 0.33) * 0.05, dock.z + 10)
    // сближение по прокрутке: разворот на ось, медленный подход, последние сантиметры — касание
    const a = ease(smooth(0.26, 0.48, p))
    const c = smooth(0.48, 0.52, p)
    const align = smooth(0.26, 0.44, p)
    g.position.lerpVectors(hold, dock, a)
    g.position.z += (1 - c) * 0.3 * a
    // касание: лёгкий толчок амортизаторов
    g.position.z -= Math.sin(Math.PI * smooth(0.515, 0.545, p)) * 0.025
    const docked = smooth(0.5, 0.52, p)
    const wob = (1 - align) * 0.02
    g.rotation.set(-0.06 * (1 - align) + Math.sin(t * 0.5) * wob, 0.14 * (1 - align) + Math.sin(t * 0.37) * wob, 0.2 * (1 - align) + spin.angle * docked)
    // двигатели ориентации: короткие вспышки, пока челнок подходит и доворачивает
    const active = smooth(0.2, 0.28, p) * (1 - smooth(0.49, 0.51, p))
    puffs.current.forEach((s, i) => {
      if (!s) return
      const h = Math.sin(t * (5.3 + i * 1.7) + i * 11.1) * Math.sin(t * (2.1 + i * 0.9) + i * 3.7)
      s.material.opacity = active * Math.max(0, (h - 0.55) / 0.45)
    })
    // захват: вспышка в стыке и огни кольца ярче
    const cap = Math.sin(Math.PI * smooth(0.505, 0.56, p))
    flash.opacity = cap
    plume.uniforms.uT.value = t
    plume.uniforms.uI.value = 0
  })
  const puffAt: [number, number, number][] = [
    [0.22, 0.05, -2.05],
    [-0.22, 0.05, -2.05],
    [0.62, 0.12, 1.4],
    [-0.62, 0.12, 1.4],
    [0, 0.26, -1.6],
  ]
  return (
    <group ref={ref}>
      {/* без отсечения: пробный кадр прогрева должен нарисовать челнок, даже пока он за кадром */}
      <PartMeshes geos={geo} mats={mats} cull={false} />
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} geometry={plumeGeo} material={plume} position={[x, 0.02, 1.65]} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false} />
      ))}
      {puffAt.map((q, i) => (
        <sprite key={i} ref={(s) => (puffs.current[i] = s)} material={rcs.clone()} position={q} scale={[0.5, 0.5, 1]} />
      ))}
      <sprite material={flash} position={[0, RANGER_DOCK_Y, RANGER_DOCK_FACE - 0.05]} scale={[2.2, 2.2, 1]} />
    </group>
  )
}

// ─── след ракеты: поднимается из облаков, голова — яркая точка ─────────────
function RocketTrail({ head }: { head: { v: number; fade: number } }) {
  const { curve, geo, mat, sprite } = useMemo(() => {
    const s0 = new THREE.Vector3(-90, 0, -420)
    s0.y = EARTH_C.y + Math.sqrt(EARTH_R * EARTH_R - s0.x * s0.x - s0.z * s0.z)
    const up = s0.clone().sub(EARTH_C).normalize()
    const curve = new THREE.CatmullRomCurve3([
      s0,
      s0.clone().addScaledVector(up, 30),
      new THREE.Vector3(-60, -70, -250),
      new THREE.Vector3(-22, -18, -90),
      new THREE.Vector3(-3, 0, 6),
      new THREE.Vector3(2.5, 0.6, 26),
    ])
    const geo = new THREE.TubeGeometry(curve, 400, 0.3, 10, false)
    const mat = new THREE.ShaderMaterial({
      uniforms: { uHead: { value: 0 }, uT: { value: 0 }, uFade: { value: 1 } },
      vertexShader: /* glsl */ `
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
        }`,
      fragmentShader: /* glsl */ `
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
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const sprite = new THREE.SpriteMaterial({
      map: (() => {
        const c = document.createElement('canvas')
        c.width = c.height = 64
        const x = c.getContext('2d')!
        const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
        g.addColorStop(0, 'rgba(255,255,255,1)')
        g.addColorStop(0.2, 'rgba(255,220,170,0.8)')
        g.addColorStop(1, 'rgba(255,160,80,0)')
        x.fillStyle = g
        x.fillRect(0, 0, 64, 64)
        return new THREE.CanvasTexture(c)
      })(),
      color: new THREE.Color(8, 6, 4),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    return { curve, geo, mat, sprite }
  }, [])
  const spr = useRef<THREE.Sprite>(null)
  useScrollScene('launch', ({ t }) => {
    mat.uniforms.uHead.value = head.v
    mat.uniforms.uFade.value = head.fade
    mat.uniforms.uT.value = t
    const h = Math.min(head.v, 0.999)
    curve.getPoint(h, spr.current!.position)
    const d = spr.current!.position.distanceTo(rig.pos)
    const s = Math.max(0.6, d * 0.022) * (head.v > 0 && head.v < 0.97 ? 1 : 0)
    spr.current!.scale.setScalar(s)
  })
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <>
      <mesh geometry={geo} material={mat} frustumCulled={false} />
      <sprite ref={spr} material={sprite} />
    </>
  )
}

// ─── свет ───────────────────────────────────────────────────────────────────
function Lights({ follow }: { follow: THREE.Vector3 }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    const l = light.current!
    l.target = target
    l.shadow.mapSize.set(isLow ? 1024 : 2048, isLow ? 1024 : 2048)
    const c = l.shadow.camera as THREE.OrthographicCamera
    c.left = -14
    c.right = 14
    c.top = 14
    c.bottom = -14
    c.near = 1
    c.far = 80
    c.updateProjectionMatrix()
    l.shadow.bias = -0.0003
    l.shadow.normalBias = 0.03
    l.shadow.radius = 2.5
  }, [target])
  useScrollScene('launch', () => {
    target.position.copy(follow)
    light.current!.position.copy(follow).addScaledVector(SUN_DIR, 40)
  })
  return (
    <>
      <primitive object={target} />
      <directionalLight ref={light} castShadow intensity={5} color="#fff4e4" />
      {/* свет, отражённый Землёй: снизу, холодный */}
      <hemisphereLight args={['#0b0d14', '#5d7db8', 0.55]} />
    </>
  )
}

// ─── ракурсы ────────────────────────────────────────────────────────────────
const KEYS: [number, [number, number, number], [number, number, number], number][] = [
  [0.0, [5, 4, 34], [-70, -95, -330], 40],
  [0.12, [4, 3.5, 32], [-30, -40, -140], 38],
  [0.24, [9, 3, 30], [1, 0.5, 18], 34],
  [0.36, [13, 4.5, 22], [0, 0, 7], 36],
  [0.5, [10, 3, 15], [0, 0, 3], 38],
  [0.62, [21, 7, 7], [0, 0, 0], 42],
  [0.76, [18, -4, -9], [0, 0, 0], 44],
  [0.88, [9, 3.5, -24], [0, 0, 6], 40],
  [1.0, [6, 3, -30], [0, 0, 30], 36],
]
const CAM = {
  pos: new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[1]))),
  look: new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[2]))),
}
function keyT(p: number) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i][0]
    const b = KEYS[i + 1][0]
    if (p <= b) {
      const f = (p - a) / (b - a)
      return (i + f * f * (3 - 2 * f)) / (KEYS.length - 1)
    }
  }
  return 1
}
const fovAt = (p: number) => {
  for (let i = 0; i < KEYS.length - 1; i++) if (p <= KEYS[i + 1][0]) {
    const f = smooth(KEYS[i][0], KEYS[i + 1][0], p)
    return KEYS[i][3] + (KEYS[i + 1][3] - KEYS[i][3]) * f
  }
  return KEYS[KEYS.length - 1][3]
}

export default function Launch() {
  const time = useMemo(() => ({ value: 0 }), [])
  const spinU = useMemo(() => ({ value: 0 }), [])
  const spin = useMemo(() => ({ angle: 0, w: 0 }), [])
  const burn = useMemo(() => ({ v: 0 }), [])
  const hover = useMemo(() => ({ v: 0 }), [])
  const head = useMemo(() => ({ v: 0, fade: 1 }), [])
  const shipPos = useMemo(() => new THREE.Vector3(), [])
  const rangerPos = useMemo(() => new THREE.Vector3(), [])
  const ship = useRef<THREE.Group>(null)
  const env = useEnvMap(
    [
      { pos: SUN_DIR.clone().multiplyScalar(30).toArray() as [number, number, number], size: [3, 3], color: '#fff6ea', intensity: 60, shape: 'disc' },
      { pos: [0, -30, 0], size: [120, 120], color: '#4d6fa8', intensity: 0.9 },
      { pos: [0, -12, -40], size: [160, 14], color: '#8fb0ff', intensity: 0.8 },
    ],
    '#000000',
    'launch',
    1,
  )
  const { gl } = useThree()
  void gl


  useScrollScene('launch', ({ p, t, dt, state }) => {
    state.scene.environment = env
    state.scene.environmentIntensity = 1
    time.value = t
    spinU.value = t * 0.002
    const k = keyT(p)
    CAM.pos.getPoint(k, rig.pos)
    CAM.look.getPoint(k, rig.look)
    rig.fov = fovAt(p)
    rig.near = 0.1
    rig.far = 30000
    rig.shake = 0.012 + burn.v * 0.03 + smooth(0.02, 0.1, p) * (1 - smooth(0.16, 0.24, p)) * 0.05

    // старт: голова следа от поверхности до точки встречи с кольцом
    // ракета уходит с Земли на орбиту вдали и гаснет, не долетая до корабля
    head.v = smooth(0.02, 0.24, p) * 0.62
    head.fade = 1 - smooth(0.2, 0.32, p)
    // точка стыковки на оси хаба; путь к ней «Рейнджер» считает сам
    rangerPos.set(0, 0, DOCK_Z)
    // раскрутка кольца: угловая скорость растёт, угол интегрируется по времени
    const target = smooth(0.56, 0.76, p) * 0.32 + hover.v * S.pointer.sx * 0.08
    spin.w += (target - spin.w) * (1 - Math.exp(-dt * 1.5))
    spin.angle += spin.w * dt
    // маршевые двигатели: разгон к Сатурну
    burn.v = smooth(0.8, 0.86, p)
    const go = smooth(0.84, 1.0, p)
    shipPos.set(0, 0, go * go * 70)
    ship.current!.position.copy(shipPos)
    rig.look.z += shipPos.z * 0.85
    fx.bloom = 1 + burn.v * 0.5 + hover.v * 0.25
  })

  return (
    <>
      <SkyBackground kind="home" intensity={0.9} />
      <Starfield kind="home" count={1600} gain={0.9} />
      <Planet radius={EARTH_R} center={EARTH_C} sun={SUN_DIR} dust={0.6} time={time} spin={spinU} />
      <Lights follow={shipPos} />
      <group ref={ship}>
        <Endurance spin={spin} burn={burn} hover={hover} />
        <Ranger spin={spin} pos={rangerPos} />
      </group>
      <RocketTrail head={head} />
    </>
  )
}
