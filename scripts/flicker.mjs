// Мерцание: серия снимков в одной точке, доля тёмных пикселей и её скачки между кадрами
// node scripts/flicker.mjs miller:0.3,miller:0.6 [кадров]
import { open, seek } from './lib.mjs'
import { execSync } from 'child_process'
import fs from 'fs'
const pts = (process.argv[2] || 'miller:0.1,miller:0.35,miller:0.6,miller:0.85').split(',')
const N = Number(process.argv[3] || 14)
const errors = []
const { browser, page } = await open({ errors })
fs.mkdirSync('docs/shots/fl', { recursive: true })
for (const p of pts) {
  await seek(page, p, 2500)
  await seek(page, p, 1500)
  const files = []
  for (let i = 0; i < N; i++) {
    const f = `docs/shots/fl/${p.replace(':', '-')}-${i}.png`
    // курсор водит по воде — как у зрителя
    await page.mouse.move(800 + Math.sin(i) * 300, 600 + Math.cos(i * 1.3) * 120)
    await page.screenshot({ path: f })
    files.push(f)
    await page.waitForTimeout(90)
  }
  const out = execSync(`python -c "
import sys
from PIL import Image
import numpy as np
for f in sys.argv[1:]:
    a=np.asarray(Image.open(f).convert('L')).astype(np.float32)
    h=a.shape[0]; a=a[int(h*0.14):int(h*0.86)]
    print(f.split('/')[-1], round(float(a.mean()),1), round(float((a<12).mean()*100),2))
" ${files.join(' ')}`).toString()
  console.log('── ' + p + '  (кадр, средняя яркость, % почти чёрных)\n' + out)
}
for (const e of [...new Set(errors)].slice(0, 10)) console.log(e.slice(0, 300))
await browser.close()
