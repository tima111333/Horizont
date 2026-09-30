// Акт I. Комната с книжной полкой: лучи из окна, падающая книга, полосы пыли.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import * as THREE from 'three'
import noise from '../shaders/noise.glsl?raw'
import { useScrollScene } from '../hooks/useScrollScene'
import { rig } from '../core/rig'
import { fx } from '../core/fx'
import { S, isLow } from '../story/store'
import { mulberry } from '../models/wheat'
import { BOOK_SHAPES, bookGeometry, shapeFor } from '../models/book'
import type { Img } from '../models/textures'
import { toTexture, useAsset } from '../core/assets'
import { useEnvMap } from '../core/envmap'
import { actIndex } from '../story/acts'
import { warmers } from '../core/Stage'

// ─── геометрия комнаты ──────────────────────────────────────────────────────
const WX = -2.2 // плоскость окна
const WIN = { z0: 0.9, z1: 2.1, y0: 0.95, y1: 2.3 }
const SHELF = { x0: -0.6, x1: 1.2, h: 2.12, d: 0.36 }
const BOARDS = [0.08, 0.5, 0.92, 1.34, 1.76, 2.1]
const BASE_L = new THREE.Vector3(1, -0.55, -0.42).normalize()
const FALL_SLOT = { shelf: 2, x: 0.36, w: 0.042, h: 0.27, d: 0.2 }
// двоичный узор полос пыли: широкая — единица, узкая — ноль
const BITS = '0100001101001111'
const DUST = { x0: 0.05, z0: 0.55, z1: 1.35, pitch: 0.058 }

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// освещённость точки через окно — одна функция на лучи, пылинки и струи пыли
const litGLSL = /* glsl */ `
uniform vec3 uL;
float windowLit(vec3 p) {
  if (p.x < ${WX.toFixed(2)} || p.y < 0.0 || p.z < 0.0) return 0.0;
  float t = (p.x - (${WX.toFixed(2)})) / uL.x;
  vec3 w = p - uL * t;
  vec2 q = vec2((w.z - ${WIN.z0.toFixed(2)}) / ${(WIN.z1 - WIN.z0).toFixed(2)}, (w.y - ${WIN.y0.toFixed(2)}) / ${(WIN.y1 - WIN.y0).toFixed(2)});
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return 0.0;
  // переплёт: 3 створки по ширине, 2 по высоте; края лучей мягкие (солнце не точка)
  vec2 g = fract(q * vec2(3.0, 2.0));
  float bar = smoothstep(0.0, 0.045, g.x) * smoothstep(1.0, 0.955, g.x) * smoothstep(0.0, 0.05, g.y) * smoothstep(1.0, 0.95, g.y);
  float edge = smoothstep(0.0, 0.03, q.x) * smoothstep(1.0, 0.97, q.x) * smoothstep(0.0, 0.03, q.y) * smoothstep(1.0, 0.97, q.y);
  // за полкой и в её толще света нет
  if (p.z < ${SHELF.d.toFixed(2)} && p.x > ${SHELF.x0.toFixed(2)} && p.x < ${SHELF.x1.toFixed(2)} && p.y < ${SHELF.h.toFixed(2)}) return 0.0;
  return bar * edge;
}
`

