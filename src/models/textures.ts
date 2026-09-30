// Процедурные текстуры: дерево, доски пола, обои, корешки книг, обшивка,
// фольга, плитки. Чистые функции над массивами RGBA — без canvas и DOM, поэтому
// считаются в Web Worker и не дёргают главный поток. На главном потоке их
// превращает в текстуры toTexture() из core/assets.
import { mulberry } from './wheat'

export interface Img {
  w: number
  h: number
  data: Uint8Array
  srgb: boolean
}

// простой гладкий шум
function makeNoise(seed: number) {
  const R = mulberry(seed)
  const g = new Float32Array(256)
  for (let i = 0; i < 256; i++) g[i] = R()
  const n1 = (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const u = f * f * (3 - 2 * f)
    return g[i & 255] * (1 - u) + g[(i + 1) & 255] * u
  }
  return (x: number, y: number) => {
    const iy = Math.floor(y)
    const fy = y - iy
    const u = fy * fy * (3 - 2 * fy)
    return n1(x + iy * 57.3) * (1 - u) + n1(x + (iy + 1) * 57.3) * u
  }
}

const img = (w: number, h: number, srgb: boolean): Img => ({ w, h, data: new Uint8Array(w * h * 4), srgb })

/** высота → нормаль (центральные разности, бесшовно) */
function heightToNormal(src: Float32Array, w: number, h: number, strength: number): Img {
  const out = img(w, h, false)
  const at = (x: number, y: number) => src[((y + h) % h) * w + ((x + w) % w)]
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const l = Math.hypot(dx, dy, 1)
      const k = (y * w + x) * 4
      out.data[k] = ((-dx / l) * 0.5 + 0.5) * 255
      out.data[k + 1] = ((dy / l) * 0.5 + 0.5) * 255
      out.data[k + 2] = (1 / l) * 0.5 * 255 + 127
      out.data[k + 3] = 255
    }
  return out
}

/** древесина: годичные слои, искажённые шумом, с порами */
export function wood(seed = 1, tone: [number, number, number] = [92, 58, 34]) {
  const W = 512
  const nz = makeNoise(seed)
  const map = img(W, W, true)
  const hgt = new Float32Array(W * W)
  const R = mulberry(seed + 5)
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const warp = nz(x * 0.01, y * 0.004) * 30 + nz(x * 0.05, y * 0.02) * 4
      const ring = Math.sin((x + warp) * 0.12) * 0.5 + 0.5
      const fine = nz(x * 0.8, y * 0.02)
      const pore = R() < 0.012 ? 0.4 : 1
      const v = (0.62 + 0.28 * Math.pow(ring, 3) + 0.12 * fine) * pore
      const k = (y * W + x) * 4
      map.data[k] = tone[0] * v
      map.data[k + 1] = tone[1] * v
      map.data[k + 2] = tone[2] * v
      map.data[k + 3] = 255
      hgt[y * W + x] = ring * 0.5 + fine * 0.3 + (pore < 1 ? -0.6 : 0)
    }
  return { map, normal: heightToNormal(hgt, W, W, 1.2) }
}

