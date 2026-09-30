import { useEffect, useRef } from 'react'
import { S } from '../story/store'
import { actIndex } from '../story/acts'
import { onTick } from '../core/scroll'

// час на поверхности = 7 земных лет
const RATIO = (7 * 365.25 * 24 * 3600) / 3600
const MI = actIndex('miller')

const pad = (n: number, l = 2) => String(Math.floor(n)).padStart(l, '0')

/**
 * Два счётчика: время на планете и на Земле. Прокрутка акта — примерно
 * час с четвертью на поверхности; реальное время тоже идёт, так что даже
 * стоя на месте видно, как земные дни улетают сотнями.
 */
export function MillerClock() {
  const root = useRef<HTMLDivElement>(null)
  const here = useRef<HTMLDivElement>(null)
  const earth = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let real = 0
    let op = 0
    const off = onTick((dt) => {
      const on = S.act === MI && S.local[MI] > 0.06 && S.local[MI] < 0.96
      op += ((on ? 1 : 0) - op) * (1 - Math.exp(-dt * 3))
      root.current!.style.opacity = op.toFixed(3)
      if (op < 0.01) return
      if (S.act === MI) real += dt
      const secs = S.local[MI] * 4500 + real
      here.current!.textContent = `${pad(secs / 3600)}:${pad((secs / 60) % 60)}:${pad(secs % 60)}`
      const e = secs * RATIO
      const years = e / (365.25 * 86400)
      const days = (e % (365.25 * 86400)) / 86400
      const hours = (e % 86400) / 3600
      earth.current!.textContent = `${pad(years, 1)} г ${pad(days, 3)} д ${pad(hours)} ч`
    })
    return () => {
      off()
    }
  }, [])

  return (
    <div className="clock" ref={root} aria-hidden>
      <div className="row">
        <span className="k">Здесь</span>
        <span className="v" ref={here}>
          00:00:00
        </span>
      </div>
      <div className="row">
        <span className="k">На Земле · ×61 362</span>
        <span className="v earth" ref={earth}>
          0 г 000 д 00 ч
        </span>
      </div>
    </div>
  )
}
