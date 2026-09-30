// Общий стенд: настоящий Chromium на GPU (d3d11). Встроенная панель браузера
// для WebGL непригодна — не тикает в фоне и врёт размером вьюпорта.
import { chromium } from 'playwright'

export const BASE = process.env.URL || 'http://127.0.0.1:5192/'

// Если dev-сервер не поднят (панель приложения его гасит), стенд поднимает свой —
// как webServer у Playwright Test — и гасит его при закрытии браузера.
export async function ensureServer() {
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(1500) })
    if (r.ok) return null
  } catch {}
  const { createServer } = await import('vite')
  const server = await createServer({ server: { host: '127.0.0.1', port: 5192, strictPort: true }, logLevel: 'error' })
  await server.listen()
  return server
}

export async function open({ w = 1600, h = 900, q = process.env.Q || '', errors = [] } = {}) {
  const angle = process.env.SWIFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
  const server = await ensureServer()
  // без vsync и лимита кадров — иначе любой кадр «весит» ровно 16,7 мс
  const unlock = process.env.VSYNC ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit']
  const browser = await chromium.launch({ args: [...angle, ...unlock, '--autoplay-policy=no-user-gesture-required'] })
  if (server) browser.on('disconnected', () => server.close())
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  page.on('console', (m) => {
    const t = m.text()
    if (/X4122|X3571|THREE\.Clock|GPU stall|GL Driver Message/.test(t)) return
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + t)
  })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  const t0 = Date.now()
  await page.goto(BASE + q, { waitUntil: 'domcontentloaded' })
  try {
    await page.waitForSelector('.intro .start:not([disabled])', { timeout: Number(process.env.LOAD_TIMEOUT || 60000) })
  } catch (e) {
    console.log('СТАРТ НЕ ГОТОВ. Консоль:')
    for (const x of [...new Set(errors)].slice(0, 20)) console.log('  ' + x.slice(0, 800))
    await browser.close()
    process.exit(1)
  }
  const load = (Date.now() - t0) / 1000
  await page.evaluate(() => window.__is.start(false))
  // стенду автопросмотр мешает: кадр должен стоять там, куда перемотали
  if (!process.env.AUTO) await page.evaluate(() => window.__is.auto(false))
  await page.mouse.move(w * 0.5, h * 0.5)
  return { browser, page, load }
}

/** p — доля всей страницы или «акт:доля», например "miller:0.4" */
export async function seek(page, p, wait = 2000) {
  const s = String(p)
  if (s.includes(':')) {
    const [id, l] = s.split(':')
    await page.evaluate(([i, v]) => window.__is.seekAct(i, v), [id, Number(l)])
  } else await page.evaluate((v) => window.__is.seek(v), Number(s))
  await page.waitForTimeout(wait)
}
