// Книга в твёрдом переплёте — единичная, в коробке ±0.5, корешок смотрит в +z.
// Крышки выступают над блоком страниц сверху, снизу и спереди, корешок скруглён,
// блок страниц чуть утоплен. Три группы материалов: 0 — ткань крышек, 1 — корешок,
// 2 — срез страниц. Инстансы масштабируются под размер книги; пропорции переплёта
// (толщина крышек, выпуклость корешка) задаются параметрами, чтобы тонкие и толстые
// книги не искажались одинаково.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface BookShape {
  /** толщина крышки — доля толщины книги */
  board: number
  /** выпуклость корешка — доля глубины книги */
  bulge: number
  /** выступ крышек над блоком: по высоте и спереди — доли размеров */
  overY: number
  overZ: number
}

/** коробка с явной разверткой UV по осям: u — вдоль первой оси, v — вдоль второй */
function slab(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return g
}

/** выпуклый корешок: полуэллипс в сечении, вытянут по высоте, с крышками сверху и снизу */
function spine(zs: number, bulge: number, y0: number, y1: number, seg = 14) {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const pt = (i: number) => {
    const t = i / seg
    const x = t - 0.5
    const s = Math.sqrt(Math.max(0, 1 - (2 * x) ** 2))
    const z = zs + bulge * s
    // нормаль эллипса
    const nx = (2 * x) / 0.5
    const nz = s / bulge
    const l = Math.hypot(nx, nz) || 1
    return { x, z, nx: nx / l, nz: nz / l, t }
  }
  // наружная поверхность
  for (let i = 0; i <= seg; i++) {
    const p = pt(i)
    for (const [y, v] of [
      [y0, 0],
      [y1, 1],
    ]) {
      pos.push(p.x, y, p.z)
      nor.push(p.nx, 0, p.nz)
      uv.push(p.t, v)
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  // торцы корешка — веер от центра хорды
  for (const [y, ny] of [
    [y0, -1],
    [y1, 1],
  ]) {
    const c = pos.length / 3
    pos.push(0, y, zs)
    nor.push(0, ny, 0)
    uv.push(0.5, y === y0 ? 0.002 : 0.998)
    for (let i = 0; i <= seg; i++) {
      const p = pt(i)
      pos.push(p.x, y, p.z)
      nor.push(0, ny, 0)
      uv.push(p.t, y === y0 ? 0.002 : 0.998)
    }
    for (let i = 0; i < seg; i++) {
      if (ny > 0) idx.push(c, c + 1 + i + 1, c + 1 + i)
      else idx.push(c, c + 1 + i, c + 1 + i + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

export function bookGeometry(s: BookShape, seg = 14) {
  const zs = 0.5 - s.bulge // хорда корешка
  const b = s.board
  // крышки: ткань, от переднего края до корешка, чуть скруглены за счёт фаски
  const back = slab(-0.5, -0.5 + b, -0.5, 0.5, -0.5, zs)
  const front = slab(0.5 - b, 0.5, -0.5, 0.5, -0.5, zs)
  // блок страниц: утоплен сверху, снизу и спереди, по толщине — между крышками
  const pages = slab(-0.5 + b, 0.5 - b, -0.5 + s.overY, 0.5 - s.overY, -0.5 + s.overZ, zs + 0.002)
  // UV среза: u — поперёк страниц (по x), чтобы полосы листов шли вдоль среза
  const p = pages.attributes.position
  const n = pages.attributes.normal
  const u = pages.attributes.uv
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i))
    const x = (p.getX(i) + 0.5 - b) / (1 - 2 * b)
    if (ax < 0.5) u.setXY(i, x, Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) + 0.5 : p.getY(i) + 0.5)
  }
  const sp = spine(zs, s.bulge, -0.5, 0.5, seg)
  const cloth = mergeGeometries([back.toNonIndexed(), front.toNonIndexed()])!
  const g = mergeGeometries([cloth, sp.toNonIndexed(), pages.toNonIndexed()], true)!
  g.computeBoundingSphere()
  return g
}

/** три набора пропорций — для тонких, средних и толстых книг */
export const BOOK_SHAPES: BookShape[] = [
  { board: 0.12, bulge: 0.03, overY: 0.012, overZ: 0.02 },
  { board: 0.075, bulge: 0.045, overY: 0.012, overZ: 0.02 },
  { board: 0.05, bulge: 0.06, overY: 0.012, overZ: 0.02 },
]
export const shapeFor = (thickness: number) => (thickness < 0.028 ? 0 : thickness < 0.045 ? 1 : 2)
