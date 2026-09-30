import { useEffect, useState } from 'react'
import { auto, onAutoChange, isAutoOn, setAuto } from '../core/scroll'

/** Автопросмотр: фильм идёт сам, пока зритель не листает. Кнопка — выключить совсем. */
export function AutoToggle() {
  const [, force] = useState(0)
  useEffect(() => onAutoChange(() => force((n) => n + 1)), [])
  const running = isAutoOn()
  const label = !auto.enabled ? 'Автопросмотр выключен' : running ? 'Автопросмотр' : 'Пауза — листаете вы'
  return (
    <button
      className="auto"
      data-on={auto.enabled}
      data-run={running}
      onClick={() => setAuto(!auto.enabled)}
      aria-pressed={auto.enabled}
      aria-label={auto.enabled ? 'Выключить автопросмотр' : 'Включить автопросмотр'}
    >
      <span className="ico" aria-hidden>
        {auto.enabled ? <i className="pause" /> : <i className="play" />}
      </span>
      {label}
    </button>
  )
}
