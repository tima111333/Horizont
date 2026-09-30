// «Эндюранс» — процедурная модель. Кольцо из двенадцати модулей трёх типов
// (жилой, лабораторный, двигательный), фермы-спицы, центральный хаб со
// стыковочным узлом и параболической антенной. Отдельно — челнок «Рейнджер».
// Геометрия склеивается по материалам (один draw call на материал), UV
// считаются коробочной проекцией, чтобы панели и заклёпки не растягивались.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mulberry } from './wheat'

export type Part = 'hull' | 'foil' | 'dark' | 'panel' | 'glow' | 'nozzle' | 'glass' | 'tile' | 'fire'
export const RING_R = 7.6
export const HUB_LEN = 3.4

type Bucket = Record<Part, THREE.BufferGeometry[]>
const bucket = (): Bucket => ({ hull: [], foil: [], dark: [], panel: [], glow: [], nozzle: [], glass: [], tile: [], fire: [] })

const M = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const V = new THREE.Vector3()
const S1 = new THREE.Vector3(1, 1, 1)

/** положить геометрию в корзину материала с трансформом */
function put(b: Bucket, part: Part, g: THREE.BufferGeometry, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) {
  const geo = g.index ? g.toNonIndexed() : g.clone()
  if (!geo.attributes.normal) geo.computeVertexNormals()
  M.compose(V.set(...pos), Q.setFromEuler(E.set(...rot)), S1.clone().set(...scale))
  geo.applyMatrix4(M)
  b[part].push(geo)
}

/** перенести содержимое одной корзины в другую с трансформом (модуль → кольцо) */
function transfer(from: Bucket, to: Bucket, m: THREE.Matrix4) {
  for (const k of Object.keys(from) as Part[])
    for (const g of from[k]) {
      const c = g.clone()
      c.applyMatrix4(m)
      to[k].push(c)
    }
}

/** коробочная проекция UV: текстура ложится одинаково плотно на любую грань */
function boxUV(g: THREE.BufferGeometry, scale: number) {
  const p = g.attributes.position
  const n = g.attributes.normal
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i))
    const ay = Math.abs(n.getY(i))
    const az = Math.abs(n.getZ(i))
    let u: number, v: number
    if (ax >= ay && ax >= az) {
      u = p.getZ(i)
      v = p.getY(i)
    } else if (ay >= az) {
      u = p.getX(i)
      v = p.getZ(i)
    } else {
      u = p.getX(i)
      v = p.getY(i)
    }
    uv[i * 2] = u * scale
    uv[i * 2 + 1] = v * scale
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

function finish(b: Bucket) {
  const out: Partial<Record<Part, THREE.BufferGeometry>> = {}
  for (const k of Object.keys(b) as Part[]) {
    if (!b[k].length) continue
    const clean = b[k].map((g) => {
      const c = new THREE.BufferGeometry()
      c.setAttribute('position', g.attributes.position)
      c.setAttribute('normal', g.attributes.normal)
      return c
    })
    const m = mergeGeometries(clean)!
    // страховка: нулевая нормаль (вырожденный треугольник) превращается в NaN в шейдере
    const nrm = m.attributes.normal
    for (let i = 0; i < nrm.count; i++) {
      const l = Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i))
      if (!(l > 1e-4)) nrm.setXYZ(i, 0, 1, 0)
    }
    boxUV(m, k === 'foil' ? 0.9 : k === 'hull' ? 0.42 : 0.75)
    m.computeBoundingSphere()
    out[k] = m
  }
  return out
}

// ─── примитивы ───────────────────────────────────────────────────────────────
const rbox = (w: number, h: number, d: number, r = 0.07) => new RoundedBoxGeometry(w, h, d, 2, r)
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (r0: number, r1: number, h: number, seg = 16, open = false) => new THREE.CylinderGeometry(r0, r1, h, seg, 1, open)

/** колокол сопла — профиль лате, внутренняя поверхность отдельной частью */
function nozzle(r: number, len: number) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    pts.push(new THREE.Vector2(r * (0.38 + 0.62 * Math.pow(t, 0.7)), -t * len))
  }
  return new THREE.LatheGeometry(pts, 24)
}

