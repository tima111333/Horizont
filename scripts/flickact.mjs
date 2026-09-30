// Мерцание по акту: серия снимков при медленной прокрутке, яркость и доля чёрного по кадрам
import { open, seek } from './lib.mjs'
import fs from 'fs'
const act = process.argv[2] || 'launch'
const N = Number(process.argv[3] || 80)
const errors = []
const { browser, page } = await open({ errors })
fs.mkdirSync('docs/shots/fa', { recursive: true })
for (const f of fs.readdirSync('docs/shots/fa')) fs.unlinkSync('docs/shots/fa/' + f)
await page.addStyleTag({ content: '.captions,.chrome,.cursor,.hint,.clock,.message{display:none!important}' })
await seek(page, act + ':0.02', 3000)
for (let i = 0; i < N; i++) {
  await page.evaluate(([a, v]) => window.__is.seekAct(a, v), [act, 0.02 + (i / N) * 0.96])
  await page.waitForTimeout(120)
  await page.screenshot({ path: `docs/shots/fa/${String(i).padStart(3, '0')}.png` })
}
for (const e of [...new Set(errors)].slice(0, 10)) console.log(e.slice(0, 300))
await browser.close()
