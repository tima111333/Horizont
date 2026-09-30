import { useEffect } from 'react'
import { S } from '../story/store'

/**
 * Глобальный трекер курсора: сырые координаты -1..1 и их сглаженная версия.
 * Сглаживание экспоненциальное от времени кадра, поэтому одинаково на 60 и 144 Гц.
 */
export function useMouseParallax() {
  useEffect(() => {
    const move = (x: number, y: number) => {
      S.pointer.px = x
      S.pointer.py = y
      S.pointer.x = (x / innerWidth - 0.5) * 2
      S.pointer.y = -(y / innerHeight - 0.5) * 2
      S.pointer.moved = true
    }
    const onMove = (e: PointerEvent) => move(e.clientX, e.clientY)
    addEventListener('pointermove', onMove, { passive: true })
    return () => removeEventListener('pointermove', onMove)
  }, [])
}

/** шаг сглаживания курсора — вызывается раз в кадр из тикера */
export function dampPointer(dt: number) {
  const k = 1 - Math.exp(-dt * 4.5)
  S.pointer.sx += (S.pointer.x - S.pointer.sx) * k
  S.pointer.sy += (S.pointer.y - S.pointer.sy) * k
}

/** параллакс для DOM-слоя: (clientX / innerWidth - 0.5) * intensity, со сглаживанием */
export const parallaxOffset = (intensity: number) => ({
  x: S.pointer.sx * 0.5 * intensity,
  y: -S.pointer.sy * 0.5 * intensity,
})
