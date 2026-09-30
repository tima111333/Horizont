import { useEffect, useRef } from 'react'
import { S } from '../story/store'
import { onTick } from '../core/scroll'

/**
 * Кольцо плавно (lerp 0.1 на кадр 60 Гц) догоняет указатель, точка — сразу.
 * Растёт над всем, что помечено [data-hover], кнопками, ссылками и над
 * интерактивными 3D-объектами (флаг S.hover3d ставит рейкастер сцены).
 */
export function CustomCursor() {
  const root = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (matchMedia('(pointer: coarse)').matches) {
      root.current!.style.display = 'none'
      return
    }
    document.body.classList.add('has-cursor')
    let x = innerWidth / 2
    let y = innerHeight / 2
    let domHover = false
    let visible = false
    const over = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      domHover = !!t.closest('a, button, [data-hover]')
    }
    const leave = () => {
      visible = false
      root.current!.style.opacity = '0'
    }
    addEventListener('pointerover', over, { passive: true })
    document.addEventListener('pointerleave', leave)
    const off = onTick((dt) => {
      const px = S.pointer.px
      const py = S.pointer.py
      if (!S.pointer.moved) return
      if (!visible) {
        visible = true
        root.current!.style.opacity = '1'
        x = px
        y = py
      }
      const k = 1 - Math.pow(0.9, dt * 60)
      x += (px - x) * k
      y += (py - y) * k
      ring.current!.style.transform = `translate3d(${x}px, ${y}px, 0)`
      dot.current!.style.transform = `translate3d(${px}px, ${py}px, 0)`
      root.current!.dataset.hover = String(domHover || S.hover3d)
    })
    return () => {
      off()
      removeEventListener('pointerover', over)
      document.removeEventListener('pointerleave', leave)
      document.body.classList.remove('has-cursor')
    }
  }, [])

  return (
    <div className="cursor" ref={root} style={{ opacity: 0 }} aria-hidden>
      <div className="ring-wrap" ref={ring} style={{ position: 'absolute' }}>
        <div className="ring" />
      </div>
      <div className="dot-wrap" ref={dot} style={{ position: 'absolute' }}>
        <div className="dot" />
      </div>
    </div>
  )
}
