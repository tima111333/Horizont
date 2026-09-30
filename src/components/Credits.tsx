import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { S } from '../story/store'
import { actIndex } from '../story/acts'
import { jumpToAct, onTick } from '../core/scroll'

// ссылка на репозиторий — подставьте свою
export const REPO_URL = 'https://github.com/tima111333/Horizont'

const EI = actIndex('epilogue')

export function Credits() {
  const root = useRef<HTMLDivElement>(null)
  const [about, setAbout] = useState(false)

  useEffect(() => {
    const el = root.current!
    const tl = gsap.timeline({ paused: true })
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power3.inOut' })
    tl.fromTo(
      el.querySelectorAll('.inner > *'),
      { opacity: 0, y: 24, filter: 'blur(8px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, stagger: 0.06, ease: 'power3.out' },
      0.05,
    )
    const off = onTick(() => {
      const p = S.act === EI ? S.local[EI] : 0
      tl.progress(Math.min(1, Math.max(0, (p - 0.72) / 0.2)))
      el.style.pointerEvents = p > 0.85 ? 'auto' : 'none'
    })
    return () => {
      off()
      tl.kill()
    }
  }, [])

  return (
    <>
      <div className="credits" ref={root}>
        <div className="inner">
          <h3>Горизонт</h3>
          <p>
            Мы прошли от пыльного поля до дома, который вращается. Всё, что вы видели, — код: ни одного кадра из фильма,
            ни одной ноты чужой музыки — только несколько реплик героев, без которых эта история не звучит.
          </p>
          <dl className="roll">
            <dt>Сцены</dt>
            <dd>процедурная геометрия, GLSL</dd>
            <dt>Свет</dt>
            <dd>ACES, bloom, зерно, линзирование лучей</dd>
            <dt>Звук</dt>
            <dd>Web Audio — синтез в реальном времени</dd>
            <dt>Каркас</dt>
            <dd>React Three Fiber, GSAP, Lenis, Howler</dd>
          </dl>
          <div className="cta">
            <button onClick={() => jumpToAct(0)}>↺ Пройти снова</button>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
            <button onClick={() => setAbout(true)}>О проекте</button>
          </div>
          <p className="disclaimer">
            Неофициальная фан-интерпретация, вдохновлённая фильмом «Интерстеллар» (2014). Не связана с правообладателями фильма.
            Короткие реплики из фильма приведены как цитаты в нашем переводе; права на них принадлежат правообладателям.
          </p>
        </div>
      </div>
      {about && (
        <div className="about" role="dialog" aria-modal="true" onClick={() => setAbout(false)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <h4>О проекте</h4>
            <p>
              «Горизонт» — одностраничная история в восьми актах, рассказанная прокруткой. Каждая сцена построена кодом: поле пшеницы
              из десятков тысяч инстансов, корабль из процедурных модулей, червоточина и чёрная дыра — трассировка лучей в
              искривлённом пространстве прямо в шейдере.
            </p>
            <ul>
              <li>Червоточина — лучи интегрируются по метрике «кротовой норы» с цилиндрической горловиной.</li>
              <li>Гаргантюа — фотоны летят по уравнению Шварцшильда; диск видно сверху и снизу за счёт того же искривления.</li>
              <li>Звук синтезируется на лету; свои записи можно подключить через public/audio/manifest.json.</li>
            </ul>
            <button onClick={() => setAbout(false)}>Закрыть</button>
          </div>
        </div>
      )}
    </>
  )
}
