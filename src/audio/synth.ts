// Кирпичики процедурного звука на Web Audio. Всё генерируется на лету:
// шумы, орган, гул, помехи, тиканье. Никаких сэмплов.

export type Ctx = AudioContext

const bufCache = new WeakMap<Ctx, Record<string, AudioBuffer>>()

/** петли шума: белый, розовый (Voss–McCartney) и коричневый */
export function noiseBuffer(ctx: Ctx, kind: 'white' | 'pink' | 'brown', seconds = 6) {
  let c = bufCache.get(ctx)
  if (!c) bufCache.set(ctx, (c = {}))
  if (c[kind]) return c[kind]
  const n = Math.floor(ctx.sampleRate * seconds)
  const b = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1
      if (kind === 'white') d[i] = w * 0.5
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.969 * b2 + w * 0.153852
        b3 = 0.8665 * b3 + w * 0.3104856
        b4 = 0.55 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.016898
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
        b6 = w * 0.115926
      } else {
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      }
    }
    // сшиваем петлю, чтобы не щёлкало на стыке
    const fade = Math.floor(ctx.sampleRate * 0.05)
    for (let i = 0; i < fade; i++) {
      const k = i / fade
      d[n - fade + i] = d[n - fade + i] * (1 - k) + d[i] * k
    }
  }
  c[kind] = b
  return b
}

export function noise(ctx: Ctx, kind: 'white' | 'pink' | 'brown') {
  const s = ctx.createBufferSource()
  s.buffer = noiseBuffer(ctx, kind)
  s.loop = true
  s.loopStart = 0.05
  s.start(ctx.currentTime, Math.random() * 4)
  return s
}

/** синтетический импульс зала: экспоненциально затухающий шум, стерео */
export function impulse(ctx: Ctx, seconds = 4, decay = 2.6) {
  const n = Math.floor(ctx.sampleRate * seconds)
  const b = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < n; i++) {
      const t = i / n
      // верха в хвосте гаснут быстрее — как в настоящем зале
      const w = Math.random() * 2 - 1
      lp += (w - lp) * (0.6 - 0.5 * t)
      d[i] = lp * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1)
    }
  }
  return b
}

export const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

/** медленный случайный LFO на AudioParam: гладкие «порывы» без периодичности */
export function wander(ctx: Ctx, param: AudioParam, base: number, depth: number, rate: number) {
  let alive = true
  const step = () => {
    if (!alive) return
    const dur = (0.6 + Math.random() * 1.4) / rate
    const v = base + (Math.random() * 2 - 1) * depth
    param.cancelScheduledValues(ctx.currentTime)
    param.setTargetAtTime(v, ctx.currentTime, dur / 3)
    setTimeout(step, dur * 1000)
  }
  step()
  return () => {
    alive = false
  }
}

/**
 * Органный голос: сумма синусов по «регистрам» (8', 4', 2 2/3', 2', 1 3/5', 1'),
 * лёгкая расстройка двух трубок на ноту — хоровой эффект, мягкая атака трубы.
 */
export class Organ {
  out: GainNode
  private voices: { oscs: OscillatorNode[]; g: GainNode }[] = []
  private filter: BiquadFilterNode
  constructor(private ctx: Ctx, public stops = [1, 0.55, 0.28, 0.32, 0.12, 0.1], bright = 2400) {
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = bright
    this.filter.Q.value = 0.3
    this.filter.connect(this.out)
  }
  get brightness() {
    return this.filter.frequency
  }
  /** сменить аккорд: старые ноты уходят, новые вступают, всё плавно */
  chord(notes: number[], attack = 2.5, release = 3) {
    const t = this.ctx.currentTime
    for (const v of this.voices) {
      v.g.gain.cancelScheduledValues(t)
      v.g.gain.setTargetAtTime(0, t, release / 4)
      v.oscs.forEach((o) => o.stop(t + release * 1.6))
    }
    this.voices = notes.map((m) => {
      const g = this.ctx.createGain()
      g.gain.value = 0
      g.gain.setTargetAtTime(1 / Math.sqrt(notes.length) / 3, t, attack / 4)
      g.connect(this.filter)
      const f0 = midi(m)
      const harm = [1, 2, 3, 4, 5, 8]
      const oscs: OscillatorNode[] = []
      harm.forEach((h, i) => {
        if (!this.stops[i]) return
        for (const det of [-2.5, 2.5]) {
          const o = this.ctx.createOscillator()
          o.frequency.value = f0 * h
          o.detune.value = det + (Math.random() - 0.5) * 2
          const hg = this.ctx.createGain()
          hg.gain.value = this.stops[i] * 0.5
          o.connect(hg).connect(g)
          o.start(t)
          oscs.push(o)
        }
      })
      return { oscs, g }
    })
  }
  stop(release = 3) {
    this.chord([], 0.1, release)
  }
}

/** одиночный щелчок часов: сухой стук корпуса + металлический отзвук */
export function tick(ctx: Ctx, dest: AudioNode, gain = 0.3, when = ctx.currentTime) {
  const s = ctx.createBufferSource()
  s.buffer = noiseBuffer(ctx, 'white')
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 3200
  bp.Q.value = 4
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(gain, when + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05)
  s.connect(bp).connect(g).connect(dest)
  s.start(when, Math.random() * 3, 0.08)
  const o = ctx.createOscillator()
  o.frequency.value = 1850
  const og = ctx.createGain()
  og.gain.setValueAtTime(gain * 0.12, when)
  og.gain.exponentialRampToValueAtTime(0.0001, when + 0.12)
  o.connect(og).connect(dest)
  o.start(when)
  o.stop(when + 0.15)
}

/** короткий тон с огибающей — для отсчёта, морзе и квиндар-тонов */
export function beep(ctx: Ctx, dest: AudioNode, f: number, dur: number, gain = 0.15, when = ctx.currentTime, type: OscillatorType = 'sine') {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = f
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(gain, when + 0.008)
  g.gain.setValueAtTime(gain, when + Math.max(0.01, dur - 0.02))
  g.gain.linearRampToValueAtTime(0, when + dur)
  o.connect(g).connect(dest)
  o.start(when)
  o.stop(when + dur + 0.02)
}

/** глухой удар: книга о пол, сцепка стыковочного узла */
export function thump(ctx: Ctx, dest: AudioNode, gain = 0.5, f = 70, when = ctx.currentTime) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(f * 1.8, when)
  o.frequency.exponentialRampToValueAtTime(f, when + 0.08)
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, when)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.6)
  o.connect(g).connect(dest)
  o.start(when)
  o.stop(when + 0.7)
  const s = ctx.createBufferSource()
  s.buffer = noiseBuffer(ctx, 'pink')
  const lp = ctx.createBiquadFilter()
  lp.frequency.value = 900
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(gain * 0.6, when)
  ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.25)
  s.connect(lp).connect(ng).connect(dest)
  s.start(when, Math.random() * 3, 0.3)
}

/** мягкая сатурация — чтобы инфранизкий гул был слышен на ноутбучных динамиках */
export function shaper(ctx: Ctx, amount = 2.5) {
  const w = ctx.createWaveShaper()
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount)
  }
  w.curve = curve
  w.oversample = '2x'
  return w
}
