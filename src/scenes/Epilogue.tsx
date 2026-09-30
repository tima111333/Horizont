// Эпилог. Станция-цилиндр изнутри: поля, дороги, дома и рощи на внутренней
// поверхности, которая загибается вверх и за дымкой становится «небом».
// По оси — световая нить-солнце, вокруг неё плывут облака.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import noise from '../shaders/noise.glsl?raw'
import { useScrollScene } from '../hooks/useScrollScene'
import { rig } from '../core/rig'
import { fx } from '../core/fx'
import { isLow } from '../story/store'
import { mulberry } from '../models/wheat'

const R = 120
const L = 1400

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// общая дымка: чем дальше по лучу — тем бледнее и голубее, это и есть «небо»
const hazeGLSL = /* glsl */ `
uniform float uWhite;
uniform float uDusk;   // к титрам станция уходит в вечер
vec3 haze(vec3 col, vec3 wp) {
  vec3 v = wp - cameraPosition;
  float d = length(v);
  // у оси воздух светлее — там солнце
  float f = 1.0 - exp(-d * 0.0018);
  vec3 hz = mix(vec3(0.5, 0.64, 0.8), vec3(0.9, 0.9, 0.84), smoothstep(40.0, 0.0, length(wp.xy)) * 0.6);
  vec3 dusk = vec3(0.16, 0.12, 0.13);
  hz = mix(hz, dusk, uDusk);
  col *= mix(vec3(1.0), vec3(0.42, 0.34, 0.3), uDusk);
  col = mix(col, hz, clamp(f, 0.0, 1.0));
  return mix(col, vec3(0.95, 0.96, 0.97), uWhite);
}
`

