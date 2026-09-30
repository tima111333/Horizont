// Рябь от курсора: двумерное волновое уравнение на сетке 256×256 (пинг-понг).
// R — высота сейчас, G — высота на прошлом шаге. Капля от курсора — гауссов импульс.
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uDrop;       // координаты капли в UV области, x < 0 — капли нет
uniform float uDropR;
uniform float uDropK;
varying vec2 vUv;

void main() {
  vec2 c = texture2D(uPrev, vUv).rg;
  float h = c.r;
  float hp = c.g;
  float n = texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r;
  float s = texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r;
  float e = texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r;
  float w = texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r;
  // схема «чехарда»: h' = 2h - h_prev + c²∇²h, с затуханием
  float lap = n + s + e + w - 4.0 * h;
  float next = (2.0 * h - hp + 0.45 * lap) * 0.986;
  if (uDrop.x >= 0.0) {
    float d = length((vUv - uDrop) / uTexel);
    next -= uDropK * exp(-d * d / (uDropR * uDropR));
  }
  // края гасят волну — нет отражения от границы области
  vec2 edge = smoothstep(0.0, 0.08, vUv) * smoothstep(1.0, 0.92, vUv);
  next *= edge.x * edge.y;
  gl_FragColor = vec4(next, h, 0.0, 1.0);
}
