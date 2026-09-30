// Весь сценарий сайта в одном месте: порядок актов, их длина в экранах прокрутки,
// тексты, цвет «склейки» и грейдинг. Сцены берут отсюда только свой диапазон.

export type ActId =
  | 'earth'
  | 'shelf'
  | 'launch'
  | 'wormhole'
  | 'miller'
  | 'gargantua'
  | 'tesseract'
  | 'epilogue'

export type CaptionKind = 'title' | 'quote' | 'log' | 'line' | 'end'

export interface Caption {
  /** локальный прогресс акта, когда подпись полностью проявилась */
  from: number
  /** когда начинает уходить */
  to: number
  kind: CaptionKind
  text: string
  meta?: string
  /** положение на экране */
  pos?: 'left' | 'right' | 'center' | 'low'
}

export interface Grade {
  exposure: number
  /** множитель цвета после тонмаппинга (sRGB) */
  tint: [number, number, number]
  lift: [number, number, number]
  saturation: number
  contrast: number
  bloom: number
  bloomThreshold: number
  ca: number
  grain: number
  vignette: number
}

export interface ActDef {
  id: ActId
  num: string
  title: string
  subtitle: string
  /** длина в экранах (100vh) */
  len: number
  /** цвет, через который акт уходит в следующий */
  dipOut: [number, number, number]
  /** широкоэкранные шторки 2.39:1 — земные сцены; космос идёт «на весь IMAX» */
  letterbox: boolean
  /** сила параллакса камеры от курсора */
  parallax: number
  grade: Grade
  captions: Caption[]
}

const G = (g: Partial<Grade>): Grade => ({
  exposure: 1,
  tint: [1, 1, 1],
  lift: [0, 0, 0],
  saturation: 1,
  contrast: 1.05,
  bloom: 0.8,
  bloomThreshold: 0.85,
  ca: 1,
  grain: 1,
  vignette: 0.55,
  ...g,
})

const DUST: [number, number, number] = [0.16, 0.1, 0.055]
const BLACK: [number, number, number] = [0, 0, 0]
const WHITE: [number, number, number] = [0.93, 0.95, 0.97]