// ─── материалы ───────────────────────────────────────────────────────────────
function useMaterials() {
  const woodI = useAsset<{ map: Img; normal: Img }>('wood')
  const planksI = useAsset<{ map: Img; normal: Img; rough: Img }>('planks')
  const wallI = useAsset<Img>('wallpaper')
  const spinesI = useAsset<Img[]>('spines')
  const clothI = useAsset<{ map: Img; normal: Img }>('cloth')
  const edgeI = useAsset<{ map: Img; normal: Img }>('pageEdge')
  return useMemo(() => {
    const w = { map: toTexture(woodI.map), normal: toTexture(woodI.normal) }
    w.map.repeat.set(2, 2)
    w.normal.repeat.set(2, 2)
    const shelfMat = new THREE.MeshStandardMaterial({ map: w.map, normalMap: w.normal, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.5, metalness: 0 })
    const pl = { map: toTexture(planksI.map), normal: toTexture(planksI.normal), rough: toTexture(planksI.rough) }
    for (const t of [pl.map, pl.normal, pl.rough]) t.repeat.set(2.2, 2.2)
    const floorMat = new THREE.MeshStandardMaterial({ map: pl.map, normalMap: pl.normal, roughnessMap: pl.rough, roughness: 1, normalScale: new THREE.Vector2(0.6, 0.6) })
    const wp = toTexture(wallI)
    wp.repeat.set(3, 1.4)
    const wallMat = new THREE.MeshStandardMaterial({ map: wp, roughness: 0.92 })
    const paintMat = new THREE.MeshStandardMaterial({ color: '#b9ae98', roughness: 0.8 })
    // срез страниц: тонкие листы; цветом инстанса не красим — бумага у всех одинаково пожелтела
    const pages = new THREE.MeshStandardMaterial({
      map: toTexture(edgeI.map),
      normalMap: toTexture(edgeI.normal),
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.92,
    })
    pages.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '')
    }
    // крышки: ткань с плетением, цвет — от инстанса
    const clothMap = toTexture(clothI.map)
    const clothN = toTexture(clothI.normal)
    clothMap.repeat.set(3, 3)
    clothN.repeat.set(3, 3)
    const cover = new THREE.MeshStandardMaterial({ map: clothMap, normalMap: clothN, normalScale: new THREE.Vector2(0.45, 0.45), roughness: 0.82 })
    const spines = spinesI.map((im) => spineMaterial(toTexture(im)))
    return { shelfMat, floorMat, wallMat, paintMat, pages, cover, spines }
  }, [woodI, planksI, wallI, spinesI, clothI, edgeI])
}
type Mats = ReturnType<typeof useMaterials>

/**
 * Корешок: ткань красится цветом книги, а тиснение (альфа текстуры = 0) — золото:
 * металл с блеском, цветом книги не тонируется.
 */
export function spineMaterial(map: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.78, metalness: 0 })
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <map_fragment>',
        `float gilt = 0.0;
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          gilt = 1.0 - sampledDiffuseColor.a;
          diffuseColor.rgb *= sampledDiffuseColor.rgb;
        #endif`,
      )
      .replace(
        '#include <color_fragment>',
        `#if defined( USE_COLOR )
          diffuseColor.rgb *= mix(vColor.rgb, vec3(1.0), gilt);
        #endif
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.6, 0.29), gilt);`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.32, gilt);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = mix(metalnessFactor, 1.0, gilt);')
  }
  return m
}

// ─── книги ───────────────────────────────────────────────────────────────────
const PALETTE = ['#6e2a22', '#2c3b2a', '#1f2a3d', '#6b5130', '#4b2233', '#35352f', '#7a6a4a', '#233a3a', '#5a3a1e', '#2a2320', '#8a7355', '#3c2a1c']

interface Book {
  pos: THREE.Vector3
  rot: THREE.Euler
  size: THREE.Vector3
  color: THREE.Color
  variant: number
}

function layoutBooks() {
  const R = mulberry(42)
  const books: Book[] = []
  const inner0 = SHELF.x0 + 0.035
  const inner1 = SHELF.x1 - 0.035
  for (let s = 0; s < BOARDS.length - 1; s++) {
    const y = BOARDS[s] + 0.0125
    const room = BOARDS[s + 1] - BOARDS[s] - 0.04
    let x = inner0 + R() * 0.02
    // верхняя полка — с игрушечным модулем, книг меньше
    const limit = s === 4 ? inner0 + 0.95 : inner1
    while (x < limit - 0.02) {
      if (s === FALL_SLOT.shelf && x + 0.06 > FALL_SLOT.x - FALL_SLOT.w / 2 && x < FALL_SLOT.x + FALL_SLOT.w / 2 + 0.004) {
        x = FALL_SLOT.x + FALL_SLOT.w / 2 + 0.006
        continue
      }
      const r = R()
      if (r < 0.06) {
        x += 0.04 + R() * 0.1
        continue
      }
      if (r < 0.14 && limit - x > 0.3) {
        // стопка лёжа
        const n = 2 + Math.floor(R() * 4)
        let yy = y
        const L = 0.22 + R() * 0.08
        for (let k = 0; k < n; k++) {
          const t = 0.025 + R() * 0.03
          const d = 0.15 + R() * 0.06
          books.push({
            pos: new THREE.Vector3(x + L / 2 + (R() - 0.5) * 0.015, yy + t / 2, SHELF.d - 0.02 - d / 2),
            rot: new THREE.Euler(0, (R() - 0.5) * 0.12, Math.PI / 2),
            size: new THREE.Vector3(t, L, d),
            color: new THREE.Color(PALETTE[Math.floor(R() * PALETTE.length)]),
            variant: Math.floor(R() * 6),
          })
          yy += t
        }
        x += L + 0.01
        continue
      }
      const t = 0.018 + Math.pow(R(), 1.5) * 0.045
      const h = Math.min(room, 0.19 + R() * 0.12)
      const d = 0.13 + R() * 0.09
      const lean = r > 0.94 ? 0.2 + R() * 0.12 : 0
      books.push({
        pos: new THREE.Vector3(x + t / 2 + Math.sin(lean) * h * 0.5, y + (h / 2) * Math.cos(lean), SHELF.d - 0.018 - d / 2 - R() * 0.015),
        rot: new THREE.Euler(0, 0, -lean),
        size: new THREE.Vector3(t, h, d),
        color: new THREE.Color(PALETTE[Math.floor(R() * PALETTE.length)]).multiplyScalar(0.75 + R() * 0.45),
        variant: Math.floor(R() * 6),
      })
      x += t + 0.001 + (lean ? Math.sin(lean) * h : 0)
    }
  }
  return books
}

