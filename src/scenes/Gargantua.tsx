// Акт V. Гаргантюа: трассировка фотонов в поле Шварцшильда, тонкий диск,
// кольцо фотонов. Медленный подлёт, почти неподвижное вращение, в конце — падение.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import noise from '../shaders/noise.glsl?raw'
import bhSrc from '../shaders/blackhole.glsl?raw'
import { useScrollScene } from '../hooks/useScrollScene'
import { rig } from '../core/rig'
import { fx } from '../core/fx'
import { S, isLow } from '../story/store'
import { actIndex } from '../story/acts'
import { useSky } from '../core/sky'
import { useEnvMap } from '../core/envmap'
import { PartMeshes, glowTexture, useEnduranceGeo, useShipMaterials } from './Launch'
import { toParts, useAsset, type SerialGeo } from '../core/assets'
import type { Part } from '../models/endurance'

const GI = actIndex('gargantua')

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = THREE.MathUtils.lerp

// ракурс в сферических координатах вокруг дыры: расстояние, наклон над диском, азимут
const SHOT: [number, number, number, number][] = [
  // p, расстояние (rs), наклон (рад), азимут (рад)
  [0.0, 46, 0.2, -0.35],
  [0.3, 30, 0.15, -0.2],
  [0.6, 19, 0.1, 0.05],
  [0.82, 12.5, 0.06, 0.18],
  [1.0, 2.2, 0.02, 0.3],
]
function shotAt(p: number) {
  for (let i = 0; i < SHOT.length - 1; i++) {
    const [a, d0, i0, z0] = SHOT[i]
    const [b, d1, i1, z1] = SHOT[i + 1]
    if (p <= b) {
      const f = smooth(a, b, p)
      // расстояние — по логарифму, чтобы подлёт шёл равномерно на глаз
      return [Math.exp(lerp(Math.log(d0), Math.log(d1), f)), lerp(i0, i1, f), lerp(z0, z1, f)]
    }
  }
  const l = SHOT[SHOT.length - 1]
  return [l[1], l[2], l[3]]
}