function Land({ u }: { u: Record<string, THREE.IUniform> }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: /* glsl */ `
          varying vec3 vW;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader:
          noise +
          hazeGLSL +
          /* glsl */ `
          uniform float uTime;
          varying vec3 vW;
          float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
          void main() {
            float th = atan(vW.y, vW.x);
            vec2 s = vec2(th * ${R.toFixed(1)}, vW.z);    // развёртка поверхности, метры
            // наделы: сетка 34×46 м, повёрнутая и слегка искажённая
            vec2 q = s + vec2(snoise(vec3(s * 0.004, 1.0)), snoise(vec3(s * 0.004, 7.0))) * 18.0;
            vec2 cell = floor(q / vec2(34.0, 46.0));
            vec2 f = fract(q / vec2(34.0, 46.0));
            float r = h12(cell);
            vec3 crop;
            if (r < 0.3) crop = vec3(0.1, 0.2, 0.05);            // зелёное поле
            else if (r < 0.55) crop = vec3(0.5, 0.38, 0.13);      // пшеница — снова растёт
            else if (r < 0.7) crop = vec3(0.22, 0.15, 0.09);      // пашня
            else if (r < 0.85) crop = vec3(0.16, 0.26, 0.08);
            else crop = vec3(0.07, 0.14, 0.05);                   // сады
            // рядки посева внутри надела
            // рядки посева: заметны вблизи, вдали сходят на нет (иначе муар)
            float rowFade = exp(-length(vW - cameraPosition) * 0.012);
            float rows = 1.0 - (0.05 + 0.08 * rowFade) + (0.05 + 0.08 * rowFade) * sin((r > 0.5 ? f.x : f.y) * 90.0);
            crop *= rows * (0.85 + 0.3 * vnoise(vec3(s * 0.08, 2.0)));
            // межи
            vec2 e = min(f, 1.0 - f);
            crop = mix(vec3(0.2, 0.2, 0.14), crop, smoothstep(0.0, 0.03, min(e.x, e.y)));
            // дороги вдоль оси и кольцевые
            float road = 1.0 - smoothstep(1.4, 2.4, abs(mod(s.x + 60.0, 190.0) - 95.0));
            road = max(road, 1.0 - smoothstep(1.2, 2.2, abs(mod(s.y, 240.0) - 120.0)));
            crop = mix(crop, vec3(0.42, 0.4, 0.36), road);
            // река петляет вдоль станции
            float river = abs(s.x - 40.0 - 55.0 * sin(s.y * 0.006) - 20.0 * sin(s.y * 0.017));
            float water = 1.0 - smoothstep(5.0, 7.5, river);
            crop = mix(crop, vec3(0.08, 0.16, 0.2), water);
            crop += vec3(0.25, 0.3, 0.32) * water * pow(vnoise(vec3(s * 0.3, uTime * 0.4)), 4.0);
            // свет от оси падает почти вертикально — поверхность ровно освещена
            vec3 col = crop * 1.35;
            // окна домов зажигаются к вечеру
            float lamp = step(0.995, h12(floor(s * 0.35))) * (1.0 - water) * uDusk;
            col += vec3(2.2, 1.4, 0.6) * lamp;
            gl_FragColor = vec4(haze(col, vW), 1.0);
          }`,
        side: THREE.BackSide,
      }),
    [u],
  )
  return (
    <mesh material={mat} rotation-x={Math.PI / 2} frustumCulled={false}>
      <cylinderGeometry args={[R, R, L, 256, 32, true]} />
    </mesh>
  )
}

/** псевдошум по позиции — неровности кроны без текстур */
const jitter = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return s - Math.floor(s)
}
/** проставить часть (цвет в шейдере) и затенение каждой вершине и сделать геометрию индексной */
function tag(g: THREE.BufferGeometry, part: number, ao: (x: number, y: number, z: number) => number) {
  const c = new THREE.BufferGeometry()
  c.setAttribute('position', g.attributes.position)
  c.setAttribute('normal', g.attributes.normal)
  if (g.index) c.setIndex(g.index)
  const p = c.attributes.position
  const pa = new Float32Array(p.count).fill(part)
  const a = new Float32Array(p.count)
  for (let i = 0; i < p.count; i++) a[i] = ao(p.getX(i), p.getY(i), p.getZ(i))
  c.setAttribute('aPart', new THREE.BufferAttribute(pa, 1))
  c.setAttribute('aAO', new THREE.BufferAttribute(a, 1))
  return c
}
const indexed = (g: THREE.BufferGeometry) => {
  const c = new THREE.BufferGeometry()
  c.setAttribute('position', g.attributes.position)
  c.setAttribute('normal', g.attributes.normal)
  if (g.index) c.setIndex(g.index)
  return c.index ? c : mergeVertices(c)
}

/** лиственное дерево: ствол и крона из трёх неровных шапок; «вверх» по +y */
function deciduous() {
  const R = mulberry(31)
  const parts = [tag(new THREE.CylinderGeometry(0.16, 0.28, 2.4, 6, 1).translate(0, 1.2, 0), 2, (_x, y) => 0.55 + y * 0.15)]
  for (let k = 0; k < 3; k++) {
    const r = 1.35 - k * 0.2 + R() * 0.25
    const g = indexed(new THREE.IcosahedronGeometry(r, 1))
    // неровный край кроны
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      const s = 0.82 + 0.3 * jitter(x + k, y, z)
      p.setXYZ(i, x * s, y * s * 0.9, z * s)
    }
    g.computeVertexNormals()
    const a = (k / 3) * Math.PI * 2 + R()
    g.translate(Math.cos(a) * 0.55 * (k ? 1 : 0.2), 3.2 + k * 0.55, Math.sin(a) * 0.55 * (k ? 1 : 0.2))
    // низ кроны и сердцевина — в тени
    parts.push(tag(g, 0, (x, y, z) => 0.45 + 0.55 * Math.min(1, Math.max(0, (y - 2.2) / 2.6)) * (0.7 + 0.3 * Math.min(1, Math.hypot(x, z) / 1.4))))
  }
  return mergeGeometries(parts)!
}

/** ель: три рваных яруса, ствол */
function conifer() {
  const parts = [tag(new THREE.CylinderGeometry(0.12, 0.22, 1.6, 5, 1).translate(0, 0.8, 0), 2, () => 0.5)]
  for (let k = 0; k < 3; k++) {
    const g = indexed(new THREE.ConeGeometry(1.7 - k * 0.45, 2.6 - k * 0.3, 9, 2))
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const s = 0.85 + 0.3 * jitter(x, p.getY(i) + k, z)
      p.setX(i, x * s)
      p.setZ(i, z * s)
    }
    g.computeVertexNormals()
    g.translate(0, 2.0 + k * 1.35, 0)
    parts.push(tag(g, 0, (_x, y) => 0.4 + 0.6 * Math.min(1, Math.max(0, (y - 1.2) / 4.2))))
  }
  return mergeGeometries(parts)!
}

/** дом: стены, двускатная крыша с выносом, труба, окна и дверь */
function houseGeo() {
  const parts: THREE.BufferGeometry[] = []
  parts.push(tag(new THREE.BoxGeometry(7, 3.6, 5).translate(0, 1.8, 0), 0, (_x, y) => 0.75 + y * 0.07))
  // фронтоны — треугольники под скатами
  const gable = new THREE.Shape()
  gable.moveTo(-2.5, 0)
  gable.lineTo(0, 2.1)
  gable.lineTo(2.5, 0)
  gable.lineTo(-2.5, 0)
  for (const x of [-3.5, 3.5]) {
    const g = new THREE.ExtrudeGeometry(gable, { depth: 0.01, bevelEnabled: false })
    g.rotateY(Math.PI / 2).translate(x, 3.6, 0)
    parts.push(tag(g, 0, () => 0.9))
  }
  // скаты: тонкие плиты с выносом за стены
  const slope = Math.atan2(2.1, 2.5)
  const len = Math.hypot(2.5, 2.1) + 0.45
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(7.8, 0.14, len)
    g.translate(0, 0, -s * len * 0.5)
    g.rotateX(-s * slope)
    g.translate(0, 3.6 + 2.1, 0)
    parts.push(tag(g, 1, () => 1))
  }
  // труба
  parts.push(tag(new THREE.BoxGeometry(0.6, 1.6, 0.6).translate(1.8, 5.2, -0.9), 0, () => 0.8))
  // окна на длинных стенах и дверь
  for (const z of [-2.52, 2.52]) {
    for (const x of [-2.4, -0.8, 0.8, 2.4]) parts.push(tag(new THREE.BoxGeometry(0.8, 1.0, 0.06).translate(x, 2.2, z), 3, () => 1))
  }
  parts.push(tag(new THREE.BoxGeometry(0.9, 1.8, 0.06).translate(-1.6, 0.9, 2.53), 4, () => 1))
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!
}

/** дома и деревья на внутренней стороне цилиндра — «низ» каждого смотрит наружу */
function Settlements({ u }: { u: Record<string, THREE.IUniform> }) {
  const { trees, houses, mat } = useMemo(() => {
    const Rn = mulberry(2067)
    const house = houseGeo()
    const treeGeos = [deciduous(), conifer()]
    // сетка дорог — та же, что рисует шейдер земли: продольные через 190 м по дуге,
    // кольцевые через 240 м вдоль оси; река петляет рядом с продольной дорогой
    const AX = [-345, -155, 35, 225]
    const RING = [-600, -360, -120, 120, 360, 600]
    const riverX = (z: number) => 40 + 55 * Math.sin(z * 0.006) + 20 * Math.sin(z * 0.017)
    const nearRoad = (sx: number, z: number, w: number) => AX.some((x) => Math.abs(sx - x) < w) || RING.some((r) => Math.abs(z - r) < w)
    const nearRiver = (sx: number, z: number, w: number) => Math.abs(sx - riverX(z)) < w
    const o = new THREE.Object3D()
    const m3 = new THREE.Matrix4()
    const X = new THREE.Vector3()
    const Y = new THREE.Vector3()
    const Z = new THREE.Vector3()
    /** поставить объект на внутреннюю поверхность: sx — метры по дуге, z — вдоль оси, along — длинная сторона вдоль оси или по дуге */
    const stand = (sx: number, z: number, along: 'axis' | 'ring', scale: number) => {
      const th = sx / R
      Y.set(-Math.cos(th), -Math.sin(th), 0) // «вверх» — к оси станции
      const tangent = new THREE.Vector3(-Math.sin(th), Math.cos(th), 0)
      // у дома длинная сторона — локальный x
      X.copy(along === 'axis' ? new THREE.Vector3(0, 0, 1) : tangent)
      Z.crossVectors(X, Y)
      m3.makeBasis(X, Y, Z)
      o.quaternion.setFromRotationMatrix(m3)
      o.position.set(Math.cos(th) * (R - 0.2), Math.sin(th) * (R - 0.2), z)
      o.scale.setScalar(scale)
      o.updateMatrix()
      return o.matrix
    }

    // деревни: у каждого перекрёстка — улица вдоль продольной дороги и короткая вдоль кольцевой,
    // дома в два ряда фасадом к дороге, с ровным шагом
    const houseM: THREE.Matrix4[] = []
    const villages: [number, number][] = []
    const perSide = isLow ? 4 : 7
    for (const ax of AX)
      for (const rz of RING) {
        if (nearRiver(ax, rz, 30)) continue
        villages.push([ax, rz])
        for (const side of [-1, 1]) {
          for (let k = 1; k <= perSide; k++) {
            // вдоль продольной дороги, в обе стороны от перекрёстка
            for (const dir of [-1, 1]) houseM.push(stand(ax + side * 5.5, rz + dir * (6 + k * 7.5), 'axis', 0.5).clone())
          }
          for (let k = 1; k <= Math.ceil(perSide / 2); k++)
            for (const dir of [-1, 1]) houseM.push(stand(ax + dir * (6 + k * 7.5), rz + side * 5.5, 'ring', 0.5).clone())
        }
      }
    const houses = new THREE.InstancedMesh(house, undefined as unknown as THREE.Material, houseM.length)
    houseM.forEach((m, i) => {
      houses.setMatrixAt(i, m)
      // стены светлые, с небольшим разбросом: побелка, охра, серый кирпич
      houses.setColorAt(i, new THREE.Color().setHSL(0.07 + Rn() * 0.05, 0.25, 0.46 + Rn() * 0.2))
    })

    // рощи и лесополосы: не на дорогах, не в реке и не в деревнях
    const treeCount = isLow ? 4000 : 12000
    // два вида: лиственные рощи и ельники; вид — по роще, чтобы леса не были пёстрыми
    const trees = treeGeos.map((g) => new THREE.InstancedMesh(g, undefined as unknown as THREE.Material, treeCount))
    const counts = [0, 0]
    let kind = 0
    let n = 0
    let cx = 0
    let cz = 0
    for (let tries = 0; n < treeCount && tries < treeCount * 6; tries++) {
      if (n % 24 === 0 || tries % 40 === 0) {
        cx = (Rn() - 0.5) * Math.PI * 2 * R
        cz = (Rn() - 0.5) * L * 0.92
        kind = Rn() < 0.62 ? 0 : 1
      }
      const sx = cx + (Rn() - 0.5) * 12
      const z = cz + (Rn() - 0.5) * 26
      if (nearRoad(sx, z, 4) || nearRiver(sx, z, 9) || villages.some(([vx, vz]) => Math.abs(sx - vx) < 70 && Math.abs(z - vz) < 70)) continue
      const m = stand(sx, z, 'axis', 0.36 + Rn() * 0.34)
      const i = counts[kind]++
      trees[kind].setMatrixAt(i, m)
      trees[kind].setColorAt(i, kind ? new THREE.Color().setHSL(0.36 + Rn() * 0.05, 0.42, 0.07 + Rn() * 0.04) : new THREE.Color().setHSL(0.22 + Rn() * 0.08, 0.5, 0.1 + Rn() * 0.07))
      n++
    }
    trees.forEach((t, k) => (t.count = counts[k]))
    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        attribute float aPart;
        attribute float aAO;
        varying vec3 vW;
        varying vec3 vN;
        varying vec3 vC;
        varying float vPart;
        varying float vAO;
        varying float vHash;
        void main() {
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vC = instanceColor;
          vPart = aPart;
          vAO = aAO;
          vec3 o = instanceMatrix[3].xyz;
          vHash = fract(sin(dot(o, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader:
        hazeGLSL +
        /* glsl */ `
        varying vec3 vW;
        varying vec3 vN;
        varying vec3 vC;
        varying float vPart;
        varying float vAO;
        varying float vHash;
        void main() {
          // свет — от оси: направление к центру сечения
          vec3 L = normalize(vec3(-vW.xy, 0.0));
          vec3 N = normalize(vN);
          float d = max(dot(N, L), 0.0);
          vec3 base = vC;
          // крыши: черепица или шифер — по дому; ствол; окна и дверь
          if (vPart > 0.5 && vPart < 1.5) base = mix(vec3(0.36, 0.13, 0.08), vec3(0.2, 0.21, 0.23), step(0.62, vHash));
          else if (vPart > 1.5 && vPart < 2.5) base = vec3(0.14, 0.1, 0.07);
          else if (vPart > 2.5) base = vec3(0.04, 0.05, 0.06);
          // мягкое небо со всех сторон цилиндра + прямой свет оси
          vec3 col = base * (0.32 + 1.05 * d) * vAO;
          // окна к вечеру зажигаются — не все
          if (vPart > 2.5 && vPart < 3.5) col += vec3(2.0, 1.25, 0.55) * uDusk * step(0.3, fract(vHash * 7.3));
          gl_FragColor = vec4(haze(col, vW), 1.0);
        }`,
    })
    trees.forEach((t) => {
      t.material = mat
      t.frustumCulled = false
    })
    houses.material = mat
    houses.frustumCulled = false
    return { trees, houses, mat }
  }, [u])
  useEffect(
    () => () => {
      trees.forEach((t) => t.geometry.dispose())
      houses.geometry.dispose()
      mat.dispose()
    },
    [trees, houses, mat],
  )
  return (
    <>
      {trees.map((t, i) => (
        <primitive key={i} object={t} />
      ))}
      <primitive object={houses} />
    </>
  )
}

/** солнце станции: световая нить по оси и торцевые диски с окнами */
function AxisSun({ u }: { u: Record<string, THREE.IUniform> }) {
  const { sun, cap } = useMemo(() => {
    const sun = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader:
        hazeGLSL +
        /* glsl */ `
        varying vec3 vW;
        varying vec2 vUv;
        void main() {
          // сегменты светильника с тонкими перемычками
          float seg = smoothstep(0.0, 0.02, fract(vUv.y * 24.0)) * smoothstep(1.0, 0.98, fract(vUv.y * 24.0));
          vec3 col = vec3(6.0, 5.6, 4.8) * (0.35 + 0.65 * seg) * mix(1.0, 0.3, uDusk) + vec3(1.2, 0.5, 0.2) * uDusk * seg;
          gl_FragColor = vec4(mix(col, vec3(0.95, 0.96, 0.97), uWhite), 1.0);
        }`,
    })
    const cap = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader:
        hazeGLSL +
        /* glsl */ `
        varying vec3 vW;
        void main() {
          float r = length(vW.xy) / ${R.toFixed(1)};
          float a = atan(vW.y, vW.x);
          // торец: тёмный металл, радиальные рёбра, кольцо окон к космосу
          float ribs = smoothstep(0.92, 1.0, abs(sin(a * 12.0)));
          float win = smoothstep(0.55, 0.57, r) * smoothstep(0.8, 0.78, r) * (1.0 - ribs);
          vec3 col = vec3(0.12, 0.13, 0.15) * (0.8 + 0.4 * ribs);
          col += vec3(0.02, 0.03, 0.06) * win + vec3(0.9, 0.85, 0.7) * win * step(0.97, fract(a * 40.0 / 6.283));
          gl_FragColor = vec4(haze(col, vW), 1.0);
        }`,
      side: THREE.DoubleSide,
    })
    return { sun, cap }
  }, [u])
  return (
    <>
      <mesh material={sun} rotation-x={Math.PI / 2} frustumCulled={false}>
        <cylinderGeometry args={[1.4, 1.4, L, 24, 1, true]} />
      </mesh>
      {[-L / 2, L / 2].map((z) => (
        <mesh key={z} material={cap} position={[0, 0, z]} frustumCulled={false}>
          <circleGeometry args={[R, 96]} />
        </mesh>
      ))}
    </>
  )
}

/** облака вокруг оси: мягкие шапки-билборды, освещённые сверху */
function Clouds({ u }: { u: Record<string, THREE.IUniform> }) {
  const count = isLow ? 60 : 130
  const { geo, mat } = useMemo(() => {
    const Rn = mulberry(33)
    const base = new THREE.PlaneGeometry(1, 1)
    const ig = new THREE.InstancedBufferGeometry()
    ig.index = base.index
    ig.setAttribute('position', base.attributes.position)
    ig.setAttribute('uv', base.attributes.uv)
    const c = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      const th = Rn() * Math.PI * 2
      const r = 62 + Rn() * 26
      c[i * 4] = Math.cos(th) * r
      c[i * 4 + 1] = Math.sin(th) * r
      c[i * 4 + 2] = (Rn() - 0.5) * L * 0.9
      c[i * 4 + 3] = 10 + Rn() * 22
    }
    ig.setAttribute('aC', new THREE.InstancedBufferAttribute(c, 4))
    ig.instanceCount = count
    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        attribute vec4 aC;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vW;
        varying float vSeed;
        void main() {
          vUv = uv;
          vSeed = aC.w;
          vec3 center = aC.xyz + vec3(0.0, 0.0, uTime * 1.2);
          center.z = mod(center.z + ${(L / 2).toFixed(1)}, ${L.toFixed(1)}) - ${(L / 2).toFixed(1)};
          // билборд, развёрнутый к камере
          vec3 toCam = normalize(cameraPosition - center);
          vec3 right = normalize(cross(vec3(0.0, 0.0, 1.0), toCam));
          if (length(cross(vec3(0.0, 0.0, 1.0), toCam)) < 0.01) right = vec3(1.0, 0.0, 0.0);
          vec3 up = cross(toCam, right);
          vec3 wp = center + (right * position.x * 1.8 + up * position.y) * aC.w;
          vW = wp;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader:
        noise +
        hazeGLSL +
        /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vW;
        varying float vSeed;
        void main() {
          vec2 q = vUv - 0.5;
          float n = vfbm(vec3(vUv * vec2(3.0, 2.0) + vSeed, uTime * 0.02), 5);
          float shape = smoothstep(0.5, 0.15, length(q * vec2(1.0, 1.5)) - (n - 0.5) * 0.35);
          float a = shape * smoothstep(0.35, 0.6, n);
          if (a < 0.01) discard;
          // освещены со стороны оси, в тени — с земли
          float lit = 0.75 + 0.25 * smoothstep(-0.3, 0.4, q.y);
          vec3 col = vec3(1.0, 0.98, 0.95) * lit * 1.3 * mix(1.0, 0.35, uDusk);
          gl_FragColor = vec4(haze(col, vW), a * 0.85);
        }`,
      transparent: true,
      depthWrite: false,
    })
    return { geo: ig, mat }
  }, [u, count])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={4} />
}

