import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ACTS } from '../story/acts'
import { S } from '../story/store'
import { onTick } from '../core/scroll'
import { parallaxOffset } from '../hooks/useMouseParallax'
import { availWidth, fitText, onFit } from '../hooks/fitText'

/**
 * Все подписи всех актов на одной GSAP-таймлайне длиной 1 = вся страница.
 * Таймлайн не играет сам — его прогресс каждый кадр ставится равным прогрессу
 * прокрутки, поэтому назад всё отматывается так же плавно, как вперёд.
 */
export function Captions() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current!
    const tl = gsap.timeline({ paused: true })
    for (const a of ACTS) {
      const L = a.end - a.start
      a.captions.forEach((c, k) => {
        const node = el.querySelector<HTMLElement>(`[data-id="${a.id}-${k}"]`)
        if (!node) return
        const fade = 0.075 * L
        const tIn = a.start + c.from * L - fade
        const tOut = a.start + c.to * L
        if (c.kind === 'title') {
          const letters = node.querySelectorAll('h2 span')
          tl.set(node, { autoAlpha: 1 }, tIn)
          tl.fromTo(
            letters,
            { opacity: 0, y: 26, filter: 'blur(10px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: fade * 0.7, stagger: (fade * 0.3) / letters.length, ease: 'power3.out' },
            tIn,
          )
          tl.fromTo(node.querySelectorAll('.num, .meta'), { opacity: 0 }, { opacity: 1, duration: fade, ease: 'power3.inOut' }, tIn + fade * 0.4)
          tl.to(node, { autoAlpha: 0, y: -20, filter: 'blur(8px)', duration: fade, ease: 'power3.inOut' }, tOut)
        } else {
          tl.fromTo(
            node,
            { autoAlpha: 0, y: 28, filter: 'blur(10px)' },
            { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: fade, ease: 'power3.inOut' },
            tIn,
          )
          tl.to(node, { autoAlpha: 0, y: -22, filter: 'blur(8px)', duration: fade, ease: 'power3.inOut' }, tOut)
        }
      })
    }
    tl.set({}, {}, 1)

    const offFit = onFit(() =>
      el.querySelectorAll<HTMLElement>('.cap[data-kind="title"]').forEach((c) => fitText(c.querySelector('h2')!, availWidth(c.dataset.pos!))),
    )

    const off = onTick(() => {
      tl.progress(S.p)
      // слой подписей плывёт чуть против курсора — ближний план параллакса
      const o = parallaxOffset(-14)
      el.style.transform = `translate3d(${o.x}px, ${o.y}px, 0)`
    })
    return () => {
      off()
      offFit()
      tl.kill()
    }
  }, [])

  return (
    <div className="captions" ref={root}>
      {ACTS.flatMap((a) =>
        a.captions.map((c, k) => (
          <div key={`${a.id}-${k}`} className="cap" data-id={`${a.id}-${k}`} data-kind={c.kind} data-pos={c.pos ?? 'left'}>
            {c.kind === 'title' ? (
              <>
                {a.id !== 'earth' && <span className="num">{a.num} / 07</span>}
                <h2 aria-label={c.text}>
                  {[...c.text].map((ch, i) => (
                    <span key={i} aria-hidden>
                      {ch === ' ' ? ' ' : ch}
                    </span>
                  ))}
                </h2>
              </>
            ) : (
              <p>{c.text}</p>
            )}
            {c.meta && <span className="meta">{c.meta}</span>}
          </div>
        )),
      )}
    </div>
  )
}
