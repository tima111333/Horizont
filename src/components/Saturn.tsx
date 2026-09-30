// Газовый гигант с кольцами: полосы облаков, тень колец на планете и тень
// планеты на кольцах — обе считаются лучом к солнцу прямо в шейдере.
import { useMemo } from 'react'
import * as THREE from 'three'
import noise from '../shaders/noise.glsl?raw'

export interface SaturnProps {
  position: [number, number, number]
  radius: number
  sun: THREE.Vector3
  tilt?: [number, number, number]
  time: { value: number }
}

const ringBands = /* glsl */ `
// плотность колец по радиусу: щели, деление Кассини, тонкая структура
float ringDensity(float r) {
  float x = (r - 1.24) / (2.27 - 1.24);
  if (x < 0.0 || x > 1.0) return 0.0;
  float d = 0.25 + 0.5 * smoothstep(0.0, 0.12, x);          // внутреннее кольцо C — тусклое
  d += 0.45 * smoothstep(0.26, 0.3, x) * (1.0 - smoothstep(0.58, 0.6, x)); // яркое кольцо B
  d *= 1.0 - 0.95 * smoothstep(0.595, 0.605, x) * (1.0 - smoothstep(0.66, 0.67, x)); // деление Кассини
  d *= 1.0 - 0.6 * smoothstep(0.86, 0.865, x) * (1.0 - smoothstep(0.875, 0.88, x)); // щель Энке
  d *= 0.75 + 0.25 * sin(x * 420.0) * sin(x * 130.0 + 1.3);
  d *= smoothstep(1.0, 0.95, x);
  return clamp(d, 0.0, 1.0);
}
`

export function Saturn({ position, radius, sun, tilt = [0.42, 0, 0.2], time }: SaturnProps) {
  const { planet, ring, uniforms } = useMemo(() => {
    const uniforms = {
      uSun: { value: sun },
      uTime: time,
      uR: { value: radius },
      uC: { value: new THREE.Vector3(...position) },
      uN: { value: new THREE.Vector3(0, 1, 0) },
    }
    const planet = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        varying vec3 vL;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vL = position;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader:
        noise +
        ringBands +
        /* glsl */ `
        uniform vec3 uSun;
        uniform float uTime;
        uniform float uR;
        uniform vec3 uC;
        uniform vec3 uN;
        varying vec3 vW;
        varying vec3 vL;
        void main() {
          vec3 N = normalize(vW - uC);
          vec3 loc = normalize(vL);
          float lat = loc.y;
          // полосы по широте, слегка завихрённые
          float w = fbm3(vec3(loc.x * 3.0, lat * 18.0, loc.z * 3.0 + uTime * 0.002)) * 0.08;
          float band = sin((lat + w) * 38.0) * 0.5 + 0.5;
          float band2 = sin((lat + w * 1.5) * 91.0) * 0.5 + 0.5;
          vec3 alb = mix(vec3(0.62, 0.5, 0.34), vec3(0.86, 0.76, 0.56), band);
          alb *= 0.88 + 0.12 * band2;
          alb = mix(alb, vec3(0.62, 0.66, 0.68), smoothstep(0.75, 0.95, abs(lat)));
          float ndl = dot(N, uSun);
          float lit = smoothstep(-0.05, 0.25, ndl) * max(ndl, 0.0) * 0.85 + 0.15 * smoothstep(-0.1, 0.4, ndl);
          // тень колец: луч к солнцу пересекает плоскость колец
          float t = -dot(vW - uC, uN) / dot(uSun, uN);
          if (t > 0.0) {
            vec3 hit = vW + uSun * t;
            float rr = length(hit - uC) / uR;
            lit *= 1.0 - 0.85 * ringDensity(rr);
          }
          vec3 col = alb * lit * 1.35;
          // лимб темнеет, атмосфера чуть светится по краю
          vec3 V = normalize(cameraPosition - vW);
          float mu = max(dot(N, V), 0.0);
          col *= 0.55 + 0.45 * pow(mu, 0.4);
          col += vec3(0.9, 0.75, 0.55) * pow(1.0 - mu, 5.0) * max(ndl, 0.0) * 0.4;
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    const ring = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader:
        ringBands +
        /* glsl */ `
        uniform vec3 uSun;
        uniform float uR;
        uniform vec3 uC;
        uniform vec3 uN;
        varying vec3 vW;
        void main() {
          float r = length(vW - uC) / uR;
          float d = ringDensity(r);
          if (d < 0.01) discard;
          // тень планеты на кольцах
          vec3 oc = vW - uC;
          float b = dot(oc, uSun);
          float c = dot(oc, oc) - uR * uR;
          float shadow = (b < 0.0 && b * b - c > 0.0) ? 0.04 : 1.0;
          vec3 V = normalize(cameraPosition - vW);
          // кольца из льда: при взгляде против солнца светятся рассеянием вперёд
          float fwd = pow(max(dot(-V, uSun), 0.0), 6.0);
          float lit = abs(dot(uSun, uN)) * 1.6 + fwd * 1.8;
          vec3 alb = mix(vec3(0.62, 0.52, 0.4), vec3(0.86, 0.78, 0.64), smoothstep(0.3, 0.8, d));
          gl_FragColor = vec4(alb * lit * shadow * 0.75, d * 0.9);
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    return { planet, ring, uniforms }
  }, [sun, time, radius, position])

  const q = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(...tilt)), [tilt])
  uniforms.uN.value.set(0, 1, 0).applyQuaternion(q)

  return (
    <group position={position} quaternion={q}>
      <mesh material={planet}>
        <sphereGeometry args={[radius, 128, 64]} />
      </mesh>
      <mesh material={ring} rotation-x={-Math.PI / 2} renderOrder={1}>
        <ringGeometry args={[radius * 1.22, radius * 2.3, 256, 1]} />
      </mesh>
    </group>
  )
}
