// Акт IV. Планета Миллер: вода по колено до горизонта, над ней — бледный диск
// Гаргантюа, а на горизонте поднимается «горный хребет», который оказывается
// волной. Курсор оставляет на воде рябь — волновое уравнение в текстуре.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import noise from '../shaders/noise.glsl?raw'
import rippleSrc from '../shaders/waterRipple.glsl?raw'
import { useScrollScene } from '../hooks/useScrollScene'
import { rig } from '../core/rig'
import { fx } from '../core/fx'
import { S, isLow } from '../story/store'
import { actIndex } from '../story/acts'

const MI = actIndex('miller')
const GARG = new THREE.Vector3(-0.42, 0.3, -0.86).normalize()
const RIPPLE = { cx: 0.6, cz: -7, size: 20, res: isLow ? 192 : 256 }

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// ─── общая атмосфера: пасмурное светлое небо и Гаргантюа за дымкой ──────────
const atmo = /* glsl */ `
uniform vec3 uGarg;
uniform float uGloom;   // 0..1 — небо темнеет, когда волна закрывает свет
vec3 skyColor(vec3 d) {
  float h = max(d.y, -0.2);
  vec3 horizon = vec3(0.7, 0.76, 0.78);
  vec3 zenith = vec3(0.3, 0.37, 0.42);
  vec3 c = mix(horizon, zenith, pow(max(smoothstep(0.0, 0.75, h), 1e-6), 0.65));
  // яркая полоса у горизонта — свет через тонкую облачность
  c += vec3(0.14, 0.15, 0.14) * exp(-h * h * 160.0);
  // Гаргантюа за дымкой: диск темнее неба, тонкое кольцо фотонов, пояс аккреционного диска
  float a = acos(clamp(dot(d, uGarg), -1.0, 1.0));
  float R = 0.085;
  vec3 gx = normalize(cross(uGarg, vec3(0.0, 1.0, 0.0)));
  vec3 gy = cross(gx, uGarg);
  vec2 q = vec2(dot(d, gx), dot(d, gy)) / R;
  float disk = smoothstep(1.03, 0.97, a / R);
  float rr = (a / R - 1.03) * 30.0;
  float ring = exp(-rr * rr);
  float qb = q.y * 13.0;
  float band = exp(-qb * qb) * smoothstep(2.4, 1.1, abs(q.x)) * (1.0 - disk * 0.6);
  float qa = (length(q) - 1.1) * 16.0;
  float arcs = exp(-qa * qa) * smoothstep(-0.2, 0.6, abs(q.y));
  vec3 g = vec3(1.0, 0.94, 0.84);
  vec3 glow = g * (ring * 0.5 + band * 0.55 + arcs * 0.25) + g * exp(-a * a * 60.0) * 0.08;
  c = mix(c, c * 0.7, disk * 0.8);
  c += glow * 0.42;
  c *= 1.0 - uGloom * 0.55;
  return c;
}
vec3 applyHaze(vec3 col, vec3 wp, vec3 cam) {
  vec3 v = wp - cam;
  float dist = length(v);
  float f = 1.0 - exp(-dist * 0.00017);
  vec3 dir = v / max(dist, 1e-3);
  vec3 hz = skyColor(normalize(vec3(dir.x, 0.015, dir.z)));
  return mix(col, hz, clamp(f, 0.0, 1.0));
}
`

function Sky({ u }: { u: Record<string, THREE.IUniform> }) {
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
          noise +
          atmo +
          /* glsl */ `
          uniform float uTime;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            vec3 c = skyColor(d);
            // облачный покров: крупные тёмные гряды и светлые разрывы
            vec2 cq = d.xz / max(d.y + 0.08, 0.04);
            float cl = fbm3(vec3(cq * 0.35, uTime * 0.008)) + 0.5 * fbm3(vec3(cq * 1.1 + 3.0, uTime * 0.01));
            c *= 1.0 + cl * 0.16 * smoothstep(0.02, 0.35, d.y) * (1.0 - uGloom);
            gl_FragColor = vec4(c, 1.0);
          }`,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [u],
  )
  const ref = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  useScrollScene('miller', () => ref.current?.position.copy(camera.position))
  return (
    <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[5000, 48, 24]} />
    </mesh>
  )
}

