// Червоточина: метрика ds² = -dt² + dl² + r(l)²dΩ² с цилиндрической горловиной
// длиной 2a и «линзой» ширины M снаружи (форма как в James et al., 2015).
// Метрика сферически симметрична, поэтому судьба луча зависит только от
// положения камеры l_c и угла луча к оси — один проход считает таблицу из
// тысяч лучей (LUT), а полноэкранный проход лишь читает её.

// #define LUT — часть для расчёта таблицы, иначе — отрисовка
#define PI 3.14159265

uniform float uA;   // полудлина горловины (в радиусах горловины)
uniform float uM;   // ширина линзирующей области
uniform float uLc;  // положение камеры по l

float rOf(float l) {
  float x = max(abs(l) - uA, 0.0);
  float X = 2.0 * x / (PI * uM);
  return 1.0 + uM * (X * atan(X) - 0.5 * log(1.0 + X * X));
}
float drOf(float l) {
  float x = max(abs(l) - uA, 0.0);
  float X = 2.0 * x / (PI * uM);
  return sign(l) * (2.0 / PI) * atan(X);
}

#ifdef LUT
uniform float uN;
varying vec2 vUv;

// производные состояния (l, phi, p) по аффинному параметру
vec3 deriv(vec3 s, float b) {
  float r = rOf(s.x);
  return vec3(s.z, b / (r * r), b * b * drOf(s.x) / (r * r * r));
}

void main() {
  float i = floor(vUv.x * uN);
  float alpha = (i + 0.5) / uN * PI;      // угол от направления «внутрь»
  float nl = -cos(alpha);
  float rc = rOf(uLc);
  float b = rc * sin(alpha);
  vec3 s = vec3(uLc, 0.0, nl);
  float far = 40.0 + abs(uLc);
  for (int k = 0; k < 600; k++) {
    // уходит на бесконечность — дальше прямая, досчитаем аналитически
    if (abs(s.x) > far && s.z * sign(s.x) > 0.0) break;
    // шаг: мелкий у горловины и у точки разворота, крупный вдали
    float h = clamp(0.015 + 0.04 * max(abs(s.x) - uA, 0.0), 0.015, 1.5);
    vec3 k1 = deriv(s, b);
    vec3 k2 = deriv(s + 0.5 * h * k1, b);
    vec3 k3 = deriv(s + 0.5 * h * k2, b);
    vec3 k4 = deriv(s + h * k3, b);
    s += h / 6.0 * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
  }
  float rf = rOf(s.x);
  float phi = s.y + asin(clamp(b / rf, 0.0, 1.0));
  gl_FragColor = vec4(phi, sign(s.x), 0.0, 1.0);
}
#else

uniform sampler2D uLut;
uniform float uN;
uniform samplerCube uSkyA;
uniform samplerCube uSkyB;
uniform mat3 uRotB;
uniform vec3 uAxis;      // e_l — радиальное направление камеры в мире
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform float uStreak;   // растяжка от скорости прокрутки
uniform float uDisp;     // хроматическая дисперсия в горловине
uniform float uGain;
varying vec2 vUv;

// судьба луча с углом alpha: (phi, сторона)
vec2 lut(float alpha) {
  float u = alpha / PI * uN - 0.5;
  float i0 = clamp(floor(u), 0.0, uN - 1.0);
  float f = clamp(u - i0, 0.0, 1.0);
  vec2 a = texelFetch(uLut, ivec2(int(i0), 0), 0).xy;
  vec2 c = texelFetch(uLut, ivec2(int(min(i0 + 1.0, uN - 1.0)), 0), 0).xy;
  // на границе вселенных углы не смешиваем — берём ближайший луч
  if (a.y != c.y) return f < 0.5 ? a : c;
  return vec2(mix(a.x, c.x, f), a.y);
}

vec3 skyFor(vec3 A, vec3 B, float alpha) {
  vec2 v = lut(alpha);
  // одна точка выхода: компилятор D3D иначе ругается на «неинициализированный» результат
  vec3 c;
  if (v.y > 0.0) c = textureCube(uSkyA, cos(v.x) * A + sin(v.x) * B).rgb;
  else c = textureCube(uSkyB, uRotB * (-cos(v.x) * A + sin(v.x) * B)).rgb;
  return c;
}

void main() {
  vec4 view = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  view /= view.w;
  vec3 ro = (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 d = normalize((uCamWorld * vec4(view.xyz, 1.0)).xyz - ro);
  vec3 A = uAxis;
  float nl = dot(d, A);
  vec3 perp = d - nl * A;
  float pl = length(perp);
  vec3 B = pl > 1e-5 ? perp / pl : normalize(cross(A, vec3(0.0, 1.0, 0.1)));
  float alpha = acos(clamp(-nl, -1.0, 1.0));

  vec3 col;
  if (uDisp > 0.001) {
    // дисперсия: красный и синий идут по чуть разным траекториям
    col.r = skyFor(A, B, alpha * (1.0 + uDisp)).r;
    col.g = skyFor(A, B, alpha).g;
    col.b = skyFor(A, B, alpha * (1.0 - uDisp)).b;
  } else col = skyFor(A, B, alpha);

  // растяжка звёзд от скорости: несколько лучей ближе к оси полёта
  if (uStreak > 0.001) {
    vec3 acc = col;
    float w = 1.0;
    for (int k = 1; k <= 5; k++) {
      float t = float(k) / 5.0;
      float wk = 1.0 - t * 0.6;
      acc += skyFor(A, B, alpha * (1.0 - uStreak * t)) * wk;
      w += wk;
    }
    col = acc / w;
  }
  gl_FragColor = vec4(col * uGain, 1.0);
}
#endif
