import { useEffect } from 'react'
import gsap from 'gsap'
import { ACTS } from '../story/acts'
import { S, onActChange } from '../story/store'

/**
 * Земные сцены — в 2.39:1 со шторками, космос раскрывается на весь кадр,
 * как переход с анаморфота на IMAX. На вертикальных экранах шторок нет.
 */
export function Letterbox() {
  useEffect(() => {
    const root = document.documentElement
    const bar = { v: 0 }
    const target = () => {
      const w = innerWidth
      const h = innerHeight
      if (!ACTS[S.act].letterbox || w / h < 1.3) return 0
      return Math.max(0, (h - w / 2.39) / 2)
    }
    const apply = () => root.style.setProperty('--bar', `${bar.v.toFixed(1)}px`)
    const go = (immediate = false) =>
      gsap.to(bar, { v: target(), duration: immediate ? 0 : 1.8, ease: 'power3.inOut', onUpdate: apply, overwrite: true })
    go(true)
    const off = onActChange(() => go())
    const onResize = () => go(true)
    addEventListener('resize', onResize)
    return () => {
      off()
      removeEventListener('resize', onResize)
    }
  }, [])
  return (
    <div className="letterbox" aria-hidden>
      <i />
      <i />
    </div>
  )
}
