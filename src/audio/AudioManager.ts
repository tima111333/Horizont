// Единый звуковой менеджер. Howler владеет AudioContext и мастер-громкостью,
// поверх него — слои актов: процедурный синтез + (по желанию) ваши файлы.
//
// ─── КАК ПОДКЛЮЧИТЬ СВОИ ФАЙЛЫ ─────────────────────────────────────────────
// 1. Положите .mp3/.ogg в /public/audio/ (например ambient-earth.mp3).
// 2. Впишите их в /public/audio/manifest.json:
//      { "files": { "earth": ["ambient-earth.ogg", "ambient-earth.mp3"],
//                   "earth-laughter": ["laughter.mp3"] } }
//    Ключи — id актов (earth, shelf, launch, wormhole, miller, gargantua,
//    tesseract, epilogue) и одиночные события (earth-laughter).
// 3. Файл акта играет петлёй и кроссфейдится вместе с актом; синтез того же
//    акта при этом приглушается до SYNTH_UNDER_FILE, чтобы не спорить с файлом.
// Что искать: freesound.org / pixabay.com/music, лицензия CC0 или Pixabay
// Content License. Подсказки по каждому слою — в public/audio/README.md.
// ────────────────────────────────────────────────────────────────────────────
import { Howl, Howler } from 'howler'
import { S } from '../story/store'
import { ACTS, type ActId } from '../story/acts'
import { Organ, beep, impulse, midi, noise, noiseBuffer, shaper, thump, tick, wander, type Ctx } from './synth'

const FADE = 1.8
const SYNTH_UNDER_FILE = 0.35
const MASTER = 0.62

interface Layer {
  gain: GainNode
  start(): void
  stop(): void
  update?(p: number, dt: number): void
}

type Bus = { dry: AudioNode; verb: AudioNode }

// ─── слои актов ──────────────────────────────────────────────────────────────

/** Пролог: ветер порывами, скрип дома, далёкий свист в щелях */
function earthLayer(ctx: Ctx, bus: Bus): Layer {
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(bus.dry)
  let nodes: AudioScheduledSourceNode[] = []
  let stops: (() => void)[] = []
  let timer = 0
  const creak = () => {
    const t = ctx.currentTime
    const s = ctx.createBufferSource()
    s.buffer = noiseBuffer(ctx, 'white')
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 18
    const f = 280 + Math.random() * 320
    bp.frequency.setValueAtTime(f, t)
    bp.frequency.linearRampToValueAtTime(f * (1.3 + Math.random() * 0.5), t + 0.9)
    const g = ctx.createGain()
    const d = 0.5 + Math.random() * 0.9
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.5, t + 0.12)
    g.gain.setTargetAtTime(0, t + d * 0.6, d * 0.2)
    // скрип — это прерывистое трение: частая амплитудная модуляция
    const am = ctx.createOscillator()
    am.frequency.value = 22 + Math.random() * 18
    const amg = ctx.createGain()
    amg.gain.value = 0.5
    const amBias = ctx.createGain()
    am.connect(amg).connect(amBias.gain)
    s.connect(bp).connect(amBias).connect(g).connect(bus.verb)
    g.connect(gain)
    s.start(t)
    am.start(t)
    s.stop(t + d + 0.5)
    am.stop(t + d + 0.5)
    timer = window.setTimeout(creak, 5000 + Math.random() * 7000)
  }
  return {
    gain,
    start() {
      // два полосовых ветра, разведённых по панораме
      for (const pan of [-0.6, 0.6]) {
        const n = noise(ctx, 'pink')
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.Q.value = 0.8
        const g = ctx.createGain()
        g.gain.value = 0.3
        const p = ctx.createStereoPanner()
        p.pan.value = pan
        n.connect(bp).connect(g).connect(p).connect(gain)
        stops.push(wander(ctx, bp.frequency, 520, 320, 0.25))
        stops.push(wander(ctx, g.gain, 0.32, 0.24, 0.35))
        nodes.push(n)
      }
      // низ ветра — давление
      const b = noise(ctx, 'brown')
      const lp = ctx.createBiquadFilter()
      lp.frequency.value = 180
      const bg = ctx.createGain()
      bg.gain.value = 0.35
      b.connect(lp).connect(bg).connect(gain)
      nodes.push(b)
      // свист в щелях — узкая полоса высоко
      const w = noise(ctx, 'white')
      const wbp = ctx.createBiquadFilter()
      wbp.type = 'bandpass'
      wbp.Q.value = 30
      const wg = ctx.createGain()
      wg.gain.value = 0.05
      w.connect(wbp).connect(wg).connect(gain)
      stops.push(wander(ctx, wbp.frequency, 1500, 500, 0.15))
      stops.push(wander(ctx, wg.gain, 0.04, 0.035, 0.2))
      nodes.push(w)
      timer = window.setTimeout(creak, 2500)
    },
    stop() {
      nodes.forEach((n) => n.stop(ctx.currentTime + 0.1))
      stops.forEach((f) => f())
      nodes = []
      stops = []
      clearTimeout(timer)
    },
  }
}

