// Хелперы для стенда (scripts/*.mjs) и ручной отладки из консоли.
import type * as THREE from 'three'
import { S } from './story/store'
import { ACTS } from './story/acts'
import { seek, setAuto } from './core/scroll'

declare global {
  interface Window {
    __is?: {
      seek: (p: number) => void
      auto: (on: boolean) => void
      seekAct: (id: string, local: number) => void
      state: () => Record<string, unknown>
      log: (m: string) => void
      logs: string[]
      renderer?: THREE.WebGLRenderer
      scene?: THREE.Scene
      camera?: THREE.Camera
      ready: boolean
      start?: (sound: boolean) => void
      pointer: (x: number, y: number) => void
      frameInfo?: { calls: number; tris: number }
    }
  }
}

window.__is = {
  seek,
  auto: setAuto,
  seekAct(id, local) {
    const a = ACTS.find((x) => x.id === id)!
    seek(a.start + (a.end - a.start) * local)
  },
  logs: [],
  ready: false,
  log(m) {
    this.logs.push(m)
    if (location.search.includes('debug')) console.info('[is]', m)
  },
  pointer(x, y) {
    S.pointer.x = x
    S.pointer.y = y
    S.pointer.sx = x
    S.pointer.sy = y
  },
  state() {
    const r = this.renderer
    return {
      p: S.p,
      act: ACTS[S.act].id,
      local: S.local[S.act],
      dip: S.dip,
      calls: this.frameInfo?.calls,
      tris: this.frameInfo?.tris,
      programs: r?.info.programs?.length,
      geos: r?.info.memory.geometries,
      tex: r?.info.memory.textures,
    }
  },
}