function BlackHole() {
  const { camera } = useThree()
  const sky = useSky('far')
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSky: { value: sky },
          uProjInv: { value: new THREE.Matrix4() },
          uCamWorld: { value: new THREE.Matrix4() },
          uCamPos: { value: new THREE.Vector3(0, 2, 30) },
          uTime: { value: 0 },
          uSteps: { value: isLow ? 150 : 320 },
          uDiskIn: { value: 2.6 },
          uDiskOut: { value: 13 },
          uDoppler: { value: 0.55 },
          uGain: { value: 1 },
          uSkyGain: { value: 1.0 },
          // небо повёрнуто так, чтобы за дырой был полюс галактики, а не её полоса:
          // иначе линза растягивает полосу в сплошное кремовое кольцо
          uSkyRot: {
            value: new THREE.Matrix3().setFromMatrix4(
              new THREE.Matrix4().makeRotationFromQuaternion(
                new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-0.2, 0.95, 0.24).normalize()),
              ),
            ),
          },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
        fragmentShader: noise + bhSrc,
        depthTest: false,
        depthWrite: false,
      }),
    [sky],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(() => {
    if (S.act !== GI) return
    camera.updateMatrixWorld()
    mat.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse)
    mat.uniforms.uCamWorld.value.copy(camera.matrixWorld)
    mat.uniforms.uCamPos.value.copy(camera.position)
  }, 0)
  useScrollScene('gargantua', ({ t, p }) => {
    // «почти неподвижное» вращение: диск живёт, но очень медленно
    mat.uniforms.uTime.value = t * 0.35
    // у самого горизонта нужна точность — шагов больше
    mat.uniforms.uSteps.value = (isLow ? 150 : 320) + smooth(0.85, 1, p) * 80
    mat.uniforms.uGain.value = 1 - smooth(0.93, 1.0, p) * 0.9
  })
  return (
    <mesh material={mat} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

// ─── корабль у Гаргантюа: пересекает диск, отстыковка, «Рейнджер» уходит в дыру,
// «Эндюранс» — из кадра гравитационным манёвром. Ничего не исчезает посреди кадра.
const DETACH = 0.52 // отстыковка — под реплику «Увидимся на той стороне»
const FALL_END = 0.88 // «Рейнджер» скрывается в тени
const SHIP_SCALE = 0.075
const DOCK = new THREE.Vector3(0, 0, 4.5) // стыковочный узел «Рейнджера» на хабе, в координатах корабля
const _c = new THREE.Vector3()
const _l = new THREE.Vector3()
const _f = new THREE.Vector3()
const _r = new THREE.Vector3()
const _u = new THREE.Vector3(0, 1, 0)

/** камера без «дыхания» — чтобы путь корабля не дрожал вместе с ней */
function camAt(p: number, pos: THREE.Vector3, look: THREE.Vector3) {
  const [d, inc, az] = shotAt(p)
  pos.set(Math.sin(az) * Math.cos(inc), Math.sin(inc), Math.cos(az) * Math.cos(inc)).multiplyScalar(d)
  look.set(0, lerp(-0.6, 0.0, smooth(0.6, 1, p)), 0)
}

const _axis = new THREE.Vector3()
const _z = new THREE.Vector3(0, 0, 1)
/** положение и поворот «Эндюранса» при прогрессе p (без вращения кольца) */
function endurancePose(p: number, pos: THREE.Vector3, rot: THREE.Quaternion) {
  camAt(p, _c, _l)
  _f.subVectors(_l, _c).normalize()
  _r.crossVectors(_f, _u).normalize()
  // пересекает диск слева направо и зависает правее центра
  const k = smooth(0.0, 0.5, p)
  // после отстыковки — манёвр: разгон вправо-вверх и прочь от камеры, пока не уйдёт из кадра
  const g = smooth(DETACH + 0.04, 0.95, p)
  pos
    .copy(_c)
    .addScaledVector(_f, 7.5 + g * 7)
    .addScaledVector(_r, lerp(-3.4, 1.6, k) + g * g * 12)
    .add(new THREE.Vector3(0, -0.45 + k * 0.25 + g * 2.5, 0))
  // кольцо — на три четверти к камере: ребром корабль читается как палка
  _axis.copy(_f).multiplyScalar(-0.62 + g * 0.3).addScaledVector(_r, 0.7 - k * 0.15).addScaledVector(_u, 0.3).normalize()
  rot.setFromUnitVectors(_z, _axis)
}

function ShipAtGargantua() {
  const mats = useShipMaterials()
  const geo = useEnduranceGeo()
  const rI = useAsset<Partial<Record<Part, SerialGeo>>>('ranger')
  const rangerGeo = useMemo(() => toParts<Part>(rI), [rI])
  const ship = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Group>(null)
  const ranger = useRef<THREE.Group>(null)
  const spin = useRef(0)
  const flare = useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(0.75, 0.85, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }),
    [],
  )
  const spark = useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(1, 0.85, 0.65), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }),
    [],
  )
  useEffect(
    () => () => {
      flare.dispose()
      spark.dispose()
    },
    [flare, spark],
  )
  const p0 = useMemo(() => new THREE.Vector3(), [])
  const e0 = useMemo(() => new THREE.Quaternion(), [])
  const start = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(0, 0, 0), [])

  useScrollScene('gargantua', ({ p, t, dt }) => {
    const s = ship.current!
    endurancePose(p, s.position, s.quaternion)
    s.visible = p < 0.97
    spin.current += dt * 0.25
    ring.current!.rotation.z = spin.current

    // маршевые двигатели на манёвре
    const burn = smooth(DETACH + 0.03, DETACH + 0.08, p) * (1 - smooth(0.9, 0.97, p))
    flare.opacity = burn * (0.85 + 0.15 * Math.sin(t * 37))

    const r = ranger.current!
    if (p < DETACH) {
      // пристыкован к хабу и крутится вместе с кораблём
      r.position.copy(s.position).add(DOCK.clone().multiplyScalar(SHIP_SCALE).applyQuaternion(s.quaternion))
      r.quaternion.copy(s.quaternion)
      r.scale.setScalar(SHIP_SCALE)
      spark.opacity = 0
    } else {
      // точка отстыковки — детерминированно из той же позы, без скачка
      endurancePose(DETACH, p0, e0)
      start.copy(p0).add(DOCK.clone().multiplyScalar(SHIP_SCALE).applyQuaternion(e0))
      // сначала отходит от корабля, потом — всё быстрее к дыре
      const f = smooth(DETACH, FALL_END, p)
      const fall = f * f * f
      r.position.lerpVectors(start, target, fall)
      r.position.addScaledVector(new THREE.Vector3(0, 0.25, 0), Math.sin(f * Math.PI) * (1 - f))
      // нос — к дыре, медленный крен
      r.lookAt(target)
      r.rotateY(Math.PI)
      r.rotateZ(f * 1.6)
      r.quaternion.slerp(e0, 1 - smooth(DETACH, DETACH + 0.06, p))
      // у кольца фотонов он уже точка — растворяется в тени
      const dist = r.position.length()
      r.scale.setScalar(SHIP_SCALE * smooth(2.4, 4.5, dist))
      spark.opacity = smooth(DETACH + 0.01, DETACH + 0.05, p) * smooth(2.4, 5, dist) * (0.8 + 0.2 * Math.sin(t * 29))
    }
  })

  return (
    <>
      <group ref={ship} scale={SHIP_SCALE}>
        <group ref={ring}>
          <PartMeshes geos={geo.ring} mats={mats} shadows={false} cull={false} />
        </group>
        <PartMeshes geos={geo.hub} mats={mats} shadows={false} cull={false} />
        {/* факел за кормой хаба */}
        <sprite material={flare} position={[0, 0, -3.2]} scale={[9, 9, 1]} />
      </group>
      <group ref={ranger} scale={1e-4}>
        <PartMeshes geos={rangerGeo} mats={mats} shadows={false} cull={false} />
        <sprite material={spark} position={[0, 0.02, 2.0]} scale={[3.6, 3.6, 1]} />
      </group>
    </>
  )
}

