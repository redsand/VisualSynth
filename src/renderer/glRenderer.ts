export interface RenderState {
  timeMs: number;
  rms: number;
  peak: number;
  strobe: number;
  plasmaEnabled: boolean;
  spectrumEnabled: boolean;
  spectrum: Float32Array;
  contrast: number;
  saturation: number;
  paletteShift: number;
  plasmaOpacity: number;
  spectrumOpacity: number;
  effectsEnabled: boolean;
  bloom: number;
  blur: number;
  chroma: number;
  posterize: number;
  kaleidoscope: number;
  feedback: number;
  persistence: number;
  trailSpectrum: Float32Array;
  particlesEnabled: boolean;
  particleDensity: number;
  particleSpeed: number;
  particleSize: number;
  particleGlow: number;
  sdfEnabled: boolean;
  sdfShape: number;
  sdfScale: number;
  sdfEdge: number;
  sdfGlow: number;
  sdfRotation: number;
  sdfFill: number;
}

export const resizeCanvasToDisplaySize = (canvas: HTMLCanvasElement) => {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
};

export const createGLRenderer = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    throw new Error('WebGL2 required');
  }

  const vertexShaderSrc = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

  const fragmentShaderSrc = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uRms;
uniform float uPeak;
uniform float uStrobe;
uniform float uPlasmaEnabled;
uniform float uSpectrumEnabled;
uniform float uSpectrum[64];
uniform float uContrast;
uniform float uSaturation;
uniform float uPaletteShift;
uniform float uPlasmaOpacity;
uniform float uSpectrumOpacity;
uniform float uEffectsEnabled;
uniform float uBloom;
uniform float uBlur;
uniform float uChroma;
uniform float uPosterize;
uniform float uKaleidoscope;
uniform float uFeedback;
uniform float uPersistence;
uniform float uTrailSpectrum[64];
uniform float uParticlesEnabled;
uniform float uParticleDensity;
uniform float uParticleSpeed;
uniform float uParticleSize;
uniform float uParticleGlow;
uniform float uSdfEnabled;
uniform float uSdfShape;
uniform float uSdfScale;
uniform float uSdfEdge;
uniform float uSdfGlow;
uniform float uSdfRotation;
uniform float uSdfFill;

in vec2 vUv;
out vec4 outColor;

float plasma(vec2 uv, float t) {
  float v = sin(uv.x * 8.0 + t) + sin(uv.y * 6.0 - t * 1.1);
  v += sin((uv.x + uv.y) * 4.0 + t * 0.7);
  return v * 0.5 + 0.5;
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float particleField(vec2 uv, float t, float density, float speed, float size) {
  float grid = mix(18.0, 90.0, density);
  vec2 drift = vec2(t * 0.02 * (0.2 + speed), t * 0.015 * (0.2 + speed));
  vec2 gv = uv * grid + drift;
  vec2 cell = floor(gv);
  vec2 f = fract(gv);
  float rnd = hash21(cell);
  vec2 pos = vec2(hash21(cell + 1.3), hash21(cell + 9.1));
  pos = 0.2 + 0.6 * pos;
  float twinkle = 0.4 + 0.6 * sin(t * (1.5 + rnd * 2.5) + rnd * 6.2831);
  float radius = mix(0.05, 0.015, density) * mix(1.4, 0.6, size);
  float d = distance(f, pos);
  float spark = smoothstep(radius, 0.0, d);
  return spark * twinkle;
}

vec2 rotate2d(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdEquilateralTriangle(vec2 p, float r) {
  float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) {
    p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
  }
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

vec3 applySaturation(vec3 color, float amount) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(luma), color, amount);
}

vec3 applyContrast(vec3 color, float amount) {
  return (color - 0.5) * amount + 0.5;
}

