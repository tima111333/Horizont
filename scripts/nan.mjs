// Ищет объект, из-за которого кадр чернеет (NaN в bloom): прячет группы и меряет яркость снимка
import { open, seek } from './lib.mjs'
import fs from 'fs'
const [p, ...groups] = process.argv.slice(2)
const errors = []
const { browser, page } = await open({ errors })
await seek(page, p, 2500)
for (const g of ['', ...groups]) {
  await page.evaluate((hide) => {
    const names = hide ? hide.split(',') : []
    window.__is.scene.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isSprite)) return
      const key = o.type + ':' + (o.material && o.material.type) + ':' + (o.geometry && o.geometry.type)
      if (o.userData.__v === undefined) o.userData.__v = o.visible
      o.visible = names.some((n) => key.includes(n)) ? false : o.userData.__v
    })
  }, g)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'docs/shots/_nan.png' })
  const { execSync } = await import('child_process')
  const mean = execSync(`python -c "from PIL import Image, ImageStat; print(round(ImageStat.Stat(Image.open('docs/shots/_nan.png').convert('L')).mean[0],1))"`).toString().trim()
  console.log(`спрятано [${g}] → яркость ${mean}`)
}
await browser.close()
