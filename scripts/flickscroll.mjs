// Мерцание в движении: колесом через акт, снимки подряд
import { open, seek } from './lib.mjs'
import fs from 'fs'
const act = process.argv[2] || 'miller'
const N = Number(process.argv[3] || 60)
const errors = []
const { browser, page } = await open({ errors })
fs.mkdirSync('docs/shots/fs', { recursive: true })
for (const f of fs.readdirSync('docs/shots/fs')) fs.unlinkSync('docs/shots/fs/' + f)
await seek(page, act + ':0.02', 2500)
await seek(page, act + ':0.02', 1500)
for (let i = 0; i < N; i++) {
  await page.mouse.move(800 + Math.sin(i * 0.4) * 400, 560 + Math.cos(i * 0.5) * 150)
  await page.mouse.wheel(0, Number(process.env.STEP || 25))
  await page.screenshot({ path: `docs/shots/fs/${String(i).padStart(3, '0')}.png` })
}
console.log(JSON.stringify(await page.evaluate(() => window.__is.state())))
for (const e of [...new Set(errors)].slice(0, 10)) console.log(e.slice(0, 300))
await browser.close()