/** Комната: глухой ветер за стеклом, тишина дома, шорох сыплющейся пыли */
function shelfLayer(ctx: Ctx, bus: Bus): Layer {
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(bus.dry)
  let nodes: AudioScheduledSourceNode[] = []
  let stops: (() => void)[] = []
  let dustG: GainNode | null = null
  let organ: Organ | null = null
  let fell = false
  return {
    gain,
    start() {
      const n = noise(ctx, 'pink')
      const lp = ctx.createBiquadFilter()
      lp.frequency.value = 380
      const g = ctx.createGain()
      g.gain.value = 0.35
      n.connect(lp).connect(g).connect(gain)
      stops.push(wander(ctx, g.gain, 0.3, 0.2, 0.3))
      const d = noise(ctx, 'white')
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 4200
      dustG = ctx.createGain()
      dustG.gain.value = 0
      d.connect(hp).connect(dustG).connect(gain)
      nodes.push(n, d)
      organ = new Organ(ctx, [1, 0.4, 0, 0.2, 0, 0], 1400)
      organ.out.connect(bus.verb)
      organ.out.gain.value = 0.25
      organ.chord([45, 52, 57, 60], 5)
      fell = false
    },
    update(p) {
      if (dustG) dustG.gain.setTargetAtTime(p > 0.62 && p < 0.95 ? 0.06 : 0, ctx.currentTime, 0.4)
      if (!fell && p > 0.44) {
        fell = true
        thump(ctx, bus.verb, 0.55, 62)
      }
      if (p < 0.3) fell = false
    },
    stop() {
      nodes.forEach((n) => n.stop(ctx.currentTime + 0.1))
      stops.forEach((f) => f())
      organ?.stop(2)
      nodes = []
      stops = []
    },
  }
}