function Books({ m }: { m: Mats }) {
  const meshes = useMemo(() => {
    const books = layoutBooks()
    const geos = BOOK_SHAPES.map((sh) => bookGeometry(sh))
    const o = new THREE.Object3D()
    // по мешу на пару «пропорции переплёта × рисунок корешка»
    const groups: { shape: number; v: number; list: Book[] }[] = []
    for (let sh = 0; sh < geos.length; sh++)
      for (let v = 0; v < m.spines.length; v++) {
        const list = books.filter((b) => b.variant === v && shapeFor(b.size.x) === sh)
        if (list.length) groups.push({ shape: sh, v, list })
      }
    return groups.map(({ shape, v, list }) => {
      const mesh = new THREE.InstancedMesh(geos[shape], [m.cover, m.spines[v], m.pages], list.length)
      list.forEach((b, i) => {
        o.position.copy(b.pos)
        o.rotation.copy(b.rot)
        o.scale.copy(b.size)
        o.updateMatrix()
        mesh.setMatrixAt(i, o.matrix)
        mesh.setColorAt(i, b.color)
      })
      mesh.castShadow = true
      mesh.receiveShadow = true
      return mesh
    })
  }, [m])
  return (
    <>
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </>
  )
}

// ─── полка ───────────────────────────────────────────────────────────────────
function Shelf({ m }: { m: Mats }) {
  const { x0, x1, h, d } = SHELF
  const W = x1 - x0
  const cx = (x0 + x1) / 2
  return (
    <group>
      {[x0 + 0.015, x1 - 0.015].map((x) => (
        <mesh key={x} position={[x, h / 2, d / 2]} material={m.shelfMat} castShadow receiveShadow>
          <boxGeometry args={[0.03, h, d]} />
        </mesh>
      ))}
      {BOARDS.map((y) => (
        <mesh key={y} position={[cx, y, d / 2]} material={m.shelfMat} castShadow receiveShadow>
          <boxGeometry args={[W - 0.03, 0.025, d]} />
        </mesh>
      ))}
      <mesh position={[cx, h / 2, 0.006]} material={m.shelfMat} receiveShadow>
        <boxGeometry args={[W, h, 0.012]} />
      </mesh>
      {/* цоколь и карниз */}
      <mesh position={[cx, 0.04, d - 0.01]} material={m.shelfMat} castShadow receiveShadow>
        <boxGeometry args={[W, 0.08, 0.02]} />
      </mesh>
      <mesh position={[cx, h + 0.02, d / 2 + 0.01]} material={m.shelfMat} castShadow receiveShadow>
        <boxGeometry args={[W + 0.06, 0.04, d + 0.04]} />
      </mesh>
    </group>
  )
}

