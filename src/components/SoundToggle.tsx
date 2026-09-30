import { useEffect, useState } from 'react'
import { AudioManager } from '../audio/AudioManager'

export function SoundToggle() {
  const [on, setOn] = useState(!AudioManager.muted)
  useEffect(() => AudioManager.onMute((m) => setOn(!m)), [])
  return (
    <button
      className="sound"
      data-on={on}
      onClick={() => {
        if (!AudioManager.ctx) AudioManager.unlock(true)
        else AudioManager.toggle()
      }}
      aria-pressed={on}
      aria-label={on ? 'Выключить звук' : 'Включить звук'}
    >
      <span className="eq" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
      {on ? 'Звук включён' : 'Звук выключен'}
    </button>
  )
}