/** пол из досок: разные тона, швы */
export function planks(seed = 3) {
  const W = 1024
  const nz = makeNoise(seed)
  const nz2 = makeNoise(seed + 11)
  const R = mulberry(seed)
  const map = img(W, W, true)
  const rough = img(W, W, false)
  const hgt = new Float32Array(W * W)
  const N = 9
  const bw = W / N
  // у каждой доски свой тон, сдвиг стыка, «центр» годичных колец и пара сучков
  const boards = Array.from({ length: N }, () => ({
    tone: 0.72 + R() * 0.4,
    hue: R(),
    off: R() * W,
    cx: (R() - 0.5) * bw * 3,
    f: 0.09 + R() * 0.05,
    knots: Array.from({ length: R() < 0.5 ? 1 : 0 }, () => ({ x: 20 + R() * (bw - 40), y: R() * W, r: 6 + R() * 8 })),
  }))
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const bi = Math.floor(x / bw)
      const b = boards[bi]
      const lx = x - bi * bw
      const yy = (y + b.off) % W
      const seam = lx < 1.5 || lx > bw - 1.5 || Math.abs(yy - W * 0.5) < 1.2
      // годичные слои при тангенциальном распиле: «арки», которые плывут вдоль доски
      const warp = nz(bi * 7.3, yy * 0.0025) * 26 + nz2(lx * 0.05 + bi, yy * 0.02) * 2.5
      let d = Math.abs(lx - bw / 2 + b.cx + warp)
      // сучок: кольца обтекают его
      let knot = 0
      for (const k of b.knots) {
        const dx = lx - k.x
        const dy = (yy - k.y) * 0.45
        const r = Math.hypot(dx, dy)
        d += (k.r * 3) / (1 + r * 0.15)
        knot = Math.max(knot, 1 - Math.min(1, r / k.r))
      }
      const ring = (d * b.f + nz(lx * 0.02, yy * 0.01) * 0.6) % 1
      // поздняя древесина — тонкие тёмные прожилки, контраст сдержанный
      const late = Math.pow(Math.max(0, (ring - 0.8) / 0.2), 2.2) * (0.6 + 0.4 * nz2(bi * 3.1, yy * 0.01))
      const pores = nz2(lx * 0.9, yy * 0.012) // мелкие поры вдоль волокна
      // продольные полосы тона — волокно вдоль доски
      const streak = nz2(lx * 0.35 + bi * 5, yy * 0.0015)
      let v = b.tone * (0.8 - 0.2 * late + 0.1 * (pores - 0.5) + 0.1 * (streak - 0.5) + 0.06 * nz(lx * 0.01 + bi, yy * 0.002))
      v *= 1 - knot * 0.55
      if (seam) v *= 0.3
      const k = (y * W + x) * 4
      // тёплый орех с разбросом оттенка по доскам
      map.data[k] = Math.min(255, (108 + b.hue * 14) * v)
      map.data[k + 1] = Math.min(255, (70 + b.hue * 6) * v)
      map.data[k + 2] = Math.min(255, 42 * v)
      map.data[k + 3] = 255
      hgt[y * W + x] = seam ? -1.2 : -late * 0.2 + (pores - 0.5) * 0.12 - knot * 0.2
      // лак стёрт полосами там, где ходят
      const wear = nz(x * 0.004, y * 0.004)
      const r = 110 + late * 50 + wear * 70 + (seam ? 90 : 0)
      rough.data[k] = rough.data[k + 1] = rough.data[k + 2] = Math.min(255, r)
      rough.data[k + 3] = 255
    }
  return { map, normal: heightToNormal(hgt, W, W, 2.2), rough }
}

/** выцветшие обои: вертикальная полоса и мелкий узор, пятна */
export function wallpaper(seed = 9) {
  const W = 512
  const nz = makeNoise(seed)
  const map = img(W, W, true)
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const stripe = Math.abs(((x / W) * 6) % 1 - 0.5) < 0.18 ? 0.93 : 1
      const motif = Math.sin(x * 0.4) * Math.sin(y * 0.4) > 0.6 ? 0.95 : 1
      const stain = 0.85 + 0.15 * nz(x * 0.01, y * 0.01)
      const v = stripe * motif * stain
      const k = (y * W + x) * 4
      map.data[k] = 150 * v
      map.data[k + 1] = 138 * v
      map.data[k + 2] = 112 * v
      map.data[k + 3] = 255
    }
  return map
}

/** прямоугольник с альфой поверх RGBA-картинки (замена fillRect) */
function rect(im: Img, x: number, y: number, w: number, h: number, c: [number, number, number], a: number) {
  const x0 = Math.max(0, Math.floor(x))
  const y0 = Math.max(0, Math.floor(y))
  const x1 = Math.min(im.w, Math.floor(x + w))
  const y1 = Math.min(im.h, Math.floor(y + h))
  for (let yy = y0; yy < y1; yy++)
    for (let xx = x0; xx < x1; xx++) {
      const k = (yy * im.w + xx) * 4
      im.data[k] = im.data[k] * (1 - a) + c[0] * a
      im.data[k + 1] = im.data[k + 1] * (1 - a) + c[1] * a
      im.data[k + 2] = im.data[k + 2] * (1 - a) + c[2] * a
    }
}

