import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration, DepthOfField, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode, type BloomEffect, type ChromaticAberrationEffect, type DepthOfFieldEffect, type EffectComposer as Composer } from 'postprocessing'
import * as THREE from 'three'
import { ExposureEffect, GradeEffect } from './effects'
import { S, isLow } from '../story/store'
import { ACTS, type Grade } from '../story/acts'
import { fx } from './fx'

const noBloom = new URLSearchParams(location.search).has('nobloom')
const cur: Grade = { ...ACTS[0].grade, tint: [...ACTS[0].grade.tint], lift: [...ACTS[0].grade.lift] }

export function PostFX() {
  const bloom = useRef<BloomEffect>(null)
  const ca = useRef<ChromaticAberrationEffect>(null)
  const dof = useRef<DepthOfFieldEffect>(null)
  const bokeh = useRef(0)
  const exposure = useMemo(() => new ExposureEffect(), [])
  const grade = useMemo(() => new GradeEffect(), [])
  const caOffset = useMemo(() => new THREE.Vector2(0.0006, 0.0004), [])

  useFrame((_, dt) => {
    const g = ACTS[S.act].grade
    const k = 1 - Math.exp(-dt * 3)
    const L = (a: number, b: number) => a + (b - a) * k
    cur.exposure = L(cur.exposure, g.exposure)
    cur.saturation = L(cur.saturation, g.saturation)
    cur.contrast = L(cur.contrast, g.contrast)
    cur.bloom = L(cur.bloom, g.bloom)
    cur.bloomThreshold = L(cur.bloomThreshold, g.bloomThreshold)
    cur.ca = L(cur.ca, g.ca)
    cur.grain = L(cur.grain, g.grain)
    cur.vignette = L(cur.vignette, g.vignette)
    for (let i = 0; i < 3; i++) {
      cur.tint[i] = L(cur.tint[i], g.tint[i])
      cur.lift[i] = L(cur.lift[i], g.lift[i])
    }

    exposure.exposure = cur.exposure * fx.exposure
    const u = (n: string) => grade.u(n)
    u('uTint').value.set(...cur.tint)
    u('uLift').value.set(...cur.lift)
    u('uSat').value = cur.saturation
    u('uContrast').value = cur.contrast
    u('uVignette').value = cur.vignette
    u('uGrain').value = cur.grain * (isLow ? 0.8 : 1)
    u('uDip').value = Math.max(S.dip, fx.dip)
    u('uDipColor').value.set(...(fx.dip > S.dip ? fx.dipColor : S.dipColor))

    if (bloom.current) {
      bloom.current.intensity = cur.bloom * fx.bloom
      bloom.current.luminanceMaterial.threshold = cur.bloomThreshold
    }
    if (dof.current) {
      // сила боке плавно, иначе на склейке актов резкость «щёлкает»
      bokeh.current += (fx.bokeh - bokeh.current) * k
      dof.current.bokehScale = bokeh.current
      dof.current.target = bokeh.current > 0.01 ? fx.focus : null
      dof.current.cocMaterial.focusRange = fx.focusRange
    }
    if (ca.current) {
      // аберрация растёт от скорости прокрутки — «перегрузка» объектива
      const s = cur.ca * (1 + S.speed * 2.5) * fx.ca
      ca.current.offset.set(0.00055 * s, 0.00035 * s)
    }
  })

  return (
    <EffectComposer
      ref={(c: Composer | null) => {
        fx.composer = c
      }}
      multisampling={isLow ? 0 : 4}
      frameBufferType={THREE.HalfFloatType}
      stencilBuffer={false}
    >
      {isLow ? <></> : <DepthOfField ref={dof} focusDistance={10} focusRange={4} bokehScale={0} resolutionScale={1} />}
      {isLow ? (
        <></>
      ) : (
        <ChromaticAberration ref={ca} offset={caOffset} radialModulation modulationOffset={0.25} />
      )}
      {noBloom ? <></> : <Bloom
        ref={bloom}
        mipmapBlur
        intensity={0.8}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.25}
        radius={0.78}
        levels={isLow ? 5 : 8}
      />}
      <primitive object={exposure} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <primitive object={grade} />
    </EffectComposer>
  )
}
