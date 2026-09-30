// Время кадра на настоящем GPU: readPixels после каждого кадра, иначе меряется
// только постановка команд. node scripts/fps.mjs earth:0.1 miller:0.5 ...
import { open, seek } from './lib.mjs'
const points = process.argv.slice(2)
const errors = []
const { browser, page } = await open({ errors, w: Number(process.env.W || 1600), h: Number(process.env.H || 900) })
for (const p of points) {
  await seek(page, p, 2500)
  const r = await page.evaluate(() => new Promise((res) => {
    const gl = window.__is.renderer.getContext()
    const px = new Uint8Array(4)
    const ts = []
    let last = performance.now()
    let n = 0
    const tick = () => {
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      const now = performance.now()
      ts.push(now - last)
      last = now
      if (++n < 100) requestAnimationFrame(tick)
      else {
        const s = ts.slice(20).sort((a, b) => a - b)
        res({ median: +s[s.length >> 1].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), info: window.__is.state() })
      }
    }
    requestAnimationFrame(tick)
  }))
  console.log(`${p.padEnd(16)} медиана ${r.median} мс  p95 ${r.p95} мс  calls ${r.info.calls}  tris ${(r.info.tris / 1e6).toFixed(2)}M`)
}
for (const e of [...new Set(errors)].slice(0, 10)) console.log('  ' + e.slice(0, 300))
await browser.close()
