// Гаргантюа. Фотоны летят по уравнению Шварцшильда в виде «ньютоновской»
// силы a = -3/2 · h² · x / r⁵ (единицы: радиус горизонта rs = 1, h — удельный
// момент луча). Интегратор — полунеявный Эйлер с шагом, растущим с радиусом.
// Тонкий диск в плоскости y = 0: при каждом пересечении луч набирает свет диска
// и теряет прозрачность. Верхняя и нижняя дуги над тенью — это дальняя часть
// того же диска, увиденная через искривление: их никто не рисует отдельно.
uniform samplerCube uSky;
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;      // позиция камеры в единицах rs
uniform float uTime;
uniform float uSteps;
uniform float uDiskIn;
uniform float uDiskOut;
uniform float uDoppler;
uniform float uGain;
uniform float uSkyGain;
uniform mat3 uSkyRot;
varying vec2 vUv;

#define PI 3.14159265

// цвет по «температуре» 0..1: от тёмно-красного через золото к бело-жёлтому
vec3 heat(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 a = vec3(0.55, 0.12, 0.02);
  vec3 b = vec3(1.0, 0.55, 0.15);
  vec3 c = vec3(1.0, 0.9, 0.72);
  vec3 d = vec3(1.0, 0.98, 0.94);
  if (t < 0.35) return mix(a, b, t / 0.35);
  if (t < 0.7) return mix(b, c, (t - 0.35) / 0.35);
  return mix(c, d, (t - 0.7) / 0.3);
}

// плотность и цвет диска в точке пересечения
vec4 disk(vec3 p, vec3 photonDir) {
  float r = length(p.xz);
  if (r < uDiskIn || r > uDiskOut) return vec4(0.0);
  float phi = atan(p.z, p.x);
  // кеплеровское вращение: внутренние кольца обгоняют внешние, почти незаметно
  float w = pow(r, -1.5) * 0.9;
  float ang = phi + w * uTime;
  vec3 q = vec3(r * 3.2, cos(ang) * 2.2, sin(ang) * 2.2);
  float n = fbm3(q) * 0.5 + 0.5;
  float n2 = fbm3(q * vec3(2.6, 1.6, 1.6) + 7.0) * 0.5 + 0.5;
  float streaks = 0.7 + 0.3 * sin(r * 17.0 + n * 9.0 + n2 * 4.0);
  float dens = smoothstep(0.15, 0.8, n) * (0.45 + 0.55 * n2) * streaks;
  // мягкие края: внутренний обрыв у ISCO и затухание к внешнему краю
  dens *= smoothstep(uDiskIn, uDiskIn + 0.35, r) * smoothstep(uDiskOut, uDiskOut * 0.62, r);

  // профиль яркости тонкого диска: T ∝ r^-3/4 (1 - √(rin/r))^1/4
  float x = uDiskIn / r;
  float T = pow(x, 0.75) * pow(max(1.0 - sqrt(x * 0.85), 0.0), 0.25) * 1.25;
  // доплер: вещество летит по кругу вокруг +y; фотон к камере — против хода луча
  float v = sqrt(0.5 / max(r - 1.0, 0.2));
  v = min(v, 0.7);
  vec3 vel = normalize(vec3(-p.z, 0.0, p.x)) * v;
  float gamma = 1.0 / sqrt(1.0 - v * v);
  float D = 1.0 / (gamma * (1.0 - dot(vel, photonDir)));
  // гравитационное красное смещение у горизонта
  float grav = sqrt(max(1.0 - 1.0 / r, 0.0));
  float boost = mix(1.0, pow(D * grav, 3.0), uDoppler);
  float temp = T * mix(1.0, D * grav, uDoppler * 0.6);
  vec3 col = heat(temp * 0.95) * T * T * 2.5 * boost;
  return vec4(col, clamp(dens * 1.4, 0.0, 0.97));
}

void main() {
  vec4 view = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  view /= view.w;
  vec3 wo = (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 rd = normalize((uCamWorld * vec4(view.xyz, 1.0)).xyz - wo);

  vec3 pos = uCamPos;
  vec3 vel = rd;
  vec3 hvec = cross(pos, vel);
  float h2 = dot(hvec, hvec);

  vec3 acc = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  float glow = 0.0;

  for (int i = 0; i < 400; i++) {
    if (float(i) >= uSteps) break;
    float r2 = dot(pos, pos);
    float r = sqrt(r2);
    if (r < 1.0) { captured = true; break; }
    if (r > 80.0 && dot(pos, vel) > 0.0) break;
    float dt = clamp(0.05 * r, 0.012, 2.5);
    // ближе к фотонной сфере — мельче шаг
    dt *= mix(0.45, 1.0, smoothstep(1.4, 3.0, r));
    vec3 a = -1.5 * h2 * pos / (r2 * r2 * r);
    vec3 prev = pos;
    vel += a * dt;
    pos += vel * dt;
    // лёгкое свечение вокруг тени — рассеянный свет горячего газа
    glow += exp(-abs(pos.y) * 4.0) * smoothstep(9.0, 2.5, r) * dt * 0.003;
    if (prev.y * pos.y < 0.0) {
      float t = prev.y / (prev.y - pos.y);
      vec3 hit = mix(prev, pos, t);
      vec4 d = disk(hit, -normalize(vel));
      acc += trans * d.rgb * d.a;
      trans *= 1.0 - d.a;
      if (trans < 0.02) break;
    }
  }
  vec3 col = acc;
  if (!captured && trans > 0.02) col += trans * textureCube(uSky, uSkyRot * normalize(vel)).rgb * uSkyGain;
  col += vec3(1.0, 0.7, 0.4) * glow * trans;
  gl_FragColor = vec4(col * uGain, 1.0);
}
