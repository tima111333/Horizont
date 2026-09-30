import { Suspense, lazy, useEffect, useRef, useState, type ReactNode, type ComponentType, type LazyExoticComponent } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CameraRig } from './CameraRig'
import { PostFX } from './PostFX'
import { fx } from './fx'
import { rig } from './rig'
import { S, isLow, isDebug, onActChange } from '../story/store'
import { ACTS, type ActId } from '../story/acts'
import { SkyProvider, prebakeSkies } from './sky'
import { envByAct } from './envmap'
import { onTick } from './scroll'

/** дополнительные проходы акта (глубина, таблицы лучей) — тоже прогреваются заранее */
export const warmers = new Map<string, () => void>()

// Каждая сцена — отдельный чанк: код и шейдеры акта грузятся, только когда до него доходит прокрутка.
const loaders: Record<ActId, () => Promise<{ default: ComponentType }>> = {
  earth: () => import('../scenes/Earth'),
  shelf: () => import('../scenes/Bookshelf'),
  launch: () => import('../scenes/Launch'),
  wormhole: () => import('../scenes/Wormhole'),
  miller: () => import('../scenes/MillersPlanet'),
  gargantua: () => import('../scenes/Gargantua'),
  tesseract: () => import('../scenes/Tesseract'),
  epilogue: () => import('../scenes/Epilogue'),
}
const scenes = Object.fromEntries(
  Object.entries(loaders).map(([k, f]) => [k, lazy(f)]),
) as Record<ActId, LazyExoticComponent<ComponentType>>

// крошечная цель для пробного кадра; тип буфера как у композера — те же ключи программ
const warmRT = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType })

const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap'] as const

/** прогрев шейдеров акта под тот же буфер, куда потом рисует композер, и загрузка его текстур в GPU */
const compileScene = new THREE.Scene()

function usePrecompile() {
  const { gl, scene, camera } = useThree()
  return (index: number, compileOnly = false) => {
    const ts = performance.now()
    const roots = scene.children.filter((o) => o.userData.act !== undefined)
    const vis = roots.map((r) => r.visible)
    roots.forEach((r) => (r.visible = r.userData.act === index))
    const target = roots.find((r) => r.userData.act === index)
    target?.traverse((o) => {
      const m = (o as THREE.Mesh).material
      if (!m) return
      for (const mat of Array.isArray(m) ? m : [m]) {
        const rec = mat as unknown as Record<string, unknown>
        for (const k of TEX_KEYS) if (rec[k] instanceof THREE.Texture) gl.initTexture(rec[k] as THREE.Texture)
      }
    })
    // окружение — как у живого кадра этого акта, иначе PBR-материалы перекомпилируются при входе
    const env = envByAct.get(ACTS[index].id)
    const prevEnv = scene.environment
    scene.environment = env?.tex ?? null
    const prev = gl.getRenderTarget()
    gl.setRenderTarget(fx.composer ? fx.composer.inputBuffer : null)
    const t0 = performance.now()
    // компилируем только корень этого акта: compile() обходит ВСЕ объекты переданной сцены,
    // в том числе скрытые, и готовит их материалы со светом прогреваемого акта. Так прогрев
    // «Червоточины» (солнце без теней) пересобирал материалы видимого «Эндюранса» — и на
    // экране они компилировались заново, рывок ~0,4–0,8 с. Пустая сцена-цель даёт окружение
    // акта, свет берётся только из его корня.
    compileScene.environment = env?.tex ?? null
    compileScene.fog = scene.fog
    const done = target ? gl.compileAsync(target, camera, compileScene) : Promise.resolve()
    gl.setRenderTarget(prev)
    scene.environment = prevEnv
    roots.forEach((r, k) => (r.visible = vis[k]))
    const syncMs = performance.now() - ts
    const warmFrame = () => {
      // пробный кадр акта в крошечный буфер: догружает геометрию, карты теней и материалы глубины
      const tw = performance.now()
      const roots2 = scene.children.filter((o) => o.userData.act !== undefined)
      const vis2 = roots2.map((r) => r.visible)
      roots2.forEach((r) => (r.visible = r.userData.act === index))
      const pe = scene.environment
      scene.environment = env?.tex ?? null
      const p0 = gl.getRenderTarget()
      gl.setRenderTarget(warmRT)
      gl.render(scene, camera)
      gl.setRenderTarget(p0)
      scene.environment = pe
      roots2.forEach((r, k) => (r.visible = vis2[k]))
      warmers.get(ACTS[index].id)?.()
      window.__is?.log(`прогрев ${ACTS[index].id}: ${(performance.now() - t0).toFixed(0)} мс (синхронно ${syncMs.toFixed(0)}, пробный кадр ${(performance.now() - tw).toFixed(0)} @${S.p.toFixed(3)})`)
    }
    if (compileOnly)
      return done.then(() => {
        window.__is?.log(`кэш шейдеров ${ACTS[index].id}: ${(performance.now() - t0).toFixed(0)} мс`)
      })
    return done.then(
      () =>
        new Promise<void>((resolve) => {
          window.__is?.log(`компиляция ${ACTS[index].id}: ${(performance.now() - t0).toFixed(0)} мс @${S.p.toFixed(3)}`)
          // пробный кадр подвешивает поток на сотни мс — прячем его в затемнение склейки
          // перед этим актом; если акт уже на экране или ещё не начат показ — сразу
          const due = () => {
            const a = S.act
            if (!S.started || a === index) return true
            if (Math.abs(a - index) > 1) return false
            const nearEdge = index > a ? S.local[a] > 0.9 : S.local[a] < 0.1
            return nearEdge && S.dip > 0.55
          }
          if (due()) {
            warmFrame()
            return resolve()
          }
          const off = onTick(() => {
            if (!due()) return
            off()
            warmFrame()
            resolve()
          })
        }),
    )
  }
}

