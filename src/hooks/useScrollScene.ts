import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { S } from '../story/store'
import { actIndex, type ActId } from '../story/acts'

export interface SceneFrame {
  /** локальный прогресс акта 0..1 */
  p: number
  /** время с начала жизни сцены, с */
  t: number
  dt: number
  state: import('@react-three/fiber').RootState
}

/**
 * Каркас сцены-акта: колбэк вызывается только для активного акта, спрятанные
 * сцены не тратят CPU (видимость гейта выставляет Stage). Приоритет -2: раньше
 * CameraRig и композера.
 */
export function useScrollScene(id: ActId, frame: (f: SceneFrame) => void) {
  const index = actIndex(id)
  const root = useRef<THREE.Group>(null)
  const t = useRef(0)
  useFrame((state, dt) => {
    if (S.act !== index) return
    const d = Math.min(dt, 0.1)
    t.current += d
    frame({ p: S.local[index], t: t.current, dt: d, state })
  }, -2)
  return root
}