/** бак-капсула: белая оболочка, тёмные бандажи, пояс изоляции, патрубок */
function tank(b: Bucket, r: number, len: number, pos: [number, number, number], rot: [number, number, number]) {
  const local = bucket()
  // бак в золотой изоляции, стянутой тёмными бандажами
  put(local, 'foil', new THREE.CapsuleGeometry(r, len, 6, 20))
  for (const y of [-len * 0.32, 0, len * 0.32]) put(local, 'dark', cyl(r * 1.03, r * 1.03, 0.04, 20), [0, y, 0])
  put(local, 'dark', cyl(0.02, 0.02, r * 0.9, 6), [0, len / 2 + r * 0.9, 0])
  transfer(local, b, new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), S1))
}

/** блок двигателей ориентации: кубик и четыре конусных сопла в стороны */
function rcs(b: Bucket, x: number, y: number, z: number) {
  put(b, 'dark', box(0.16, 0.16, 0.16), [x, y, z])
  const dirs: [number, number, number][] = [
    [0.12, 0, 0],
    [-0.12, 0, 0],
    [0, 0, 0.12],
    [0, 0, -0.12],
  ]
  for (const [dx, dy, dz] of dirs) {
    const g = new THREE.ConeGeometry(0.045, 0.08, 10)
    // конус смотрит раструбом наружу
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx, dy, dz).normalize())
    g.applyQuaternion(q)
    put(b, 'nozzle', g, [x + dx, y + dy, z + dz])
  }
}

/**
 * «Гриблы»: мелочь на гранях модуля — датчики, поручни, кожухи, тёмные
 * сервисные панели. Без неё крупные белые коробки выглядят игрушечными.
 */
function greeble(b: Bucket, R: () => number, w: number, h: number, d: number, n = 10) {
  for (let i = 0; i < n; i++) {
    const face = Math.floor(R() * 4)
    const u = (R() - 0.5) * w * 0.8
    const v = (R() - 0.5) * d * 0.8
    const s = 0.06 + R() * 0.16
    const t = 0.02 + R() * 0.06
    const kind = R()
    const part: Part = kind < 0.45 ? 'dark' : kind < 0.7 ? 'hull' : kind < 0.85 ? 'panel' : 'foil'
    if (face === 0) put(b, part, box(s, t, s * (0.6 + R())), [u, h / 2 + t / 2, v])
    else if (face === 1) put(b, part, box(s, t, s * (0.6 + R())), [u, -h / 2 - t / 2, v])
    else if (face === 2) put(b, part, box(s * (0.6 + R()), s, t), [u, (R() - 0.5) * h * 0.7, d / 2 + t / 2])
    else put(b, part, box(s * (0.6 + R()), s, t), [u, (R() - 0.5) * h * 0.7, -d / 2 - t / 2])
  }
  // поручни вдоль торца
  for (const z of [d / 2 + 0.05, -d / 2 - 0.05]) {
    put(b, 'panel', cyl(0.012, 0.012, w * 0.7, 5), [0, h * 0.32, z], [0, 0, Math.PI / 2])
    put(b, 'panel', cyl(0.012, 0.012, 0.06, 5), [w * 0.35, h * 0.32, z - Math.sign(z) * 0.03], [Math.PI / 2, 0, 0])
    put(b, 'panel', cyl(0.012, 0.012, 0.06, 5), [-w * 0.35, h * 0.32, z - Math.sign(z) * 0.03], [Math.PI / 2, 0, 0])
  }
  // тёмная сервисная панель на торце
  put(b, 'dark', box(w * 0.3, h * 0.35, 0.02), [(R() - 0.5) * w * 0.4, -h * 0.15, d / 2 + 0.01])
}