/**
 * Корешок книги 128×512: светлая ткань с плетением (цвет даёт инстанс), тёмные
 * накладки-этикетки, золотое тиснение — полосы, рамки и «строки» названия.
 * Золото лежит в альфе (0 — золото, 255 — ткань): шейдер делает его металлом
 * и не красит цветом книги. variant — один из шести рисунков. Строки снизу вверх.
 */
export function spine(variant: number) {
  const W = 128
  const H = 512
  const im = img(W, H, true)
  const R = mulberry(variant * 31 + 7)
  const nz = makeNoise(variant * 13 + 3)
  // ткань: основа и уток + пятна износа, края корешка затёрты светлее
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const weave = ((x & 1) ^ (y & 1) ? 0.96 : 1.02) * (0.97 + 0.06 * nz(x * 0.7, y * 0.05))
      const blot = 0.93 + 0.07 * nz(x * 0.04 + 9, y * 0.02)
      const edge = Math.min(x, W - 1 - x) < 5 ? 1.12 : 1
      const top = Math.min(y, H - 1 - y) < 6 ? 1.1 : 1
      const v = Math.min(255, 214 * weave * blot * edge * top)
      const k = (y * W + x) * 4
      im.data[k] = v
      im.data[k + 1] = v
      im.data[k + 2] = v
      im.data[k + 3] = 255
    }
  // золото — в альфу; немного «съеденное»: не каждый пиксель
  const gild = (x: number, y: number, w: number, h: number, wear = 0.12) => {
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(H, Math.floor(y + h)); yy++)
      for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(W, Math.floor(x + w)); xx++)
        if (R() > wear) im.data[(yy * W + xx) * 4 + 3] = 0
  }
  const label = (y: number, h: number, a = 0.62) => rect(im, 10, y, W - 20, h, [20, 16, 12], a)
  // «строка» названия: буквы — короткие вертикальные штрихи разной высоты, поперёк корешка
  const title = (yc: number, len: number, size = 7) => {
    let x = (W - len * (size + 3)) / 2
    for (let i = 0; i < len; i++) {
      const h = size * (0.7 + R() * 0.5)
      if (R() > 0.12) {
        gild(x, yc - h / 2, 2, h, 0.05)
        if (R() > 0.4) gild(x + 2, yc - h / 2, size - 2, 2, 0.05)
        if (R() > 0.5) gild(x + size - 2, yc - h / 2, 2, h * 0.6, 0.05)
      }
      x += size + 3
    }
  }
  const rule = (y: number, h = 3) => gild(8, y, W - 16, h)
  switch (variant % 6) {
    case 0:
      rule(H - 30)
      rule(H - 38, 2)
      label(H - 170, 96)
      title(H - 110, 7)
      title(H - 138, 5, 6)
      rule(30, 2)
      rule(36)
      title(70, 4, 6)
      break
    case 1:
      rect(im, 0, H - 60, W, 60, [0, 0, 0], 0.28)
      rect(im, 0, 0, W, 60, [0, 0, 0], 0.28)
      rule(H - 64, 2)
      rule(62, 2)
      for (let i = 0; i < 5; i++) rule(150 + i * 44, 2)
      title(H - 140, 8, 7)
      break
    case 2:
      for (let i = 0; i < 5; i++) rect(im, 0, 30 + i * 100, W, 8, [0, 0, 0], 0.35)
      label(H - 200, 70, 0.5)
      title(H - 165, 6)
      title(120, 3, 6)
      break
    case 3:
      rect(im, 12, H - 140, W - 24, 90, [238, 226, 200], 0.85)
      for (let i = 0; i < 4; i++) rect(im, 22, H - 70 - i * 16, W - 44 - R() * 26, 5, [40, 30, 22], 0.85)
      rule(H - 30)
      rule(40)
      break
    case 4:
      // рамка-картуш и фирменный знак издательства внизу
      gild(14, H - 190, 3, 130)
      gild(W - 17, H - 190, 3, 130)
      gild(14, H - 190, W - 28, 3)
      gild(14, H - 63, W - 28, 3)
      title(H - 105, 6)
      title(H - 145, 7, 6)
      gild(W / 2 - 10, 40, 20, 20, 0.3)
      break
    default:
      rect(im, 0, 0, W, H * 0.18, [0, 0, 0], 0.4)
      rect(im, 0, H * 0.82, W, H * 0.18, [0, 0, 0], 0.4)
      rule(H * 0.18 - 2, 2)
      rule(H * 0.82, 2)
      title(H * 0.6, 9, 6)
      title(H * 0.5, 4, 6)
  }
  return im
}

