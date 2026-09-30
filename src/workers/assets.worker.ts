// Фоновая генерация тяжёлых процедурных ассетов: текстуры обшивки, фольги,
// досок, пшеница, модель корабля. Главный поток получает готовые массивы
// (передача без копирования) и только оборачивает их в объекты three.
import type * as THREE from 'three'
import * as T from '../models/textures'
import { buildClump, scatter } from '../models/wheat'
import { buildEndurance, buildRanger } from '../models/endurance'

export interface SerialGeo {
  attributes: Record<string, { array: ArrayLike<number> & { buffer: ArrayBufferLike }; itemSize: number }>
  index: (ArrayLike<number> & { buffer: ArrayBufferLike }) | null
}

function serialize(g: THREE.BufferGeometry): SerialGeo {
  const attributes: SerialGeo['attributes'] = {}
  for (const [k, a] of Object.entries(g.attributes)) {
    const attr = a as THREE.BufferAttribute
    attributes[k] = { array: attr.array as Float32Array, itemSize: attr.itemSize }
  }
  return { attributes, index: g.index ? (g.index.array as Uint32Array) : null }
}

const serParts = (o: Partial<Record<string, THREE.BufferGeometry>>) => Object.fromEntries(Object.entries(o).map(([k, g]) => [k, serialize(g!)]))

export type WheatRing = { geo: SerialGeo; inst: Float32Array; vars: Float32Array; n: number }

const tasks: Record<string, (args: never) => unknown> = {
  wood: () => T.wood(4),
  planks: () => T.planks(3),
  wallpaper: () => T.wallpaper(9),
  spines: () => [0, 1, 2, 3, 4, 5].map((v) => T.spine(v)),
  cloth: () => T.cloth(5),
  pageEdge: () => T.pageEdge(8),
  hull: () => T.hullMaps(21),
  foil: () => T.foilNormal(33),
  tiles: () => T.tiles(),
  endurance: () => {
    const e = buildEndurance()
    return { ring: serParts(e.ring), hub: serParts(e.hub) }
  },
  ranger: () => serParts(buildRanger()),
  wheat: (a: { rings: [0 | 1 | 2, number, number, number, number][]; path: [number, number][]; roadX: number }) =>
    a.rings.map(([lod, stalks, count, r0, r1], i) => {
      const g = buildClump(stalks, lod, 11 + i * 12)
      const s = scatter(count, r0, r1, 101 + i * 101, a.path, a.roadX)
      return { geo: serialize(g), inst: s.inst.slice(), vars: s.vars.slice(), n: s.n } as WheatRing
    }),
}

// все буферы результата передаются, а не копируются
function transfers(v: unknown, out: Set<ArrayBufferLike> = new Set()) {
  if (!v || typeof v !== 'object') return out
  if (ArrayBuffer.isView(v)) {
    out.add(v.buffer)
    return out
  }
  for (const x of Object.values(v as object)) transfers(x, out)
  return out
}

self.onmessage = (e: MessageEvent<{ id: number; task: string; args?: unknown }>) => {
  const { id, task, args } = e.data
  try {
    const result = tasks[task](args as never)
    ;(self as unknown as Worker).postMessage({ id, result }, [...transfers(result)] as Transferable[])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) })
  }
}