vec3 shiftPalette(vec3 color, float shift) {
  float angle = shift * 6.28318;
  mat3 rot = mat3(
    0.299 + 0.701 * cos(angle) + 0.168 * sin(angle), 0.587 - 0.587 * cos(angle) + 0.330 * sin(angle), 0.114 - 0.114 * cos(angle) - 0.497 * sin(angle),
    0.299 - 0.299 * cos(angle) - 0.328 * sin(angle), 0.587 + 0.413 * cos(angle) + 0.035 * sin(angle), 0.114 - 0.114 * cos(angle) + 0.292 * sin(angle),
    0.299 - 0.300 * cos(angle) + 1.250 * sin(angle), 0.587 - 0.588 * cos(angle) - 1.050 * sin(angle), 0.114 + 0.886 * cos(angle) - 0.203 * sin(angle)
  );
  return clamp(rot * color, 0.0, 1.0);
}

vec2 kaleidoscope(vec2 uv, float amount) {
  if (amount <= 0.01) return uv;
  vec2 centered = uv * 2.0 - 1.0;
  float angle = atan(centered.y, centered.x);
  float radius = length(centered);
  float slices = mix(1.0, 8.0, amount);
  float slice = 6.28318 / slices;
  angle = mod(angle, slice);
  angle = abs(angle - slice * 0.5);
  vec2 rotated = vec2(cos(angle), sin(angle)) * radius;
  return rotated * 0.5 + 0.5;
}

vec3 posterize(vec3 color, float amount) {
  if (amount <= 0.01) return color;
  float levels = mix(16.0, 3.0, amount);
  return floor(color * levels) / levels;
}