export default function Gargantua() {
  const env = useEnvMap(
    [
      // диск: широкая тёплая полоса вокруг корабля
      { pos: [0, 0, -30], size: [90, 8], color: '#ffc27a', intensity: 3 },
      { pos: [0, 10, -28], size: [40, 3], color: '#ffd9a8', intensity: 1.2 },
    ],
    '#000000',
    'gargantua',
    0.8,
  )
  const dir = useMemo(() => new THREE.Vector3(), [])
  useScrollScene('gargantua', ({ p, t, state }) => {
    state.scene.environment = env
    state.scene.environmentIntensity = 0.8
    const [d, inc, az] = shotAt(p)
    // медленный облёт: азимут плывёт и сам по себе
    const a = az + Math.sin(t * 0.03) * 0.02
    dir.set(Math.sin(a) * Math.cos(inc), Math.sin(inc), Math.cos(a) * Math.cos(inc))
    rig.pos.copy(dir).multiplyScalar(d)
    // смотрим чуть выше центра: тень — в нижней трети, дуга диска — над ней
    rig.look.set(0, lerp(-0.6, 0.0, smooth(0.6, 1, p)), 0)
    rig.fov = lerp(34, 50, smooth(0.55, 1.0, p))
    rig.near = 0.01
    rig.far = 1000
    rig.shake = 0.004 + smooth(0.85, 1.0, p) * 0.02
    rig.roll = -0.08 + Math.sin(t * 0.05) * 0.01
    fx.bloom = 1 + smooth(0.6, 0.9, p) * 0.3
  })
  return (
    <>
      <BlackHole />
      <ShipAtGargantua />
      <directionalLight position={[0, 1, -10]} intensity={2.2} color="#ffc98a" />
      <ambientLight intensity={0.05} />
    </>
  )
}
