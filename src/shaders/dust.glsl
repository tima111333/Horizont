// Стена пыльной бури. Геометрия — дуга цилиндра вокруг поля; объём имитируется
// «клубящимся» шумом (сумма модулей симплекса даёт округлые клубы), а свет —
// разницей плотности в сторону солнца: где к солнцу пыль редеет, там край клуба
// освещён. Одна лишняя выборка вместо полноценного марша.
uniform float uTime;
uniform float uLayer;
uniform float uHeight;
uniform float uOpacity;
uniform vec2 uParallax;
uniform vec3 uCam;
uniform float uOct;
uniform float uR;
uniform float uEdge;
varying vec2 vWall;     // x — метры вдоль дуги, y — высота
varying vec3 vWorld;
varying vec3 vTangent;
varying vec3 vNormalW;

float billow(vec3 p, float oct) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) {
    if (float(i) >= oct) break;
    s += a * (1.0 - abs(snoise(p)));
    p = p * 2.03 + vec3(4.1, 1.3, 7.7);
    a *= 0.5;
  }
  return s;
}

// высота верхнего края стены в точке x: крупные башни + клубы помельче
float topAt(vec2 q, float t) {
  float towers = snoise(vec3(q.x * 0.5, uLayer * 3.1, t * 0.12)) * 0.5 + 0.5;
  float puffs = billow(vec3(q.x * 2.2, q.y * 1.4 - t * 0.6, t * 0.5 + uLayer * 7.0), uOct);
  return uHeight * (0.5 + 0.38 * towers + 0.32 * puffs);
}

float density(vec2 w) {
  vec2 q = (w + uParallax) / 170.0;
  float t = uTime * 0.04;
  float top = topAt(q, t);
  // мягкость края зависит от высоты: у макушек рыхлее
  float soft = 22.0 + 0.08 * top;
  float d = smoothstep(top, top - soft, w.y);
  // правый фланг рваный и тает — сквозь него пробивается солнце
  float th = w.x / max(uR, 1.0);
  float frayed = snoise(vec3(q * 1.7, t)) * 0.12;
  d *= smoothstep(uEdge + 0.05, uEdge - 0.4, th + frayed);
  return d;
}

void main() {
  float d = density(vWall);
  if (d < 0.004) discard;
  vec3 L = normalize(uSunDir);
  // направление на солнце в плоскости стены
  vec2 toSun = normalize(vec2(dot(L, vTangent), max(L.y, 0.0) + 0.5));
  float dl = density(vWall + toSun * 30.0);
  float edgeLit = clamp((d - dl) * 1.6, 0.0, 1.0);
  // фактура внутри стены: перекатывающиеся валы пыли, только яркостью
  vec2 q = (vWall + uParallax) / 120.0;
  float roll = billow(vec3(q.x, q.y - uTime * 0.03, uTime * 0.02 + uLayer), 3.0);

  vec3 V = normalize(vWorld - uCam);
  // контровой свет через редкую пыль около солнца
  float back = pow(max(dot(V, L), 0.0), 10.0) * pow(1.0 - d, 1.5) * 2.4;
  float hh = clamp(vWall.y / max(uHeight, 1.0), 0.0, 1.2);
  vec3 body = mix(vec3(0.06, 0.036, 0.02), vec3(0.14, 0.085, 0.045), hh);
  vec3 lit = vec3(0.95, 0.55, 0.27);
  body *= 0.7 + 0.6 * roll;
  vec3 col = body + lit * edgeLit * edgeLit * 0.45 * uSunVis + vec3(1.0, 0.5, 0.2) * back * uSunVis;
  // стена должна читаться на горизонте — дымку на неё кладём тоньше
  col = applyHaze(col, uCam + (vWorld - uCam) * 0.4, uCam);
  gl_FragColor = vec4(col, d * uOpacity);
}