const RAW: Omit<ActDef, never>[] = [
  {
    id: 'earth',
    num: '00',
    title: 'Пыль',
    subtitle: 'Пролог. Земля, которая устала',
    len: 2.9,
    dipOut: DUST,
    letterbox: true,
    parallax: 1,
    grade: G({ exposure: 0.95, tint: [1.05, 0.98, 0.88], lift: [0.01, 0.006, 0.0], saturation: 0.95, contrast: 1.12, bloom: 0.45, bloomThreshold: 1.0 }),
    captions: [
      { from: 0.03, to: 0.14, kind: 'title', text: 'Горизонт', meta: 'путешествие сквозь пыль, пространство и время', pos: 'center' },
      { from: 0.19, to: 0.3, kind: 'quote', text: 'Раньше мы смотрели в небо и гадали о своём месте среди звёзд. Теперь смотрим под ноги и тревожимся о месте в пыли.', meta: '«Интерстеллар», 2014 · Купер', pos: 'left' },
      { from: 0.35, to: 0.46, kind: 'quote', text: 'Пыль приходила к вечеру. Мы ставили тарелки вверх дном, чтобы утром было из чего есть.', meta: 'Архив устных свидетельств · запись 14 · Эдит, 84 года', pos: 'right' },
      { from: 0.51, to: 0.61, kind: 'quote', text: 'Небо у нас было коричневое. Я уже не помню, каким оно должно быть.', meta: 'Запись 31 · учительница начальных классов', pos: 'left' },
      { from: 0.66, to: 0.76, kind: 'quote', text: 'Мы найдём способ. Мы всегда находили.', meta: '«Интерстеллар», 2014 · Купер', pos: 'right' },
      { from: 0.84, to: 0.94, kind: 'line', text: 'Человечество родилось на Земле. Но умирать здесь оно не обязано.', meta: '«Интерстеллар», 2014 · Купер', pos: 'center' },
    ],
  },
  {
    id: 'shelf',
    num: '01',
    title: 'Призрак',
    subtitle: 'Комната с книжной полкой',
    len: 2.7,
    dipOut: BLACK,
    letterbox: true,
    parallax: 0.6,
    grade: G({ exposure: 1.0, tint: [1.05, 0.97, 0.88], lift: [0.012, 0.008, 0.004], saturation: 0.92, contrast: 1.1, bloom: 0.9, bloomThreshold: 0.8 }),
    captions: [
      { from: 0.06, to: 0.16, kind: 'title', text: 'Призрак', meta: 'Акт I · комната на втором этаже', pos: 'left' },
      { from: 0.21, to: 0.31, kind: 'quote', text: 'Книги падали сами. Всегда с одной и той же полки.', meta: 'Из дневника, 3 апреля', pos: 'right' },
      { from: 0.36, to: 0.47, kind: 'quote', text: 'Закон Мёрфи не о том, что случится плохое. Он о том, что всё, что может случиться, — случится.', meta: '«Интерстеллар», 2014 · Купер — дочери', pos: 'left' },
      { from: 0.52, to: 0.62, kind: 'quote', text: 'Когда становишься родителем, ты становишься призраком будущего своих детей.', meta: '«Интерстеллар», 2014 · Купер', pos: 'right' },
      { from: 0.68, to: 0.84, kind: 'log', text: 'Полосы пыли на полу. Широкая — единица, узкая — ноль. Кто-то передаёт нам координаты.', meta: '01000011 · 01001111 · 01001111', pos: 'left' },
    ],
  },
  {
    id: 'launch',
    num: '02',
    title: 'Эндюранс',
    subtitle: 'Старт и стыковка',
    len: 2.8,
    dipOut: BLACK,
    letterbox: false,
    parallax: 0.9,
    grade: G({ exposure: 1.0, tint: [1.0, 1.0, 1.02], lift: [0.0, 0.004, 0.01], saturation: 0.95, contrast: 1.08, bloom: 0.9, bloomThreshold: 0.9 }),
    captions: [
      { from: 0.05, to: 0.14, kind: 'log', text: 'Т − 10 … зажигание. Отрыв. Тангаж в норме.', meta: 'канал 2 · центр управления', pos: 'center' },
      { from: 0.22, to: 0.36, kind: 'title', text: 'Эндюранс', meta: 'Акт II · кольцо из двенадцати модулей на низкой орбите', pos: 'left' },
      { from: 0.44, to: 0.58, kind: 'log', text: '— Это невозможно. — Нет. Это необходимо.', meta: '«Интерстеллар», 2014 · робот и Купер на стыковке', pos: 'right' },
      { from: 0.64, to: 0.78, kind: 'quote', text: 'Мы здесь не для того, чтобы спасти мир. Мы здесь, чтобы его покинуть.', meta: '«Интерстеллар», 2014 · профессор Бранд', pos: 'left' },
      { from: 0.84, to: 0.95, kind: 'line', text: 'Не уходи смиренно в эту тихую ночь.', meta: 'Дилан Томас · в фильме читает профессор Бранд', pos: 'center' },
    ],
  },
  {
    id: 'wormhole',
    num: '03',
    title: 'Червоточина',
    subtitle: 'Сфера, в которой видно чужое небо',
    len: 3.0,
    dipOut: WHITE,
    letterbox: false,
    parallax: 0.7,
    grade: G({ exposure: 1.0, tint: [0.98, 1.0, 1.04], lift: [0.0, 0.0, 0.006], saturation: 1.0, contrast: 1.06, bloom: 1.1, bloomThreshold: 0.8, ca: 1.4 }),
    captions: [
      { from: 0.05, to: 0.18, kind: 'title', text: 'Червоточина', meta: 'Акт III · орбита Сатурна', pos: 'left' },
      { from: 0.24, to: 0.38, kind: 'quote', text: 'Это не дыра, это сфера. С какой стороны ни подлетай — смотришь прямо в неё.', meta: 'пилот', pos: 'right' },
      { from: 0.44, to: 0.56, kind: 'log', text: 'Внутри — звёзды другой галактики. Вывернутые, растянутые в кольцо.', meta: 'телеметрия · линзирование 41°', pos: 'left' },
      { from: 0.66, to: 0.78, kind: 'line', text: 'Держитесь.', pos: 'center' },
    ],
  },
  {
    id: 'miller',
    num: '04',
    title: 'Миллер',
    subtitle: 'Планета, где время идёт медленно',
    len: 2.6,
    dipOut: BLACK,
    letterbox: true,
    parallax: 0.8,
    grade: G({ exposure: 1.02, tint: [0.95, 1.0, 1.04], lift: [0.012, 0.016, 0.02], saturation: 0.78, contrast: 1.04, bloom: 0.6, bloomThreshold: 0.95 }),
    captions: [
      { from: 0.05, to: 0.18, kind: 'title', text: 'Миллер', meta: 'Акт IV · первая планета', pos: 'left' },
      { from: 0.24, to: 0.38, kind: 'quote', text: 'Время относительно. Оно растягивается и сжимается, но назад не течёт.', meta: '«Интерстеллар», 2014 · Купер', pos: 'right' },
      { from: 0.46, to: 0.6, kind: 'log', text: 'Один час здесь — семь лет на Земле. Каждая минута стоит месяца чьей-то жизни.', meta: 'гравитационное замедление времени', pos: 'left' },
      { from: 0.7, to: 0.86, kind: 'line', text: 'Это не горы. Это волны.', meta: '«Интерстеллар», 2014 · Купер', pos: 'center' },
    ],
  },
  {
    id: 'gargantua',
    num: '05',
    title: 'Гаргантюа',
    subtitle: 'Сто миллионов солнц в одной точке',
    len: 3.2,
    dipOut: BLACK,
    letterbox: false,
    parallax: 0.5,
    grade: G({ exposure: 0.95, tint: [1.04, 1.0, 0.94], lift: [0.0, 0.0, 0.0], saturation: 0.95, contrast: 1.1, bloom: 1.0, bloomThreshold: 0.75, ca: 1.2 }),
    captions: [
      { from: 0.05, to: 0.15, kind: 'title', text: 'Гаргантюа', meta: 'Акт V · сверхмассивная чёрная дыра', pos: 'left' },
      { from: 0.21, to: 0.33, kind: 'quote', text: 'Свет огибает её и возвращается. Диск видно сверху и снизу одновременно — это один и тот же диск.', meta: 'научный офицер', pos: 'right' },
      { from: 0.39, to: 0.5, kind: 'log', text: 'Кольцо фотонов: радиус 1,5 от горизонта. Ближе свет уже не может летать по кругу.', meta: 'навигация', pos: 'left' },
      { from: 0.56, to: 0.66, kind: 'log', text: 'Увидимся на той стороне, Куп.', meta: '«Интерстеллар», 2014 · робот ТАРС, отстыковка', pos: 'right' },
      { from: 0.74, to: 0.88, kind: 'line', text: 'Третий закон Ньютона: чтобы куда-то попасть, приходится что-то оставить позади.', meta: '«Интерстеллар», 2014 · Купер', pos: 'center' },
    ],
  },
  {
    id: 'tesseract',
    num: '06',
    title: 'Тессеракт',
    subtitle: 'Библиотека, где время — направление',
    len: 3.0,
    dipOut: WHITE,
    letterbox: false,
    parallax: 0.3,
    grade: G({ exposure: 1.0, tint: [1.06, 0.98, 0.9], lift: [0.004, 0.004, 0.012], saturation: 0.95, contrast: 1.1, bloom: 1.0, bloomThreshold: 0.8 }),
    captions: [
      { from: 0.05, to: 0.18, kind: 'title', text: 'Тессеракт', meta: 'Акт VI · за полкой', pos: 'left' },
      { from: 0.24, to: 0.38, kind: 'quote', text: 'Они вовсе не «существа». Они — это мы.', meta: '«Интерстеллар», 2014 · Купер', pos: 'right' },
      { from: 0.44, to: 0.56, kind: 'log', text: 'Каждая ячейка — одна секунда той комнаты. Двигайте курсор: вы идёте сквозь них.', meta: 'управление: мышь', pos: 'left' },
      { from: 0.62, to: 0.72, kind: 'line', text: 'Не дай мне уйти, Мёрф!', meta: '«Интерстеллар», 2014 · Купер', pos: 'low' },
      { from: 0.86, to: 0.94, kind: 'line', text: 'Это я. Я был твоим призраком.', meta: '«Интерстеллар», 2014 · Купер', pos: 'low' },
    ],
  },
  {
    id: 'epilogue',
    num: '07',
    title: 'Станция',
    subtitle: 'Новый дом',
    len: 3.4,
    dipOut: BLACK,
    letterbox: false,
    parallax: 0.7,
    grade: G({ exposure: 1.02, tint: [1.02, 1.0, 0.96], lift: [0.01, 0.012, 0.016], saturation: 0.95, contrast: 1.03, bloom: 0.7, bloomThreshold: 0.9 }),
    captions: [
      { from: 0.05, to: 0.14, kind: 'title', text: 'Станция', meta: 'Эпилог · орбита Сатурна, спустя время', pos: 'left' },
      { from: 0.19, to: 0.28, kind: 'quote', text: 'Небо свёрнуто в трубу. Если поднять голову — увидишь чужие крыши.', meta: 'житель третьего сектора', pos: 'right' },
      { from: 0.33, to: 0.42, kind: 'quote', text: 'Потому что мой папа мне обещал.', meta: '«Интерстеллар», 2014 · Мёрф', pos: 'left' },
      { from: 0.47, to: 0.56, kind: 'quote', text: 'Любовь — единственное, что мы способны ощутить сквозь время и пространство.', meta: '«Интерстеллар», 2014 · Амелия Бранд', pos: 'right' },
      { from: 0.61, to: 0.69, kind: 'quote', text: 'Ни один родитель не должен видеть, как умирает его ребёнок. Со мной мои дети. Иди.', meta: '«Интерстеллар», 2014 · Мёрф — отцу', pos: 'left' },
    ],
  },
]

const TOTAL = RAW.reduce((s, a) => s + a.len, 0)

export interface Act extends ActDef {
  index: number
  start: number
  end: number
}

let acc = 0
export const ACTS: Act[] = RAW.map((a, index) => {
  const start = acc / TOTAL
  acc += a.len
  return { ...a, index, start, end: acc / TOTAL }
})

/** общая длина полотна прокрутки в экранах */
export const TOTAL_SCREENS = TOTAL + 1

/** полуширина «склейки» между актами — в долях всей прокрутки */
export const DIP = 0.2 / TOTAL

export const actIndex = (id: ActId) => ACTS.findIndex((a) => a.id === id)

export const actAt = (p: number) => {
  for (let i = ACTS.length - 1; i >= 0; i--) if (p >= ACTS[i].start) return i
  return 0
}