function Warm({ index, onReady, compileOnly }: { index: number; onReady: (i: number, compileOnly: boolean) => void; compileOnly: boolean }) {
  const precompile = usePrecompile()
  useEffect(() => {
    // кадр на то, чтобы сцена успела создать свои материалы в эффектах
    const id = requestAnimationFrame(() => {
      precompile(index, compileOnly).finally(() => onReady(index, compileOnly))
    })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])
  return null
}

const ready = new Set<number>()
const readyListeners = new Set<() => void>()
export const sceneReady = (i: number) => ready.has(i)
/** доля актов, чьи шейдеры уже в кэше браузера */
export const warmProgress = { v: 0 }
export const onSceneReady = (f: () => void) => {
  readyListeners.add(f)
  return () => {
    readyListeners.delete(f)
  }
}

function Acts() {
  const [act, setAct] = useState(S.act)
  useEffect(() => onActChange(() => setAct(S.act)), [])

  // Все акты грузятся и прогреваются по очереди ещё на стартовом экране и дальше
  // остаются смонтированными (скрытые акты GPU не стоят — их корень невидим).
  // Так во время фильма нет ни монтирования, ни компиляции, ни пробных кадров —
  // автопросмотр идёт без остановок, в том числе на склейках.
  const [tour, setTour] = useState(2)
  const [r0, setR0] = useState(false)
  const near = [act - 1, act, act + 1].filter((i) => i >= 0 && i < ACTS.length)
  const loaded = r0 ? Array.from({ length: Math.min(tour + 1, ACTS.length) }, (_, i) => i) : []
  const mounted = [...new Set([...loaded, ...near])].sort((x, y) => x - y)

  const gl = useThree((s) => s.gl)
  useEffect(() => {
    warmProgress.v = Math.min(1, (tour - 2) / (ACTS.length - 2))
    readyListeners.forEach((f) => f())
  }, [tour])
  const onReady = (i: number) => {
    setTour((t) => (t === i ? t + 1 : t))
    if (i === 0 && !ready.has(0)) {
      // небеса запекаем, пока зритель на стартовом экране; готовность — после них
      prebakeSkies(gl).then(() => {
        ready.add(0)
        setR0(true)
        readyListeners.forEach((f) => f())
      })
      return
    }
    ready.add(i)
    readyListeners.forEach((f) => f())
  }

  return (
    <>
      {mounted.map((i) => {
        const Scene = scenes[ACTS[i].id]
        return (
          <Suspense key={ACTS[i].id} fallback={null}>
            <Gate index={i}>
              <Scene />
            </Gate>
            <Warm index={i} onReady={onReady} compileOnly={false} />
          </Suspense>
        )
      })}
    </>
  )
}

/** корень акта: виден только пока акт активен — спрятанные сцены GPU не стоят */
function Gate({ index, children }: { index: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.visible = S.act === index
  }, -3)
  return (
    <group ref={ref} userData={{ act: index }} name={ACTS[index].id} visible={S.act === index}>
      {children}
    </group>
  )
}

