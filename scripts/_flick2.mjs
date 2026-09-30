import { open, seek } from './lib.mjs'
import fs from 'fs'
const at = process.argv[2] || 'launch:0.7'
const { browser, page } = await open({})
fs.mkdirSync('docs/shots/fb', { recursive: true })
for (const f of fs.readdirSync('docs/shots/fb')) fs.unlinkSync('docs/shots/fb/' + f)
await page.addStyleTag({ content: '.captions,.chrome,.cursor,.hint,.clock,.message{display:none!important}' })
await seek(page, at, 3000)
await seek(page, at, 2000)
for (let i = 0; i < 40; i++) { await page.screenshot({ path: `docs/shots/fb/${String(i).padStart(3, '0')}.png` }) }
await browser.close()
