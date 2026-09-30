// Небесная сфера: полоса галактики из зернистых звёздных облаков, пылевые
// прожилки, выпуклость ядра и редкие эмиссионные туманности. Рисуется один
// раз — в кубическую карту, которую берут сцены и линзы (червоточина, Гаргантюа).
uniform vec3 uGalN;      // нормаль галактической плоскости
uniform vec3 uCore;      // направление на ядро
uniform vec3 uTintA;     // цвет звёздных облаков
uniform vec3 uTintB;     // цвет ядра
uniform vec3 uNeb;       // эмиссия (водород)
uniform vec3 uNeb2;      // эмиссия (кислород)
uniform float uNebK;     // сколько туманностей
uniform float uBright;
uniform float uWidth;
uniform float uSeed;
varying vec3 vDir;

float ridged(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * (1.0 - abs(snoise(p)));
    p = p * 2.1 + 3.3;
    a *= 0.5;
  }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float b = dot(d, uGalN);
  float coreK = max(dot(d, uCore), 0.0);
  float bulge = pow(coreK, 9.0);

  vec3 q = d * 2.6 + uSeed;
  // края полосы рваные: ширина «дышит» по долготе
  float w = uWidth * (0.8 + 0.5 * (fbm3(q * 0.9) * 0.5 + 0.5) + 2.2 * bulge);
  float band = exp(-b * b / (w * w));

  // зернистые звёздные облака: высокочастотный шум в квадрате — сгустки и провалы
  float cloud = fbm3(q * 4.5) * 0.5 + 0.5;
  float cloud2 = fbm3(q * 11.0 + 4.0) * 0.5 + 0.5;
  // мягкое свечение с умеренными сгустками + зерно неразрешённых звёзд на уровне текселя
  float stars = (0.5 + 0.5 * pow(cloud, 1.5)) * (0.85 + 0.3 * cloud2);
  float grain = pow(hash13(floor(d * 1500.0)), 12.0) * 0.9 + pow(hash13(floor(d * 700.0) + 7.0), 16.0) * 1.2;
  stars = stars * 0.6 + grain * (0.3 + cloud);

  // пылевые прожилки: хребты шума, вытянутые вдоль плоскости
  vec3 lq = q * 1.6 + uGalN * b * 10.0;
  float lane = smoothstep(0.6, 1.0, ridged(lq * 0.8)) * smoothstep(0.35, 0.7, fbm3(q * 0.7) * 0.5 + 0.5);
  float laneMask = exp(-b * b / (w * w * 0.18));

  vec3 col = mix(uTintA, uTintB, clamp(bulge * 2.0 + 0.3 * cloud, 0.0, 1.0));
  vec3 c = col * band * stars * (1.0 - 0.9 * lane * laneMask);
  c += uTintB * bulge * (0.8 + 0.6 * cloud) * (1.0 - 0.8 * lane * laneMask);

  // редкие эмиссионные туманности — только в отдельных местах неба
  float where = smoothstep(0.52, 0.78, fbm3(d * 1.3 + uSeed * 1.7) * 0.5 + 0.5);
  float wisps = ridged(d * 7.0 + uSeed);
  float wisps2 = ridged(d * 11.0 - uSeed);
  vec3 neb = uNeb * pow(wisps, 3.5) * 1.2 + uNeb2 * pow(wisps2, 4.0) * 1.0;
  neb = mix(vec3(dot(neb, vec3(0.3, 0.5, 0.2))), neb, 0.7);
  c += neb * where * uNebK;

  // лёгкое общее свечение неба от невидимых звёзд
  c += uTintA * 0.015 * (0.5 + 0.5 * band);

  gl_FragColor = vec4(max(c, 0.0) * uBright, 1.0);
}
