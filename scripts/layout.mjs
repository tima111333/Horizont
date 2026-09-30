// Аудит вёрстки текста: переносы внутри слов заголовков, выход за экран, число строк.
// node scripts/layout.mjs  → таблица по вьюпортам
import { chromium } from 'playwright'
import { ensureServer, BASE } from './lib.mjs'

const VIEWS = (process.env.VIEWS || '2560x1440,1920x1080,1600x900,1440x900,1366x768,1280x720,1024x768')
  .split(',')
  .map((s) => s.split('x').map(Number))

const server = await ensureServer()
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let bad = 0
for (const [w, h] of VIEWS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await page.goto(BASE + (w < 760 ? '?mobile=1' : ''), { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.cap')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  const res = await page.evaluate(() => {
    const out = []
    const vw = innerWidth, vh = innerHeight
    const lines = (el) => {
      const r = el.getClientRects()
      const cs = getComputedStyle(el)
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2
      return Math.round(el.getBoundingClientRect().height / lh)
    }
    const offscreen = (el) => {
      const r = el.getBoundingClientRect()
      return r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1
    }
    // заголовки — проверяем, не разорвано ли слово по буквам
    const check = (sel, label, opts = {}) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        const host = el.closest('.cap, .message, .credits, .intro, .robot-say, .clock, .hud-act') || el
        const saved = []
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          saved.push([n, n.getAttribute('style')])
          n.style.visibility = 'visible'
          n.style.opacity = '1'
          n.style.filter = 'none'
          if (getComputedStyle(n).display === 'none') n.style.display = 'block'
        }
        const text = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)
        const spans = el.querySelectorAll(':scope > span')
        let broken = false
        if (spans.length > 1) {
          // по словам: буквы одного слова должны лежать на одной строке
          let wordTop = null
          for (const s of spans) {
            if (s.textContent.trim() === '') { wordTop = null; continue }
            const t = Math.round(s.getBoundingClientRect().top)
            if (wordTop === null) wordTop = t
            else if (Math.abs(t - wordTop) > 4) broken = true
          }
        }
        const n = lines(el)
        const off = offscreen(el)
        const r = el.getBoundingClientRect()
        const over = el.scrollWidth > el.clientWidth + 1
        if (broken || off || over || n > (opts.max ?? 99))
          out.push({ label, text, lines: n, broken, off, over, w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right) })
        for (const [n2, st] of saved.reverse()) st === null ? n2.removeAttribute('style') : n2.setAttribute('style', st)
      })
    }
    check('.cap[data-kind="title"] h2', 'title', { max: 1 })
    check('.cap .meta', 'meta', { max: 2 })
    check('.cap[data-kind="quote"] p', 'quote', { max: 3 })
    check('.cap[data-kind="log"] p', 'log', { max: 3 })
    check('.cap[data-kind="line"] p', 'line', { max: 2 })
    check('.intro h1', 'intro-h1', { max: 1 })
    check('.intro .lede', 'lede', { max: 4 })
    check('.intro .fine', 'fine', { max: 2 })
    check('.credits h3', 'credits-h3', { max: 1 })
    check('.credits p', 'credits-p', { max: 4 })
    check('.credits .roll dd', 'roll', { max: 1 })
    document.querySelector('.message .text').textContent = document.querySelector('.message .text').getAttribute('aria-label')
    check('.message .text', 'message', { max: 1 })
    check('.clock .v', 'clock', { max: 1 })
    check('.clock .k', 'clock-k', { max: 1 })
    return out
  })
  console.log(`\n── ${w}×${h}: ${res.length ? res.length + ' проблем' : 'ок'}`)
  for (const r of res) console.log('  ', JSON.stringify(r))
  bad += res.length
  await page.close()
}
await browser.close()
server?.close()
console.log('\nИТОГО проблем:', bad)
