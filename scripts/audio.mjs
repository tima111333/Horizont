// Звук: включить, пройти по актам и измерить уровень (RMS) на мастер-шине Howler
import { chromium } from 'playwright'
import { ensureServer, BASE } from './lib.mjs'
const server = await ensureServer()
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const page = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.intro .start:not([disabled])', { timeout: 120000 })
await page.click('.intro .start')
await page.waitForTimeout(1500)
const setup = await page.evaluate(() => {
  const A = window.__audio
  const an = A.ctx.createAnalyser()
  an.fftSize = 2048
  A.master.connect(an)
  window.__an = an
  return A.ctx.state
})
console.log('контекст:', setup)
for (const p of ['earth:0.3', 'shelf:0.5', 'launch:0.06', 'launch:0.5', 'wormhole:0.4', 'wormhole:0.68', 'miller:0.5', 'gargantua:0.5', 'tesseract:0.5', 'epilogue:0.5']) {
  const [id, l] = p.split(':')
  await page.evaluate(([i, v]) => window.__is.seekAct(i, Number(v)), [id, l])
  await page.waitForTimeout(3000)
  const rms = await page.evaluate(() => {
    const a = new Float32Array(2048)
    let s = 0
    for (let k = 0; k < 5; k++) {
      window.__an.getFloatTimeDomainData(a)
      for (const x of a) s += x * x
    }
    return Math.sqrt(s / (2048 * 5))
  })
  console.log(`${p.padEnd(14)} RMS ${rms.toFixed(4)} (${(20 * Math.log10(rms + 1e-9)).toFixed(1)} дБ)`)
}
console.log(errors.length ? 'ошибки: ' + errors.join(' | ') : 'ошибок нет')
await b.close()
await server?.close()
