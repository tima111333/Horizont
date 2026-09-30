// Кадры вокруг входа в акт: что меняется в рендерере на кадре-рывке
import { open, seek } from './lib.mjs'
const from = process.env.FROM || 'shelf:0.8'
const until = Number(process.env.UNTIL || 0.27)
const { browser, page } = await open({ q: process.env.Q || '' })
await seek(page, from, Number(process.env.WAIT || 3000))
await page.evaluate((a) => (window.__act = a), process.env.ACT || 'launch')
await page.evaluate(() => {
  window.__fr = []
  let last = performance.now()
  const f = () => {
    const n = performance.now()
    const r = window.__is.renderer
    const s = window.__is.state()
    // у каких материалов акта «Эндюранс» сменилась программа на этом кадре
    window.__pm ??= new Map()
    let ch = []
    window.__is.scene.traverse((o) => {
      if (!o.material) return
      let a = o; while (a && a.userData.act === undefined) a = a.parent
      if (a?.name !== (window.__act || 'launch')) return
      for (const m of [].concat(o.material)) {
        const pr = r.properties.get(m).currentProgram
        if (window.__pm.has(m) && window.__pm.get(m) !== pr) {
          const o1 = String(window.__pm.get(m)?.cacheKey ?? '').split(','), n1 = String(pr?.cacheKey ?? '').split(',')
          const diff = []
          for (let i = 0; i < Math.max(o1.length, n1.length); i++) if (o1[i] !== n1[i]) diff.push(i + ':' + o1[i] + '→' + n1[i])
          ch.push(o.type + ':' + m.type + ' [' + diff.slice(0, 6).join(' ') + '] len ' + o1.length + '/' + n1.length)
        }
        window.__pm.set(m, pr)
      }
    })
    if (ch.length) window.__is.log('смена программ: ' + ch.join(', '))
    window.__fr.push([Math.round(n - last), +s.p.toFixed(4), +s.dip.toFixed(2), r.info.programs.length, r.info.memory.textures, r.info.memory.geometries, s.calls, window.__is.logs.length])
    last = n
    requestAnimationFrame(f)
  }
  requestAnimationFrame(f)
})
for (let i = 0; i < 400; i++) {
  await page.mouse.wheel(0, 110)
  await page.waitForTimeout(45)
  if (i % 5 === 0 && (await page.evaluate(() => window.__is.state().p)) > until) break
}
await page.waitForTimeout(800)
const fr = await page.evaluate(() => window.__fr)
const logs = await page.evaluate(() => window.__is.logs)
let prev = null
for (const x of fr) {
  const changed = prev && (x[3] !== prev[3] || x[4] !== prev[4] || x[5] !== prev[5] || x[7] !== prev[7])
  if (x[0] > 33 || changed) console.log(JSON.stringify(x), changed ? '← изменилось' : '', x[7] !== prev?.[7] ? logs.slice(prev?.[7] ?? 0, x[7]).join(' | ') : '')
  prev = x
}
await browser.close()