// ─── модули кольца: локально x — по касательной, y — наружу, z — вдоль оси ──
function habitat(R: () => number) {
  const b = bucket()
  put(b, 'hull', rbox(2.9, 1.55, 1.8, 0.09))
  // иллюминаторы: полоса на внешней грани
  for (let i = 0; i < 7; i++) put(b, 'glow', box(0.16, 0.05, 0.22), [-1.05 + i * 0.35, 0.78, 0.35])
  put(b, 'dark', box(2.5, 0.04, 0.44), [0, 0.775, 0.35])
  // золотая изоляция по бокам
  put(b, 'foil', rbox(0.06, 1.25, 1.5, 0.02), [1.47, 0, 0])
  put(b, 'foil', rbox(0.06, 1.25, 1.5, 0.02), [-1.47, 0, 0])
  // радиаторы на стойках сверху: рама и ламели с просветами
  for (const z of [-0.45, 0.45]) {
    const zc = z * 1.3
    for (let k = 0; k < 7; k++) put(b, 'panel', box(1.86, 0.018, 0.068), [0, 1.08, zc - 0.27 + k * 0.09])
    put(b, 'dark', box(1.92, 0.04, 0.03), [0, 1.08, zc - 0.32])
    put(b, 'dark', box(1.92, 0.04, 0.03), [0, 1.08, zc + 0.32])
    put(b, 'dark', box(0.03, 0.04, 0.64), [0.95, 1.08, zc])
    put(b, 'dark', box(0.03, 0.04, 0.64), [-0.95, 1.08, zc])
    put(b, 'foil', cyl(0.025, 0.025, 1.9, 8), [0, 1.06, zc], [0, 0, Math.PI / 2])
    put(b, 'dark', box(0.05, 0.3, 0.05), [-0.7, 0.93, zc])
    put(b, 'dark', box(0.05, 0.3, 0.05), [0.7, 0.93, zc])
  }
  rcs(b, 1.3, -0.55, 0.78)
  rcs(b, -1.3, -0.55, -0.78)
  // люк на торце
  put(b, 'dark', cyl(0.28, 0.28, 0.04, 20), [0.6, 0, 0.86], [Math.PI / 2, 0, 0])
  if (R() > 0.5) put(b, 'dark', cyl(0.02, 0.02, 0.9, 6), [-0.9, 1.1, -0.5])
  greeble(b, R, 2.9, 1.55, 1.8, 12)
  return b
}

function lab(R: () => number) {
  const b = bucket()
  // восьмигранный цилиндр вдоль касательной
  put(b, 'hull', cyl(0.85, 0.85, 2.4, 8), [0, 0, 0], [0, 0, Math.PI / 2])
  put(b, 'dark', cyl(0.9, 0.9, 0.12, 8), [1.14, 0, 0], [0, 0, Math.PI / 2])
  put(b, 'dark', cyl(0.9, 0.9, 0.12, 8), [-1.14, 0, 0], [0, 0, Math.PI / 2])
  put(b, 'foil', cyl(0.87, 0.87, 0.9, 8, true), [0, 0, 0], [0, 0, Math.PI / 2])
  for (let i = 0; i < 4; i++) put(b, 'glow', box(0.12, 0.04, 0.12), [-0.9 + i * 0.22, 0.86, 0.3])
  // выносная ферма с баллонами
  put(b, 'dark', box(1.6, 0.08, 0.08), [0, -0.7, 0.6])
  for (const x of [-0.5, 0, 0.5]) tank(b, 0.17, 0.3, [x, -0.72, 0.85], [0, 0, 0])
  rcs(b, 0.95, 0.5, -0.6)
  if (R() > 0.4) put(b, 'panel', box(0.03, 0.9, 1.4), [0, 1.05, 0], [0, 0, 0])
  greeble(b, R, 2.2, 1.6, 1.6, 6)
  return b
}

function engine(R: () => number) {
  const b = bucket()
  put(b, 'hull', rbox(2.3, 1.45, 1.8, 0.08))
  put(b, 'foil', rbox(2.36, 0.5, 1.3, 0.03), [0, -0.2, 0])
  // два маршевых сопла в корму (по -z)
  for (const x of [-0.55, 0.55]) {
    put(b, 'dark', cyl(0.36, 0.3, 0.25, 20), [x, 0, -0.95], [Math.PI / 2, 0, 0])
    put(b, 'nozzle', nozzle(0.42, 0.85), [x, 0, -1.05], [-Math.PI / 2, 0, 0])
    put(b, 'fire', cyl(0.2, 0.2, 0.02, 16), [x, 0, -1.12], [Math.PI / 2, 0, 0])
  }
  // баки спереди
  for (const x of [-0.58, 0.58]) tank(b, 0.3, 0.5, [x, 0.1, 1.05], [Math.PI / 2, 0, 0])
  put(b, 'dark', box(1.8, 0.1, 0.1), [0, 0.1, 1.05])
  rcs(b, 1.1, 0.55, 0.5)
  rcs(b, -1.1, 0.55, 0.5)
  greeble(b, R, 2.3, 1.45, 1.8, 10)
  return b
}

