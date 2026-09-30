// Общее изменяемое состояние. Намеренно не React-state: его читают useFrame и
// тикер GSAP шестьдесят раз в секунду, перерисовка React тут не нужна.
import { ACTS, DIP, actAt } from './acts'

type Listener = () => void

export const S = {
  /** сглаженный Lenis прогресс всей страницы 0..1 */
  p: 0,
  /** скорость прокрутки, нормированная примерно к 0..1 (со знаком) */
  vel: 0,
  /** модуль скорости, сглаженный — для звука и «полёта» */
  speed: 0,
  /** индекс акта, который сейчас рисуется */
  act: 0,
  /** локальный прогресс каждого акта 0..1 */
  local: new Float32Array(ACTS.length),
  /** глубина склейки 0..1 и её цвет */
  dip: 0,
  dipColor: [0, 0, 0] as [number, number, number],
  /** курсор: сырой и сглаженный, -1..1, y вверх */
  pointer: { x: 0, y: 0, sx: 0, sy: 0, px: 0, py: 0, moved: false },
  /** курсор над интерактивным 3D-объектом */
  hover3d: false,
  started: false,
  time: 0,
}

const listeners = new Set<Listener>()
export const onActChange = (fn: Listener) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** пересчёт производных величин по новому прогрессу — вызывается из тикера */
export function setProgress(p: number) {
  S.p = p
  for (let i = 0; i < ACTS.length; i++) {
    const a = ACTS[i]
    S.local[i] = Math.min(1, Math.max(0, (p - a.start) / (a.end - a.start)))
  }
  const act = actAt(p)
  // склейка: на границе акт уходит в цвет dipOut и выходит из него следующий
  let dip = 0
  let col = ACTS[act].dipOut
  for (let i = 0; i < ACTS.length - 1; i++) {
    const b = ACTS[i].end
    const d = 1 - smooth(0, DIP, Math.abs(p - b))
    if (d > dip) {
      dip = d
      col = ACTS[i].dipOut
    }
  }
  // вход в первый акт из темноты и уход последнего — не нужны: там титры
  S.dip = dip
  S.dipColor = col
  if (act !== S.act) {
    S.act = act
    listeners.forEach((f) => f())
  }
}

export const isLow = (() => {
  const q = new URLSearchParams(location.search)
  if (q.has('mobile') || q.get('q') === 'low') return true
  if (q.get('q') === 'high') return false
  const coarse = matchMedia('(pointer: coarse)').matches
  return coarse || Math.min(innerWidth, innerHeight) < 600
})()

export const isDebug = new URLSearchParams(location.search).has('debug')