// ─── сетка воды: плотная у камеры, геометрически реже к горизонту ──────────
function waterGrid() {
  const nx = isLow ? 260 : 420
  const nz = isLow ? 300 : 520
  const pos = new Float32Array(nx * nz * 3)
  for (let j = 0; j < nz; j++) {
    const t = j / (nz - 1)
    const z = 60 - (Math.exp(t * Math.log(9060)) - 1)
    for (let i = 0; i < nx; i++) {
      const s = (i / (nx - 1)) * 2 - 1
      const x = Math.sign(s) * Math.pow(Math.abs(s), 1.8) * 9000
      const k = (j * nx + i) * 3
      pos[k] = x
      pos[k + 1] = 0
      pos[k + 2] = z
    }
  }
  const idx: number[] = []
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i
      idx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -4000), 12000)
  return g
}

const waveGLSL = /* glsl */ `
uniform float uWaveZ;
uniform float uWaveH;
uniform float uWaveW;
uniform float uTime;
// высота большой волны: крутой фронт к зрителю, пологая спина, неровный гребень
float bigWave(vec2 p) {
  float u = (p.y - uWaveZ) / uWaveW;
  float prof = u > 0.0 ? exp(-u * u * 5.0) : exp(-u * u * 0.35);
  float lat = 0.72 + 0.2 * sin(p.x * 0.0009 + 1.3) + 0.08 * sin(p.x * 0.0041 + uTime * 0.05);
  lat *= smoothstep(9000.0, 2500.0, abs(p.x));
  return uWaveH * prof * lat;
}
// длинная пологая зыбь на мелководье
float swell(vec2 p) {
  return 0.035 * sin(p.y * 0.21 + uTime * 0.9) + 0.02 * sin(p.x * 0.13 + p.y * 0.17 + uTime * 0.7);
}
`

