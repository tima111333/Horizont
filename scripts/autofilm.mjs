// Весь фильм в автопросмотре, как у зрителя: долгие кадры и остановки движения
import { open } from './lib.mjs'
process.env.AUTO = '1'
const errors = []
const { browser, page, load } = await open({ errors, w: Number(process.env.W || 1600), h: Number(process.env.H || 900) })
console.log(`загрузка до кнопки: ${load.toFixed(1)} с`)
await page.evaluate(() => {
  window.__fr = []
  let last = performance.now()
  const f = () => {
    const n = performance.now()
    const s = window.__is.state()
    window.__fr.push([n - last, s.p, s.dip, s.act])
    last = n
    requestAnimationFrame(f)
  }
  requestAnimationFrame(f)
})
const t0 = Date.now()
while (Date.now() - t0 < 330000) {
  await page.waitForTimeout(5000)
  const p = await page.evaluate(() => window.__is.state().p)
  if (p > 0.985) break
}
const fr = await page.evaluate(() => window.__fr)
const long = fr.filter((x) => x[0] > 50)
console.log(`время ${((Date.now() - t0) / 1000).toFixed(0)} с, кадров ${fr.length}, >50 мс: ${long.length}, >100 мс: ${fr.filter((x) => x[0] > 100).length}`)
for (const [dt, p, dip, act] of long.sort((a, b) => b[0] - a[0]).slice(0, 15)) console.log(`  ${dt.toFixed(0)} мс  ${act}  p=${p.toFixed(3)} склейка=${dip.toFixed(2)}`)
// «остановки»: секундные окна, где прогресс почти не сдвинулся
let stalls = 0
for (let i = 0, j = 0; i < fr.length; i++) {
  let t = 0
  for (j = i; j < fr.length && t < 1000; j++) t += fr[j][0]
  if (j < fr.length && fr[j][1] - fr[i][1] < 0.0004 && fr[i][1] > 0.01 && fr[i][1] < 0.97) { stalls++; i = j }
}
console.log('секунд без движения:', stalls)
for (const e of [...new Set(errors)].slice(0, 8)) console.log(e.slice(0, 300))
await browser.close()