/** ферма-спица: четыре лонжерона и раскосы зигзагом */
function truss(b: Bucket, from: THREE.Vector3, to: THREE.Vector3, w = 0.3) {
  const dir = to.clone().sub(from)
  const len = dir.length()
  const mid = from.clone().add(to).multiplyScalar(0.5)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  const local = bucket()
  for (const [x, z] of [
    [-w, -w],
    [w, -w],
    [w, w],
    [-w, w],
  ])
    put(local, 'hull', cyl(0.035, 0.035, len, 6), [x, 0, z])
  const n = Math.floor(len / (w * 2.2))
  for (let i = 0; i < n; i++) {
    const y0 = -len / 2 + (i / n) * len
    const y1 = -len / 2 + ((i + 1) / n) * len
    const dy = y1 - y0
    const ang = Math.atan2(dy, 2 * w)
    const dl = Math.hypot(dy, 2 * w)
    for (const side of [-1, 1]) {
      put(local, 'dark', cyl(0.018, 0.018, dl, 4), [0, (y0 + y1) / 2, side * w], [0, 0, (i % 2 ? 1 : -1) * (Math.PI / 2 - ang)])
      put(local, 'dark', cyl(0.018, 0.018, dl, 4), [side * w, (y0 + y1) / 2, 0], [(i % 2 ? 1 : -1) * (Math.PI / 2 - ang), 0, 0])
    }
  }
  // кабель-тоннель внутри фермы
  put(local, 'foil', cyl(0.09, 0.09, len * 0.96, 10), [0, 0, 0])
  transfer(local, b, new THREE.Matrix4().compose(mid, q, S1))
}

