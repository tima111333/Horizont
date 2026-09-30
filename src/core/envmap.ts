// Карта окружения из светящихся панелей, запечённая через PMREM.
// Вместо <Environment> из drei: тот вешает карту на всю сцену сразу при
// монтировании, а у нас смонтировано до трёх актов — они бы спорили за
// scene.environment. Здесь карта ставится только активным актом, каждый кадр.
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export interface Panel {
  pos: [number, number, number]
  /** куда панель светит (по умолчанию — в центр) */
  look?: [number, number, number]
  size: [number, number]
  color: string
  intensity: number
  shape?: 'rect' | 'disc'
}

/** окружение каждого акта — по id акта; его ставит и сам акт, и прогрев шейдеров */
export const envByAct = new Map<string, { tex: THREE.Texture; intensity: number }>()

export function useEnvMap(panels: Panel[], background: string | null = null, key = '', intensity = 1) {
  const gl = useThree((s) => s.gl)
  const rt = useMemo(() => {
    const scene = new THREE.Scene()
    scene.background = background ? new THREE.Color(background) : new THREE.Color(0)
    for (const p of panels) {
      const geo = p.shape === 'disc' ? new THREE.CircleGeometry(p.size[0] / 2, 48) : new THREE.PlaneGeometry(p.size[0], p.size[1])
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.intensity), side: THREE.DoubleSide })
      const m = new THREE.Mesh(geo, mat)
      m.position.set(...p.pos)
      m.lookAt(...(p.look ?? [0, 0, 0]))
      scene.add(m)
    }
    const pm = new THREE.PMREMGenerator(gl)
    const prev = gl.getRenderTarget()
    const out = pm.fromScene(scene, 0.02, 0.1, 100)
    gl.setRenderTarget(prev)
    pm.dispose()
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    })
    return out
    // панели задаются литералом в сцене — пересобирать по ключу, а не по ссылке
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, key])
  useEffect(() => {
    envByAct.set(key, { tex: rt.texture, intensity })
    return () => {
      envByAct.delete(key)
      rt.dispose()
    }
  }, [rt, key, intensity])
  return rt.texture
}
