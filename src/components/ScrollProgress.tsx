import { useEffect, useRef, useState } from 'react'
import { ACTS } from '../story/acts'
import { S, onActChange } from '../story/store'
import { jumpToAct, onTick } from '../core/scroll'
import { AudioManager } from '../audio/AudioManager'

/** Вертикальная шкала глав справа + номер и название акта слева вверху */
export function ScrollProgress() {
  const fill = useRef<HTMLDivElement>(null)
  const [act, setAct] = useState(0)

  useEffect(() => {
    const off1 = onActChange(() => setAct(S.act))
    const off2 = onTick(() => {
      if (fill.current) fill.current.style.height = `${(S.p * 100).toFixed(2)}%`
    })
    return () => {
      off1()
      off2()
    }
  }, [])

  const a = ACTS[act]
  return (
    <>
      <div className="hud-act" aria-live="polite">
        <span>
          <b>{a.num}</b> / 07
        </span>
        <span>{a.title}</span>
        <span>{a.subtitle}</span>
      </div>
      <nav className="progress" aria-label="Акты">
        <div className="rail">
          <div className="fill" ref={fill} />
        </div>
        {ACTS.map((x, i) => (
          <button
            key={x.id}
            data-on={i === act}
            onClick={() => {
              AudioManager.blip(900 + i * 80)
              jumpToAct(i)
            }}
            aria-current={i === act ? 'step' : undefined}
            aria-label={`${x.num}. ${x.title}`}
          >
            <span className="t">
              {x.num} · {x.title}
            </span>
            <span className="dot" />
          </button>
        ))}
      </nav>
    </>
  )
}
