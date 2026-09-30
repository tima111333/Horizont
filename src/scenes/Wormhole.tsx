// Акт III. Червоточина у Сатурна: сфера, в которой видно чужую галактику,
// и пролёт сквозь горловину. Прокрутка — это положение камеры по l.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import whSrc from '../shaders/wormhole.glsl?raw'
import { useScrollScene } from '../hooks/useScrollScene'
import { rig } from '../core/rig'
import { fx } from '../core/fx'
import { S, isLow } from '../story/store'
import { useSky } from '../core/sky'
import { Saturn } from '../components/Saturn'
import { actIndex } from '../story/acts'
import { useEnvMap } from '../core/envmap'
import { PartMeshes, useEnduranceGeo, useShipMaterials } from './Launch'

const WI = actIndex('wormhole')
const RHO = 12 // радиус горловины в мировых единицах
const A_WH = 0.6 // полудлина горловины
const M_WH = 0.2 // ширина линзы
const N = isLow ? 2048 : 4096
const AXIS = new THREE.Vector3(0.18, 0.1, 1).normalize()
const SUN = new THREE.Vector3(-0.35, 0.28, 0.9).normalize()

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// r(l) — тот же, что в шейдере: нужен, чтобы ставить камеру и корабль в мир
function rOf(l: number) {
  const x = Math.max(Math.abs(l) - A_WH, 0)
  const X = (2 * x) / (Math.PI * M_WH)
  return 1 + M_WH * (X * Math.atan(X) - 0.5 * Math.log(1 + X * X))
}

/** монотонный кубический сплайн: камера не «замирает» на ключах и не откатывается */
function monotone(xs: number[], ys: number[]) {
  const n = xs.length
  const d: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  m.push(d[0])
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2)
  m.push(d[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * d[i]
      m[i + 1] = t * b * d[i]
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i]
    const t = (x - xs[i]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
  }
}

// положение камеры по l от доли акта: подлёт, горловина, выход в чужую галактику
const lOf = monotone([0, 0.28, 0.52, 0.62, 0.7, 0.78, 1], [36, 13, 3.2, 0.9, -0.9, -3.4, -26])

