// Проверка процедурной геометрии: NaN и нулевые нормали дают чёрные вспышки через bloom
import { buildEndurance, buildRanger } from '../src/models/endurance.ts'
import { BOOK_SHAPES, bookGeometry } from '../src/models/book.ts'
import { buildClump } from '../src/models/wheat.ts'
let found = 0
const check = (name: string, g: any) => {
  for (const attr of ['position', 'normal']) {
    const a = g.attributes[attr]?.array
    if (!a) continue
    let bad = 0, zero = 0
    for (let i = 0; i < a.length; i += 3) {
      if (!Number.isFinite(a[i]) || !Number.isFinite(a[i + 1]) || !Number.isFinite(a[i + 2])) bad++
      if (attr === 'normal' && !(Math.hypot(a[i], a[i + 1], a[i + 2]) > 0.5)) zero++
    }
    if (bad || zero) { found++; console.log(name, attr, 'NaN:', bad, 'нулевых:', zero) }
  }
}
const e = buildEndurance()
for (const [k, g] of Object.entries(e.ring)) check('ring.' + k, g)
for (const [k, g] of Object.entries(e.hub)) check('hub.' + k, g)
for (const [k, g] of Object.entries(buildRanger())) check('ranger.' + k, g)
BOOK_SHAPES.forEach((s, i) => { check('book' + i, bookGeometry(s)); check('book5-' + i, bookGeometry(s, 5)) })
for (const lod of [0, 1, 2] as const) check('wheat' + lod, buildClump(5, lod, 11))
console.log(found ? 'проблем: ' + found : 'всё чисто')