/** ткань крышек: плотное плетение, альбедо светлое (цвет даёт инстанс) + нормаль */
export function cloth(seed = 5) {
  const W = 256
  const nz = makeNoise(seed)
  const map = img(W, W, true)
  const hgt = new Float32Array(W * W)
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      // нити основы и утка по 2 пикселя, переплетение «полотно»
      const cx = Math.floor(x / 2)
      const cy = Math.floor(y / 2)
      const over = (cx + cy) & 1
      const fx = (x % 2) / 2 + 0.25
      const fy = (y % 2) / 2 + 0.25
      const h = over ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI)
      hgt[y * W + x] = h * 0.6 + nz(x * 0.08, y * 0.08) * 0.4
      const v = Math.min(255, 205 * (0.92 + 0.1 * h) * (0.93 + 0.1 * nz(x * 0.03 + 5, y * 0.03)))
      const k = (y * W + x) * 4
      map.data[k] = map.data[k + 1] = map.data[k + 2] = v
      map.data[k + 3] = 255
    }
  return { map, normal: heightToNormal(hgt, W, W, 1.2) }
}

/** срез блока страниц: тонкие листы по u, пожелтевшие, с тёмным налётом у краёв */
export function pageEdge(seed = 8) {
  const W = 512
  const H = 64
  const R = mulberry(seed)
  const nz = makeNoise(seed)
  const map = img(W, H, true)
  const hgt = new Float32Array(W * H)
  const sheet = new Float32Array(W)
  for (let x = 0; x < W; x++) sheet[x] = 0.9 + R() * 0.12 - (R() < 0.08 ? 0.12 : 0)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gap = x % 3 === 0 ? 0.78 : 1
      const age = 0.95 - 0.08 * nz(x * 0.01, y * 0.2)
      const v = sheet[x] * gap * age
      const k = (y * W + x) * 4
      map.data[k] = Math.min(255, 236 * v)
      map.data[k + 1] = Math.min(255, 222 * v)
      map.data[k + 2] = Math.min(255, 188 * v)
      map.data[k + 3] = 255
      hgt[y * W + x] = gap < 1 ? 0 : 1
    }
  return { map, normal: heightToNormal(hgt, W, H, 0.6) }
}

/**
 * Обшивка корабля: панели разного размера, разделка швов, заклёпки по краям,
 * грязь у швов. Возвращает альбедо, нормаль и шероховатость.
 */