/** игрушечный посадочный модуль на верхней полке — отсылка к мечте о космосе */
function ToyLander() {
  const foil = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8a052', metalness: 1, roughness: 0.32 }), [])
  const grey = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8d8d88', metalness: 0.4, roughness: 0.5 }), [])
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.4 }), [])
  return (
    <group position={[0.95, BOARDS[4] + 0.0125, 0.2]} rotation-y={-0.5} scale={0.9}>
      <mesh position={[0, 0.07, 0]} material={foil} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.06, 8]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <group key={i}>
            <mesh position={[Math.cos(a) * 0.09, 0.04, Math.sin(a) * 0.09]} rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]} material={grey} castShadow>
              <cylinderGeometry args={[0.004, 0.004, 0.1, 5]} />
            </mesh>
            <mesh position={[Math.cos(a) * 0.115, 0.004, Math.sin(a) * 0.115]} material={grey}>
              <cylinderGeometry args={[0.014, 0.014, 0.005, 10]} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[0, 0.13, 0]} material={grey} castShadow>
        <cylinderGeometry args={[0.055, 0.065, 0.07, 6]} />
      </mesh>
      <mesh position={[0.02, 0.14, 0.055]} rotation-x={-0.2} material={dark}>
        <boxGeometry args={[0.03, 0.022, 0.004]} />
      </mesh>
      <mesh position={[0, 0.19, 0]} material={grey}>
        <cylinderGeometry args={[0.012, 0.012, 0.05, 6]} />
      </mesh>
    </group>
  )
}

// ─── комната ─────────────────────────────────────────────────────────────────
function Room({ m }: { m: Mats }) {
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.45, 0.72), toneMapped: true }), [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0.2, 0, 1.6]} material={m.floorMat} receiveShadow>
        <planeGeometry args={[5.6, 3.6]} />
      </mesh>
      <mesh position={[0.2, 1.35, 0]} material={m.wallMat} receiveShadow>
        <planeGeometry args={[5.6, 2.7]} />
      </mesh>
      <mesh position={[0.2, 2.7, 1.6]} rotation-x={Math.PI / 2} material={m.paintMat}>
        <planeGeometry args={[5.6, 3.6]} />
      </mesh>
      <mesh position={[2.6, 1.35, 1.6]} rotation-y={-Math.PI / 2} material={m.wallMat} receiveShadow>
        <planeGeometry args={[3.6, 2.7]} />
      </mesh>
      {/* левая стена с проёмом окна: четыре куска вокруг */}
      {(
        [
          [WIN.z0 / 2, 1.35, WIN.z0, 2.7],
          [(WIN.z1 + 3.4) / 2, 1.35, 3.4 - WIN.z1, 2.7],
          [(WIN.z0 + WIN.z1) / 2, WIN.y0 / 2, WIN.z1 - WIN.z0, WIN.y0],
          [(WIN.z0 + WIN.z1) / 2, (WIN.y1 + 2.7) / 2, WIN.z1 - WIN.z0, 2.7 - WIN.y1],
        ] as const
      ).map(([z, y, w, h], i) => (
        <mesh key={i} position={[WX - 0.1, y, z]} material={m.wallMat} castShadow receiveShadow>
          <boxGeometry args={[0.2, h, w]} />
        </mesh>
      ))}
      {/* переплёт окна */}
      {[1, 2].map((k) => (
        <mesh key={'v' + k} position={[WX - 0.05, (WIN.y0 + WIN.y1) / 2, WIN.z0 + ((WIN.z1 - WIN.z0) * k) / 3]} material={m.paintMat} castShadow>
          <boxGeometry args={[0.05, WIN.y1 - WIN.y0, 0.04]} />
        </mesh>
      ))}
      <mesh position={[WX - 0.05, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2]} material={m.paintMat} castShadow>
        <boxGeometry args={[0.05, 0.045, WIN.z1 - WIN.z0]} />
      </mesh>
      <mesh position={[WX + 0.04, WIN.y0 - 0.02, (WIN.z0 + WIN.z1) / 2]} material={m.paintMat} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.04, WIN.z1 - WIN.z0 + 0.16]} />
      </mesh>
      {/* за окном — пыльное закатное небо */}
      <mesh position={[WX - 1.2, 1.6, 1.5]} rotation-y={Math.PI / 2} material={glowMat}>
        <planeGeometry args={[6, 4]} />
      </mesh>
      {/* плинтус */}
      <mesh position={[0.2, 0.05, 0.01]} material={m.paintMat}>
        <boxGeometry args={[5.6, 0.1, 0.02]} />
      </mesh>
    </group>
  )
}

