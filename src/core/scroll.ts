// Прокрутка: Lenis + ScrollTrigger дают целевой прогресс, поверх него — пружина,
// чтобы движение камеры не рвалось на щелчках колеса. Если зритель не листает,
// фильм идёт сам (автопросмотр) — ровно, с разгоном и торможением.
//
// Документ сам не прокручивается: Lenis крутит отдельный невидимый слой.
// Иначе при нативной прокрутке компоновщик Chrome на тяжёлых кадрах сдвигает
// fixed-слои и сверху мелькает чёрная полоса — на светлом Миллере это видно.
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { S, setProgress, isLow } from '../story/store'
import { dampPointer } from '../hooks/useMouseParallax'
import { ACTS } from '../story/acts'

gsap.registerPlugin(ScrollTrigger)

export let lenis: Lenis | null = null
const frameHooks = new Set<(dt: number) => void>()
export const onTick = (f: (dt: number) => void) => {
  frameHooks.add(f)
  return () => {
    frameHooks.delete(f)
  }
}

/** автопросмотр: включён ли вообще и когда зритель последний раз листал сам */
export const auto = {
  enabled: true,
  /** сколько секунд тишины после ручной прокрутки, прежде чем фильм пойдёт дальше сам */
  idle: 3.5,
  /** базовый темп, экранов в секунду: весь фильм ~4 минуты */
  pace: 1 / 8.3,
  /** текущая скорость автопросмотра 0..1 от темпа — для индикатора */
  k: 0,
  lastInput: -1e9,
}
const autoHooks = new Set<() => void>()
export const onAutoChange = (f: () => void) => {
  autoHooks.add(f)
  return () => {
    autoHooks.delete(f)
  }
}
export function setAuto(on: boolean) {
  auto.enabled = on
  auto.lastInput = on ? -1e9 : auto.lastInput
  autoHooks.forEach((f) => f())
}

/** зажатая стрелка: направление, момент нажатия и текущая скорость (экранов/с) */
const hold = { dir: 0, since: 0, v: 0, on: false }

// пружина прогресса: критическое затухание, ~0,35 с на успокоение
const spring = { x: 0, v: 0, w: 9 }
let snap = true

