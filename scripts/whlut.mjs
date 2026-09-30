import { open, seek } from './lib.mjs'
const errors = []
const { browser, page } = await open({ errors })
for (const p of ['wormhole:0.6', 'wormhole:0.64', 'wormhole:0.66', 'wormhole:0.68', 'wormhole:0.72']) {
  await seek(page, p, 3500)
  const r = await page.evaluate(() => {
    const { renderer, scene } = window.__is
    let rt = null
    scene.traverse((o) => { if (o.material?.uniforms?.uLut) rt = o.material.uniforms.uLut.value })
    // найдём сам рендер-таргет по текстуре
    const target = renderer.getRenderTarget()
    return { hasLut: !!rt, img: rt && rt.image ? [rt.image.width, rt.image.height] : null }
  })
  await page.screenshot({ path: 'docs/shots/_w.png' })
  const { execSync } = await import('child_process')
  const mean = execSync(`python -c "from PIL import Image, ImageStat; print(round(ImageStat.Stat(Image.open('docs/shots/_w.png').convert('L')).mean[0],1))"`).toString().trim()
  console.log(p, JSON.stringify(r), 'яркость', mean, JSON.stringify(await page.evaluate(() => window.__is.state().local)))
}
for (const e of [...new Set(errors)].slice(0, 8)) console.log('  ' + e.slice(0, 300))
await browser.close()