void main() {
  vec2 uv = vUv;
  vec2 effectUv = kaleidoscope(uv, uKaleidoscope);
  if (uFeedback > 0.01) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float radius = length(centered);
    float twist = uFeedback * 2.0;
    float angle = atan(centered.y, centered.x) + twist * radius * 2.0;
    effectUv = vec2(cos(angle), sin(angle)) * (radius * (1.0 - uFeedback * 0.2)) * 0.5 + 0.5;
  }
  vec3 color = vec3(0.02, 0.04, 0.08);
  if (uPlasmaEnabled > 0.5) {
    float p = plasma(effectUv, uTime);
    color += vec3(0.1 + p * 0.4, 0.2 + p * 0.5, 0.3 + p * 0.6) * uPlasmaOpacity;
  }

  if (uSpectrumEnabled > 0.5) {
    float band = floor(effectUv.x * 64.0);
    int index = int(clamp(band, 0.0, 63.0));
    float amp = uSpectrum[index];
    float trail = uTrailSpectrum[index];
    float bar = step(effectUv.y, amp);
    float trailBar = step(effectUv.y, trail);
    color += vec3(0.1, 0.6, 1.0) * bar * 0.8 * uSpectrumOpacity;
    if (uPersistence > 0.01) {
      color += vec3(0.1, 0.4, 0.8) * trailBar * 0.5 * uPersistence;
    }
  }

  if (uParticlesEnabled > 0.5) {
    float particles = particleField(effectUv, uTime, uParticleDensity, uParticleSpeed, uParticleSize);
    float lift = 0.5 + uRms * 0.8;
    color += vec3(0.2, 0.7, 1.0) * particles * uParticleGlow * lift;
  }

  if (uSdfEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    centered = rotate2d(centered, uSdfRotation);
    float scale = mix(0.2, 0.9, uSdfScale);
    float sdfValue = 0.0;
    if (uSdfShape < 0.5) {
      sdfValue = sdCircle(centered, scale);
    } else if (uSdfShape < 1.5) {
      sdfValue = sdBox(centered, vec2(scale));
    } else {
      sdfValue = sdEquilateralTriangle(centered, scale);
    }
    float edge = smoothstep(uSdfEdge + 0.02, 0.0, abs(sdfValue));
    float fill = smoothstep(0.02, -0.02, sdfValue);
    float sdfIntensity = max(fill * uSdfFill, edge * uSdfGlow);
    float pulse = 0.85 + uPeak * 0.6;
    color += vec3(1.0, 0.6, 0.25) * sdfIntensity * pulse;
  }

  float flash = uStrobe * 1.5;
  color += vec3(flash);
  color += vec3(uPeak * 0.2, uRms * 0.5, uRms * 0.8);

  if (uEffectsEnabled > 0.5) {
    float bloom = uBloom;
    color += pow(color, vec3(2.0)) * bloom;
    color = posterize(color, uPosterize);
  }

  if (uEffectsEnabled > 0.5 && uChroma > 0.01) {
    vec2 offset = vec2(uChroma * 0.02, 0.0);
    vec3 shifted = vec3(color.r, color.g, color.b);
    shifted.r = color.r + offset.x;
    shifted.b = color.b - offset.x;
    color = mix(color, shifted, 0.3);
  }

  if (uEffectsEnabled > 0.5 && uBlur > 0.01) {
    color = mix(color, vec3((color.r + color.g + color.b) / 3.0), uBlur * 0.3);
  }

  color = shiftPalette(color, uPaletteShift);
  color = applySaturation(color, uSaturation);
  color = applyContrast(color, uContrast);

  outColor = vec4(color, 1.0);
}`;

  const compileShader = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Shader creation failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile error');
    }
    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSrc);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSrc);

  const program = gl.createProgram();
  if (!program) throw new Error('Program creation failed');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Program link error');
  }

  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) throw new Error('Buffer creation failed');

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const vertices = new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1
  ]);

  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, 'position');

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const timeLocation = gl.getUniformLocation(program, 'uTime');
  const rmsLocation = gl.getUniformLocation(program, 'uRms');
  const peakLocation = gl.getUniformLocation(program, 'uPeak');
  const strobeLocation = gl.getUniformLocation(program, 'uStrobe');
  const plasmaLocation = gl.getUniformLocation(program, 'uPlasmaEnabled');
  const spectrumLocation = gl.getUniformLocation(program, 'uSpectrumEnabled');
  const spectrumArrayLocation = gl.getUniformLocation(program, 'uSpectrum');
  const contrastLocation = gl.getUniformLocation(program, 'uContrast');
  const saturationLocation = gl.getUniformLocation(program, 'uSaturation');
  const paletteLocation = gl.getUniformLocation(program, 'uPaletteShift');
  const plasmaOpacityLocation = gl.getUniformLocation(program, 'uPlasmaOpacity');
  const spectrumOpacityLocation = gl.getUniformLocation(program, 'uSpectrumOpacity');
  const effectsEnabledLocation = gl.getUniformLocation(program, 'uEffectsEnabled');
  const bloomLocation = gl.getUniformLocation(program, 'uBloom');
  const blurLocation = gl.getUniformLocation(program, 'uBlur');
  const chromaLocation = gl.getUniformLocation(program, 'uChroma');
  const posterizeLocation = gl.getUniformLocation(program, 'uPosterize');
  const kaleidoscopeLocation = gl.getUniformLocation(program, 'uKaleidoscope');
  const feedbackLocation = gl.getUniformLocation(program, 'uFeedback');
  const persistenceLocation = gl.getUniformLocation(program, 'uPersistence');
  const trailSpectrumLocation = gl.getUniformLocation(program, 'uTrailSpectrum');
  const particlesEnabledLocation = gl.getUniformLocation(program, 'uParticlesEnabled');
  const particleDensityLocation = gl.getUniformLocation(program, 'uParticleDensity');
  const particleSpeedLocation = gl.getUniformLocation(program, 'uParticleSpeed');
  const particleSizeLocation = gl.getUniformLocation(program, 'uParticleSize');
  const particleGlowLocation = gl.getUniformLocation(program, 'uParticleGlow');
  const sdfEnabledLocation = gl.getUniformLocation(program, 'uSdfEnabled');
  const sdfShapeLocation = gl.getUniformLocation(program, 'uSdfShape');
  const sdfScaleLocation = gl.getUniformLocation(program, 'uSdfScale');
  const sdfEdgeLocation = gl.getUniformLocation(program, 'uSdfEdge');
  const sdfGlowLocation = gl.getUniformLocation(program, 'uSdfGlow');
  const sdfRotationLocation = gl.getUniformLocation(program, 'uSdfRotation');
  const sdfFillLocation = gl.getUniformLocation(program, 'uSdfFill');

  return {
    render: (state: RenderState) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.02, 0.03, 0.06, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      if (timeLocation) gl.uniform1f(timeLocation, state.timeMs * 0.001);
      if (rmsLocation) gl.uniform1f(rmsLocation, state.rms);
      if (peakLocation) gl.uniform1f(peakLocation, state.peak);
      if (strobeLocation) gl.uniform1f(strobeLocation, state.strobe);
      if (plasmaLocation) gl.uniform1f(plasmaLocation, state.plasmaEnabled ? 1 : 0);
      if (spectrumLocation) gl.uniform1f(spectrumLocation, state.spectrumEnabled ? 1 : 0);
      if (spectrumArrayLocation) {
        gl.uniform1fv(spectrumArrayLocation, state.spectrum);
      }
      if (contrastLocation) gl.uniform1f(contrastLocation, state.contrast);
      if (saturationLocation) gl.uniform1f(saturationLocation, state.saturation);
      if (paletteLocation) gl.uniform1f(paletteLocation, state.paletteShift);
      if (plasmaOpacityLocation) gl.uniform1f(plasmaOpacityLocation, state.plasmaOpacity);
      if (spectrumOpacityLocation) gl.uniform1f(spectrumOpacityLocation, state.spectrumOpacity);
      if (effectsEnabledLocation) gl.uniform1f(effectsEnabledLocation, state.effectsEnabled ? 1 : 0);
      if (bloomLocation) gl.uniform1f(bloomLocation, state.bloom);
      if (blurLocation) gl.uniform1f(blurLocation, state.blur);
      if (chromaLocation) gl.uniform1f(chromaLocation, state.chroma);
      if (posterizeLocation) gl.uniform1f(posterizeLocation, state.posterize);
      if (kaleidoscopeLocation) gl.uniform1f(kaleidoscopeLocation, state.kaleidoscope);
      if (feedbackLocation) gl.uniform1f(feedbackLocation, state.feedback);
      if (persistenceLocation) gl.uniform1f(persistenceLocation, state.persistence);
      if (trailSpectrumLocation) gl.uniform1fv(trailSpectrumLocation, state.trailSpectrum);
      if (particlesEnabledLocation) gl.uniform1f(particlesEnabledLocation, state.particlesEnabled ? 1 : 0);
      if (particleDensityLocation) gl.uniform1f(particleDensityLocation, state.particleDensity);
      if (particleSpeedLocation) gl.uniform1f(particleSpeedLocation, state.particleSpeed);
      if (particleSizeLocation) gl.uniform1f(particleSizeLocation, state.particleSize);
      if (particleGlowLocation) gl.uniform1f(particleGlowLocation, state.particleGlow);
      if (sdfEnabledLocation) gl.uniform1f(sdfEnabledLocation, state.sdfEnabled ? 1 : 0);
      if (sdfShapeLocation) gl.uniform1f(sdfShapeLocation, state.sdfShape);
      if (sdfScaleLocation) gl.uniform1f(sdfScaleLocation, state.sdfScale);
      if (sdfEdgeLocation) gl.uniform1f(sdfEdgeLocation, state.sdfEdge);
      if (sdfGlowLocation) gl.uniform1f(sdfGlowLocation, state.sdfGlow);
      if (sdfRotationLocation) gl.uniform1f(sdfRotationLocation, state.sdfRotation);
      if (sdfFillLocation) gl.uniform1f(sdfFillLocation, state.sdfFill);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
};