/** Старт: рёв двигателей, отсчёт, радиопереговоры с квиндар-тонами, гул кольца */
function launchLayer(ctx: Ctx, bus: Bus): Layer {
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(bus.dry)
  let nodes: AudioScheduledSourceNode[] = []
  let roar: GainNode | null = null
  let hum: GainNode | null = null
  let organ: Organ | null = null
  let timer = 0
  let lastCount = -1
  const radio = () => {
    // «фраза» из помех: сквелч, слоги-всплески узкой полосы, квиндар в начале и в конце
    const t0 = ctx.currentTime + 0.05
    const rg = ctx.createGain()
    rg.gain.value = 0.22
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.random() * 1.2 - 0.6
    rg.connect(pan).connect(gain)
    beep(ctx, rg, 2525, 0.25, 0.08, t0)
    let t = t0 + 0.32
    const n = 4 + Math.floor(Math.random() * 7)
    for (let i = 0; i < n; i++) {
      const s = ctx.createBufferSource()
      s.buffer = noiseBuffer(ctx, 'white')
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 900 + Math.random() * 1600
      bp.Q.value = 2.5
      const g = ctx.createGain()
      const d = 0.08 + Math.random() * 0.22
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.5, t + 0.02)
      g.gain.linearRampToValueAtTime(0, t + d)
      s.connect(bp).connect(g).connect(rg)
      s.start(t, Math.random() * 3, d + 0.05)
      t += d + Math.random() * 0.12
    }
    beep(ctx, rg, 2475, 0.25, 0.08, t + 0.05)
    timer = window.setTimeout(radio, 3500 + Math.random() * 5000)
  }
  return {
    gain,
    start() {
      const b = noise(ctx, 'brown')
      const lp = ctx.createBiquadFilter()
      lp.frequency.value = 260
      roar = ctx.createGain()
      roar.gain.value = 0
      const sh = shaper(ctx, 2)
      b.connect(lp).connect(sh).connect(roar).connect(gain)
      const sub = ctx.createOscillator()
      sub.frequency.value = 41
      const sg = ctx.createGain()
      sg.gain.value = 0.18
      sub.connect(sg).connect(roar)
      // электрический гул корабля
      hum = ctx.createGain()
      hum.gain.value = 0
      for (const f of [60, 120, 180.4]) {
        const o = ctx.createOscillator()
        o.frequency.value = f
        const g = ctx.createGain()
        g.gain.value = f === 60 ? 0.05 : 0.02
        o.connect(g).connect(hum)
        o.start()
        nodes.push(o)
      }
      hum.connect(gain)
      sub.start()
      nodes.push(b, sub)
      organ = new Organ(ctx, [1, 0.5, 0.2, 0.3, 0, 0.08], 1800)
      organ.out.connect(bus.verb)
      organ.out.gain.value = 0
      organ.chord([40, 47, 52, 55, 59], 6)
      timer = window.setTimeout(radio, 1800)
      lastCount = -1
    },
    update(p) {
      const t = ctx.currentTime
      // отсчёт: первые 12% акта — десять сигналов
      const c = Math.floor((p - 0.02) / 0.011)
      if (p < 0.14 && c >= 0 && c <= 9 && c !== lastCount) {
        lastCount = c
        beep(ctx, gain, c === 9 ? 1320 : 880, c === 9 ? 0.5 : 0.12, 0.12)
      }
      const r = p < 0.13 ? 0.15 : p < 0.22 ? 1.1 * (1 - (p - 0.13) / 0.09) : 0
      roar?.gain.setTargetAtTime(r, t, 0.3)
      hum?.gain.setTargetAtTime(p > 0.2 ? 0.5 : 0, t, 1)
      organ?.out.gain.setTargetAtTime(p > 0.6 ? 0.22 : p > 0.25 ? 0.1 : 0, t, 1.5)
    },
    stop() {
      nodes.forEach((n) => n.stop(ctx.currentTime + 0.1))
      organ?.stop(2)
      clearTimeout(timer)
      nodes = []
    },
  }
}

/** Червоточина: нарастающий гул и орган, в кульминации — тишина */
function wormholeLayer(ctx: Ctx, bus: Bus): Layer {
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(bus.dry)
  let nodes: AudioScheduledSourceNode[] = []
  let drone: GainNode | null = null
  let dlp: BiquadFilterNode | null = null
  let organ: Organ | null = null
  let air: GainNode | null = null
  let chordStep = -1
  const chords = [
    [45, 52, 57, 60, 64],
    [41, 48, 53, 57, 60],
    [43, 50, 55, 59, 62],
    [40, 47, 52, 56, 59, 64],
  ]
  return {
    gain,
    start() {
      drone = ctx.createGain()
      drone.gain.value = 0
      dlp = ctx.createBiquadFilter()
      dlp.frequency.value = 200
      dlp.Q.value = 2
      for (const [f, det] of [[55, 0], [55, 7], [82.4, -4], [110, 3]] as const) {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = f
        o.detune.value = det
        const g = ctx.createGain()
        g.gain.value = 0.08
        o.connect(g).connect(dlp)
        o.start()
        nodes.push(o)
      }
      dlp.connect(drone).connect(gain)
      const n = noise(ctx, 'pink')
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1200
      air = ctx.createGain()
      air.gain.value = 0
      n.connect(bp).connect(air).connect(bus.verb)
      nodes.push(n)
      organ = new Organ(ctx)
      organ.out.connect(bus.verb)
      organ.out.connect(gain)
      organ.out.gain.value = 0
      chordStep = -1
    },
    update(p) {
      const t = ctx.currentTime
      // кульминация — внутри горловины (≈0.62..0.74) всё смолкает
      const hush = p > 0.6 && p < 0.76 ? 1 - Math.min(1, (p - 0.6) / 0.03) * Math.min(1, (0.76 - p) / 0.03) : 1
      const rise = Math.min(1, p / 0.6)
      drone?.gain.setTargetAtTime((0.25 + rise * 0.9) * hush * (1 + S.speed), t, 0.25)
      dlp?.frequency.setTargetAtTime(160 + rise * rise * 2400 + S.speed * 1500, t, 0.3)
      air?.gain.setTargetAtTime(rise * 0.12 * hush, t, 0.4)
      organ?.out.gain.setTargetAtTime((p > 0.2 ? 0.14 + rise * 0.22 : 0) * (p > 0.6 ? (p > 0.76 ? 0.9 : 0) : 1), t, p > 0.6 && p < 0.76 ? 0.08 : 1.2)
      organ?.brightness.setTargetAtTime(900 + rise * 3000, t, 1)
      const step = Math.min(3, Math.floor(p * 5))
      if (step !== chordStep && organ) {
        chordStep = step
        organ.chord(chords[step], 3, 3)
      }
    },
    stop() {
      nodes.forEach((n) => n.stop(ctx.currentTime + 0.1))
      organ?.stop(2)
      nodes = []
    },
  }
}