export function initScroll(wrapper: HTMLElement, track: HTMLElement) {
  history.scrollRestoration = 'manual'
  lenis = new Lenis({
    wrapper,
    content: track,
    eventsTarget: window,
    lerp: isLow ? 0.1 : 0.08,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4,
    smoothWheel: true,
    syncTouch: true,
    syncTouchLerp: 0.08,
    autoRaf: false,
  })
  lenis.stop()
  lenis.on('scroll', ScrollTrigger.update)
  ScrollTrigger.defaults({ scroller: wrapper })

  let target = 0
  const st = ScrollTrigger.create({
    trigger: track,
    scroller: wrapper,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      target = self.progress
    },
  })

  // ручной ввод останавливает автопросмотр; клавиатуру ведём сами — документ не прокручивается
  const touch = () => {
    auto.lastInput = S.time
  }
  // клавиши: стрелка — плавный шаг с разгоном и торможением; зажатая — ровное «течение»
  // с мягким стартом, как у автопросмотра, а не очередь рывков автоповтора
  const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  const keyStep = (dy: number, duration: number) =>
    lenis!.scrollTo(Math.min(lenis!.limit, Math.max(0, lenis!.animatedScroll + dy)), { duration, easing: easeInOut })
  const onKey = (e: KeyboardEvent) => {
    if (!lenis || !S.started) return
    const tag = (e.target as HTMLElement)?.tagName
    if (e.key === ' ' && (tag === 'BUTTON' || tag === 'A')) return
    const h = innerHeight
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const dir = e.key === 'ArrowDown' ? 1 : -1
      if (!e.repeat) {
        hold.dir = dir
        hold.since = S.time
        keyStep(dir * h * 0.3, 1.4)
      }
    } else if (e.key === 'PageDown' || e.key === 'PageUp' || e.key === ' ') {
      if (!e.repeat) keyStep((e.key === 'PageUp' || (e.key === ' ' && e.shiftKey) ? -1 : 1) * h * 0.8, 2.2)
    } else if (e.key === 'Home') lenis.scrollTo(0, { duration: 3, easing: easeInOut })
    else if (e.key === 'End') lenis.scrollTo(lenis.limit, { duration: 3, easing: easeInOut })
    else return
    e.preventDefault()
    touch()
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if ((e.key === 'ArrowDown' && hold.dir > 0) || (e.key === 'ArrowUp' && hold.dir < 0)) hold.dir = 0
  }
  addEventListener('keyup', onKeyUp)
  addEventListener('blur', () => (hold.dir = 0))
  addEventListener('wheel', touch, { passive: true })
  addEventListener('touchstart', touch, { passive: true })
  addEventListener('touchmove', touch, { passive: true })
  addEventListener('keydown', onKey)

  let autoV = 0
  let autoOn = false
  const tick = (time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs / 1000, 0.1)
    S.time += dt

    // автопросмотр: после паузы во вводе плавно разгоняемся до темпа фильма
    const l = lenis!
    const end = ACTS[ACTS.length - 1]
    const atEnd = target > end.start + (end.end - end.start) * 0.93
    const want = auto.enabled && S.started && !atEnd && S.time - auto.lastInput > auto.idle && !l.isStopped
    let pace = 0
    if (want) {
      // в склейках быстрее — нечего задерживаться в темноте; пока висит подпись — чуть медленнее
      const a = ACTS[S.act]
      const loc = S.local[S.act]
      const reading = a.captions.some((c) => loc > c.from - 0.02 && loc < c.to && c.kind !== 'title')
      pace = auto.pace * (S.dip > 0.25 ? 1.8 : reading ? 0.85 : 1)
    }
    // ручной ввод — сразу отдаём управление, без борьбы с колесом
    if (S.time - auto.lastInput < 0.05) autoV = 0
    autoV += (pace - autoV) * (1 - Math.exp(-dt * 0.9))
    if (autoV > 1e-4 && want) {
      const y = Math.min(l.limit, l.animatedScroll + autoV * innerHeight * dt)
      l.scrollTo(y, { immediate: true, force: true })
    }
    const k = auto.pace > 0 ? autoV / auto.pace : 0
    auto.k = k
    if (k > 0.3 !== autoOn) {
      autoOn = k > 0.3
      autoHooks.forEach((f) => f())
    }

    // зажатая стрелка: после короткого шага переходим в ровное течение ~0,45 экрана/с
    const holding = hold.dir !== 0 && S.time - hold.since > 0.5
    // подхватываем скорость шага, чтобы переход в течение был без провала
    if (holding && !hold.on && dt > 0) hold.v = (l.velocity || 0) / dt / innerHeight
    hold.on = holding
    hold.v += ((holding ? hold.dir * 0.45 : 0) - hold.v) * (1 - Math.exp(-dt * 3))
    if (Math.abs(hold.v) > 0.002) {
      auto.lastInput = S.time
      if (holding || !l.isScrolling) l.scrollTo(Math.min(l.limit, Math.max(0, l.animatedScroll + hold.v * innerHeight * dt)), { immediate: true, force: true })
    }

    l.raf(time * 1000)

    // пружина поверх Lenis: щелчок колеса начинается мягко, а не рывком
    if (snap) {
      spring.x = target
      spring.v = 0
      snap = false
    } else {
      const w = spring.w
      // полуявный Эйлер с подшагами — устойчив при провалах кадра
      const n = dt > 0.02 ? 3 : 1
      const h = dt / n
      for (let i = 0; i < n; i++) {
        spring.v += (w * w * (target - spring.x) - 2 * w * spring.v) * h
        spring.x += spring.v * h
      }
    }
    setProgress(Math.min(1, Math.max(0, spring.x)))

    // скорость в экранах в секунду → примерно 0..1
    const total = l.limit / Math.max(1, innerHeight)
    const v = spring.v * total
    S.vel = v
    const kk = 1 - Math.exp(-dt * 3)
    S.speed += (Math.min(1, Math.abs(v) * 0.6) - S.speed) * kk
    dampPointer(dt)
    frameHooks.forEach((f) => f(dt))
  }
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)

  return () => {
    gsap.ticker.remove(tick)
    removeEventListener('wheel', touch)
    removeEventListener('touchstart', touch)
    removeEventListener('touchmove', touch)
    removeEventListener('keydown', onKey)
    removeEventListener('keyup', onKeyUp)
    st.kill()
    lenis?.destroy()
    lenis = null
  }
}

export const isAutoOn = () => auto.k > 0.3

/** y в пикселях для глобального прогресса p */
export const yFor = (p: number) => p * (lenis?.limit ?? 0)

/** мгновенно — для отладки и стенда */
export function seek(p: number) {
  lenis?.scrollTo(yFor(p), { immediate: true, force: true })
  ScrollTrigger.update()
  snap = true
}

/** переход к акту: через склейку, чтобы не пролетать все сцены подряд */
export function jumpToAct(i: number, onMid?: () => void) {
  const a = ACTS[i]
  const p = a.start + (a.end - a.start) * 0.12
  const far = Math.abs(i - S.act) > 1
  auto.lastInput = S.time
  if (!far) {
    lenis?.scrollTo(yFor(p), { duration: 2.2, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) })
    return
  }
  const veil = document.querySelector<HTMLElement>('.veil')
  gsap.to(veil, {
    opacity: 1,
    duration: 0.7,
    ease: 'power3.inOut',
    onComplete: () => {
      seek(p)
      onMid?.()
      auto.lastInput = S.time
      gsap.to(veil, { opacity: 0, duration: 1.1, delay: 0.35, ease: 'power3.inOut' })
    },
  })
}
