import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { onSceneReady, sceneReady, warmProgress } from '../core/Stage'
import { lenis, onTick } from '../core/scroll'
import { AudioManager } from '../audio/AudioManager'
import { S } from '../story/store'

/**
 * Первый экран. Звук браузер разрешит только после клика, поэтому путешествие
 * начинается кнопкой; пока она неактивна — греются шейдеры первой сцены.
 */
export function LoadingOverlay({ onStart }: { onStart: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0.08)
  const [ready, setReady] = useState(false)
  const [gone, setGone] = useState(false)
  const [hint, setHint] = useState(false)

  useEffect(() => {
    let fonts = false
    let scene = false
    const upd = () => {
      scene = sceneReady(0)
      // старт — когда пролог готов и шейдеры всех актов прогреты: дальше путь без подвисаний
      const w = warmProgress.v
      setProgress(0.06 + (fonts ? 0.1 : 0) + (scene ? 0.24 : 0) + w * 0.6)
      if (fonts && scene && w >= 1) setReady(true)
    }
    document.fonts.ready.then(() => {
      fonts = true
      upd()
    })
    const off = onSceneReady(upd)
    // ползём, пока грузится — чтобы кольцо не стояло
    const id = setInterval(() => setProgress((p) => (p < 0.97 ? p + 0.002 : p)), 120)
    upd()
    return () => {
      off()
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (window.__is) window.__is.start = (sound) => start(sound)
  })

  const start = (sound: boolean) => {
    if (!ready || S.started) return
    S.started = true
    AudioManager.unlock(sound)
    lenis?.start()
    gsap.to(root.current, {
      opacity: 0,
      duration: 2.2,
      ease: 'power3.inOut',
      onComplete: () => {
        setGone(true)
        if (window.__is) window.__is.ready = true
      },
    })
    onStart()
    setHint(true)
    // подсказка уходит, как только зритель начал листать — проверяем в тикере
    const off = onTick(() => {
      if (S.p > 0.004) {
        setHint(false)
        off()
      }
    })
  }

  const C = 2 * Math.PI * 84

  return (
    <>
      {!gone && (
        <div className="intro" ref={root}>
          <div className="inner">
            <span className="eyebrow">Неофициальная художественная интерпретация</span>
            <h1>Горизонт</h1>
            <p className="lede">
              Пыль, кольцо «Эндюранс», червоточина у Сатурна, волна на Миллер, Гаргантюа и библиотека
              времени — одна история, рассказанная прокруткой. Лучше в наушниках.
            </p>
            <button className="start" disabled={!ready} onClick={() => start(true)} aria-label="Начать путешествие со звуком">
              <svg viewBox="0 0 170 170" aria-hidden>
                <circle cx="85" cy="85" r="84" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
              </svg>
              {ready ? (
                <>
                  Нажмите,
                  <br />
                  чтобы начать
                  <br />
                  путешествие
                </>
              ) : (
                <>Прогрев шейдеров {Math.round(progress * 100)}%</>
              )}
            </button>
            <button className="mute" disabled={!ready} onClick={() => start(false)}>
              или без звука
            </button>
          </div>
          <div className="fine">Не связано с создателями фильма. Все модели, шейдеры, тексты и звук созданы для этого сайта.</div>
        </div>
      )}
      {hint && (
        <div className="hint">
          Прокручивайте — или просто смотрите
          <i />
        </div>
      )}
    </>
  )
}