/** Миллер: плеск мелкой воды, тиканье раз в 1,25 с, растущий рёв волны */
function millerLayer(ctx: Ctx, bus: Bus): Layer {
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(bus.dry)
  let nodes: AudioScheduledSourceNode[] = []
  let stops: (() => void)[] = []
  let roar: GainNode | null = null
  let next = 0
  let organ: Organ | null = null
  return {
    gain,
    start() {
      for (const pan of [-0.5, 0.5]) {
        const n = noise(ctx, 'pink')
        const lp = ctx.createBiquadFilter()
        lp.frequency.value = 900
        const g = ctx.createGain()
        g.gain.value = 0.1
        const pn = ctx.createStereoPanner()
        pn.pan.value = pan
        n.connect(lp).connect(g).connect(pn).connect(gain)
        stops.push(wander(ctx, g.gain, 0.12, 0.1, 1.2))
        stops.push(wander(ctx, lp.frequency, 900, 400, 0.8))
        nodes.push(n)
      }
      const b = noise(ctx, 'brown')
      const lp = ctx.createBiquadFilter()
      lp.frequency.value = 300
      roar = ctx.createGain()
      roar.gain.value = 0
      b.connect(lp).connect(shaper(ctx, 1.6)).connect(roar).connect(gain)
      nodes.push(b)
      organ = new Organ(ctx, [1, 0.3, 0, 0.25, 0, 0.1], 1500)
      organ.out.connect(bus.verb)
      organ.out.gain.value = 0.12
      organ.chord([38, 45, 50, 53, 57], 4)
      next = ctx.currentTime + 0.5
    },
    update(p) {
      const t = ctx.currentTime
      // тиканье: каждый щелчок — сутки на Земле
      while (next < t + 0.1) {
        tick(ctx, gain, 0.28, Math.max(next, t))
        next += 1.25
      }
      const w = Math.max(0, (p - 0.55) / 0.4)
      roar?.gain.setTargetAtTime(w * w * 1.2, t, 0.5)
      organ?.out.gain.setTargetAtTime(0.1 + w * 0.2, t, 1)
    },
    stop() {
      nodes.forEach((n) => n.stop(ctx.currentTime + 0.1))
      stops.forEach((f) => f())
      organ?.stop(2)
      nodes = []
      stops = []
    },
  }
}