/** сброс покадровых ручек до того, как сцены их выставят */
function FrameReset() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    gl.info.autoReset = false
  }, [gl])
  const known = useRef(new Set<unknown>())
  useFrame(() => {
    if (window.__is) window.__is.frameInfo = { calls: gl.info.render.calls, tris: gl.info.render.triangles }
    // отладка рывков: какие программы появились вне прогрева
    if (S.started && isDebug) {
      for (const pr of gl.info.programs ?? []) {
        if (known.current.has(pr)) continue
        known.current.add(pr)
        window.__is?.log(`новая программа @${S.p.toFixed(3)}: ${(pr as { name: string }).name} ${String((pr as { cacheKey?: string }).cacheKey ?? '').slice(0, 160)}`)
      }
    } else for (const pr of gl.info.programs ?? []) known.current.add(pr)
    gl.info.reset()
    // окружение ставит только активный акт — иначе смонтированные соседи спорят за него
    scene.environment = null
    scene.environmentIntensity = 1
    fx.exposure = 1
    fx.bloom = 1
    fx.ca = 1
    fx.dip = 0
    fx.bokeh = 0
    fx.focusRange = 4
    rig.shake = 0.012
    rig.roll = 0
    rig.ownPointer = false
    rig.near = 0.1
    rig.far = 4000
  }, -3)
  return null
}

/**
 * Адаптивное разрешение: если кадр стабильно не укладывается в ~21 мс,
 * рендер идёт чуть мельче вместо того, чтобы дёргаться. Обратно поднимаемся
 * медленно и не выше уровня, на котором уже тормозило, — без качелей.
 */
function AdaptiveDpr() {
  const setDpr = useThree((s) => s.setDpr)
  const st = useRef({ acc: 0, n: 0, slow: 0, fast: 0, dpr: 0, ceil: 0, pending: false })
  useEffect(() => {
    const max = isLow ? 1.25 : Math.min(1.5, Math.max(1, devicePixelRatio))
    st.current.dpr = max
    st.current.ceil = max
  }, [])
  useFrame((_, dt) => {
    const s = st.current
    // склейки и прогрев не считаем: там бывают разовые паузы компиляции
    // смена разрешения пересоздаёт буферы и может дать чёрный кадр — применяем её
    // только в затемнении склейки, где этого не видно
    if (s.pending && S.dip > 0.85) {
      s.pending = false
      setDpr(s.dpr)
      window.__is?.log(`dpr → ${s.dpr.toFixed(2)} @${S.p.toFixed(3)}`)
    }
    if (!S.started || S.dip > 0.2 || dt > 0.2) {
      s.acc = s.n = 0
      return
    }
    s.acc += dt
    s.n++
    if (s.acc < 1) return
    const avg = s.acc / s.n
    s.acc = s.n = 0
    if (avg > 1 / 48) {
      s.slow++
      s.fast = 0
    } else if (avg < 1 / 57) {
      s.fast++
      s.slow = 0
    } else s.slow = s.fast = 0
    const min = isLow ? 0.6 : 0.75
    // только вниз и без качелей: поднятие обратно снова упиралось бы в тот же предел
    if (s.slow >= 2 && s.dpr > min && !s.pending) {
      s.dpr = Math.max(min, s.dpr - 0.15)
      s.slow = 0
      s.pending = true
    }
    void s.fast
    void s.ceil
  })
  return null
}

function Debug() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    if (!window.__is) return
    window.__is.renderer = gl
    window.__is.scene = scene
    window.__is.camera = camera
  }, [gl, scene, camera])
  return null
}

export function Stage() {
  return (
    <div className="stage">
      <Canvas
        className="stage-canvas"
        dpr={isLow ? [0.8, 1.25] : [1, 1.5]}
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          stencil: false,
          alpha: false,
          preserveDrawingBuffer: false,
        }}
        camera={{ fov: 40, near: 0.1, far: 4000, position: [0, 1, 5] }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 1)
          scene.background = new THREE.Color(0x000000)
        }}
      >
        <FrameReset />
        <SkyProvider>
          <Acts />
        </SkyProvider>
        <CameraRig />
        <PostFX />
        <AdaptiveDpr />
        <Debug />
      </Canvas>
    </div>
  )
}
