// «Оператор». Активная сцена каждый кадр кладёт сюда базовый ракурс, а CameraRig
// добавляет поверх параллакс от курсора и дыхание рук (шум Перлина).
import * as THREE from 'three'

export const rig = {
  pos: new THREE.Vector3(0, 1, 5),
  look: new THREE.Vector3(0, 0, 0),
  fov: 40,
  roll: 0,
  near: 0.1,
  far: 4000,
  /** амплитуда дыхания камеры в мировых единицах (ТЗ: < 0.02) */
  shake: 0.012,
  /** угол параллакса от курсора в радианах при максимальном отклонении */
  parallax: 0.035,
  /** если сцена сама управляет камерой по курсору — общий параллакс выключается */
  ownPointer: false,
}

export type Rig = typeof rig

/** одномерный градиентный шум — гладкий, без периодичности синусов */
const P = new Uint8Array(512)
{
  const perm = Array.from({ length: 256 }, (_, i) => i)
  let s = 1337
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647
    const j = s % (i + 1)
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255]
}
const grad = (h: number, x: number) => ((h & 1) === 0 ? x : -x) * (1 + (h & 7) / 8)
export function perlin1(x: number) {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * f * (f * (f * 6 - 15) + 10)
  const a = grad(P[i & 255], f)
  const b = grad(P[(i + 1) & 255], f - 1)
  return (a + (b - a) * u) * 0.9
}
