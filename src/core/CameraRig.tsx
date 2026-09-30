import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rig, perlin1 } from './rig'
import { S } from '../story/store'
import { ACTS } from '../story/acts'

const q = new THREE.Quaternion()
const off = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const right = new THREE.Vector3()
const fwd = new THREE.Vector3()
const m = new THREE.Matrix4()

/**
 * Применяет ракурс к камере. Приоритет -1: сцены (приоритет -2) уже положили
 * базу, EffectComposer (приоритет 1) ещё не рисовал.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const par = rig.ownPointer ? 0 : rig.parallax * ACTS[S.act].parallax

    // орбита вокруг точки взгляда на небольшой угол — параллакс не зависит от масштаба сцены
    off.subVectors(rig.pos, rig.look)
    fwd.copy(off).normalize()
    right.crossVectors(up, fwd).normalize()
    q.setFromAxisAngle(up, -S.pointer.sx * par)
    off.applyQuaternion(q)
    q.setFromAxisAngle(right, S.pointer.sy * par * 0.55)
    off.applyQuaternion(q)
    camera.position.copy(rig.look).add(off)

    // дыхание оператора: несколько октав шума, по каждой оси своя фаза
    const a = rig.shake
    camera.position.x += a * (perlin1(t * 0.31) + 0.5 * perlin1(t * 0.87 + 11))
    camera.position.y += a * (perlin1(t * 0.27 + 37) + 0.5 * perlin1(t * 0.79 + 53))
    camera.position.z += a * 0.6 * perlin1(t * 0.23 + 71)

    m.lookAt(camera.position, rig.look, up)
    camera.quaternion.setFromRotationMatrix(m)
    const roll = rig.roll + a * 0.12 * perlin1(t * 0.19 + 91)
    if (roll) camera.rotateZ(roll)

    // на вертикальном экране горизонт узкий — раскрываем вертикальный угол, чтобы кадр не резался
    const fov = camera.aspect < 0.95 ? Math.min(rig.fov * (1 + (0.95 - camera.aspect) * 0.75), 90) : rig.fov
    if (camera.fov !== fov || camera.near !== rig.near || camera.far !== rig.far) {
      camera.fov = fov
      camera.near = rig.near
      camera.far = rig.far
      camera.updateProjectionMatrix()
    }
  }, -1)

  return null
}
