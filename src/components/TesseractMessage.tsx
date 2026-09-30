import { useEffect, useRef } from 'react'
import { S } from '../story/store'
import { actIndex } from '../story/acts'
import { onTick } from '../core/scroll'
import { AudioManager } from '../audio/AudioManager'
import { fitText, onFit } from '../hooks/fitText'

export const MESSAGE = 'ЗДЕСЬ · СЕЙЧАС · ВСЕГДА'

const ABC = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
const MORSE: Record<string, string> = {
  А: '.-', Б: '-...', В: '.--', Г: '--.', Д: '-..', Е: '.', Ж: '...-', З: '--..', И: '..', Й: '.---',
  К: '-.-', Л: '.-..', М: '--', Н: '-.', О: '---', П: '.--.', Р: '.-.', С: '...', Т: '-', У: '..-',
  Ф: '..-.', Х: '....', Ц: '-.-.', Ч: '---.', Ш: '----', Щ: '--.-', Ъ: '--.--', Ы: '-.--', Ь: '-..-',
  Э: '..-..', Ю: '..--', Я: '.-.-',
}
// двоичный код — по кодовой странице 1251, как в старых терминалах
const bin = (ch: string) => {
  const i = ABC.indexOf(ch)
  return i < 0 ? '' : (0xc0 + i).toString(2)
}
const letters = [...MESSAGE].filter((c) => ABC.includes(c))
const TI = actIndex('tesseract')
const GLYPHS = '01·—.-'

/**
 * Послание в три этапа по прокрутке: морзе → двоичный код → текст по букве.
 * Каждая новая буква морзе звучит, если прокрутка идёт вперёд.
 */
export function TesseractMessage() {
  const root = useRef<HTMLDivElement>(null)
  const code = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let op = 0
    let lastN = 0
    let lastStage = ''
    const off = onTick((dt) => {
      const p = S.act === TI ? S.local[TI] : 0
      const on = p > 0.58 && p < 0.97
      op += ((on ? 1 : 0) - op) * (1 - Math.exp(-dt * 3))
      root.current!.style.opacity = op.toFixed(3)
      if (op < 0.01) return

      const n = letters.length
      const k = (a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)))
      const morseN = Math.round(k(0.6, 0.7) * n)
      const binN = Math.round(k(0.7, 0.78) * n)
      const textK = k(0.78, 0.9)

      let stage = 'morse'
      let line: string
      if (binN > 0 && textK === 0) {
        stage = 'bin'
        line = letters.slice(0, binN).map(bin).join(' ') + (binN < n ? ' ' + letters.slice(binN).map((c) => MORSE[c]).join(' ') : '')
      } else if (textK > 0) {
        stage = 'text'
        line = letters.map(bin).join(' ')
      } else {
        line = letters.slice(0, morseN).map((c) => MORSE[c]).join('  ')
        if (morseN > lastN) AudioManager.morse(MORSE[letters[morseN - 1]])
      }
      lastN = morseN
      if (line !== code.current!.dataset.v || stage !== lastStage) {
        code.current!.dataset.v = line
        code.current!.textContent = line.replace(/-/g, '—').replace(/\./g, '·')
        lastStage = stage
      }

      // текст: буквы проявляются по одной, ещё не пришедшие мерцают глифами
      const shown = textK * MESSAGE.length
      let html = ''
      for (let i = 0; i < MESSAGE.length; i++) {
        const ch = MESSAGE[i]
        if (i < shown - 1 || ch === ' ' || ch === '·') html += i < shown ? ch : ch === ' ' ? ' ' : ' '
        else if (i < shown) html += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        else html += ' '
      }
      if (text.current!.textContent !== html) text.current!.textContent = html
    })
    const offFit = onFit(() => fitText(text.current!, root.current!.clientWidth, MESSAGE))
    return () => {
      off()
      offFit()
    }
  }, [])

  return (
    <div className="message" ref={root} aria-live="polite">
      <div className="code" ref={code} />
      <div className="text" ref={text} aria-label={MESSAGE} />
    </div>
  )
}