/** Гаргантюа: давящий инфранизкий гул, осциллятор + фильтр, медленное дыхание */
function gargantuaLayer(ctx: Ctx, bus: Bus): Layer {
  const gain = ctx.createGain()
  gain.gain.value = 0
  // инфранизкий гул обманчиво громкий по энергии — общий подрез до уровня соседних актов
  const trim = ctx.createGain()
  trim.gain.value = 0.4
  gain.connect(trim).connect(bus.dry)
  let nodes: AudioScheduledSourceNode[] = []
  let stops: (() => void)[] = []
  let organ: Organ | null = null
  let press: GainNode | null = null
  return {
    gain,
    start() {
      const lp = ctx.createBiquadFilter()
      lp.frequency.value = 140
      lp.Q.value = 4
      press = ctx.createGain()
      press.gain.value = 0.2
      const sh = shaper(ctx, 3)
      for (const f of [30.87, 46.25, 61.74]) {
        const o = ctx.createOscillator()
        o.frequency.value = f
        const g = ctx.createGain()
        g.gain.value = f < 40 ? 0.22 : 0.1
        o.connect(g).connect(lp)
        o.start()
        nodes.push(o)
      }
      lp.connect(sh).connect(press).connect(gain)
      stops.push(wander(ctx, lp.frequency, 120, 60, 0.12))
      stops.push(wander(ctx, press.gain, 0.18, 0.06, 0.1))
      const b = noise(ctx, 'brown')
      const bl = ctx.createBiquadFilter()
      bl.frequency.value = 90
      const bg = ctx.createGain()
      bg.gain.value = 0.16
      b.connect(bl).connect(bg).connect(gain)
      nodes.push(b)
      organ = new Organ(ctx, [1, 0.6, 0.3, 0.3, 0.1, 0.1], 1200)
      organ.out.connect(bus.verb)
      organ.out.gain.value = 0
      organ.chord([33, 40, 45, 48, 52], 8)
    },
    update(p) {
      organ?.out.gain.setTargetAtTime(p > 0.25 ? 0.1 + p * 0.06 : 0.04, ctx.currentTime, 2)
      organ?.brightness.setTargetAtTime(700 + p * 1600, ctx.currentTime, 2)
    },
    stop() {
      nodes.forEach((n) => n.stop(ctx.currentTime + 0.1))
      stops.forEach((f) => f())
      organ?.stop(2)
      nodes = []
      stops = []
    },
  }
}

/** Тессеракт: стеклянное мерцание высоких гармоник, дрожание струн */
function tesseractLayer(ctx: Ctx, bus: Bus): Layer {
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(bus.dry)
  let nodes: AudioScheduledSourceNode[] = []
  let stops: (() => void)[] = []
  let string: GainNode | null = null
  let organ: Organ | null = null
  return {
    gain,
    start() {
      const notes = [69, 76, 81, 83, 88]
      notes.forEach((m, i) => {
        const o = ctx.createOscillator()
        o.frequency.value = midi(m)
        const g = ctx.createGain()
        g.gain.value = 0
        o.connect(g).connect(bus.verb)
        o.start()
        stops.push(wander(ctx, g.gain, 0.02, 0.02, 0.3 + i * 0.07))
        nodes.push(o)
      })
      // «струны времени»: низкий пиццикато-гул, дрожит от движения курсора
      string = ctx.createGain()
      string.gain.value = 0
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = midi(33)
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 5.5
      const lg = ctx.createGain()
      lg.gain.value = 3
      lfo.connect(lg).connect(o.detune)
      o.connect(string).connect(gain)
      o.start()
      lfo.start()
      nodes.push(o, lfo)
      organ = new Organ(ctx, [1, 0.5, 0.25, 0.3, 0.1, 0.15], 2600)
      organ.out.connect(bus.verb)
      organ.out.gain.value = 0.1
      organ.chord([45, 52, 57, 61, 64], 5)
    },
    update(p) {
      const move = Math.min(1, Math.hypot(S.pointer.x - S.pointer.sx, S.pointer.y - S.pointer.sy) * 3)
      string?.gain.setTargetAtTime(0.08 + move * 0.35, ctx.currentTime, 0.15)
      organ?.out.gain.setTargetAtTime(0.1 + p * 0.25, ctx.currentTime, 1.5)
    },
    stop() {
      nodes.forEach((n) => n.stop(ctx.currentTime + 0.1))
      stops.forEach((f) => f())
      organ?.stop(3)
      nodes = []
      stops = []
    },
  }
}