export function hullMaps(seed = 21) {
  const W = 1024
  const R = mulberry(seed)
  const nz = makeNoise(seed)
  const hgt = new Float32Array(W * W).fill(0.5)
  const alb = new Float32Array(W * W).fill(1)
  const rgh = new Float32Array(W * W).fill(0.45)
  const panels: [number, number, number, number][] = []
  const split = (x: number, y: number, w: number, h: number, d: number) => {
    if (d > 4 || (d > 1 && R() < 0.3) || w < 60 || h < 60) {
      panels.push([x, y, w, h])
      return
    }
    if (w > h ? R() < 0.8 : R() < 0.2) {
      const k = Math.round(w * (0.3 + R() * 0.4))
      split(x, y, k, h, d + 1)
      split(x + k, y, w - k, h, d + 1)
    } else {
      const k = Math.round(h * (0.3 + R() * 0.4))
      split(x, y, w, k, d + 1)
      split(x, y + k, w, h - k, d + 1)
    }
  }
  split(0, 0, W, W, 0)
  // тон панели: основная белая краска, реже — серые вставки и тёплые, выгоревшие листы
  const tint = new Float32Array(W * W * 3).fill(1)
  for (const [px, py, pw, ph] of panels) {
    const kind = R()
    const tone = kind < 0.1 ? 0.62 + R() * 0.08 : kind < 0.18 ? 0.86 : 0.9 + R() * 0.1
    const warm = kind >= 0.1 && kind < 0.18 ? [1.0, 0.97, 0.9] : [1, 1, 1]
    const rough = kind < 0.1 ? 0.5 + R() * 0.15 : 0.3 + R() * 0.26
    const riv = R() < 0.6
    // маркировка: пара тёмных «строк» у края некоторых панелей
    const mark = pw > 110 && ph > 70 && R() < 0.35
    const mx = px + 14 + Math.floor(R() * Math.max(1, pw - 110))
    const my = py + 14 + Math.floor(R() * Math.max(1, ph - 50))
    const mLen = 40 + R() * 50
    for (let y = py; y < py + ph; y++)
      for (let x = px; x < px + pw; x++) {
        const i = y * W + x
        const ex = Math.min(x - px, px + pw - 1 - x)
        const ey = Math.min(y - py, py + ph - 1 - y)
        const e = Math.min(ex, ey)
        let h = 0.5
        if (e < 2) h = 0.1
        else if (e < 4) h = 0.35
        if (riv && e >= 7 && e <= 10) {
          const along = ex < ey ? y : x
          if (along % 18 < 4) h = 0.75
        }
        hgt[i] = h
        // грязь у швов, крупные пятна и вертикальные потёки
        const streak = Math.max(0, nz(x * 0.09, y * 0.004 + 7) - 0.55) * 0.35
        const dirt = Math.max(0, 1 - e / 26) * 0.1 + nz(x * 0.012, y * 0.012) * 0.08 + streak
        let t = tone * (1 - dirt)
        if (mark && y >= my && y < my + 30 && x >= mx && x < mx + mLen) {
          const row = (y - my) % 12
          const glyph = nz(x * 0.45, y * 0.1 + 3)
          if (row < 5 && glyph > 0.45 && x < mx + mLen * (row < 12 ? 1 : 0.6)) t *= 0.35
        }
        alb[i] = t
        rgh[i] = rough + dirt * 0.5
        tint[i * 3] = warm[0]
        tint[i * 3 + 1] = warm[1]
        tint[i * 3 + 2] = warm[2]
      }
  }
  const map = img(W, W, true)
  const rough = img(W, W, false)
  for (let i = 0; i < W * W; i++) {
    const a = Math.min(255, alb[i] * 235)
    map.data[i * 4] = a * tint[i * 3]
    map.data[i * 4 + 1] = a * 0.995 * tint[i * 3 + 1]
    map.data[i * 4 + 2] = a * 0.975 * tint[i * 3 + 2]
    map.data[i * 4 + 3] = 255
    const r = Math.min(255, rgh[i] * 255)
    rough.data[i * 4] = rough.data[i * 4 + 1] = rough.data[i * 4 + 2] = r
    rough.data[i * 4 + 3] = 255
  }
  return { map, normal: heightToNormal(hgt, W, W, 3), rough }
}

/** мятая золотая плёнка: гранёные складки из пересекающихся «сгибов» */
export function foilNormal(seed = 33) {
  const W = 512
  const R = mulberry(seed)
  const hgt = new Float32Array(W * W)
  const folds = Array.from({ length: 90 }, () => {
    const a = R() * Math.PI
    return { nx: Math.cos(a), ny: Math.sin(a), c: R() * W * 1.4 - W * 0.2, k: 0.4 + R() * 1.4 }
  })
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      let h = 0
      for (const f of folds) h += Math.abs(Math.sin((x * f.nx + y * f.ny - f.c) * 0.02 * f.k)) * 0.12
      hgt[y * W + x] = h
    }
  return heightToNormal(hgt, W, W, 4)
}

/** плитки: тёмная сетка — теплозащита «Рейнджера» и ячейки солнечных панелей */
export function tiles() {
  const W = 256
  const im = img(W, W, true)
  const R = mulberry(4)
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const v = 18 + R() * 12
      rect(im, x * 32 + 1, y * 32 + 1, 30, 30, [v, v + 2, v + 6], 1)
    }
  for (let i = 0; i <= 8; i++) {
    rect(im, i * 32 - 1, 0, 1, W, [106, 106, 112], 1)
    rect(im, 0, i * 32 - 1, W, 1, [106, 106, 112], 1)
  }
  for (let i = 3; i < im.data.length; i += 4) im.data[i] = 255
  return im
}