// ─── ракурсы: из облаков — к земле — вверх, к оси, на всю станцию ─────────
const KEYS: [number, [number, number, number], [number, number, number], number][] = [
  [0.0, [0, -70, 420], [0, -80, 300], 50],
  [0.2, [4, -92, 330], [0, -100, 200], 46],
  [0.45, [10, -104, 200], [-6, -86, 20], 50],
  [0.7, [4, -80, 120], [0, -20, -200], 56],
  [1.0, [0, -44, 70], [0, 0, -500], 62],
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

export default function Epilogue() {
  const u = useMemo(() => ({ uTime: { value: 0 }, uWhite: { value: 1 }, uDusk: { value: 0 } }), [])
  useScrollScene('epilogue', ({ p, t }) => {
    const k = keyT(p)
    CAM.pos.getPoint(k, rig.pos)
    CAM.look.getPoint(k, rig.look)
    let fov = KEYS[0][3]
    for (let i = 0; i < KEYS.length - 1; i++)
      if (p <= KEYS[i + 1][0]) {
        fov = THREE.MathUtils.lerp(KEYS[i][3], KEYS[i + 1][3], smooth(KEYS[i][0], KEYS[i + 1][0], p))
        break
      }
    rig.fov = fov
    rig.near = 0.5
    rig.far = 3000
    rig.shake = 0.03
    u.uTime.value = t
    // выходим из белизны тессеракта — через облако
    u.uWhite.value = 1 - smooth(0.0, 0.16, p)
    u.uDusk.value = smooth(0.66, 0.9, p)
    fx.bloom = 0.9
  })
  return (
    <>
      <Land u={u} />
      <Settlements u={u} />
      <AxisSun u={u} />
      <Clouds u={u} />
    </>
  )
}
