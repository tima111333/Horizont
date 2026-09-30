// Несколько кадров за один запуск: node scripts/shots.mjs префикс act:p act:p ...
import { open, seek } from './lib.mjs'
const [prefix, ...pts] = process.argv.slice(2)
const W = Number(process.env.W || 1600), H = Number(process.env.H || 900)
const errors = []
const { browser, page, load } = await open({ w: W, h: H, errors })
console.log(`загрузка ${load.toFixed(1)} с`)
if (process.env.HIDEUI) await page.addStyleTag({ content: '.captions,.chrome,.cursor,.robot,.robot-say,.hint,.clock,.message{display:none!important}' })
for (const p of pts) {
  await seek(page, p, 2500)
  await seek(page, p, Number(process.env.WAIT || 1500))
  const f = `docs/shots/${prefix}-${p.replace(':', '-')}.jpg`
  await page.screenshot({ path: f, type: 'jpeg', quality: 90 })
  console.log('→ ' + f)
}
for (const e of [...new Set(errors)].slice(0, 12)) console.log('  ' + e.slice(0, 500))
await browser.close()
