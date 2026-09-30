// Автопросмотр и плавность: пишем S.p каждый кадр, потом колесо, потом снова тишина
import { open } from './lib.mjs'
process.env.AUTO = '1'
const errors = []
const { browser, page } = await open({ errors, w: 1600, h: 900 })
await page.evaluate(() => {
  window.__rec = []
  const t0 = performance.now()
  const f = () => { window.__rec.push([(performance.now() - t0) / 1000, window.__is.state().p]); requestAnimationFrame(f) }
  requestAnimationFrame(f)
})
await page.waitForTimeout(12000)
// зритель крутит колесо — автопросмотр должен уступить
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(120) }
await page.waitForTimeout(8000)
const rec = await page.evaluate(() => window.__rec)
const at = (t) => rec.find((r) => r[0] >= t)?.[1] ?? rec.at(-1)[1]
for (const t of [1, 3, 4, 5, 6, 8, 10, 12, 12.5, 13, 14, 15, 16, 17, 18, 20]) console.log(`t=${t}s p=${at(t).toFixed(5)}`)
// рывки: вторая разность прогресса по кадрам
let worst = 0, back = 0
for (let i = 2; i < rec.length; i++) {
  const v1 = (rec[i - 1][1] - rec[i - 2][1]) / Math.max(1e-3, rec[i - 1][0] - rec[i - 2][0])
  const v2 = (rec[i][1] - rec[i - 1][1]) / Math.max(1e-3, rec[i][0] - rec[i - 1][0])
  worst = Math.max(worst, Math.abs(v2 - v1))
  if (rec[i][1] < rec[i - 1][1] - 1e-6) back++
}
console.log('кадров', rec.length, 'макс. скачок скорости', worst.toFixed(4), 'откатов назад', back)
console.log('full film ~', (1 / ((at(11) - at(7)) / 4) / 60).toFixed(1), 'мин при текущем темпе')
for (const e of [...new Set(errors)].slice(0, 10)) console.log(e.slice(0, 300))
await browser.close()