/** Эпилог: воздух станции и один длинный органный аккорд, уходящий в тишину */
function epilogueLayer(ctx: Ctx, bus: Bus): Layer {
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(bus.dry)
  let nodes: AudioScheduledSourceNode[] = []
  let organ: Organ | null = null
  let air: GainNode | null = null
  return {
    gain,
    start() {
      const n = noise(ctx, 'pink')
      const lp = ctx.createBiquadFilter()
      lp.frequency.value = 700
      air = ctx.createGain()
      air.gain.value = 0.12
      n.connect(lp).connect(air).connect(gain)
      nodes.push(n)
      organ = new Organ(ctx, [1, 0.55, 0.3, 0.35, 0.12, 0.12], 2200)
      organ.out.connect(bus.verb)
      organ.out.connect(gain)
      organ.out.gain.value = 0.2
      organ.chord([36, 43, 48, 52, 55, 60, 64], 6)
    },
    update(p) {
      // к титрам остаётся один аккорд, потом тишина
      const end = p > 0.75 ? Math.max(0, 1 - (p - 0.75) / 0.23) : 1
      organ?.out.gain.setTargetAtTime(0.2 * (0.6 + 0.4 * end) * (p > 0.97 ? 0 : 1), ctx.currentTime, 1.5)
      air?.gain.setTargetAtTime(0.12 * end, ctx.currentTime, 1)
    },
    stop() {
      nodes.forEach((n) => n.stop(ctx.currentTime + 0.1))
      organ?.stop(4)
      nodes = []
    },
  }
}

const FACTORY: Record<ActId, (ctx: Ctx, bus: Bus) => Layer> = {
  earth: earthLayer,
  shelf: shelfLayer,
  launch: launchLayer,
  wormhole: wormholeLayer,
  miller: millerLayer,
  gargantua: gargantuaLayer,
  tesseract: tesseractLayer,
  epilogue: epilogueLayer,
}

// ─── менеджер ────────────────────────────────────────────────────────────────

type Listener = (muted: boolean) => void

class AudioManagerImpl {
  ctx: AudioContext | null = null
  private master: GainNode | null = null
  private tone: BiquadFilterNode | null = null
  private bus: Bus | null = null
  private layers = new Map<ActId, Layer>()
  private live = new Set<ActId>()
  private stopTimers = new Map<ActId, number>()
  private files = new Map<string, Howl>()
  private act: ActId | null = null
  private listeners = new Set<Listener>()
  muted = true

  /** вызывать только из обработчика клика — политика автозапуска браузеров */
  async unlock(sound: boolean) {
    if (!this.ctx) {
      Howler.autoSuspend = false
      Howler.volume(1)
      this.ctx = Howler.ctx
      const ctx = this.ctx
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -16
      comp.ratio.value = 3
      comp.attack.value = 0.02
      comp.release.value = 0.4
      this.tone = ctx.createBiquadFilter()
      this.tone.type = 'lowpass'
      this.tone.frequency.value = 9000
      this.master = ctx.createGain()
      this.master.gain.value = 0
      const verb = ctx.createConvolver()
      verb.buffer = impulse(ctx, 4.5, 2.4)
      const verbIn = ctx.createGain()
      verbIn.gain.value = 0.9
      const dry = ctx.createGain()
      verbIn.connect(verb).connect(this.tone)
      dry.connect(this.tone)
      this.tone.connect(comp).connect(this.master).connect(Howler.masterGain)
      this.bus = { dry, verb: verbIn }
      // верб-посыл получает и сухой сигнал слоёв — немного, для общего пространства
      const send = ctx.createGain()
      send.gain.value = 0.25
      dry.connect(send).connect(verbIn)
      for (const a of ACTS) this.layers.set(a.id, FACTORY[a.id](ctx, this.bus))
      this.loadManifest()
      // для стенда: измерить уровень на мастер-шине
      ;(window as unknown as { __audio?: unknown }).__audio = { ctx, master: Howler.masterGain }
    }
    await this.ctx.resume()
    this.setMuted(!sound)
  }