export function buildEndurance() {
  const R = mulberry(2014)
  const ring = bucket()
  const kinds = ['hab', 'lab', 'eng'] as const
  const halfLen = { hab: 1.45, lab: 1.2, eng: 1.15 }
  const list = Array.from({ length: 12 }, (_, i) => kinds[i % 3])
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const kind = list[i]
    const mod = kind === 'hab' ? habitat(R) : kind === 'lab' ? lab(R) : engine(R)
    const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a - Math.PI / 2)), S1)
    transfer(mod, ring, m)
    // переходной тоннель к следующему модулю по хорде
    const a2 = ((i + 1) / 12) * Math.PI * 2
    const p1 = new THREE.Vector3(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0)
    const p2 = new THREE.Vector3(Math.cos(a2) * RING_R, Math.sin(a2) * RING_R, 0)
    const chord = p2.clone().sub(p1)
    const t = chord.clone().normalize()
    const s = p1.clone().addScaledVector(t, halfLen[kind] - 0.05)
    const e = p2.clone().addScaledVector(t, -(halfLen[list[(i + 1) % 12]] - 0.05))
    const mid = s.clone().add(e).multiplyScalar(0.5)
    const len = s.distanceTo(e)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), t)
    const tun = bucket()
    put(tun, 'hull', cyl(0.28, 0.28, len, 14))
    put(tun, 'dark', cyl(0.34, 0.34, 0.12, 14), [0, len / 2 - 0.06, 0])
    put(tun, 'dark', cyl(0.34, 0.34, 0.12, 14), [0, -len / 2 + 0.06, 0])
    put(tun, 'foil', cyl(0.3, 0.3, len * 0.5, 14, true))
    transfer(tun, ring, new THREE.Matrix4().compose(mid, q, S1))
  }
  // спицы — между модулями, к хабу
  for (const k of [0, 3, 6, 9]) {
    const a = ((k + 0.5) / 12) * Math.PI * 2
    const d = new THREE.Vector3(Math.cos(a), Math.sin(a), 0)
    truss(ring, d.clone().multiplyScalar(1.25), d.clone().multiplyScalar(RING_R * Math.cos(Math.PI / 12) - 0.3))
  }

  // хаб: цилиндр вдоль оси, стыковочный узел спереди (+z), антенна сзади
  const hub = bucket()
  put(hub, 'hull', cyl(1.05, 1.05, HUB_LEN, 24), [0, 0, 0], [Math.PI / 2, 0, 0])
  put(hub, 'foil', cyl(1.08, 1.08, 1.2, 24, true), [0, 0, 0.2], [Math.PI / 2, 0, 0])
  for (const z of [-1.3, 1.1]) put(hub, 'dark', cyl(1.12, 1.12, 0.14, 24), [0, 0, z], [Math.PI / 2, 0, 0])
  put(hub, 'dark', cyl(0.62, 0.8, 0.45, 20), [0, 0, HUB_LEN / 2 + 0.2], [Math.PI / 2, 0, 0])
  put(hub, 'hull', new THREE.TorusGeometry(0.56, 0.07, 10, 32), [0, 0, HUB_LEN / 2 + 0.45])
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    put(hub, 'glow', box(0.05, 0.05, 0.05), [Math.cos(a) * 0.72, Math.sin(a) * 0.72, HUB_LEN / 2 + 0.44])
  }
  // антенна-тарелка
  const dishPts: THREE.Vector2[] = []
  for (let i = 0; i <= 10; i++) {
    const r = (i / 10) * 1.1
    dishPts.push(new THREE.Vector2(r, r * r * 0.28))
  }
  put(hub, 'dark', cyl(0.06, 0.06, 1.2, 8), [0, 0, -HUB_LEN / 2 - 0.6], [Math.PI / 2, 0, 0])
  put(hub, 'panel', new THREE.LatheGeometry(dishPts, 28), [0, 0, -HUB_LEN / 2 - 1.1], [-Math.PI / 2, 0, 0])
  put(hub, 'dark', cyl(0.02, 0.02, 0.5, 6), [0, 0, -HUB_LEN / 2 - 1.3], [Math.PI / 2, 0, 0])
  // солнечные крылья на хабе
  for (const s of [-1, 1]) {
    put(hub, 'dark', box(0.08, 3.2, 0.08), [s * 0.0, s * 2.4, -1.0])
    put(hub, 'tile', box(1.3, 2.5, 0.03), [0, s * 2.6, -1.0])
  }
  rcs(hub, 0.9, 0.9, 1.2)
  rcs(hub, -0.9, -0.9, 1.2)
  return { ring: finish(ring), hub: finish(hub) }
}

// ─── «Рейнджер»: несущий корпус, собранный лофтом по сечениям ───────────────
// Сечение — суперэллипс: верх круглее, брюхо почти плоское. По длине меняются
// ширина, высота верха (горб кабины) и низа; нос чуть опущен.
const RL = { z0: -2.35, z1: 1.35 }
/** высота оси стыковочного кольца и его передняя плоскость в координатах «Рейнджера» */
export const RANGER_DOCK_Y = -0.03
export const RANGER_DOCK_FACE = RL.z0 - 0.16 - 0.05
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
function rangerSection(t: number) {
  const nose = Math.pow(clamp01(t / 0.5), 0.5)
  const w = 0.64 * nose * (1 - 0.1 * sstep(0.75, 1, t)) + 0.01
  const top = 0.3 * Math.pow(clamp01(t / 0.42), 0.55) + 0.13 * Math.exp(-Math.pow((t - 0.33) / 0.13, 2)) - 0.06 * sstep(0.75, 1, t) + 0.01
  const bot = 0.2 * Math.pow(clamp01(t / 0.3), 0.6) + 0.01
  const yc = -0.1 * Math.pow(1 - t, 3)
  return { w, top, bot, yc }
}
/** точка поверхности корпуса: t — вдоль (0 нос), a — угол сечения (0 — правый борт, π/2 — верх) */
function rangerPoint(t: number, a: number, out: THREE.Vector3) {
  const { w, top, bot, yc } = rangerSection(t)
  const c = Math.cos(a)
  const sn = Math.sin(a)
  const up = sn >= 0
  const n = up ? 2.4 : 4.5
  const x = w * Math.sign(c) * Math.pow(Math.abs(c), 2 / n)
  const y = (up ? top : -bot) * Math.pow(Math.abs(sn), 2 / n)
  return out.set(x, yc + y, RL.z0 + t * (RL.z1 - RL.z0))
}
function rangerLoft(a0: number, a1: number, nt = 64, na = 28) {
  const pos: number[] = []
  const idx: number[] = []
  const v = new THREE.Vector3()
  for (let i = 0; i <= nt; i++) {
    // гуще у носа — там кривизна. Без совпадающих сечений: вырожденные треугольники дают
    // нулевые нормали → NaN в шейдере → bloom размазывает их в чёрное мерцание
    const t = 0.0015 + (1 - 0.0015) * Math.pow(i / nt, 1.6)
    for (let j = 0; j <= na; j++) {
      rangerPoint(t, a0 + ((a1 - a0) * j) / na, v)
      pos.push(v.x, v.y, v.z)
    }
  }
  for (let i = 0; i < nt; i++)
    for (let j = 0; j < na; j++) {
      const a = i * (na + 1) + j
      const b = a + na + 1
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
/** плоская деталь по контуру в плоскости XZ с толщиной по Y и скруглённой кромкой */
function slab(pts: [number, number][], thick: number, bevel: number) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)))
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 })
  g.translate(0, 0, -thick / 2)
  g.rotateX(Math.PI / 2)
  return g
}