// ─── падающая книга ─────────────────────────────────────────────────────────
function FallingBook({ m }: { m: Mats }) {
  const ref = useRef<THREE.Mesh>(null)
  const yawRef = useRef<THREE.Group>(null)
  const { tl, st } = useMemo(() => {
    const y0 = BOARDS[FALL_SLOT.shelf] + 0.0125 + FALL_SLOT.h / 2
    const z0 = SHELF.d - 0.02 - FALL_SLOT.d / 2
    // yaw — поворот вокруг вертикали мира (внешняя группа), rx/ry/rz — самой книги.
    // Лёжа на крышке: rx = ry = π/2 — толщина вверх, верх книги к комнате.
    const st = { x: FALL_SLOT.x, y: y0, z: z0, rx: 0, ry: 0, rz: 0, yaw: 0 }
    // таймлайн 0..1, её прогресс равен доле пути по отрезку прокрутки
    const tl = gsap.timeline({ paused: true })
    tl.to(st, { z: z0 + 0.09, yaw: 0.05, duration: 0.24, ease: 'power2.inOut' })
      .to(st, { z: z0 + 0.13, rz: 0.03, duration: 0.08, ease: 'power1.in' })
      // клюёт вперёд через край полки
      .to(st, { rx: 0.55, y: y0 + 0.01, z: z0 + 0.16, duration: 0.12, ease: 'power2.in' })
      // летит, переворачиваясь на крышку
      .to(st, { rx: Math.PI / 2 + 0.05, ry: Math.PI / 2 - 0.12, rz: 0, yaw: 0.3, y: FALL_SLOT.w / 2 + 0.002, z: 0.78, x: FALL_SLOT.x + 0.06, duration: 0.36, ease: 'power2.in' })
      // удар: подскок края и шлепок плашмя
      .to(st, { y: FALL_SLOT.w / 2 + 0.018, ry: Math.PI / 2 - 0.22, duration: 0.08, ease: 'power2.out' })
      .to(st, { y: FALL_SLOT.w / 2 + 0.001, rx: Math.PI / 2, ry: Math.PI / 2, yaw: 0.42, duration: 0.12, ease: 'bounce.out' })
    return { tl, st }
  }, [])
  const color = useMemo(() => new THREE.Color('#5e2a22'), [])
  const geo = useMemo(() => bookGeometry(BOOK_SHAPES[shapeFor(FALL_SLOT.w)]), [])
  const mats = useMemo(() => {
    const c = m.cover.clone()
    c.color = color
    const sp = spineMaterial(m.spines[0].map!)
    sp.color = color
    return [c, sp, m.pages]
  }, [m, color])
  useScrollScene('shelf', ({ p }) => {
    tl.progress(smooth(0.3, 0.47, p) ** 1)
    const b = ref.current!
    const g = yawRef.current!
    g.position.set(st.x, st.y, st.z)
    g.rotation.set(0, st.yaw, 0)
    b.rotation.set(st.rx, st.ry, st.rz)
    bookPos.copy(g.position)
  })
  return (
    <group ref={yawRef}>
      <mesh ref={ref} geometry={geo} material={mats} castShadow receiveShadow scale={[FALL_SLOT.w, FALL_SLOT.h, FALL_SLOT.d]} />
    </group>
  )
}

