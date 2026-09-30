// Трасса Chrome во время прокрутки: какие задачи главного потока длиннее порога
import { open } from './lib.mjs'
import fs from 'fs'
const until = Number(process.argv[2] || 0.11)
const errors = []
const { browser, page } = await open({ errors })
await browser.startTracing(page, { categories: ['devtools.timeline', 'v8.execute', 'blink.user_timing'] })
await page.mouse.move(800, 450)
for (let i = 0; i < 400; i++) {
  await page.mouse.wheel(0, 110)
  await page.waitForTimeout(45)
  if (i % 10 === 0 && (await page.evaluate(() => window.__is.state().p)) > until) break
}
await page.waitForTimeout(1500)
const buf = await browser.stopTracing()
fs.writeFileSync('docs/trace.json', buf)
const ev = JSON.parse(buf.toString()).traceEvents
const long = ev.filter((e) => e.ph === 'X' && e.dur > Number(process.env.MIN || 120) * 1000 && (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask'))
for (const t of long.slice(0, 15)) {
  const kids = ev.filter((e) => e.ph === 'X' && e.tid === t.tid && e.ts >= t.ts && e.ts + (e.dur || 0) <= t.ts + t.dur && e.dur > 20000 && e !== t)
  console.log(`${(t.dur / 1000).toFixed(0)} мс:`, kids.slice(0, 8).map((k) => `${k.name}${k.args?.data?.functionName ? '(' + k.args.data.functionName + ')' : ''}${k.args?.data?.url ? '[' + String(k.args.data.url).split('/').pop() + ':' + k.args.data.lineNumber + ']' : ''}=${(k.dur / 1000).toFixed(0)}`).join('  '))
}
await browser.close()