export function buildRanger() {
  const b = bucket()
  // верх — белая обшивка, низ — чёрная теплозащита
  put(b, 'hull', rangerLoft(0, Math.PI))
  put(b, 'tile', rangerLoft(Math.PI, Math.PI * 2))
  // носовой наконечник из углерод-углерода
  put(b, 'dark', new THREE.SphereGeometry(0.035, 12, 8), [0, rangerSection(0).yc, RL.z0 + 0.01])

  // крылья: низкоплан, сильная стреловидность
  const wing: [number, number][] = [
    [0.5, -0.35],
    [1.38, 0.72],
    [1.42, 1.02],
    [1.18, 1.12],
    [0.5, 1.12],
  ]
  for (const sgn of [1, -1]) {
    const pts = wing.map(([x, z]) => [x * sgn, z] as [number, number])
    if (sgn < 0) pts.reverse()
    put(b, 'hull', slab(pts, 0.05, 0.025), [0, -0.07, 0], [0, 0, sgn * 0.06])
    const low = pts.map(([x, z]) => [x * 0.98, z] as [number, number])
    put(b, 'tile', slab(low, 0.012, 0.004), [0, -0.115, 0], [0, 0, sgn * 0.06])
    // законцовки крыла — маленькие кили, завалены наружу
    const fin: [number, number][] = [
      [0, 0],
      [0.3, 0.2],
      [0.34, 0.38],
      [0, 0.34],
    ]
    const fg = slab(fin, 0.03, 0.012)
    fg.rotateZ(Math.PI / 2)
    put(b, 'hull', fg, [sgn * 1.36, -0.03, 0.72], [0, 0, -sgn * 0.25])
  }
  // два киля на корме с развалом
  const tail: [number, number][] = [
    [0, 0.2],
    [0.5, 0.55],
    [0.54, 0.82],
    [0, 0.9],
  ]
  for (const sgn of [1, -1]) {
    const g = slab(tail, 0.04, 0.015)
    g.rotateZ(Math.PI / 2)
    put(b, 'hull', g, [sgn * 0.34, 0.12, 0.35], [0, 0, -sgn * 0.32])
  }

  // детали по поверхности: стёкла, рамы, люки — кладутся по касательной к корпусу
  const P = new THREE.Vector3()
  const Pt = new THREE.Vector3()
  const Pa = new THREE.Vector3()
  const place = (t: number, a: number, w: number, h: number, part: Part, lift: number, th = 0.012) => {
    rangerPoint(t, a, P)
    rangerPoint(t + 0.01, a, Pt).sub(P).normalize()
    rangerPoint(t, a + 0.02, Pa).sub(P).normalize()
    const n = new THREE.Vector3().crossVectors(Pt, Pa).normalize()
    // нормаль наружу — от оси корпуса
    const axis = new THREE.Vector3(0, rangerSection(t).yc, P.z)
    if (n.dot(P.clone().sub(axis)) < 0) n.negate()
    const tz = Pt.clone().sub(n.clone().multiplyScalar(Pt.dot(n))).normalize()
    const xAxis = new THREE.Vector3().crossVectors(n, tz).normalize()
    const m = new THREE.Matrix4().makeBasis(xAxis, n, tz)
    const g = new RoundedBoxGeometry(w, th, h, 2, Math.min(th / 2, 0.006))
    g.applyMatrix4(m)
    put(b, part, g, [P.x + n.x * lift, P.y + n.y * lift, P.z + n.z * lift])
  }
  for (const a of [Math.PI / 2 - 0.36, Math.PI / 2 - 0.12, Math.PI / 2 + 0.12, Math.PI / 2 + 0.36]) {
    place(0.215, a, 0.235, 0.2, 'dark', 0.002, 0.014)
    place(0.215, a, 0.2, 0.17, 'glass', 0.008, 0.01)
  }
  for (const a of [0.55, Math.PI - 0.55]) {
    place(0.25, a, 0.12, 0.2, 'dark', 0.002, 0.014)
    place(0.25, a, 0.1, 0.17, 'glass', 0.008, 0.01)
  }
  place(0.55, Math.PI / 2, 0.36, 0.5, 'panel', 0.003, 0.012)
  place(0.72, Math.PI / 2, 0.3, 0.28, 'dark', 0.003, 0.012)
  place(0.62, Math.PI / 2 - 0.9, 0.16, 0.34, 'panel', 0.002, 0.01)
  place(0.62, Math.PI / 2 + 0.9, 0.16, 0.34, 'panel', 0.002, 0.01)
  for (const a of [0.25, Math.PI - 0.25]) place(0.09, a, 0.08, 0.1, 'dark', 0.004, 0.02)

  // корма: гондолы двигателей, сопла с кольцами охлаждения, торцевая плита
  const rear = RL.z1
  put(b, 'dark', rbox(1.05, 0.34, 0.1, 0.04), [0, 0.0, rear - 0.02])
  for (const x of [-0.4, 0.4]) {
    put(b, 'hull', cyl(0.2, 0.21, 0.55, 20), [x, 0.02, rear - 0.2], [Math.PI / 2, 0, 0])
    put(b, 'dark', cyl(0.215, 0.215, 0.06, 20), [x, 0.02, rear + 0.08], [Math.PI / 2, 0, 0])
    put(b, 'nozzle', nozzle(0.22, 0.34), [x, 0.02, rear + 0.1], [-Math.PI / 2, 0, 0])
    for (const k of [0.12, 0.22]) put(b, 'dark', new THREE.TorusGeometry(0.16 + k * 0.28, 0.008, 6, 28), [x, 0.02, rear + 0.1 + k])
    put(b, 'fire', cyl(0.1, 0.1, 0.02, 12), [x, 0.02, rear + 0.14], [Math.PI / 2, 0, 0])
  }
  for (const x of [-0.62, 0.62]) for (const y of [0.1, -0.08]) put(b, 'nozzle', cyl(0.025, 0.04, 0.06, 10), [x, y, rear + 0.02], [Math.PI / 2, 0, 0])

  // стыковочный узел на носу: расширяющийся переходник и кольцо — к узлу хаба встаёт
  // кольцом к кольцу, а не носом в проём. Передняя плоскость кольца — RANGER_DOCK_FACE.
  const nz = RL.z0
  const ny = RANGER_DOCK_Y
  put(b, 'dark', cyl(0.2, 0.46, 0.36, 28), [0, ny, nz + 0.02], [Math.PI / 2, 0, 0])
  put(b, 'hull', new THREE.TorusGeometry(0.5, 0.05, 10, 40), [0, ny, nz - 0.16])
  put(b, 'dark', cyl(0.47, 0.47, 0.04, 28, true), [0, ny, nz - 0.14], [Math.PI / 2, 0, 0])
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    // защёлки
    put(b, 'panel', box(0.08, 0.08, 0.12), [Math.cos(a) * 0.5, ny + Math.sin(a) * 0.5, nz - 0.13])
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    // огни стыковочного кольца
    put(b, 'glow', box(0.035, 0.035, 0.02), [Math.cos(a) * 0.41, ny + Math.sin(a) * 0.41, nz - 0.2])
  }
  return finish(b)
}
