// Общая атмосфера пролога: небо, дымка, пыль. Её подклеивают все материалы
// сцены — небо, земля, пшеница, буря, ферма, — чтобы дымка совпадала пиксель в пиксель.
uniform vec3 uSunDir;
uniform float uStorm;    // 0..1 — насколько близко буря
uniform float uDust;     // 0..1 — пыль в воздухе (к концу акта заливает кадр)
uniform float uSunVis;   // видимость солнца сквозь пыль

vec3 skyColor(vec3 d) {
  float h = d.y;
  float sd = max(dot(d, uSunDir), 0.0);
  vec3 zenith = mix(vec3(0.07, 0.085, 0.115), vec3(0.09, 0.065, 0.045), uStorm);
  vec3 horizon = mix(vec3(0.62, 0.36, 0.18), vec3(0.36, 0.2, 0.1), uStorm);
  float t = pow(smoothstep(-0.03, 0.55, h), 0.55);
  vec3 c = mix(horizon, zenith, t);
  // рассеяние Ми вокруг солнца: широкое тёплое гало и плотное ядро
  c += vec3(1.0, 0.5, 0.2) * pow(sd, 12.0) * 0.4 * uSunVis;
  c += vec3(1.0, 0.66, 0.34) * pow(sd, 160.0) * 0.9 * uSunVis;
  // диск солнца, сплюснутый у горизонта не будем — он и так низко
  float disk = smoothstep(0.99965, 0.99985, sd);
  c += vec3(14.0, 7.5, 3.2) * disk * uSunVis;
  // ниже горизонта — пыльная дымка, продолжает небо
  c = mix(c, horizon * 0.62, smoothstep(0.0, -0.08, h));
  return c;
}

/** цвет дымки в направлении d — небо у горизонта + рассеяние к солнцу */
vec3 hazeColor(vec3 d) {
  float sd = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);
  vec3 base = mix(vec3(0.46, 0.29, 0.16), vec3(0.3, 0.18, 0.1), uStorm);
  base += vec3(0.9, 0.46, 0.18) * pow(sd, 10.0) * 0.4 * uSunVis;
  vec3 dustC = vec3(0.22, 0.135, 0.07);
  return mix(base, dustC, uDust);
}

/** экспоненциальная дымка с падением плотности по высоте */
vec3 applyHaze(vec3 col, vec3 wp, vec3 camPos) {
  vec3 v = wp - camPos;
  float dist = length(v);
  vec3 d = v / max(dist, 1e-3);
  float dens = mix(0.0011, 0.0024, uStorm) + uDust * 0.06;
  float hf = exp(-max(wp.y, 0.0) * 0.004);
  float f = 1.0 - exp(-dist * dens * hf);
  return mix(col, hazeColor(d), clamp(f, 0.0, 1.0));
}
