# Звук: свои файлы поверх синтеза

Сайт звучит и без файлов — каждый акт синтезируется на Web Audio
(`src/audio/AudioManager.ts`). Файлы добавляют «живую» текстуру поверх.

1. Скачайте файлы (CC0 или Pixabay Content License) в эту папку.
2. Впишите их в `manifest.json`, например:

```json
{
  "files": {
    "earth": ["ambient-earth.ogg", "ambient-earth.mp3"],
    "earth-laughter": ["laughter.mp3"],
    "miller": ["ambient-miller.mp3"]
  }
}
```

Ключ без дефиса — петля акта (кроссфейд 1,8 с вместе с актом), с дефисом — одиночный звук.

| ключ | что искать | поисковый запрос на freesound.org |
|---|---|---|
| `earth` | ветер в поле, сухой, порывами | `wind field gusts dry` |
| `earth-laughter` | далёкий детский смех, на улице | `children laughing distant outdoor` |
| `shelf` | тишина старого дома, ветер за окном | `old house room tone wind outside` |
| `launch` | низкий гул двигателя / рёв ракеты вдали | `rocket launch rumble distant` |
| `wormhole` | нарастающий дрон, органный пэд | `organ drone swell ambient` |
| `miller` | мелкая вода, плеск у ног | `shallow water lapping` |
| `gargantua` | инфразвуковой дрон | `deep space drone low` |
| `tesseract` | стеклянные тоны, мерцание | `glass harmonics shimmer` |
| `epilogue` | длинный органный аккорд | `church organ sustained chord` |

Синтез акта при наличии файла не выключается, а приглушается до 35 % —
это задаётся константой `SYNTH_UNDER_FILE`.
