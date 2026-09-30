// Процедурная пшеница: пучок стеблей с колосьями и листьями одной геометрией.
// Два уровня детализации: ближний (гранёные стебли, колос из колец, лист)
// и дальний (минимум граней — издали всё равно видна только масса поля).
import * as THREE from 'three'

type Rand = () => number

export function mulberry(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Buf {
  pos: number[]
  nrm: number[]
  h: number[]
  part: number[]
  uv: number[]
  idx: number[]
}

/** трубка по кривой с переменным радиусом: sides граней, rings колец */
function tube(b: Buf, curve: (t: number) => THREE.Vector3, radius: (t: number) => number, sides: number, rings: number, hOf: (t: number) => number, part: number, twist = 0) {
  const base = b.pos.length / 3
  const up = new THREE.Vector3(0, 1, 0)
  const tan = new THREE.Vector3()
  const nA = new THREE.Vector3()
  const nB = new THREE.Vector3()
  for (let r = 0; r <= rings; r++) {
    const t = r / rings
    const p = curve(t)
    const p2 = curve(Math.min(1, t + 0.01))
    const p1 = curve(Math.max(0, t - 0.01))
    tan.subVectors(p2, p1).normalize()
    nA.crossVectors(tan, up)
    if (nA.lengthSq() < 1e-6) nA.set(1, 0, 0)
    nA.normalize()
    nB.crossVectors(tan, nA).normalize()
    const rad = radius(t)
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2 + twist
      const cx = Math.cos(a)
      const sy = Math.sin(a)
      const nx = nA.x * cx + nB.x * sy
      const ny = nA.y * cx + nB.y * sy
      const nz = nA.z * cx + nB.z * sy
      b.pos.push(p.x + nx * rad, p.y + ny * rad, p.z + nz * rad)
      b.nrm.push(nx, ny, nz)
      b.h.push(hOf(t))
      b.part.push(part)
      b.uv.push(t, s / sides)
    }
  }
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < sides; s++) {
      const a = base + r * sides + s
      const bb = base + r * sides + ((s + 1) % sides)
      const c = a + sides
      const d = bb + sides
      b.idx.push(a, c, bb, bb, c, d)
    }
}

/** лента листа: ширина по синусу, изгиб наружу и вниз */
/** зерно-колосок: вытянутый эллипсоид с продольной бороздкой, part 4 */
function grain(b: Buf, c: THREE.Vector3, axis: THREE.Vector3, side: THREE.Vector3, len: number, wid: number, dep: number, h: number) {
  const base = b.pos.length / 3
  const third = new THREE.Vector3().crossVectors(axis, side).normalize()
  const rings = 3
  const sides = 5
  for (let r = 0; r <= rings; r++) {
    const u = (r / rings) * Math.PI
    const along = -Math.cos(u) * len * 0.5
    const s = Math.sin(u)
    for (let k = 0; k < sides; k++) {
      const v = (k / sides) * Math.PI * 2
      const cs = Math.cos(v)
      const sn = Math.sin(v)
      // бороздка на внутренней стороне — чуть вдавлена
      const groove = cs < -0.7 ? 0.75 : 1
      const px = side.x * cs * wid * s * groove + third.x * sn * dep * s + axis.x * along
      const py = side.y * cs * wid * s * groove + third.y * sn * dep * s + axis.y * along
      const pz = side.z * cs * wid * s * groove + third.z * sn * dep * s + axis.z * along
      b.pos.push(c.x + px, c.y + py, c.z + pz)
      const n = new THREE.Vector3()
        .addScaledVector(side, (cs * s) / wid)
        .addScaledVector(third, (sn * s) / dep)
        .addScaledVector(axis, -Math.cos(u) / len)
        .normalize()
      b.nrm.push(n.x, n.y, n.z)
      b.h.push(h)
      b.part.push(4)
      b.uv.push(r / rings, k / sides)
    }
  }
  for (let r = 0; r < rings; r++)
    for (let k = 0; k < sides; k++) {
      const a = base + r * sides + k
      const bb = base + r * sides + ((k + 1) % sides)
      b.idx.push(a, a + sides, bb, bb, a + sides, bb + sides)
    }
}

function leaf(b: Buf, root: THREE.Vector3, dir: THREE.Vector3, len: number, width: number, droop: number, segs: number, hRoot: number) {
  const base = b.pos.length / 3
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize()
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const w = width * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * (1 - t * 0.3)
    const p = root
      .clone()
      .addScaledVector(dir, len * t)
      .add(new THREE.Vector3(0, len * (0.55 * t - droop * t * t), 0))
    const n = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -0.4).normalize()
    for (const sgn of [-1, 1]) {
      const q = p.clone().addScaledVector(side, (w / 2) * sgn)
      b.pos.push(q.x, q.y, q.z)
      b.nrm.push(n.x, n.y, n.z)
      b.h.push(hRoot + t * 0.15)
      b.part.push(2)
      b.uv.push(t, sgn * 0.5 + 0.5)
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = base + i * 2
    b.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
}

