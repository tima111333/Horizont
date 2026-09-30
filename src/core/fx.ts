// Ручки, которые сцены могут крутить поверх грейдинга акта: вспышка, всплеск
// блума, собственная склейка. Плюс ссылка на композер для прогрева шейдеров.
import type { EffectComposer } from 'postprocessing'
import * as THREE from 'three'

export const fx = {
  exposure: 1,
  bloom: 1,
  ca: 1,
  dip: 0,
  dipColor: [0, 0, 0] as [number, number, number],
  /** глубина резкости: точка фокуса в мире, сила боке, глубина резкой зоны */
  focus: new THREE.Vector3(),
  bokeh: 0,
  focusRange: 4,
  composer: null as EffectComposer | null,
}