function Water({ u, ripple }: { u: Record<string, THREE.IUniform>; ripple: { tex: THREE.Texture | null } }) {
  const geo = useMemo(() => waterGrid(), [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...u,
          uRipple: { value: null },
          uRippleRect: { value: new THREE.Vector3(RIPPLE.cx, RIPPLE.cz, RIPPLE.size) },
        },
        vertexShader:
          waveGLSL +
          /* glsl */ `
          varying vec3 vW;
          varying vec3 vN;
          varying float vH;
          void main() {
            vec3 p = position;
            float h = bigWave(p.xz);
            float e = max(2.0, abs(p.z) * 0.004);
            float hx = bigWave(p.xz + vec2(e, 0.0));
            float hz = bigWave(p.xz + vec2(0.0, e));
            p.y = h + swell(p.xz);
            vN = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
            vH = h / max(uWaveH, 1.0);
            vec4 w = modelMatrix * vec4(p, 1.0);
            vW = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader:
          noise +
          atmo +
          /* glsl */ `
          uniform float uTime;
          // настоящая позиция камеры с дыханием и параллаксом, а не базовая точка ракурса
          #define uCam cameraPosition
          uniform sampler2D uRipple;
          uniform vec3 uRippleRect;
          uniform float uWaveH;
          uniform float uWaveZ;
          varying vec3 vW;
          varying vec3 vN;
          varying float vH;

          // мелкая рябь: сумма направленных волн + шум, высота в метрах
          float ripples(vec2 p) {
            float h = 0.0;
            h += 0.006 * sin(dot(p, vec2(0.8, 0.6)) * 3.1 + uTime * 1.9);
            h += 0.005 * sin(dot(p, vec2(-0.5, 0.86)) * 4.3 + uTime * 2.4);
            h += 0.003 * sin(dot(p, vec2(0.97, -0.24)) * 7.9 + uTime * 3.1);
            h += 0.003 * sin(dot(p, vec2(-0.2, -0.98)) * 11.3 + uTime * 3.7);
            h += 0.012 * vnoise(vec3(p * 1.3, uTime * 0.5)) + 0.006 * vnoise(vec3(p * 3.7, uTime * 0.9));
            return h;
          }

          vec3 seabed(vec2 p) {
            float n = vfbm(vec3(p * 0.9, 0.0), 4);
            float stones = smoothstep(0.62, 0.7, vnoise(vec3(p * 2.6, 3.0)));
            vec3 sand = mix(vec3(0.2, 0.2, 0.19), vec3(0.3, 0.3, 0.28), n);
            return mix(sand, vec3(0.18, 0.19, 0.18), stones * 0.7);
          }

          void main() {
            vec3 V = normalize(uCam - vW);
            float dist = length(vW - uCam);
            vec2 p = vW.xz;
            vec3 n = normalize(vN);
            // рябь гаснет с расстоянием — иначе муар
            float fade = exp(-dist * 0.07);
            if (fade > 0.01) {
              float e = 0.04;
              float h0 = ripples(p);
              float hx = ripples(p + vec2(e, 0.0));
              float hz = ripples(p + vec2(0.0, e));
              n = normalize(n + vec3(-(hx - h0) / e, 0.0, -(hz - h0) / e) * fade * 1.3);
            }
            // рябь от курсора
            vec2 ruv = (p - uRippleRect.xy) / uRippleRect.z + 0.5;
            float rip = 0.0;
            if (ruv.x > 0.0 && ruv.x < 1.0 && ruv.y > 0.0 && ruv.y < 1.0) {
              float t = 1.0 / 256.0;
              float c0 = texture2D(uRipple, ruv).r;
              float cx = texture2D(uRipple, ruv + vec2(t, 0.0)).r;
              float cz = texture2D(uRipple, ruv + vec2(0.0, t)).r;
              vec2 g = vec2(cx - c0, cz - c0) * 18.0;
              n = normalize(n + vec3(-g.x, 0.0, -g.y));
              rip = abs(c0);
            }

            // стекающая по фронту вода: вертикальные струи в нормали
            float face = smoothstep(0.05, 0.3, vH);
            if (face > 0.0) {
              float st = vnoise(vec3(p.x * 0.09, vW.y * 0.012 - uTime * 0.4, 1.0)) - 0.5;
              float st2 = vnoise(vec3(p.x * 0.35, vW.y * 0.03 - uTime * 0.9, 5.0)) - 0.5;
              n = normalize(n + vec3(st * 0.5 + st2 * 0.25, 0.0, 0.0) * face);
            }
            // отражение неба — и самой волны: если луч уходит под гребень, в воде тёмная стена
            vec3 R = reflect(-V, n);
            R.y = abs(R.y) + 0.01;
            vec3 refl = skyColor(normalize(R));
            float toWave = max(p.y - uWaveZ, 1.0);
            float waveElev = uWaveH * 0.8 / toWave;
            float rElev = R.y / max(length(R.xz), 1e-3);
            float inWave = smoothstep(waveElev * 1.05, waveElev * 0.9, rElev) * step(0.0, -R.z) * (1.0 - face);
            refl = mix(refl, mix(vec3(0.06, 0.12, 0.13), skyColor(vec3(0.0, 0.02, -1.0)), 0.45) * (1.0 - uGloom * 0.4), inWave * 0.85);
            // pow() от отрицательного числа — NaN, а bloom размазывает его в чёрное пятно
            float cosT = clamp(dot(n, V), 0.0, 1.0);
            float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);

            // преломление: дно на глубине ~0.45 м, вода съедает красный по длине пути
            float depth = 0.45 + vH * uWaveH;
            float path = depth / max(cosT, 0.08);
            vec2 off = n.xz * 0.12;
            vec3 bed = seabed(p + off);
            // каустики: светлые нити от ряби
            float caus = pow(clamp(1.0 - abs(snoise(vec3((p + off) * 2.2, uTime * 0.7))), 0.0, 1.0), 6.0) * 0.5;
            bed *= 0.85 + caus;
            vec3 absorb = exp(-vec3(0.55, 0.16, 0.12) * path);
            vec3 deep = mix(vec3(0.05, 0.13, 0.14), vec3(0.015, 0.05, 0.06), face);
            vec3 refr = bed * absorb + deep * (1.0 - absorb);

            vec3 col = mix(refr, refl, F);
            // тело волны: тонкий гребень просвечивает бирюзой
            float thin = smoothstep(0.35, 0.95, vH) * pow(1.0 - cosT, 1.5);
            col += vec3(0.08, 0.3, 0.28) * thin * 1.2;
            // пена на гребне и у подножия фронта
            float foamN = vnoise(vec3(p * 0.05, uTime * 0.3)) * 0.6 + vnoise(vec3(p * 0.2, uTime)) * 0.4;
            float foam = smoothstep(0.86, 0.99, vH) * smoothstep(0.4, 0.75, foamN) * 0.8;
            foam += smoothstep(0.03, 0.08, vH) * smoothstep(0.16, 0.06, vH) * smoothstep(0.62, 0.85, foamN) * 0.25;
            col = mix(col, vec3(0.86, 0.9, 0.9), clamp(foam, 0.0, 1.0));
            col += vec3(0.06) * rip * 6.0;
            col = applyHaze(col, vW, uCam);
            // последняя страховка: битый пиксель не должен уйти в bloom
            if (any(isnan(col)) || any(isinf(col))) col = vec3(0.6, 0.66, 0.68);
            gl_FragColor = vec4(max(col, 0.0), 1.0);
          }`,
      }),
    [u],
  )
  useScrollScene('miller', () => {
    mat.uniforms.uRipple.value = ripple.tex
  })
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <mesh geometry={geo} material={mat} frustumCulled={false} />
}

// ─── симуляция ряби: пинг-понг двух текстур, капля — под курсором ────────────
function useRipple() {
  const { gl, camera } = useThree()
  const sim = useMemo(() => {
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }
    const a = new THREE.WebGLRenderTarget(RIPPLE.res, RIPPLE.res, opts)
    const b = new THREE.WebGLRenderTarget(RIPPLE.res, RIPPLE.res, opts)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: new THREE.Vector2(1 / RIPPLE.res, 1 / RIPPLE.res) },
        uDrop: { value: new THREE.Vector2(-1, -1) },
        uDropR: { value: 2.2 },
        uDropK: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: rippleSrc,
      depthTest: false,
      depthWrite: false,
    })
    const scene = new THREE.Scene()
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    q.frustumCulled = false
    scene.add(q)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    return { a, b, mat, scene, cam, cur: a, last: new THREE.Vector2(-9, -9), tex: a.texture as THREE.Texture | null }
  }, [])
  useEffect(
    () => () => {
      sim.a.dispose()
      sim.b.dispose()
      sim.mat.dispose()
    },
    [sim],
  )
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  useFrame(() => {
    if (S.act !== MI) return
    // точка под курсором на поверхности воды
    ndc.set(S.pointer.x, S.pointer.y)
    ray.setFromCamera(ndc, camera)
    let drop = false
    if (S.pointer.moved && ray.ray.intersectPlane(plane, hit)) {
      const u = (hit.x - RIPPLE.cx) / RIPPLE.size + 0.5
      const v = (hit.z - RIPPLE.cz) / RIPPLE.size + 0.5
      // UV плоскости: v растёт к +z; в текстуре — от низа
      const du = u - sim.last.x
      const dv = v - sim.last.y
      const speed = Math.hypot(du, dv)
      if (u > 0.02 && u < 0.98 && v > 0.02 && v < 0.98 && speed > 0.002) {
        sim.mat.uniforms.uDrop.value.set(u, v)
        sim.mat.uniforms.uDropK.value = Math.min(0.25, speed * 6)
        drop = true
      }
      sim.last.set(u, v)
    }
    if (!drop) sim.mat.uniforms.uDrop.value.set(-1, -1)
    const prevRT = gl.getRenderTarget()
    // два шага на кадр: волна бежит живее, без потери устойчивости
    for (let k = 0; k < 2; k++) {
      const src = sim.cur
      const dst = src === sim.a ? sim.b : sim.a
      sim.mat.uniforms.uPrev.value = src.texture
      gl.setRenderTarget(dst)
      gl.render(sim.scene, sim.cam)
      sim.cur = dst
      if (k === 0) sim.mat.uniforms.uDrop.value.set(-1, -1)
    }
    gl.setRenderTarget(prevRT)
    sim.tex = sim.cur.texture
  }, 0)
  return sim
}

// ─── водяная пыль, срываемая с гребня ─────────────────────────────────────
function CrestSpray({ u }: { u: Record<string, THREE.IUniform> }) {
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(18000, 1, 400, 1)
    geo.translate(0, 0.5, 0)
    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader:
        waveGLSL +
        /* glsl */ `
        varying vec2 vP;
        varying vec3 vW;
        void main() {
          vec3 p = position;
          // лента стоит на гребне: низ — на вершине волны, верх — выше и ветром назад
          float top = bigWave(vec2(p.x, uWaveZ));
          float y = top * (0.93 + p.y * 0.45);
          vec3 wp = vec3(p.x, y, uWaveZ + 6.0 - p.y * uWaveW * 0.6);
          vP = vec2(p.x, p.y);
          vW = wp;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader:
        noise +
        atmo +
        /* glsl */ `
        uniform float uTime;
        uniform float uWaveH;
        varying vec2 vP;
        varying vec3 vW;
        void main() {
          float n = vfbm(vec3(vP.x * 0.004, vP.y * 2.0 - uTime * 0.15, uTime * 0.05), 5);
          float a = smoothstep(0.35, 0.75, n) * smoothstep(1.0, 0.1, vP.y) * smoothstep(0.0, 0.08, vP.y);
          a *= smoothstep(120.0, 260.0, uWaveH);
          vec3 c = vec3(0.82, 0.87, 0.88);
          c = applyHaze(c, vW, cameraPosition);
          gl_FragColor = vec4(c, a * 0.75);
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    return { geo, mat }
  }, [u])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={3} />
}

// ─── ракурсы ────────────────────────────────────────────────────────────────
const KEYS: [number, [number, number, number], [number, number, number], number][] = [
  [0.0, [0, 1.7, 6], [-6, 0.6, -40], 40],
  [0.3, [0.5, 1.6, 2], [-2, 1.2, -60], 38],
  [0.55, [1.2, 1.5, -2], [3, 6, -120], 42],
  [0.8, [1.0, 1.45, -4], [2, 60, -240], 50],
  [1.0, [0.8, 1.3, -5], [0, 110, -200], 56],
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

export default function MillersPlanet() {
  const u = useMemo(
    () => ({
      uGarg: { value: GARG },
      uGloom: { value: 0 },
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uWaveZ: { value: -7000 },
      uWaveH: { value: 260 },
      uWaveW: { value: 420 },
    }),
    [],
  )
  const sim = useRipple()
  useScrollScene('miller', ({ p, t }) => {
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
    rig.near = 0.1
    rig.far = 12000
    // волна: далёкий «хребет» → стена над головой
    const w = smooth(0.45, 1.0, p)
    u.uWaveZ.value = THREE.MathUtils.lerp(-7200, -320, Math.pow(w, 1.6))
    u.uWaveH.value = THREE.MathUtils.lerp(240, 420, w)
    u.uWaveW.value = THREE.MathUtils.lerp(460, 230, w)
    u.uGloom.value = smooth(0.7, 1.0, p)
    rig.shake = 0.01 + smooth(0.75, 1, p) * 0.04
    u.uTime.value = t
    u.uCam.value.copy(rig.pos)
    fx.bloom = 1
    fx.focus.copy(rig.look)
    fx.focusRange = 400
    fx.bokeh = 0.8
  })
  return (
    <>
      <Sky u={u} />
      <Water u={u} ripple={sim} />
      <CrestSpray u={u} />
    </>
  )
}