// ─── полосы пыли на полу и струйки, из которых они растут ─────────────────
function DustLines({ u }: { u: Record<string, THREE.IUniform> }) {
  const { alpha, width } = useMemo(() => {
    // маска полос: ширина по битам, края рыхлые, внутри — зерно
    const W = 1024
    const H = 512
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    const R = mulberry(5)
    const total = BITS.length * DUST.pitch
    for (let i = 0; i < BITS.length; i++) {
      const cx = ((i + 0.5) * DUST.pitch) / total
      const bw = (BITS[i] === '1' ? 0.036 : 0.012) / total
      for (let k = 0; k < 9000 * (BITS[i] === '1' ? 2 : 1); k++) {
        const gx = (R() + R() + R() - 1.5) / 1.5
        const x = (cx + gx * bw * 0.7) * W
        const y = R() * H
        const a = 0.25 + R() * 0.5
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.fillRect(x, y, 1 + R() * 1.5, 1 + R() * 1.5)
      }
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.NoColorSpace
    return { alpha: t, width: total }
  }, [])
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#cdbb9c', roughness: 1, alphaMap: alpha, transparent: true, opacity: 0, depthWrite: false })
    m.polygonOffset = true
    m.polygonOffsetFactor = -2
    return m
  }, [alpha])

  // струйки: пылинки падают столбиками точно над полосами и светятся только в луче
  const count = isLow ? 1200 : 3200
  const streams = useMemo(() => {
    const R = mulberry(8)
    const pos = new Float32Array(count * 3)
    const rnd = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const b = Math.floor(R() * BITS.length)
      const bw = BITS[b] === '1' ? 0.03 : 0.01
      pos[i * 3] = DUST.x0 + (b + 0.5) * DUST.pitch + (R() - 0.5) * bw
      pos[i * 3 + 1] = R() * 2.6
      pos[i * 3 + 2] = DUST.z0 + R() * (DUST.z1 - DUST.z0)
      rnd[i] = R()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aR', new THREE.BufferAttribute(rnd, 1))
    const m = new THREE.ShaderMaterial({
      uniforms: { ...u, uFall: { value: 0 }, uPx: { value: 800 } },
      vertexShader:
        litGLSL +
        /* glsl */ `
        attribute float aR;
        uniform float uTime;
        uniform float uFall;
        uniform float uPx;
        varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y - uTime * (0.35 + aR * 0.3), 2.6);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(0.004 * uPx / -mv.z, 1.0, 4.0);
          vA = windowLit(p) * uFall * step(aR, uFall) * (0.4 + 0.6 * aR);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          if (vA < 0.01) discard;
          float d = length(gl_PointCoord - 0.5) * 2.0;
          gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * 2.2 * vA * (1.0 - d * d), 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { g, m }
  }, [u, count])
  const size = useThree((s) => s.size)
  useScrollScene('shelf', ({ p }) => {
    mat.opacity = smooth(0.58, 0.88, p) * 0.85
    streams.m.uniforms.uFall.value = smooth(0.52, 0.62, p) * (1 - smooth(0.9, 0.98, p) * 0.7)
    streams.m.uniforms.uPx.value = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(rig.fov) / 2))
  })
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[DUST.x0 + width / 2, 0.002, (DUST.z0 + DUST.z1) / 2]} material={mat} receiveShadow>
        <planeGeometry args={[width, DUST.z1 - DUST.z0]} />
      </mesh>
      <points geometry={streams.g} material={streams.m} frustumCulled={false} />
    </>
  )
}

// ─── объёмные лучи: марш по лучу до глубины сцены ───────────────────────────
function GodRays({ u }: { u: Record<string, THREE.IUniform> }) {
  const { gl, scene, camera, size } = useThree()
  const scale = isLow ? 0.35 : 0.5
  const { rt, mat, occl } = useMemo(() => {
    const w = Math.max(2, Math.floor(size.width * gl.getPixelRatio() * scale))
    const h = Math.max(2, Math.floor(size.height * gl.getPixelRatio() * scale))
    const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true })
    rt.depthTexture = new THREE.DepthTexture(w, h)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...u,
        uDepth: { value: rt.depthTexture },
        uProjInv: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uIntensity: { value: 1 },
        uSteps: { value: isLow ? 18 : 30 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader:
        noise +
        litGLSL +
        /* glsl */ `
        uniform sampler2D uDepth;
        uniform mat4 uProjInv;
        uniform mat4 uCamWorld;
        uniform float uNear;
        uniform float uFar;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uSteps;
        varying vec2 vUv;
        void main() {
          float z = texture2D(uDepth, vUv).r;
          vec4 clip = vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
          vec4 view = uProjInv * clip;
          view /= view.w;
          vec3 ro = (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec3 hit = (uCamWorld * vec4(view.xyz, 1.0)).xyz;
          vec3 rd = hit - ro;
          float tEnd = min(length(rd), 7.0);
          rd = normalize(rd);
          float stepL = tEnd / uSteps;
          // дизеринг старта — полосы шагов превращаются в незаметный шум
          float j = hash12(gl_FragCoord.xy + fract(uTime * 7.0) * 100.0);
          float acc = 0.0;
          for (int i = 0; i < 40; i++) {
            if (float(i) >= uSteps) break;
            vec3 p = ro + rd * (float(i) + j) * stepL;
            float lit = windowLit(p);
            if (lit > 0.0) {
              // пыль в воздухе неравномерна и медленно дрейфует
              float dust = 0.45 + 0.55 * vnoise(p * 3.2 + vec3(uTime * 0.05, -uTime * 0.02, 0.0));
              acc += lit * dust;
            }
          }
          acc *= stepL;
          // рассеяние вперёд: против света лучи ярче
          float ph = 0.3 + 0.9 * pow(max(dot(-rd, uL), 0.0), 4.0);
          vec3 col = vec3(1.0, 0.72, 0.45) * acc * ph * 0.55 * uIntensity;
          gl_FragColor = vec4(col, 1.0);
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const occl = new THREE.MeshBasicMaterial({ colorWrite: false })
    return { rt, mat, occl }
  }, [gl, size, u, scale])
  useEffect(
    () => () => {
      rt.depthTexture?.dispose()
      rt.dispose()
      mat.dispose()
    },
    [rt, mat],
  )
  const quad = useRef<THREE.Mesh>(null)

  const depthPass = () => {
    const cam = camera as THREE.PerspectiveCamera
    const q = quad.current!
    q.visible = false
    const prevOverride = scene.overrideMaterial
    const au = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false
    scene.overrideMaterial = occl
    const prev = gl.getRenderTarget()
    gl.setRenderTarget(rt)
    gl.clear(true, true, false)
    gl.render(scene, cam)
    gl.setRenderTarget(prev)
    scene.overrideMaterial = prevOverride
    gl.shadowMap.autoUpdate = au
    q.visible = true
    mat.uniforms.uProjInv.value.copy(cam.projectionMatrixInverse)
    mat.uniforms.uCamWorld.value.copy(cam.matrixWorld)
  }
  // глубина сцены — после того как CameraRig поставил камеру (приоритет 0)
  useDepthPass(depthPass)
  // проход глубины со своей заменой материала тоже компилируется заранее
  useEffect(() => {
    warmers.set('shelf', depthPass)
    return () => {
      warmers.delete('shelf')
    }
  })

  return (
    <mesh ref={quad} material={mat} frustumCulled={false} renderOrder={50}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

const SI = actIndex('shelf')
function useDepthPass(f: () => void) {
  useFrame(() => {
    if (S.act === SI) f()
  }, 0)
}

// ─── пылинки в луче ─────────────────────────────────────────────────────────
function Motes({ u }: { u: Record<string, THREE.IUniform> }) {
  const count = isLow ? 900 : 2600
  const { g, m } = useMemo(() => {
    const R = mulberry(12)
    const pos = new Float32Array(count * 3)
    const rnd = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = -2.1 + R() * 3.6
      pos[i * 3 + 1] = R() * 2.6
      pos[i * 3 + 2] = 0.1 + R() * 2.6
      rnd[i] = R()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aR', new THREE.BufferAttribute(rnd, 1))
    const m = new THREE.ShaderMaterial({
      uniforms: { ...u, uPx: { value: 800 } },
      vertexShader:
        litGLSL +
        /* glsl */ `
        attribute float aR;
        uniform float uTime;
        uniform float uPx;
        varying float vA;
        varying float vB;
        void main() {
          vec3 p = position;
          // броуновское парение: медленный дрейф вниз и в стороны
          p += vec3(sin(uTime * 0.21 + aR * 50.0), sin(uTime * 0.17 + aR * 31.0) - uTime * 0.01, cos(uTime * 0.19 + aR * 17.0)) * 0.05;
          p.y = mod(p.y, 2.6);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float z = -mv.z;
          float coc = clamp(abs(z - 2.2) * 2.5, 0.0, 9.0);
          gl_PointSize = clamp(0.003 * uPx / z + coc, 1.0, 22.0);
          vB = coc;
          vA = windowLit(p) * (0.4 + 0.6 * aR);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        varying float vB;
        void main() {
          if (vA < 0.01) discard;
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = mix(exp(-d * d * 6.0), smoothstep(1.0, 0.8, d) * 0.5, clamp(vB / 6.0, 0.0, 1.0));
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.6) * 1.8 * vA * a / (1.0 + vB * 0.35), 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { g, m }
  }, [u, count])
  const size = useThree((s) => s.size)
  useScrollScene('shelf', () => {
    m.uniforms.uPx.value = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(rig.fov) / 2))
  })
  return <points geometry={g} material={m} frustumCulled={false} />
}

// ─── свет ───────────────────────────────────────────────────────────────────
function Light({ u }: { u: Record<string, THREE.IUniform> }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    const l = light.current!
    l.target = target
    l.shadow.mapSize.set(isLow ? 1024 : 2048, isLow ? 1024 : 2048)
    const c = l.shadow.camera as THREE.OrthographicCamera
    c.left = -2.6
    c.right = 2.6
    c.top = 2.4
    c.bottom = -2.4
    c.near = 0.5
    c.far = 12
    c.updateProjectionMatrix()
    l.shadow.bias = -0.0004
    l.shadow.normalBias = 0.015
    l.shadow.radius = 4
  }, [target])
  const L = useMemo(() => new THREE.Vector3(), [])
  useScrollScene('shelf', () => {
    // «призрак»: курсор чуть сдвигает свет из окна, тени книг ползут
    L.copy(BASE_L)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), -S.pointer.sx * 0.07)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), S.pointer.sy * 0.05)
      .normalize()
    ;(u.uL.value as THREE.Vector3).copy(L)
    target.position.set(0.4, 0.4, 0.6)
    light.current!.position.copy(target.position).addScaledVector(L, -6)
  })
  return (
    <>
      <primitive object={target} />
      <directionalLight ref={light} castShadow intensity={5.2} color="#ffd2a0" />
      <hemisphereLight args={['#6b6a72', '#2a1c12', 0.35]} />
      {/* отражённый от пола свет: тёплое пятно, без него комната выглядит пустой */}
      <pointLight position={[0.5, 0.25, 0.9]} intensity={0.9} distance={4.5} decay={2} color="#ffb070" />
      <pointLight position={[1.5, 1.8, 2.8]} intensity={0.25} distance={5} decay={2} color="#8a90a8" />
    </>
  )
}

// ─── ракурсы ────────────────────────────────────────────────────────────────
// ключи по долям акта: окно → полка → книга падает → пол с полосами пыли
const KEYS: [number, [number, number, number], [number, number, number]][] = [
  [0.0, [1.6, 1.5, 3.4], [-1.6, 1.45, 1.3]],
  [0.16, [1.45, 1.42, 3.1], [-1.0, 1.25, 0.9]],
  [0.3, [1.25, 1.22, 2.55], [0.3, 0.95, 0.2]],
  [0.44, [1.05, 0.95, 2.25], [0.42, 0.55, 0.45]],
  [0.56, [0.95, 1.35, 2.2], [0.45, 0.12, 0.75]],
  [0.8, [0.72, 2.1, 1.95], [0.5, 0.0, 0.95]],
  [1.0, [0.66, 2.4, 1.8], [0.5, 0.0, 0.95]],
]
const CAM = {
  pos: new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[1]))),
  look: new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[2]))),
}
/** доля акта → параметр кривой с учётом неравномерных ключей */
function keyT(p: number) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [a] = KEYS[i]
    const [b] = KEYS[i + 1]
    if (p <= b) {
      const f = (p - a) / (b - a)
      const e = f * f * (3 - 2 * f)
      return (i + e) / (KEYS.length - 1)
    }
  }
  return 1
}
export const bookPos = new THREE.Vector3()

export default function Bookshelf() {
  const m = useMaterials()
  const u = useMemo(() => ({ uL: { value: BASE_L.clone() }, uTime: { value: 0 } }), [])
  const env = useEnvMap(
    [
      { pos: [-4, 1.6, 0.3], size: [1.2, 1.4], color: '#ffcf98', intensity: 6 },
      { pos: [2, 3, 3], size: [4, 2], color: '#8088a0', intensity: 0.6 },
      { pos: [0, -2, 0], size: [5, 5], color: '#3a2616', intensity: 0.6 },
    ],
    '#0c0907',
    'shelf',
    0.35,
  )
  useScrollScene('shelf', ({ p, t, state }) => {
    state.scene.environment = env
    state.scene.environmentIntensity = 0.35
    const k = keyT(p)
    CAM.pos.getPoint(k, rig.pos)
    CAM.look.getPoint(k, rig.look)
    // пока книга летит, взгляд чуть тянется за ней — как у оператора, который успел повернуть голову
    const follow = smooth(0.3, 0.38, p) * (1 - smooth(0.5, 0.6, p)) * 0.55
    rig.look.lerp(bookPos, follow)
    // фокус — туда, куда смотрит оператор; пока книга падает — на книге
    fx.focus.copy(rig.look).lerp(bookPos, smooth(0.28, 0.34, p) * (1 - smooth(0.5, 0.58, p)))
    // лёгкая глубина резкости: фон мягче, но книги и пол остаются читаемыми
    fx.focusRange = 2.2
    fx.bokeh = 1.2
    rig.fov = 38
    rig.near = 0.03
    rig.far = 30
    rig.shake = 0.006
    u.uTime.value = t
    fx.bloom = 1
  })
  return (
    <>
      <Light u={u} />
      <Room m={m} />
      <Shelf m={m} />
      <Books m={m} />
      <ToyLander />
      <FallingBook m={m} />
      <DustLines u={u} />
      <Motes u={u} />
      <GodRays u={u} />
    </>
  )
}
