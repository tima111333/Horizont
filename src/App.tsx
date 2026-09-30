import { useEffect, useRef, useState } from 'react'
import { Stage } from './core/Stage'
import { initScroll, onTick } from './core/scroll'
import { AudioManager } from './audio/AudioManager'
import { preloadAssets } from './core/assets'
import { WHEAT_ARGS } from './models/wheatConfig'
import { TOTAL_SCREENS } from './story/acts'
import { useMouseParallax } from './hooks/useMouseParallax'
import { Captions } from './components/Captions'
import { CustomCursor } from './components/CustomCursor'
import { LoadingOverlay } from './components/LoadingOverlay'
import { ScrollProgress } from './components/ScrollProgress'
import { Letterbox } from './components/Letterbox'
import { SoundToggle } from './components/SoundToggle'
import { AutoToggle } from './components/AutoToggle'
import { MillerClock } from './components/MillerClock'
import { TesseractMessage } from './components/TesseractMessage'
import { Credits } from './components/Credits'

export function App() {
  const scroller = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  useMouseParallax()

  useEffect(() => initScroll(scroller.current!, track.current!), [])
  useEffect(() => onTick((dt) => AudioManager.update(dt)), [])
  // тяжёлая генерация — в воркер сразу, пока зритель читает стартовый экран
  useEffect(() => preloadAssets(WHEAT_ARGS), [])

  return (
    <>
      <Stage />
      <Letterbox />
      <Captions />
      <MillerClock />
      <TesseractMessage />
      <Credits />
      <div className="chrome" data-started={started}>
        <ScrollProgress />
        <SoundToggle />
        <AutoToggle />
      </div>
      <div className="veil" />
      <LoadingOverlay onStart={() => setStarted(true)} />
      <CustomCursor />
      <div ref={scroller} className="scroller" aria-hidden>
        <div ref={track} className="track" style={{ height: `${TOTAL_SCREENS * 100}vh` }} />
      </div>
    </>
  )
}
