// Отладка загрузки: открыть страницу, подождать и вывести логи/состояние без старта
import { chromium } from 'playwright'
import { ensureServer } from './lib.mjs'
const server = await ensureServer()
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await b.newPage({ viewport: { width: 1600, height: 900 } })
page.on('console', (m) => console.log('[' + m.type() + ']', m.text().slice(0, 300)))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://127.0.0.1:5192/' + (process.argv[2] || ''), { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(Number(process.env.WAIT || 12000))
console.log(await page.evaluate(() => JSON.stringify({ logs: window.__is?.logs, kids: window.__is?.scene?.children.map((c) => c.name + ':' + c.children.length) })))
await b.close()
await server?.close()
