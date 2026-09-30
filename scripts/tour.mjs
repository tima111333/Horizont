// Сквозной прогон колесом мыши: как зритель листает от пролога до титров.
// Пишет рывки (кадры > 33 мс) по актам, память three и ошибки консоли.
import { open } from './lib.mjs'
const errors = []
const { browser, page, load } = await open({ errors, w: Number(process.env.W || 1600), h: Number(process.env.H || 900) })
console.log(`загрузка до кнопки: ${load.toFixed(1)} с`)
await page.evaluate(() => {
  window.__frames = []
  let last = performance.now()
  const tick = () => {
    const now = performance.now()
    const st = window.__is.state()
    window.__frames.push([now - last, st.act, st.p, st.dip])
    last = now
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
await page.mouse.move(800, 450)
const acts = new Map()
let lastAct = ''
for (let i = 0; i < 2000; i++) {
  await page.mouse.wheel(0, 110)
  await page.waitForTimeout(45)
  if (i % 10 === 0) {
    const st = await page.evaluate(() => window.__is.state())
    if (st.act !== lastAct) {
      lastAct = st.act
      console.log(`→ ${st.act.padEnd(10)} p=${st.p.toFixed(3)} geos=${st.geos} tex=${st.tex} programs=${st.programs}`)
    }
    if (st.p > 0.999) break
  }
}
await page.waitForTimeout(2500)
const frames = await page.evaluate(() => window.__frames)
// считаем только видимые кадры: в затемнении склейки подвисание не видно
for (const [dt, act, , dip] of frames) {
  const a = acts.get(act) || { n: 0, long: 0, max: 0, sum: 0 }
  a.n++
  a.sum += dt
  if (dip > 0.5) {
    acts.set(act, a)
    continue
  }
  if (dt > 33) a.long++
  a.max = Math.max(a.max, dt)
  acts.set(act, a)
}
const worst = [...frames].sort((a, b) => b[0] - a[0]).slice(0, 12)
console.log('худшие кадры:', worst.map(([d, a, p, dip]) => `${a}@${p.toFixed(3)}${dip > 0.5 ? '(в склейке)' : ''}:${d.toFixed(0)}мс`).join('  '))
for (const [act, a] of acts) console.log(`${act.padEnd(10)} кадров ${a.n}  средний ${(a.sum / a.n).toFixed(1)} мс  видимых рывков>33мс ${a.long}  худший видимый ${a.max.toFixed(0)} мс`)
console.log('логи:', (await page.evaluate(() => window.__is.logs)).join(' | '))
const st = await page.evaluate(() => window.__is.state())
console.log('финал:', JSON.stringify(st))
await page.screenshot({ path: 'docs/shots/tour-end.jpg', type: 'jpeg', quality: 85 })
if (errors.length) {
  console.log('\nКОНСОЛЬ:')
  for (const e of [...new Set(errors)].slice(0, 20)) console.log('  ' + e.slice(0, 400))
} else console.log('\nконсоль чистая')
await browser.close()
