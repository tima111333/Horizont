// Однострочные заголовки: если слово не влезает в отведённую ширину, уменьшаем
// кегль ровно настолько, чтобы влезло, — вместо переноса по буквам.
const gutter = () => Math.min(64, Math.max(16, innerWidth * 0.04))

/** доступная ширина под заголовок в зависимости от места на экране */
export const availWidth = (pos: 'left' | 'right' | 'center' | 'low' | string) =>
  // справа — шкала глав (~90 px)
  pos === 'center' || pos === 'low' ? innerWidth * 0.92 : innerWidth - 2 * gutter() - 90

export function fitText(el: HTMLElement, avail: number, sample?: string) {
  el.style.fontSize = ''
  const saved = sample !== undefined ? el.textContent : null
  if (sample !== undefined) el.textContent = sample
  const natural = el.scrollWidth
  if (saved !== null) el.textContent = saved
  if (natural <= avail || natural === 0) return
  const fs = parseFloat(getComputedStyle(el).fontSize)
  el.style.fontSize = `${Math.floor(fs * (avail / natural) * 0.98)}px`
}

/** подписка на всё, что меняет метрики: ресайз и догрузка шрифтов */
export function onFit(fn: () => void) {
  let raf = 0
  const run = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(fn)
  }
  document.fonts.ready.then(run)
  addEventListener('resize', run)
  run()
  return () => {
    cancelAnimationFrame(raf)
    removeEventListener('resize', run)
  }
}