/** lod 0 — у самой камеры (ости, листья), 1 — средний план, 2 — дальний */
export function buildClump(stalks: number, lod: 0 | 1 | 2, seed: number) {
  const near = lod === 0
  const R = mulberry(seed)
  const b: Buf = { pos: [], nrm: [], h: [], part: [], uv: [], idx: [] }
  for (let s = 0; s < stalks; s++) {
    const ang = R() * Math.PI * 2
    const rad = Math.sqrt(R()) * 0.09
    const base = new THREE.Vector3(Math.cos(ang) * rad, 0, Math.sin(ang) * rad)
    const H = 0.82 + R() * 0.32
    const leanA = R() * Math.PI * 2
    const lean = 0.04 + R() * 0.13
    const ld = new THREE.Vector3(Math.cos(leanA), 0, Math.sin(leanA))
    // колос тяжёлый — верх стебля провисает сильнее
    const curve = (t: number) => base.clone().addScaledVector(ld, lean * H * Math.pow(t, 1.7)).setY(H * t)
    tube(b, curve, (t) => 0.0042 * (1 - t * 0.35), 3, near ? 4 : lod === 1 ? 3 : 2, (t) => t * 0.9, 0)

    // колос: веретено, чуть наклонено по ходу стебля
    const top = curve(1)
    const dirTop = curve(1).sub(curve(0.95)).normalize()
    const earLen = 0.075 + R() * 0.03
    const earCurve = (t: number) => top.clone().addScaledVector(dirTop, earLen * t)
    if (!near) {
      tube(
        b,
        earCurve,
        (t) => 0.0085 * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * t)), 0.6) * (1 - t * 0.15),
        lod === 1 ? 4 : 3,
        lod === 1 ? 3 : 2,
        () => 1,
        1,
        R() * 3,
      )
    } else {
      // стержень колоса и колоски в два ряда «ёлочкой»; плоскость рядов у каждого колоса своя
      tube(b, earCurve, () => 0.0018, 3, 2, () => 1, 0)
      const face = R() * Math.PI
      const side = new THREE.Vector3(Math.cos(face), 0, Math.sin(face))
      side.addScaledVector(dirTop, -side.dot(dirTop)).normalize()
      const n = 11 + Math.floor(R() * 4)
      for (let k = 0; k < n; k++) {
        const t = 0.06 + (k / (n - 1)) * 0.9
        const sgn = k % 2 ? 1 : -1
        // к концу колоса колоски мельче
        const sz = Math.sin(Math.PI * (0.18 + 0.75 * t)) * (0.85 + R() * 0.3)
        const out = side.clone().multiplyScalar(sgn)
        const ax = dirTop.clone().multiplyScalar(0.82).addScaledVector(out, 0.55).normalize()
        const c = earCurve(t).addScaledVector(out, 0.0034 * sz)
        grain(b, c, ax, out, 0.0105 * sz, 0.0036 * sz, 0.003 * sz, 1)
        // ость — длинная тонкая щетинка от кончика колоска
        if (R() < 0.8) {
          const tip = c.clone().addScaledVector(ax, 0.005 * sz)
          const d = ax.clone().addScaledVector(dirTop, 1.6).normalize()
          const L = (0.045 + R() * 0.03) * (0.6 + 0.4 * t)
          tube(b, (q) => tip.clone().addScaledVector(d, L * q).addScaledVector(out, 0.004 * q * q), () => 0.00045, 2, 1, () => 1, 3)
        }
      }
      // лист от нижней трети стебля
      const lr = curve(0.3 + R() * 0.15)
      const la = R() * Math.PI * 2
      leaf(b, lr, new THREE.Vector3(Math.cos(la), 0, Math.sin(la)), 0.22 + R() * 0.1, 0.012, 1.4 + R(), 4, 0.35)
    }
  }
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3))
  g.setAttribute('aH', new THREE.Float32BufferAttribute(b.h, 1))
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(b.part, 1))
  g.setAttribute('aUV', new THREE.Float32BufferAttribute(b.uv, 2))
  g.setIndex(b.idx)
  return g
}

/**
 * Раскладка пучков вдоль пути камеры: плотно у самого пути, реже к краям.
 * Дорогу (полоса по x ≈ roadX) оставляем пустой.
 */
export function scatter(count: number, rMin: number, rMax: number, seed: number, path: [number, number][], roadX: number) {
  const R = mulberry(seed)
  const inst = new Float32Array(count * 4)
  const vars = new Float32Array(count * 3)
  let n = 0
  let guard = 0
  const segDist = (x: number, z: number) => {
    let best = 1e9
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i]
      const [bx, bz] = path[i + 1]
      const dx = bx - ax
      const dz = bz - az
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
    }
    return best
  }
  const minX = Math.min(...path.map((p) => p[0])) - rMax
  const maxX = Math.max(...path.map((p) => p[0])) + rMax
  const minZ = Math.min(...path.map((p) => p[1])) - rMax
  const maxZ = Math.max(...path.map((p) => p[1])) + rMax
  while (n < count && guard++ < count * 60) {
    const x = minX + R() * (maxX - minX)
    const z = minZ + R() * (maxZ - minZ)
    const d = segDist(x, z)
    if (d < rMin || d > rMax) continue
    if (Math.abs(x - roadX) < 3.2) continue
    // у стартовой точки камеры не ставим стебли вплотную к объективу
    if (Math.hypot(x - 0.4, z - 3) < 1.1) continue
    // плотность падает с расстоянием — ближе к камере гуще
    const w = Math.pow(1 - (d - rMin) / (rMax - rMin), 1.3)
    if (R() > 0.12 + 0.88 * w) continue
    inst[n * 4] = x
    inst[n * 4 + 1] = z
    inst[n * 4 + 2] = R() * Math.PI * 2
    inst[n * 4 + 3] = 0.88 + R() * 0.28 + (d > 20 ? 0.12 : 0)
    vars[n * 3] = R()
    vars[n * 3 + 1] = R()
    vars[n * 3 + 2] = R()
    n++
  }
  return { inst: inst.subarray(0, n * 4), vars: vars.subarray(0, n * 3), n }
}