  private async loadManifest() {
    try {
      const r = await fetch(import.meta.env.BASE_URL + 'audio/manifest.json', { cache: 'no-cache' })
      if (!r.ok) return
      const m = (await r.json()) as { files?: Record<string, string[]> }
      for (const [key, srcs] of Object.entries(m.files ?? {})) {
        if (!srcs?.length) continue
        const h = new Howl({
          src: srcs.map((s) => import.meta.env.BASE_URL + 'audio/' + s),
          loop: !key.includes('-'),
          volume: 0,
          preload: true,
          onloaderror: () => this.files.delete(key),
        })
        this.files.set(key, h)
      }
    } catch {
      /* манифеста нет — работаем на синтезе */
    }
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setTargetAtTime(m ? 0 : MASTER, t, 0.4)
    }
    this.listeners.forEach((f) => f(m))
  }
  toggle() {
    this.setMuted(!this.muted)
  }
  onMute(f: Listener) {
    this.listeners.add(f)
    return () => {
      this.listeners.delete(f)
    }
  }

  /** раз в кадр из тикера GSAP */
  update(dt: number) {
    const ctx = this.ctx
    if (!ctx || !this.tone) return
    const id = ACTS[S.act].id
    if (id !== this.act) this.crossfade(id)
    const t = ctx.currentTime
    // быстрая прокрутка открывает фильтр и чуть поднимает уровень
    this.tone.frequency.setTargetAtTime(7000 + S.speed * 11000, t, 0.2)
    // склейка между актами слегка приглушает всё — как затемнение
    const layer = this.layers.get(id)!
    const hasFile = this.files.has(id)
    layer.gain.gain.setTargetAtTime((hasFile ? SYNTH_UNDER_FILE : 1) * (1 - S.dip * 0.45) * (1 + S.speed * 0.25), t, 0.3)
    layer.update?.(S.local[S.act], dt)
  }

  private crossfade(id: ActId) {
    const ctx = this.ctx!
    const t = ctx.currentTime
    if (this.act) {
      const prev = this.act
      const l = this.layers.get(prev)!
      l.gain.gain.cancelScheduledValues(t)
      l.gain.gain.setValueAtTime(l.gain.gain.value, t)
      l.gain.gain.linearRampToValueAtTime(0, t + FADE)
      this.stopTimers.set(
        prev,
        window.setTimeout(() => {
          if (this.act !== prev && this.live.has(prev)) {
            l.stop()
            this.live.delete(prev)
          }
        }, FADE * 1000 + 200),
      )
      this.files.get(prev)?.fade(this.files.get(prev)!.volume(), 0, FADE * 1000)
    }
    this.act = id
    clearTimeout(this.stopTimers.get(id))
    const l = this.layers.get(id)!
    if (!this.live.has(id)) {
      l.start()
      this.live.add(id)
    }
    l.gain.gain.cancelScheduledValues(t)
    l.gain.gain.setValueAtTime(l.gain.gain.value, t)
    l.gain.gain.linearRampToValueAtTime(1, t + FADE)
    const f = this.files.get(id)
    if (f) {
      if (!f.playing()) f.play()
      f.fade(f.volume(), 0.8, FADE * 1000)
    }
    if (id === 'earth') this.oneShot('earth-laughter', 6000, 0.25)
  }

  private oneShot(key: string, delay: number, vol: number) {
    const h = this.files.get(key)
    if (!h) return
    setTimeout(() => {
      if (this.act === 'earth') {
        h.volume(vol)
        h.play()
      }
    }, delay)
  }

  // ─── одиночные звуки для интерфейса и сцен ────────────────────────────────
  morse(code: string, unit = 0.07) {
    if (!this.ctx || !this.bus || this.muted) return
    let t = this.ctx.currentTime + 0.05
    for (const ch of code) {
      if (ch === '.' || ch === '-') {
        const d = ch === '.' ? unit : unit * 3
        beep(this.ctx, this.bus.verb, 740, d, 0.06, t)
        t += d + unit
      } else t += unit * 3
    }
  }
  blip(f = 1200) {
    if (!this.ctx || !this.bus || this.muted) return
    beep(this.ctx, this.bus.dry, f, 0.05, 0.035)
  }
}

export const AudioManager = new AudioManagerImpl()
