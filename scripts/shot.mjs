// Один кадр: node scripts/shot.mjs <доля прокрутки> <имя> ["js перед снимком"]
import { open, seek } from './lib.mjs'
const p = process.argv[2] || '0'
const name = process.argv[3] || '_dbg'
const js = process.argv[4] || ''
const W = Number(process.env.W || 1600), H = Number(process.env.H || 900)
const errors = []
const { browser, page, load } = await open({ w: W, h: H, errors })
console.log(`загрузка ${load.toFixed(1)} с`)
if (process.env.MX) await page.mouse.move(W * Number(process.env.MX), H * Number(process.env.MY || 0.5))
// первая перемотка монтирует акт (чанк, запекание неба, шейдеры) — даём ему время и перематываем ещё раз
await seek(page, p, 2500)
await seek(page, p, Number(process.env.WAIT || 2000))
if (js) console.log(await page.evaluate(js))
if (process.env.HIDEUI) await page.addStyleTag({ content: '.captions,.chrome,.cursor,.robot,.robot-say,.hint,.clock,.message{display:none!important}' })
await page.screenshot({ path: `docs/shots/${name}.jpg`, type: 'jpeg', quality: 90 })
console.log(JSON.stringify(await page.evaluate(() => ({ ...window.__is.state(), logs: window.__is.logs.slice(-6) }))))
console.log('→ docs/shots/' + name + '.jpg')
for (const e of [...new Set(errors)].slice(0, 12)) console.log('  ' + e.slice(0, 500))
await browser.close()
