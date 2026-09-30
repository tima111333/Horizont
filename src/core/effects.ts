// Свои эффекты для цепочки postprocessing: экспозиция до тонмаппинга и «плёнка»
// после — грейдинг, виньетка, зерно, склейки между актами.
import { Effect, BlendFunction } from 'postprocessing'
import * as THREE from 'three'

export class ExposureEffect extends Effect {
  constructor() {
    super(
      'Exposure',
      /* glsl */ `
      uniform float uExposure;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = vec4(inputColor.rgb * uExposure, inputColor.a);
      }`,
      { blendFunction: BlendFunction.SET, uniforms: new Map([['uExposure', new THREE.Uniform(1)]]) },
    )
  }
  set exposure(v: number) {
    this.uniforms.get('uExposure')!.value = v
  }
}

const gradeFrag = /* glsl */ `
uniform vec3 uTint;
uniform vec3 uLift;
uniform float uSat;
uniform float uContrast;
uniform float uVignette;
uniform float uGrain;
uniform float uDip;
uniform vec3 uDipColor;
uniform float uTime;
uniform vec2 uRes;

// дешёвый хеш без синусов (Dave Hoskins) — ровное распределение, нет полос
float hash13(vec3 p3) {
  p3 = fract(p3 * .1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0);
  c = pow(c, vec3(1.0 / 2.2));

  c *= uTint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = (c - 0.5) * uContrast + 0.5;
  c = c + uLift * (1.0 - c);

  // виньетка по эллипсу кадра, мягкая, с лёгким падением к краям
  vec2 q = uv - 0.5;
  q.x *= uRes.x / uRes.y * 0.72;
  float v = 1.0 - smoothstep(0.28, 0.95, length(q));
  c *= mix(1.0, v, uVignette);

  // склейка
  c = mix(c, uDipColor, uDip);

  // зерно: две частоты, сильнее в полутонах, слабее в светах — как у плёнки
  vec2 px = uv * uRes;
  float fr = floor(uTime * 24.0);
  float g1 = hash13(vec3(px, fr)) - 0.5;
  float g2 = hash13(vec3(floor(px * 0.5), fr + 17.0)) - 0.5;
  float g = g1 * 0.6 + g2 * 0.55;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float amt = uGrain * (0.018 + 0.05 * lum * (1.0 - lum) * 2.0);
  c += g * amt;

  c = pow(max(c, 0.0), vec3(2.2));
  outputColor = vec4(c, inputColor.a);
}
`

export class GradeEffect extends Effect {
  constructor() {
    super('Grade', gradeFrag, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, THREE.Uniform>([
        ['uTint', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
        ['uLift', new THREE.Uniform(new THREE.Vector3())],
        ['uSat', new THREE.Uniform(1)],
        ['uContrast', new THREE.Uniform(1)],
        ['uVignette', new THREE.Uniform(0.5)],
        ['uGrain', new THREE.Uniform(1)],
        ['uDip', new THREE.Uniform(0)],
        ['uDipColor', new THREE.Uniform(new THREE.Vector3())],
        ['uTime', new THREE.Uniform(0)],
        ['uRes', new THREE.Uniform(new THREE.Vector2(1, 1))],
      ]),
    })
  }
  u(name: string) {
    return this.uniforms.get(name)!
  }
  update(_r: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget, dt?: number) {
    this.u('uTime').value += dt ?? 0.016
    this.u('uRes').value.set(input.width, input.height)
  }
}
