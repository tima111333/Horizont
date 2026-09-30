// Акт VI. Тессеракт: бесконечная решётка из «задников» книжной полки, растянутых
// во времени. Ячейки — инстансы, которые шейдер заворачивает вокруг камеры,
// поэтому решётка бесконечна при конечном числе объектов. Курсор = положение в ней.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useScrollScene } from '../hooks/useScrollScene'
import { rig } from '../core/rig'
import { fx } from '../core/fx'
import { S, isLow } from '../story/store'
import { mulberry } from '../models/wheat'
import { BOOK_SHAPES, bookGeometry, shapeFor } from '../models/book'

const CELL = new THREE.Vector3(2.6, 2.2, 2.6)
const GRID = isLow ? new THREE.Vector3(5, 5, 7) : new THREE.Vector3(9, 9, 11)
const PALETTE = ['#7a3322', '#314a33', '#24324d', '#8a6436', '#57283b', '#474740', '#9a8358', '#2a4848', '#6d4722', '#3a302a', '#b48c52', '#4c3622']

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** одна ячейка: полка-доска, стойка, ряд книг (вид сзади) и световая щель за ними */
function buildCell() {
  const R = mulberry(606)
  const parts: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, col: THREE.Color, part: number, x: number, y: number, z: number) => {
    g.translate(x, y, z)
    const n = g.attributes.position.count
    const c = new Float32Array(n * 3)
    const pa = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      c[i * 3] = col.r
      c[i * 3 + 1] = col.g
      c[i * 3 + 2] = col.b
      pa[i] = part
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    g.setAttribute('aPart', new THREE.BufferAttribute(pa, 1))
    parts.push(g.index ? g.toNonIndexed() : g)
  }
  // книга в переплёте: крышки — цвет книги, срез страниц — часть 2 (бумага в шейдере)
  const books = BOOK_SHAPES.map((sh) => bookGeometry(sh, 5))
  const addBook = (w: number, h: number, d: number, col: THREE.Color, x: number, y: number, z: number, flip: boolean) => {
    const g = books[shapeFor(w)].clone()
    const pa = new Float32Array(g.attributes.position.count).fill(1)
    const pages = g.groups[2]
    for (let i = pages.start; i < pages.start + pages.count; i++) pa[i] = 2
    g.clearGroups()
    // большинство — корешком от нас (видим срезы, как из-за полки), часть — корешком к нам
    g.scale(w, h, d)
    if (flip) g.rotateY(Math.PI)
    g.translate(x, y, z)
    const c = new Float32Array(pa.length * 3)
    for (let i = 0; i < pa.length; i++) {
      c[i * 3] = col.r
      c[i * 3 + 1] = col.g
      c[i * 3 + 2] = col.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    g.setAttribute('aPart', new THREE.BufferAttribute(pa, 1))
    parts.push(g)
  }
  const wood = new THREE.Color('#3d2716')
  // доска и стойка
  add(new THREE.BoxGeometry(CELL.x, 0.05, 0.42), wood, 0, 0, -CELL.y / 2 + 0.05, 0)
  add(new THREE.BoxGeometry(0.05, CELL.y, 0.42), wood, 0, -CELL.x / 2 + 0.025, 0, 0)
  // книги стоят корешками от нас: видим обрезы и задние крышки
  let x = -CELL.x / 2 + 0.07
  while (x < CELL.x / 2 - 0.06) {
    const w = 0.025 + Math.pow(R(), 1.6) * 0.06
    const h = 0.22 + R() * 0.16
    const d = 0.18 + R() * 0.1
    const col = new THREE.Color(PALETTE[Math.floor(R() * PALETTE.length)]).multiplyScalar(0.7 + R() * 0.5)
    if (R() < 0.07) {
      x += 0.05 + R() * 0.08
      continue
    }
    addBook(w, h, d, col, x + w / 2, -CELL.y / 2 + 0.075 + h / 2, (R() - 0.5) * 0.04, R() < 0.55)
    x += w + 0.002
  }
  // щель света за книгами — комната по ту сторону полки
  add(new THREE.PlaneGeometry(CELL.x - 0.1, 0.4), new THREE.Color(1, 0.8, 0.5), 3, 0, -CELL.y / 2 + 0.28, -0.22)
  // верхняя часть ячейки — пустота с полосами книг следующего «слоя времени»
  return mergeGeometries(parts)!
}

