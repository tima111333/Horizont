// Загрузчик процедурных ассетов: задачи уходят в воркер, результат кэшируется
// как промис. Сцены читают его через use() — пока данных нет, акт «висит»
// в Suspense и не монтируется, а когда зритель доскроллит — всё уже готово.
import { use } from 'react'
import * as THREE from 'three'
import type { Img } from '../models/textures'
import type { SerialGeo, WheatRing } from '../workers/assets.worker'

let worker: Worker | null = null
let seq = 0
const waiting = new Map<number, { ok: (v: unknown) => void; fail: (e: unknown) => void }>()
const cache = new Map<string, Promise<unknown>>()

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/assets.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const w = waiting.get(e.data.id)
      if (!w) return
      waiting.delete(e.data.id)
      if (e.data.error) w.fail(new Error(e.data.error))
      else w.ok(e.data.result)
    }
  }
  return worker
}

export function asset<T>(task: string, args?: unknown, key = task): Promise<T> {
  let p = cache.get(key)
  if (!p) {
    p = new Promise((ok, fail) => {
      const id = ++seq
      waiting.set(id, { ok, fail })
      getWorker().postMessage({ id, task, args })
    })
    cache.set(key, p)
  }
  return p as Promise<T>
}

export const useAsset = <T,>(task: string, args?: unknown, key = task) => use(asset<T>(task, args, key))

// ─── обёртки в объекты three: кэш, чтобы общие ассеты грузились в GPU один раз ─
const texCache = new WeakMap<Img, THREE.DataTexture>()
export function toTexture(im: Img) {
  let t = texCache.get(im)
  if (!t) {
    t = new THREE.DataTexture(im.data, im.w, im.h, THREE.RGBAFormat, THREE.UnsignedByteType)
    t.colorSpace = im.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
    t.anisotropy = 16
    t.needsUpdate = true
    texCache.set(im, t)
  }
  return t
}

const geoCache = new WeakMap<SerialGeo, THREE.BufferGeometry>()
export function toGeometry(s: SerialGeo, instanced = false) {
  let g = geoCache.get(s)
  if (!g) {
    g = instanced ? new THREE.InstancedBufferGeometry() : new THREE.BufferGeometry()
    for (const [k, a] of Object.entries(s.attributes)) g.setAttribute(k, new THREE.BufferAttribute(a.array as Float32Array, a.itemSize))
    if (s.index) g.setIndex(new THREE.BufferAttribute(s.index as Uint32Array, 1))
    g.computeBoundingSphere()
    geoCache.set(s, g)
  }
  return g
}

export function toParts<K extends string>(o: Partial<Record<K, SerialGeo>>) {
  return Object.fromEntries(Object.entries(o).map(([k, s]) => [k, toGeometry(s as SerialGeo)])) as Partial<Record<K, THREE.BufferGeometry>>
}

export type { WheatRing, SerialGeo }

/** фоновая очередь: всё тяжёлое считается заранее, в порядке актов */
export function preloadAssets(wheatArgs: unknown) {
  asset('wheat', wheatArgs)
  ;['wood', 'planks', 'wallpaper', 'spines', 'cloth', 'pageEdge', 'hull', 'foil', 'tiles', 'endurance', 'ranger'].forEach((t) => asset(t))
}