function WormholeView() {
  const { gl, camera } = useThree()
  const skyA = useSky('home')
  const skyB = useSky('far')
  const { lut, lutScene, lutCam, lutMat, mat } = useMemo(() => {
    const lut = new THREE.WebGLRenderTarget(N, 1, {
      type: THREE.FloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      generateMipmaps: false,
    })
    const common = { uA: { value: A_WH }, uM: { value: M_WH }, uLc: { value: 30 }, uN: { value: N } }
    const lutMat = new THREE.ShaderMaterial({
      defines: { LUT: '' },
      uniforms: common,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: whSrc,
      depthTest: false,
      depthWrite: false,
    })
    const lutScene = new THREE.Scene()
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lutMat)
    q.frustumCulled = false
    lutScene.add(q)
    const lutCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    // другая вселенная повёрнута — чтобы звёзды «там» не совпали с нашими
    const rotB = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.7, 2.1, -0.4)))
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...common,
        uLut: { value: lut.texture },
        uSkyA: { value: skyA },
        uSkyB: { value: skyB },
        uRotB: { value: rotB },
        uAxis: { value: AXIS.clone() },
        uProjInv: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uStreak: { value: 0 },
        uDisp: { value: 0 },
        uGain: { value: 1.3 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
      fragmentShader: whSrc,
      depthTest: false,
      depthWrite: false,
    })
    return { lut, lutScene, lutCam, lutMat, mat }
  }, [skyA, skyB])
  useEffect(
    () => () => {
      lut.dispose()
      lutMat.dispose()
      mat.dispose()
    },
    [lut, lutMat, mat],
  )

  // таблица лучей — после того как CameraRig поставил камеру, до композера
  useFrame(() => {
    if (S.act !== WI) return
    const prev = gl.getRenderTarget()
    gl.setRenderTarget(lut)
    gl.render(lutScene, lutCam)
    gl.setRenderTarget(prev)
    camera.updateMatrixWorld()
    mat.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse)
    mat.uniforms.uCamWorld.value.copy(camera.matrixWorld)
  }, 0)

  useScrollScene('wormhole', ({ p }) => {
    const l = lOf(p)
    lutMat.uniforms.uLc.value = l
    // скорость прокрутки = скорость полёта: звёзды тянутся к центру
    const transit = smooth(0.5, 0.64, p) * (1 - smooth(0.74, 0.86, p))
    mat.uniforms.uStreak.value = Math.min(0.3, S.speed * 0.18 + transit * 0.015)
    mat.uniforms.uDisp.value = transit * 0.004
    mat.uniforms.uGain.value = 1.25 + transit * 0.6
  })

  return (
    <mesh material={mat} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

/** «Эндюранс» впереди: ныряет в сферу первым */
function ShipAhead() {
  const mats = useShipMaterials()
  const geo = useEnduranceGeo()
  const ref = useRef<THREE.Group>(null)
  const spin = useRef(0)
  useScrollScene('wormhole', ({ p, dt }) => {
    const g = ref.current!
    // корабль на 7 единиц l впереди камеры; у поверхности сферы исчезает в ней
    const ls = lOf(p) - 7
    const r = rOf(ls)
    g.visible = ls > 1.25
    g.position.copy(AXIS).multiplyScalar(r * RHO)
    g.lookAt(0, 0, 0)
    spin.current += dt * 0.3
    g.rotateZ(spin.current)
    const k = THREE.MathUtils.clamp((ls - 1.25) / 1.2, 0, 1)
    g.scale.setScalar(0.32 * (0.35 + 0.65 * k))
  })
  return (
    <group ref={ref}>
      <group rotation-y={Math.PI}>
        <PartMeshes geos={geo.ring} mats={mats} shadows={false} />
        <PartMeshes geos={geo.hub} mats={mats} shadows={false} />
      </group>
    </group>
  )
}

export default function Wormhole() {
  const time = useMemo(() => ({ value: 0 }), [])
  const env = useEnvMap(
    [
      { pos: SUN.clone().multiplyScalar(30).toArray() as [number, number, number], size: [2, 2], color: '#fff3e0', intensity: 40, shape: 'disc' },
      { pos: [-30, 5, -10], size: [30, 30], color: '#b89a70', intensity: 0.5 },
    ],
    '#000000',
    'wormhole',
    1,
  )
  const saturnVis = useRef<THREE.Group>(null)
  useScrollScene('wormhole', ({ p, t, state }) => {
    state.scene.environment = env
    time.value = t
    const l = lOf(p)
    const r = rOf(l) * RHO
    rig.pos.copy(AXIS).multiplyScalar(r)
    // сначала взгляд на Сатурн, потом — в сферу; за горловиной — только вперёд
    const toSaturn = 1 - smooth(0.08, 0.34, p)
    const look = new THREE.Vector3().copy(rig.pos).addScaledVector(AXIS, -20)
    look.add(new THREE.Vector3(-7, -1.5, 0).multiplyScalar(toSaturn))
    rig.look.copy(look)
    rig.fov = 42 + smooth(0.52, 0.64, p) * 18 * (1 - smooth(0.74, 0.9, p))
    rig.near = 0.1
    rig.far = 20000
    rig.shake = 0.01 + smooth(0.5, 0.62, p) * (1 - smooth(0.76, 0.84, p)) * 0.06
    rig.roll = Math.sin(t * 0.2) * 0.01 + smooth(0.55, 0.8, p) * 0.35
    saturnVis.current!.visible = l > 0
    fx.bloom = 1 + smooth(0.55, 0.66, p) * 0.4
  })
  return (
    <>
      <WormholeView />
      <group ref={saturnVis}>
        <Saturn position={[-330, -70, -160]} radius={95} sun={SUN} time={time} tilt={[0.35, 0.3, 0.25]} />
        <ShipAhead />
        <directionalLight position={SUN.clone().multiplyScalar(100).toArray() as [number, number, number]} intensity={3.5} color="#fff2e0" />
        <hemisphereLight args={['#1a1a22', '#3a2c1c', 0.25]} />
      </group>
    </>
  )
}