/** нити: книги, растянутые вдоль оси времени (z) */
function buildStrands() {
  const R = mulberry(77)
  const per = isLow ? 5 : 9
  const g = new THREE.BoxGeometry(1, 1, 1)
  const ig = new THREE.InstancedBufferGeometry()
  ig.index = g.index
  ig.setAttribute('position', g.attributes.position)
  ig.setAttribute('normal', g.attributes.normal)
  const n = GRID.x * GRID.y * per
  const base = new Float32Array(n * 3)
  const off = new Float32Array(n * 4)
  const col = new Float32Array(n * 3)
  let k = 0
  for (let i = 0; i < GRID.x; i++)
    for (let j = 0; j < GRID.y; j++)
      for (let s = 0; s < per; s++) {
        base[k * 3] = i
        base[k * 3 + 1] = j
        base[k * 3 + 2] = 0
        // x внутри ячейки, y — по высоте книг, толщина и сила свечения
        off[k * 4] = (R() - 0.5) * CELL.x * 0.95
        off[k * 4 + 1] = -CELL.y / 2 + 0.1 + R() * 0.32
        off[k * 4 + 2] = 0.008 + R() * 0.03
        off[k * 4 + 3] = R()
        const c = new THREE.Color(PALETTE[Math.floor(R() * PALETTE.length)])
        col[k * 3] = c.r
        col[k * 3 + 1] = c.g
        col[k * 3 + 2] = c.b
        k++
      }
  ig.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3))
  ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4))
  ig.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 3))
  ig.instanceCount = n
  return ig
}

/** золотые струны вдоль x на рёбрах ячеек — дрожат от движения курсора */
function buildStrings() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 5, 64, true)
  g.rotateZ(Math.PI / 2)
  const ig = new THREE.InstancedBufferGeometry()
  ig.index = g.index
  ig.setAttribute('position', g.attributes.position)
  ig.setAttribute('normal', g.attributes.normal)
  const n = GRID.y * GRID.z
  const base = new Float32Array(n * 3)
  let k = 0
  for (let j = 0; j < GRID.y; j++)
    for (let l = 0; l < GRID.z; l++) {
      base[k * 3] = 0
      base[k * 3 + 1] = j
      base[k * 3 + 2] = l
      k++
    }
  ig.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3))
  ig.instanceCount = n
  return ig
}

// заворачивание решётки вокруг камеры: у любой ячейки — ближайшая копия
const wrapGLSL = /* glsl */ `
uniform vec3 uCell;
uniform vec3 uGrid;
uniform vec3 uCamCell;
vec3 wrapCell(vec3 base) {
  vec3 c = base - uCamCell;
  c = mod(c + floor(uGrid * 0.5), uGrid) - floor(uGrid * 0.5) + uCamCell;
  return c;
}
`

const shadeGLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uFogCol;
uniform float uFog;
uniform float uFocus;
vec3 fogIt(vec3 col, float dist) {
  return mix(col, uFogCol, 1.0 - exp(-dist * uFog));
}
`

export default function Tesseract() {
  const u = useMemo(
    () => ({
      uCell: { value: CELL },
      uGrid: { value: GRID },
      uCamCell: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uFogCol: { value: new THREE.Color(0.02, 0.018, 0.022) },
      uFog: { value: 0.07 },
      uFocus: { value: 0 },
      uShiver: { value: 0 },
      uFocusCell: { value: new THREE.Vector3() },
    }),
    [],
  )

  const { cells, cellMat, strands, strandMat, strings, stringMat } = useMemo(() => {
    const cellGeo = buildCell()
    const ig = new THREE.InstancedBufferGeometry()
    ig.index = cellGeo.index
    for (const k of Object.keys(cellGeo.attributes)) ig.setAttribute(k, cellGeo.attributes[k])
    const n = GRID.x * GRID.y * GRID.z
    const base = new Float32Array(n * 3)
    let k = 0
    for (let i = 0; i < GRID.x; i++) for (let j = 0; j < GRID.y; j++) for (let l = 0; l < GRID.z; l++) {
      base[k * 3] = i
      base[k * 3 + 1] = j
      base[k * 3 + 2] = l
      k++
    }
    ig.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3))
    ig.instanceCount = n
    const cellMat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexColors: true,
      vertexShader:
        wrapGLSL +
        /* glsl */ `
        attribute vec3 aBase;
        attribute float aPart;
        uniform vec3 uFocusCell;
        varying vec3 vCol;
        varying vec3 vN;
        varying vec3 vW;
        varying float vPart;
        varying float vHash;
        varying float vFocus;
        varying vec2 vUv;
        float h13(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
        void main() {
          vec3 cell = wrapCell(aBase);
          vec3 wp = position + cell * uCell;
          vW = wp;
          vN = normal;
          vCol = color;
          vPart = aPart;
          vUv = uv;
          vHash = h13(cell);
          vFocus = step(distance(cell, uFocusCell), 0.1);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader:
        shadeGLSL +
        /* glsl */ `
        varying vec3 vCol;
        varying vec3 vN;
        varying vec3 vW;
        varying float vPart;
        varying float vHash;
        varying float vFocus;
        varying vec2 vUv;
        void main() {
          vec3 N = normalize(vN);
          float dist = distance(cameraPosition, vW);
          // свет изнутри комнаты: тёплый из-за полки (+z), холодный отражённый спереди
          vec3 key = vec3(1.0, 0.72, 0.42) * (0.35 + 0.65 * max(dot(N, normalize(vec3(0.2, 0.5, 1.0))), 0.0));
          vec3 fill = vec3(0.25, 0.32, 0.5) * max(dot(N, normalize(vec3(-0.3, -0.2, -1.0))), 0.0) * 0.6;
          vec3 base = vCol;
          if (vPart > 1.5 && vPart < 2.5) {
            // срез страниц: пожелтевшая бумага, тонкие листы поперёк
            float sheet = 0.82 + 0.18 * step(0.35, fract(vUv.x * 48.0 + vHash * 3.0));
            base = vec3(0.6, 0.52, 0.38) * sheet;
          }
          vec3 col = base * (key * 1.1 + fill);
          // у каждой ячейки — свой момент времени: одни комнаты светлее, другие в сумерках
          float moment = 0.45 + 0.55 * vHash;
          col *= moment;
          if (vPart > 2.5) {
            // щель света, в «той самой» комнате — ярче и дышит
            float breathe = 0.85 + 0.15 * sin(uTime * (0.6 + vHash) + vHash * 20.0);
            // мягкое свечение: ярче к середине щели, края тают — не плоская белая плашка
            float v = pow(sin(3.14159 * clamp(vUv.y, 0.0, 1.0)), 1.5);
            float hx = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
            col = vec3(1.0, 0.62, 0.3) * (0.5 + 1.1 * vHash) * breathe * v * hx;
            col *= 1.0 + vFocus * uFocus * 4.0;
          }
          col += vec3(1.0, 0.75, 0.45) * vFocus * uFocus * 0.4;
          gl_FragColor = vec4(fogIt(col, dist), 1.0);
        }`,
    })

    const strands = buildStrands()
    const strandMat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader:
        wrapGLSL +
        /* glsl */ `
        attribute vec3 aBase;
        attribute vec4 aOff;
        attribute vec3 aCol;
        varying vec3 vCol;
        varying vec3 vW;
        varying float vGlow;
        varying float vZ;
        void main() {
          vec3 cell = wrapCell(vec3(aBase.xy, 0.0));
          float len = uGrid.z * uCell.z;
          vec3 p = position;
          p.x *= aOff.z;
          p.y *= aOff.z * 1.4;
          p.z *= len;
          vec3 wp = vec3(cell.x * uCell.x + aOff.x, cell.y * uCell.y + aOff.y, cameraPosition.z) + p;
          vW = wp;
          vCol = aCol;
          vGlow = aOff.w;
          vZ = p.z / len;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader:
        shadeGLSL +
        /* glsl */ `
        varying vec3 vCol;
        varying vec3 vW;
        varying float vGlow;
        varying float vZ;
        void main() {
          float dist = distance(cameraPosition, vW);
          // нить мерцает бегущими вдоль оси времени импульсами
          float pulse = pow(0.5 + 0.5 * sin(vW.z * 1.3 + uTime * 2.2 + vGlow * 30.0), 8.0);
          vec3 col = vCol * (0.6 + 1.4 * vGlow) + vec3(1.0, 0.75, 0.45) * pulse * vGlow * 1.6;
          gl_FragColor = vec4(fogIt(col, dist), 1.0);
        }`,
    })

    const strings = buildStrings()
    const stringMat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader:
        wrapGLSL +
        /* glsl */ `
        attribute vec3 aBase;
        uniform float uShiver;
        uniform float uTime;
        varying vec3 vW;
        varying float vA;
        void main() {
          vec3 cell = wrapCell(vec3(0.0, aBase.yz));
          float len = uGrid.x * uCell.x;
          vec3 p = position;
          float x = p.x * len;
          // стоячая волна на струне: амплитуда — от скорости курсора
          float wave = sin(x * 0.9 - uTime * 7.0 + cell.z * 1.7) * uShiver * 0.06;
          vec3 wp = vec3(cameraPosition.x + x, cell.y * uCell.y + CELL_Y_EDGE + wave + p.y * 0.006, cell.z * uCell.z + CELL_Z_EDGE + p.z * 0.006);
          vW = wp;
          vA = 1.0;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`
          .replace('CELL_Y_EDGE', (CELL.y / 2).toFixed(3))
          .replace('CELL_Z_EDGE', (CELL.z / 2).toFixed(3)),
      fragmentShader:
        shadeGLSL +
        /* glsl */ `
        uniform float uShiver;
        varying vec3 vW;
        varying float vA;
        void main() {
          float dist = distance(cameraPosition, vW);
          vec3 col = vec3(1.0, 0.78, 0.45) * (1.6 + uShiver * 2.0);
          gl_FragColor = vec4(fogIt(col, dist), 1.0);
        }`,
    })
    return { cells: ig, cellMat, strands, strandMat, strings, stringMat }
  }, [u])

  useEffect(
    () => () => {
      ;[cells, strands, strings].forEach((g) => g.dispose())
      ;[cellMat, strandMat, stringMat].forEach((m) => m.dispose())
    },
    [cells, strands, strings, cellMat, strandMat, stringMat],
  )

  const cam = useMemo(() => ({ x: 0, y: 0, lx: 0, ly: 0, speed: 0 }), [])
  useScrollScene('tesseract', ({ p, t, dt }) => {
    // курсор — положение в решётке: мягко, с инерцией, до полутора ячеек в стороны
    const k = 1 - Math.exp(-dt * 1.6)
    const tx = S.pointer.x * CELL.x * 1.4
    const ty = S.pointer.y * CELL.y * 1.1
    const vx = (tx - cam.x) * k
    const vy = (ty - cam.y) * k
    cam.x += vx
    cam.y += vy
    cam.speed += (Math.min(1, Math.hypot(vx, vy) * 18) - cam.speed) * (1 - Math.exp(-dt * 5))
    // прокрутка — движение по оси времени; в начале — вылет из тьмы с разгона
    const arrive = 1 - smooth(0, 0.14, p)
    const z = -p * 26 - arrive * arrive * 18
    rig.ownPointer = true
    rig.pos.set(cam.x + Math.sin(t * 0.21) * 0.15, cam.y + 0.35 + Math.sin(t * 0.17) * 0.1, z)
    cam.lx += (S.pointer.x * 1.2 - cam.lx) * k
    cam.ly += (S.pointer.y * 0.8 - cam.ly) * k
    rig.look.set(rig.pos.x + cam.lx, rig.pos.y + cam.ly - 0.15, z - 6)
    rig.fov = 55 + arrive * 25
    rig.near = 0.05
    rig.far = 80
    rig.shake = 0.006
    rig.roll = Math.sin(t * 0.1) * 0.03 + cam.lx * -0.04

    u.uTime.value = t
    u.uCamCell.value.set(Math.floor(rig.pos.x / CELL.x + 0.5), Math.floor(rig.pos.y / CELL.y + 0.5), Math.floor(rig.pos.z / CELL.z + 0.5))
    u.uShiver.value = cam.speed
    // послание: одна комната впереди разгорается
    u.uFocus.value = smooth(0.58, 0.66, p) * (1 - smooth(0.93, 1, p))
    u.uFocusCell.value.set(u.uCamCell.value.x, u.uCamCell.value.y, u.uCamCell.value.z - 2)
    u.uFog.value = 0.075 + arrive * 0.25
    fx.bloom = 1.1 + u.uFocus.value * 0.4
  })

  return (
    <>
      <mesh geometry={cells} material={cellMat} frustumCulled={false} />
      <mesh geometry={strands} material={strandMat} frustumCulled={false} />
      <mesh geometry={strings} material={stringMat} frustumCulled={false} />
    </>
  )
}
