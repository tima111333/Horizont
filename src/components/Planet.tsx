// Планета с атмосферой для орбитальных кадров. Рисуется одним полноэкранным
// проходом с аналитическим пересечением луча и сферы: у полигональной сферы
// радиусом в тысячи единиц горизонт гранится, а здесь край идеально круглый.
// Материки, облака, блик океана, терминатор, светящийся лимб.
import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import noise from '../shaders/noise.glsl?raw'

export interface PlanetProps {
  radius: number
  center: THREE.Vector3
  sun: THREE.Vector3
  /** 0 — живая Земля, 1 — пыльная, умирающая */
  dust?: number
  time: { value: number }
  /** поворот поверхности (вращение планеты), рад */
  spin?: { value: number }
}

const frag = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uC;
uniform float uR;
uniform float uRa;
uniform float uTime;
uniform float uDust;
uniform float uSpin;
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
varying vec2 vUv;

vec2 sph(vec3 ro, vec3 rd, float r) {
  vec3 oc = ro - uC;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

vec3 surface(vec3 N, vec3 V) {
  // поворот координат поверхности вокруг оси планеты
  float cs = cos(uSpin), sn = sin(uSpin);
  vec3 P = vec3(cs * N.x + sn * N.z, N.y, -sn * N.x + cs * N.z);
  float c = fbm3(P * 2.1 + 3.7) + 0.35 * fbm3(P * 7.0);
  float land = smoothstep(0.02, 0.09, c);
  float m = fbm3(P * 11.0 + 9.0) * 0.5 + 0.5;
  vec3 green = vec3(0.07, 0.1, 0.045);
  vec3 tan = mix(vec3(0.3, 0.23, 0.14), vec3(0.5, 0.38, 0.24), m);
  vec3 landC = mix(green, tan, clamp(uDust + (m - 0.5) * 0.8, 0.0, 1.0));
  vec3 ocean = vec3(0.01, 0.035, 0.08);
  vec3 alb = mix(ocean, landC, land);
  vec3 q = P * 5.0 + vec3(uTime * 0.004, 0.0, 0.0);
  float cl = smoothstep(0.05, 0.55, fbm3(q + fbm3(q * 0.6) * 0.8));
  cl = max(cl, smoothstep(0.35, 0.7, fbm3(P * 14.0 - uTime * 0.003)) * 0.55);
  float ndl = dot(N, uSun);
  float day = smoothstep(-0.12, 0.25, ndl);
  vec3 col = alb * max(ndl, 0.0) * 2.0;
  vec3 H = normalize(uSun + V);
  col += vec3(1.0, 0.85, 0.65) * pow(max(dot(N, H), 0.0), 220.0) * (1.0 - land) * (1.0 - cl) * 2.5 * day;
  col = mix(col, vec3(0.9, 0.9, 0.88) * (max(ndl, 0.0) * 2.2 + 0.01), cl);
  float city = step(0.992, hash13(floor(P * 420.0))) * land * (1.0 - day) * (1.0 - cl);
  col += vec3(1.0, 0.68, 0.32) * city * 0.9;
  return col;
}

void main() {
  vec4 view = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  view /= view.w;
  vec3 ro = (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 rd = normalize((uCamWorld * vec4(view.xyz, 1.0)).xyz - ro);
  vec2 a = sph(ro, rd, uRa);
  if (a.y < 0.0 || a.x > 1e8) discard;
  vec2 p = sph(ro, rd, uR);
  bool hit = p.x > 0.0 && p.x < 1e8;
  float t0 = max(a.x, 0.0);
  float t1 = hit ? p.x : a.y;

  // атмосфера: 10 шагов по хорде, экспоненциальная плотность по высоте.
  // Рассеянный свет насыщается (1 - e^-τ), а не растёт бесконечно на скользящих лучах.
  float H = (uRa - uR) * 0.22;
  float od = 0.0;
  vec3 lit = vec3(0.0);
  float dt = (t1 - t0) / 10.0;
  for (int i = 0; i < 10; i++) {
    vec3 x = ro + rd * (t0 + (float(i) + 0.5) * dt);
    vec3 n = x - uC;
    float h = length(n) - uR;
    float d = exp(-max(h, 0.0) / H);
    od += d * dt;
    float mu = dot(normalize(n), uSun);
    float sunL = smoothstep(-0.2, 0.15, mu);
    vec3 tint = mix(vec3(1.0, 0.38, 0.1), vec3(0.24, 0.48, 1.0), smoothstep(-0.06, 0.3, mu));
    lit += d * dt * sunL * tint;
  }
  float tau = od / (H * 6.0);
  vec3 avgTint = lit / max(od, 1e-4);
  float ph = 0.8 + 1.2 * pow(max(dot(rd, uSun), 0.0), 5.0);
  vec3 atm = avgTint * (1.0 - exp(-tau)) * 1.15 * ph;
  float ext = exp(-tau * 0.6);

  if (hit) {
    vec3 X = ro + rd * p.x;
    vec3 N = normalize(X - uC);
    vec3 col = surface(N, -rd) * ext + atm;
    gl_FragColor = vec4(col, 1.0);
  } else {
    gl_FragColor = vec4(atm, 0.0);
  }
}
`

export function Planet({ radius, center, sun, dust = 0.6, time, spin }: PlanetProps) {
  const camera = useThree((s) => s.camera)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSun: { value: sun },
          uTime: time,
          uSpin: spin ?? { value: 0 },
          uC: { value: center },
          uR: { value: radius },
          uRa: { value: radius * 1.022 },
          uDust: { value: dust },
          uProjInv: { value: new THREE.Matrix4() },
          uCamWorld: { value: new THREE.Matrix4() },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 1.0, 1.0);
          }`,
        fragmentShader: noise + frag,
        // в непрозрачном списке с renderOrder -8: после неба и звёзд, до корабля
        transparent: false,
        depthTest: false,
        depthWrite: false,
        // предумноженная альфа: планета закрывает звёзды, атмосфера светится поверх
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    [sun, time, spin, center, radius, dust],
  )
  useFrame(() => {
    // CameraRig только что сдвинул камеру — матрицу мира обновляем сами, иначе отставание на кадр
    camera.updateMatrixWorld()
    mat.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse)
    mat.uniforms.uCamWorld.value.copy(camera.matrixWorld)
  }, 0)
  return (
    <mesh material={mat} frustumCulled={false} renderOrder={-8}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
