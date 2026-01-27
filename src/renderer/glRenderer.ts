import { toFileUrl } from '../shared/fileUrl';
import type { AssetItem } from '../shared/project';
import type { AssetTextureSampling } from '../shared/assets';

export interface RenderState {
  timeMs: number;
  rms: number;
  peak: number;
  strobe: number;
  plasmaEnabled: boolean;
  spectrumEnabled: boolean;
  origamiEnabled: boolean;
  glyphEnabled: boolean;
  crystalEnabled: boolean;
  inkEnabled: boolean;
  topoEnabled: boolean;
  weatherEnabled: boolean;
  portalEnabled: boolean;
  oscilloEnabled: boolean;
  spectrum: Float32Array;
  contrast: number;
  saturation: number;
  paletteShift: number;
  plasmaOpacity: number;
  plasmaSpeed: number;
  plasmaScale: number;
  spectrumOpacity: number;
  origamiOpacity: number;
  origamiFoldState: number;
  origamiFoldSharpness: number;
  glyphOpacity: number;
  glyphMode: number;
  glyphSeed: number;
  glyphBeat: number;
  glyphSpeed: number;
  crystalOpacity: number;
  crystalMode: number;
  crystalBrittleness: number;
  crystalScale: number;
  crystalSpeed: number;
  inkOpacity: number;
  inkBrush: number;
  inkPressure: number;
  inkLifespan: number;
  inkSpeed: number;
  inkScale: number;
  topoOpacity: number;
  topoQuake: number;
  topoSlide: number;
  topoPlate: number;
  topoTravel: number;
  topoScale: number;
  topoElevation: number;
  weatherOpacity: number;
  weatherMode: number;
  weatherIntensity: number;
  weatherSpeed: number;
  portalOpacity: number;
  portalShift: number;
  portalPositions: Float32Array;
  portalRadii: Float32Array;
  portalActives: Float32Array;
  oscilloOpacity: number;
  oscilloMode: number;
  oscilloFreeze: number;
  oscilloRotate: number;
  oscilloData: Float32Array;
  plasmaAssetBlendMode: number;
  plasmaAssetAudioReact: number;
  spectrumAssetBlendMode: number;
  spectrumAssetAudioReact: number;
  effectsEnabled: boolean;
  bloom: number;
  blur: number;
  chroma: number;
  posterize: number;
  kaleidoscope: number;
  kaleidoscopeRotation: number;
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
  gravityPositions: Float32Array;
  gravityStrengths: Float32Array;
  gravityPolarities: Float32Array;
  gravityActives: Float32Array;
  gravityCollapse: number;
  debugTint?: number;
  origamiSpeed: number;
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
uniform float uOrigamiEnabled;
uniform float uGlyphEnabled;
uniform float uGlyphOpacity;
uniform float uGlyphMode;
uniform float uGlyphSeed;
uniform float uGlyphBeat;
uniform float uGlyphSpeed;
uniform float uCrystalEnabled;
uniform float uCrystalOpacity;
uniform float uCrystalMode;
uniform float uCrystalBrittleness;
uniform float uCrystalScale;
uniform float uCrystalSpeed;
uniform float uInkEnabled;
uniform float uInkOpacity;
uniform float uInkBrush;
uniform float uInkPressure;
uniform float uInkLifespan;
uniform float uInkSpeed;
uniform float uInkScale;
uniform float uTopoEnabled;
uniform float uTopoOpacity;
uniform float uTopoQuake;
uniform float uTopoSlide;
uniform float uTopoPlate;
uniform float uTopoTravel;
uniform float uTopoScale;
uniform float uTopoElevation;
uniform float uWeatherEnabled;
uniform float uWeatherOpacity;
uniform float uWeatherMode;
uniform float uWeatherIntensity;
uniform float uWeatherSpeed;
uniform float uPortalEnabled;
uniform float uPortalOpacity;
uniform float uPortalShift;
uniform vec2 uPortalPos[4];
uniform float uPortalRadius[4];
uniform float uPortalActive[4];
uniform float uOscilloEnabled;
uniform float uOscilloOpacity;
uniform float uOscilloMode;
uniform float uOscilloFreeze;
uniform float uOscilloRotate;
uniform float uOscillo[256];
uniform vec2 uGravityPos[8];
uniform float uGravityStrength[8];
uniform float uGravityPolarity[8];
uniform float uGravityActive[8];
uniform float uGravityCollapse;
uniform float uSpectrum[64];
uniform float uContrast;
uniform float uSaturation;
uniform float uPaletteShift;
uniform vec3 uPalette[5];
uniform float uPlasmaOpacity;
uniform float uPlasmaSpeed;
uniform float uPlasmaScale;
uniform float uSpectrumOpacity;
uniform float uOrigamiOpacity;
uniform float uOrigamiFoldState;
uniform float uOrigamiFoldSharpness;
uniform float uOrigamiSpeed;
uniform float uEffectsEnabled;
uniform float uBloom;
uniform float uBlur;
uniform float uChroma;
uniform float uPosterize;
uniform float uKaleidoscope;
uniform float uKaleidoscopeRotation;
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
uniform float uPlasmaAssetEnabled;
uniform sampler2D uPlasmaAsset;
uniform float uPlasmaAssetBlend;
uniform float uSpectrumAssetEnabled;
uniform sampler2D uSpectrumAsset;
uniform float uSpectrumAssetBlend;
uniform float uPlasmaAssetAudioReact;
uniform float uSpectrumAssetAudioReact;
uniform float uDebugTint;

in vec2 vUv;
out vec4 outColor;

vec3 blendAdd(vec3 base, vec3 blend) {
  return min(base + blend, 1.0);
}

vec3 blendMultiply(vec3 base, vec3 blend) {
  return base * blend;
}

vec3 blendScreen(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) * (1.0 - blend);
}

vec3 blendOverlay(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend,
    1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
    step(0.5, base)
  );
}

vec3 blendDifference(vec3 base, vec3 blend) {
  return abs(base - blend);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float sdArc(vec2 p, vec2 center, float radius, float thickness) {
  float d = abs(length(p - center) - radius);
  return d - thickness;
}

float hash21(vec2 p);

float oscilloSample(float t) {
  float idx = clamp(t, 0.0, 1.0) * 255.0;
  int i0 = int(floor(idx));
  int i1 = min(255, i0 + 1);
  float f = fract(idx);
  float a = uOscillo[i0];
  float b = uOscillo[i1];
  return mix(a, b, f);
}

float glyphShape(vec2 p, float seed, float family, float complexity) {
  float thickness = mix(0.035, 0.012, complexity);
  float g = 10.0;
  float h1 = hash21(vec2(seed, family));
  float h2 = hash21(vec2(seed + 11.3, family * 1.7));
  float h3 = hash21(vec2(seed + 23.7, family * 2.3));
  vec2 a = vec2(-0.32 + h1 * 0.2, -0.25 + h2 * 0.15);
  vec2 b = vec2(0.32 - h2 * 0.2, 0.25 - h3 * 0.15);
  vec2 c = vec2(-0.22 + h3 * 0.2, 0.28 - h1 * 0.18);
  vec2 d = vec2(0.22 - h1 * 0.2, -0.28 + h2 * 0.18);
  g = min(g, sdSegment(p, a, b));
  g = min(g, sdSegment(p, c, d));
  if (h1 > 0.4) {
    g = min(g, sdSegment(p, vec2(-0.28, 0.0), vec2(0.28, 0.0)));
  }
  if (h2 > 0.5) {
    float radius = 0.18 + h3 * 0.12;
    vec2 center = vec2(0.0, -0.02 + (h1 - 0.5) * 0.2);
    g = min(g, sdArc(p, center, radius, thickness));
  }
  return g;
}

float crystalField(vec2 p, float seed, float scale) {
  vec2 gv = p * scale;
  vec2 cell = floor(gv);
  vec2 f = fract(gv);
  float d = 10.0;
  for (int j = -1; j <= 1; j += 1) {
    for (int i = -1; i <= 1; i += 1) {
      vec2 offset = vec2(float(i), float(j));
      vec2 id = cell + offset;
      float rnd = hash21(id + seed);
      vec2 point = offset + vec2(rnd, fract(rnd * 1.7));
      d = min(d, length(f - point));
    }
  }
  return d;
}

vec3 applyBlendMode(vec3 base, vec3 blend, float mode, float opacity) {
  vec3 result;
  if (mode < 0.5) {
    result = blend;
  } else if (mode < 1.5) {
    result = blendAdd(base, blend);
  } else if (mode < 2.5) {
    result = blendMultiply(base, blend);
  } else if (mode < 3.5) {
    result = blendScreen(base, blend);
  } else if (mode < 4.5) {
    result = blendOverlay(base, blend);
  } else {
    result = blendDifference(base, blend);
  }
  return mix(base, result, opacity);
}

float plasma(vec2 uv, float t) {
  float v = sin(uv.x * 8.0 * uPlasmaScale + t * uPlasmaSpeed) + sin(uv.y * 6.0 * uPlasmaScale - t * 1.1 * uPlasmaSpeed);
  v += sin((uv.x + uv.y) * 4.0 * uPlasmaScale + t * 0.7 * uPlasmaSpeed);
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
  float angle = atan(centered.y, centered.x) + uKaleidoscopeRotation;
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

vec3 palette(float t) {
  return mix(uPalette[0], uPalette[1], smoothstep(0.0, 0.25, t)) +
         mix(uPalette[1], uPalette[2], smoothstep(0.25, 0.5, t)) +
         mix(uPalette[2], uPalette[3], smoothstep(0.5, 0.75, t)) +
         mix(uPalette[3], uPalette[4], smoothstep(0.75, 1.0, t));
}

void main() {
  vec2 uv = vUv;
  vec2 effectUv = kaleidoscope(uv, uKaleidoscope);
  float low = 0.0;
  for (int i = 0; i < 8; i += 1) {
    low += uSpectrum[i];
  }
  low /= 8.0;
  float mid = 0.0;
  for (int i = 8; i < 24; i += 1) {
    mid += uSpectrum[i];
  }
  mid /= 16.0;
  float high = 0.0;
  for (int i = 24; i < 64; i += 1) {
    high += uSpectrum[i];
  }
  high /= 40.0;
  low = pow(low, 1.2);
  mid = pow(mid, 1.1);
  high = pow(high, 1.0);

  float gravityLens = 0.0;
  float gravityRing = 0.0;
  if (uGravityActive[0] > 0.5 || uGravityActive[1] > 0.5 || uGravityActive[2] > 0.5 || uGravityActive[3] > 0.5 ||
      uGravityActive[4] > 0.5 || uGravityActive[5] > 0.5 || uGravityActive[6] > 0.5 || uGravityActive[7] > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    vec2 warp = vec2(0.0);
    float ringAcc = 0.0;
    float lens = 0.0;
    float tWarp = uTime * (1.0 - clamp(low, 0.0, 1.0) * 0.25);
    for (int i = 0; i < 8; i += 1) {
      if (uGravityActive[i] < 0.5) continue;
      vec2 well = uGravityPos[i];
      vec2 delta = centered - well;
      float dist = length(delta) + 0.001;
      float inv = uGravityStrength[i] / (dist * dist + 0.12);
      float polarity = uGravityPolarity[i];
      warp += normalize(delta) * inv * -0.08 * polarity;
      float ring = sin(dist * (8.0 + mid * 14.0) - tWarp * 2.2);
      ring *= smoothstep(0.6, 0.05, dist) * (0.4 + high);
      ringAcc += ring * inv;
      lens += inv * 0.2;
    }
    warp *= (1.0 + uGravityCollapse * 0.8);
    effectUv = clamp(effectUv + warp * 0.5, 0.0, 1.0);
    gravityLens = lens;
    gravityRing = ringAcc;
  }
  if (uFeedback > 0.01) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float radius = length(centered);
    float twist = uFeedback * 2.0;
    float angle = atan(centered.y, centered.x) + twist * radius * 2.0;
    
    // Improved depth simulation:
    // 1. Stronger linear zoom (uFeedback * 0.4 instead of 0.2)
    // 2. Non-linear stretch (pow) to simulate perspective acceleration
    float zoom = 1.0 - uFeedback * 0.4;
    float stretch = 1.0 + uFeedback * 0.5;
    float newRadius = pow(radius * zoom, stretch);
    
    effectUv = vec2(cos(angle), sin(angle)) * newRadius * 0.5 + 0.5;
  }
  vec3 color = vec3(0.02, 0.04, 0.08);
  if (uPlasmaEnabled > 0.5) {
    float p = plasma(effectUv, uTime);
    color += palette(p) * uPlasmaOpacity;
  }
  if (uDebugTint > 0.5 && uPlasmaEnabled > 0.5) {
    color += vec3(0.06, 0.02, 0.02) * uPlasmaOpacity;
  }

  if (uPlasmaAssetEnabled > 0.5) {
    vec2 assetUv = effectUv;
    float audioMod = 1.0 + (uRms * 0.3 + uPeak * 0.5) * uPlasmaAssetAudioReact;
    vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
    centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
    vec4 assetSample = texture(uPlasmaAsset, centeredAssetUv);
    vec3 assetColor = assetSample.rgb * (0.85 + audioMod * 0.15);
    float alpha = assetSample.a * clamp(uPlasmaOpacity, 0.0, 1.0);
    color = applyBlendMode(color, assetColor, uPlasmaAssetBlend, alpha);
  }

  if (uSpectrumEnabled > 0.5) {
    float band = floor(effectUv.x * 64.0);
    int index = int(clamp(band, 0.0, 63.0));
    float amp = uSpectrum[index];
    float trail = uTrailSpectrum[index];
    float bar = step(effectUv.y, amp);
    float trailBar = step(effectUv.y, trail);
    color += palette(amp) * bar * 0.8 * uSpectrumOpacity;
    if (uPersistence > 0.01) {
      color += palette(trail) * trailBar * 0.5 * uPersistence;
    }
  }
  if (uDebugTint > 0.5 && uSpectrumEnabled > 0.5) {
    color += vec3(0.02, 0.06, 0.08) * uSpectrumOpacity;
  }

  if (uSpectrumAssetEnabled > 0.5) {
    vec2 assetUv = effectUv;
    float band = floor(assetUv.x * 64.0);
    int specIndex = int(clamp(band, 0.0, 63.0));
    float specVal = uSpectrum[specIndex];
    float audioMod = 1.0 + (specVal * 0.4 + uRms * 0.3) * uSpectrumAssetAudioReact;
    vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
    centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
    vec4 assetSample = texture(uSpectrumAsset, centeredAssetUv);
    vec3 assetColor = assetSample.rgb * (0.8 + audioMod * 0.2);
    float alpha = assetSample.a * clamp(uSpectrumOpacity, 0.0, 1.0);
    color = applyBlendMode(color, assetColor, uSpectrumAssetBlend, alpha);
  }

  if (uGlyphEnabled > 0.5) {
    vec2 grid = vec2(18.0, 10.0);
    vec2 cell = floor(effectUv * grid);
    vec2 local = fract(effectUv * grid) - 0.5;
    float cellId = cell.x + cell.y * grid.x;
    float band = floor((cell.x / grid.x) * 8.0);
    int bandIndex = int(clamp(band, 0.0, 7.0));
    float bandVal = uSpectrum[bandIndex * 8];
    float complexity = clamp(0.3 + bandVal * 0.8 + uGlyphBeat * 0.4, 0.0, 1.0);
    float seed = uGlyphSeed + cellId * 0.37 + band * 2.1 + floor(uGlyphBeat * 4.0) * 7.0;

    if (uGlyphMode < 0.5) {
      local.y += (mod(cell.x, 3.0) - 1.0) * (0.08 + bandVal * 0.12);
    } else if (uGlyphMode < 1.5) {
      float angle = uTime * 0.15 * uGlyphSpeed + cellId * 0.12;
      local = rotate2d(local, angle);
    } else if (uGlyphMode < 2.5) {
      vec2 dir = normalize(local + 0.0001);
      local += dir * (uGlyphBeat * 0.35 + bandVal * 0.12);
    } else {
      float sweep = sin(uTime * 0.2 * uGlyphSpeed + cell.y * 0.6) * 0.2;
      local.x += sweep;
      local.y += (cell.x / grid.x - 0.5) * 0.12;
    }

    if (uGlyphMode > 2.5) {
      float row = mod(cell.y, 4.0);
      float lane = row - 1.5;
      local.y += lane * 0.06;
      local.x += sin(uTime * 0.2 * uGlyphSpeed + cell.y * 0.8) * 0.06;
    }

    float dist = glyphShape(local, seed, band, complexity);
    float stroke = smoothstep(0.04, 0.0, dist);
    vec3 paletteA = vec3(0.65, 0.8, 0.95);
    vec3 paletteB = vec3(0.95, 0.75, 0.6);
    vec3 paletteC = vec3(0.7, 0.9, 0.78);
    vec3 paletteD = vec3(0.82, 0.72, 0.95);
    vec3 glyphColor = bandIndex < 2 ? paletteA : bandIndex < 4 ? paletteB : bandIndex < 6 ? paletteC : paletteD;
    glyphColor += vec3(0.08, 0.03, 0.12) * (band / 7.0);
    glyphColor *= 0.55 + complexity * 0.75;
    color += glyphColor * stroke * uGlyphOpacity;
  }
  if (uDebugTint > 0.5 && uGlyphEnabled > 0.5) {
    color += vec3(0.04, 0.02, 0.07) * uGlyphOpacity;
  }

  if (uCrystalEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float alignment = smoothstep(0.2, 0.7, uRms);
    float dissonance = clamp(uPeak - uRms, 0.0, 1.0);
    float bassStability = clamp(low * 1.4, 0.0, 1.0);
    float branch = clamp(mid * 1.6, 0.0, 1.0);
    float shimmer = clamp(high * 1.8, 0.0, 1.0);
    float scale = mix(4.0, 10.0, bassStability) * (uCrystalScale > 0.01 ? uCrystalScale : 1.0);
    float timeScale = uCrystalSpeed > 0.01 ? uCrystalSpeed : 1.0;
    float cell = crystalField(centered, uTime * 0.02 * timeScale + uCrystalMode * 2.0, scale);
    float shard = smoothstep(0.22, 0.02, cell);
    float fracture = smoothstep(0.1, 0.0, cell - shimmer * 0.05) * dissonance;
    float growth = mix(0.35, 0.9, alignment) + branch * 0.2;
    float modeBias = uCrystalMode < 0.5 ? 0.15 : uCrystalMode < 1.5 ? 0.35 : uCrystalMode < 2.5 ? 0.7 : 0.05;
    float brittle = clamp(uCrystalBrittleness, 0.0, 1.0);

    vec3 base = vec3(0.55, 0.75, 0.95);
    vec3 core = vec3(0.25, 0.5, 0.9);
    vec3 caustic = vec3(0.9, 0.95, 1.0);
    float glow = (1.0 - cell) * (0.6 + bassStability * 0.6);
    vec3 crystal = mix(base, core, glow);
    crystal += caustic * fracture * (0.6 + shimmer);
    crystal *= growth + modeBias;
    crystal *= 0.4 + (1.0 - brittle) * 0.6;
    color += crystal * shard * uCrystalOpacity;
  }
  if (uDebugTint > 0.5 && uCrystalEnabled > 0.5) {
    color += vec3(0.02, 0.05, 0.08) * uCrystalOpacity;
  }

  if (uInkEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float flowScale = mix(1.5, 4.0, uRms) * uInkScale;
    vec2 flow = vec2(
      sin(centered.y * flowScale + uTime * 0.4 * uInkSpeed + uPeak * 1.2),
      cos(centered.x * flowScale - uTime * 0.35 * uInkSpeed + uRms)
    );
    flow += vec2(-centered.y, centered.x) * (0.25 + uPeak * 0.5);
    float beatKick = uGlyphBeat * 0.6;
    if (beatKick > 0.1) {
      flow = vec2(flow.y, -flow.x);
    }
    vec2 inkUv = effectUv + flow * 0.08;
    float strand = abs(sin((inkUv.x + inkUv.y) * 18.0 * uInkScale + uTime * 0.6 * uInkSpeed));
    float stroke = smoothstep(0.6, 0.0, strand) * (0.4 + uInkPressure * 0.8);
    float decay = mix(0.3, 0.9, uInkLifespan);
    vec3 inkColor;
    if (uInkBrush < 0.5) {
      inkColor = vec3(0.12, 0.08, 0.06);
    } else if (uInkBrush < 1.5) {
      inkColor = vec3(0.2, 0.15, 0.1);
      stroke *= 0.6 + abs(sin(inkUv.x * 12.0 + uTime * 0.4 * uInkSpeed)) * 0.6;
    } else {
      inkColor = vec3(0.1, 0.85, 0.95);
      stroke *= 0.8 + high * 0.5;
    }
    color += inkColor * stroke * decay * uInkOpacity;
  }
  if (uDebugTint > 0.5 && uInkEnabled > 0.5) {
    color += vec3(0.07, 0.04, 0.02) * uInkOpacity;
  }

  if (uTopoEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    // Scale adjustment (zoom)
    centered *= (2.0 - clamp(uTopoScale, 0.1, 1.9)); 
    
    float elevation = (low * 0.6 + mid * 0.3 + high * 0.1) * uTopoElevation;
    float slope = mix(0.2, 1.0, mid);
    float contourDensity = mix(6.0, 18.0, high);
    float travel = uTopoTravel + uTopoPlate * 0.4;
    vec2 flow = centered + vec2(travel * 0.4, travel * 0.2);
    float base = sin(flow.x * 2.4 + travel) + cos(flow.y * 2.2 - travel);
    base *= 0.35;
    float ridges = abs(base) * (0.6 + elevation);
    float quake = uTopoQuake * 0.6;
    float slide = uTopoSlide * 0.5;
    float terrain = ridges + elevation * 0.6;
    terrain += quake * sin(flow.x * 6.0 + uTime * 1.4);
    terrain -= slide * smoothstep(0.2, 0.9, ridges);
    float contours = abs(sin(terrain * contourDensity)) * slope;
    float mask = smoothstep(0.12, 0.02, contours);
    vec3 topoBase = vec3(0.18, 0.28, 0.35);
    vec3 topoHigh = vec3(0.4, 0.6, 0.7);
    vec3 topoColor = mix(topoBase, topoHigh, clamp(terrain, 0.0, 1.0));
    topoColor += vec3(0.1, 0.15, 0.2) * quake;
    topoColor -= vec3(0.12, 0.08, 0.1) * slide;
    color += topoColor * mask * uTopoOpacity;
  }
  if (uDebugTint > 0.5 && uTopoEnabled > 0.5) {
    color += vec3(0.03, 0.07, 0.03) * uTopoOpacity;
  }

  if (uWeatherEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float pressure = low * 1.2 + uWeatherIntensity * 0.4;
    float wind = mid * 1.1 + uWeatherIntensity * 0.3;
    float precip = high * 1.2 + uWeatherIntensity * 0.2;
    float mode = uWeatherMode;
    float storm = mode < 0.5 ? 1.0 : 0.0;
    float fog = mode > 0.5 && mode < 1.5 ? 1.0 : 0.0;
    float calm = mode > 1.5 && mode < 2.5 ? 1.0 : 0.0;
    float hurricane = mode > 2.5 ? 1.0 : 0.0;

    vec2 swirl = vec2(-centered.y, centered.x) * (0.2 + hurricane * 0.6);
    vec2 flow = vec2(sin(centered.y * 1.6 + uTime * 0.2 * uWeatherSpeed), cos(centered.x * 1.4 - uTime * 0.18 * uWeatherSpeed));
    flow += swirl * (0.4 + pressure);
    vec2 weatherUv = effectUv + flow * (0.08 + wind * 0.15);

    float cloud = sin(weatherUv.x * 3.2 + uTime * 0.1 * uWeatherSpeed) + cos(weatherUv.y * 2.6 - uTime * 0.08 * uWeatherSpeed);
    cloud = cloud * 0.35 + pressure;
    float cloudMask = smoothstep(0.1, 0.7, cloud);
    vec3 cloudColor = mix(vec3(0.6, 0.65, 0.7), vec3(0.85, 0.88, 0.9), cloudMask);
    cloudColor = mix(cloudColor, vec3(0.45, 0.55, 0.65), storm);
    cloudColor = mix(cloudColor, vec3(0.7, 0.75, 0.8), calm);
    cloudColor = mix(cloudColor, vec3(0.55, 0.6, 0.65), fog);

    float rain = abs(sin((weatherUv.x + uTime * 0.4 * uWeatherSpeed) * 30.0)) * precip;
    float rainMask = smoothstep(0.6, 0.0, rain) * (storm + hurricane);
    float snow = abs(sin((weatherUv.y - uTime * 0.2 * uWeatherSpeed) * 18.0)) * precip;
    float snowMask = smoothstep(0.65, 0.0, snow) * fog;
    vec3 rainColor = vec3(0.4, 0.55, 0.8) * rainMask;
    vec3 snowColor = vec3(0.8, 0.85, 0.9) * snowMask;

    float lightning = smoothstep(0.9, 1.0, precip) * storm * uGlyphBeat;
    vec3 lightningColor = vec3(1.2, 1.1, 0.9) * lightning;

    vec3 weather = cloudColor * cloudMask + rainColor + snowColor + lightningColor;
    weather *= 0.5 + uWeatherIntensity * 0.6;
    color += weather * uWeatherOpacity;
  }
  if (uDebugTint > 0.5 && uWeatherEnabled > 0.5) {
    color += vec3(0.03, 0.04, 0.07) * uWeatherOpacity;
  }

  if (uPortalEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    vec2 warp = vec2(0.0);
    float ringGlow = 0.0;
    for (int i = 0; i < 4; i += 1) {
      if (uPortalActive[i] < 0.5) continue;
      vec2 delta = centered - uPortalPos[i];
      float dist = length(delta);
      float radius = uPortalRadius[i];
      float ring = smoothstep(radius + 0.02, radius, dist) * smoothstep(radius - 0.02, radius - 0.05, dist);
      ringGlow += ring;
      float pull = (radius - dist) * 0.08;
      warp += normalize(delta + 0.0001) * pull;
    }
    effectUv = clamp(effectUv + warp * 0.5, 0.0, 1.0);
    vec3 portalColor = vec3(0.2, 0.6, 0.9) + vec3(0.2, 0.1, 0.3) * uPortalShift;
    color += portalColor * ringGlow * uPortalOpacity;
  }
  if (uDebugTint > 0.5 && uPortalEnabled > 0.5) {
    color += vec3(0.05, 0.02, 0.07) * uPortalOpacity;
  }

  if (uOscilloEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float mode = uOscilloMode;
    float rot = uOscilloRotate * 0.6 + uTime * 0.12 * (1.0 - uOscilloFreeze);
    float minDist = 10.0;
    float arcGlow = 0.0;
    for (int i = 0; i < 64; i += 1) {
      float t = float(i) / 63.0;
      float oscSample = oscilloSample(t);
      float harmonic = 1.0 + floor(mode) * 0.35;
      float angle = t * 6.28318 * harmonic;
      float radius = 0.28 + oscSample * 0.22 + uRms * 0.12;
      vec2 p = vec2(cos(angle), sin(angle)) * radius;
      p = rotate2d(p, rot);
      float d = length(centered - p);
      minDist = min(minDist, d);
      float arc = abs(length(centered) - (radius + 0.06 * sin(t * 12.0 + uTime * 0.3)));
      arcGlow += smoothstep(0.08, 0.0, arc) * 0.2;
    }
    float line = smoothstep(0.07, 0.0, minDist);
    float halo = smoothstep(0.18, 0.0, minDist) * 0.35;
    float purity = smoothstep(0.2, 0.7, uRms);
    vec3 base = mix(vec3(0.95, 0.82, 0.6), vec3(0.6, 0.8, 1.0), uSpectrum[28]);
    vec3 glow = mix(vec3(0.95, 0.5, 0.2), vec3(0.7, 0.9, 1.0), uSpectrum[8]);
    vec3 oscilloColor = base * (0.6 + purity * 0.5) + glow * (0.2 + uPeak * 0.6);
    oscilloColor += vec3(0.2, 0.15, 0.4) * arcGlow;
    color += oscilloColor * (line + halo + arcGlow) * uOscilloOpacity;
  }
  if (uDebugTint > 0.5 && uOscilloEnabled > 0.5) {
    color += vec3(0.06, 0.04, 0.01) * uOscilloOpacity;
  }

  if (gravityLens > 0.0 || gravityRing > 0.0) {
    vec3 lensColor = vec3(0.08, 0.12, 0.2) * gravityLens;
    vec3 ringColor = vec3(0.2, 0.35, 0.5) * gravityRing * (0.4 + high);
    color += lensColor + ringColor;
  }

  if (uOrigamiEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float baseGrid = mix(2.5, 7.5, low);
    float midGrid = mix(6.0, 18.0, mid);
    float highGrid = mix(18.0, 60.0, high);
    float sharp = mix(0.12, 0.02, clamp(uOrigamiFoldSharpness, 0.0, 1.0));
    float baseLine = abs(sin((centered.x * 0.9 + centered.y * 0.4) * baseGrid + uTime * 0.35 * uOrigamiSpeed));
    float diagLine = abs(sin((centered.x * -0.4 + centered.y * 0.9) * baseGrid + 1.7));
    float creaseBase = 1.0 - smoothstep(0.0, sharp, min(baseLine, diagLine));
    float midLine = abs(sin(centered.x * midGrid)) * abs(sin(centered.y * midGrid));
    float creaseMid = 1.0 - smoothstep(0.0, sharp * 0.8, midLine);
    float ripple = sin(centered.x * highGrid + uTime * uOrigamiSpeed) * sin(centered.y * highGrid - uTime * 0.8 * uOrigamiSpeed);

    float foldField = (creaseBase * (0.6 + low) + creaseMid * (0.4 + mid)) * (0.6 + uOrigamiFoldSharpness);
    foldField += ripple * high * 0.3;

    float foldMode = uOrigamiFoldState;
    float foldSign = foldMode < 0.5 ? 1.0 : (foldMode < 1.5 ? -1.0 : (foldMode < 2.5 ? 1.0 : -1.0));
    float radial = smoothstep(0.9, 0.0, length(centered));
    float collapse = step(1.5, foldMode) * (1.0 - step(2.5, foldMode));
    float explode = step(2.5, foldMode);
    float radialFold = (collapse - explode) * radial * (0.4 + low);
    float displacement = (foldField + radialFold) * foldSign;

    vec3 normal = normalize(vec3(-dFdx(displacement), -dFdy(displacement), 1.0));
    vec3 lightDir = normalize(vec3(-0.4, 0.6, 0.9));
    float diff = clamp(dot(normal, lightDir), 0.0, 1.0);
    float edge = smoothstep(0.2, 0.75, foldField);
    float grain = hash21(effectUv * 420.0) * 0.12 + hash21(effectUv * 1200.0) * 0.06;
    float fiber = sin((effectUv.y + grain) * 900.0) * 0.03;
    float tear = smoothstep(0.7, 0.98, abs(ripple)) * high * (0.6 + grain);
    vec3 paper = vec3(0.92, 0.9, 0.86);
    vec3 shade = paper * (0.65 + diff * 0.45) + edge * vec3(0.12, 0.1, 0.08);
    shade += vec3(fiber + grain) * 0.15;
    shade -= tear * vec3(0.18, 0.12, 0.08);
    shade = clamp(shade, 0.0, 1.0);
    color = applyBlendMode(color, shade, 3.0, clamp(uOrigamiOpacity, 0.0, 1.0));
  }
  if (uDebugTint > 0.5 && uOrigamiEnabled > 0.5) {
    color += vec3(0.06, 0.05, 0.02) * uOrigamiOpacity;
  }

  if (uParticlesEnabled > 0.5) {
    float particles = particleField(effectUv, uTime, uParticleDensity, uParticleSpeed, uParticleSize);
    float lift = 0.5 + uRms * 0.8;
    color += vec3(0.2, 0.7, 1.0) * particles * uParticleGlow * lift;
  }
  if (uDebugTint > 0.5 && uParticlesEnabled > 0.5) {
    color += vec3(0.02, 0.07, 0.02) * uParticleGlow;
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
  if (uDebugTint > 0.5 && uSdfEnabled > 0.5) {
    color += vec3(0.07, 0.02, 0.02) * uSdfGlow;
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
  color = color / (vec3(1.0) + color);
  color = pow(color, vec3(1.0 / 1.35));

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
  const origamiLocation = gl.getUniformLocation(program, 'uOrigamiEnabled');
  const glyphLocation = gl.getUniformLocation(program, 'uGlyphEnabled');
  const glyphOpacityLocation = gl.getUniformLocation(program, 'uGlyphOpacity');
  const glyphModeLocation = gl.getUniformLocation(program, 'uGlyphMode');
  const glyphSeedLocation = gl.getUniformLocation(program, 'uGlyphSeed');
  const glyphBeatLocation = gl.getUniformLocation(program, 'uGlyphBeat');
  const glyphSpeedLocation = gl.getUniformLocation(program, 'uGlyphSpeed');
  const crystalLocation = gl.getUniformLocation(program, 'uCrystalEnabled');
  const crystalOpacityLocation = gl.getUniformLocation(program, 'uCrystalOpacity');
  const crystalModeLocation = gl.getUniformLocation(program, 'uCrystalMode');
  const crystalBrittleLocation = gl.getUniformLocation(program, 'uCrystalBrittleness');
  const crystalScaleLocation = gl.getUniformLocation(program, 'uCrystalScale');
  const crystalSpeedLocation = gl.getUniformLocation(program, 'uCrystalSpeed');
  const inkLocation = gl.getUniformLocation(program, 'uInkEnabled');
  const inkOpacityLocation = gl.getUniformLocation(program, 'uInkOpacity');
  const inkBrushLocation = gl.getUniformLocation(program, 'uInkBrush');
  const inkPressureLocation = gl.getUniformLocation(program, 'uInkPressure');
  const inkLifespanLocation = gl.getUniformLocation(program, 'uInkLifespan');
  const inkSpeedLocation = gl.getUniformLocation(program, 'uInkSpeed');
  const inkScaleLocation = gl.getUniformLocation(program, 'uInkScale');
  const topoLocation = gl.getUniformLocation(program, 'uTopoEnabled');
  const topoOpacityLocation = gl.getUniformLocation(program, 'uTopoOpacity');
  const topoQuakeLocation = gl.getUniformLocation(program, 'uTopoQuake');
  const topoSlideLocation = gl.getUniformLocation(program, 'uTopoSlide');
  const topoPlateLocation = gl.getUniformLocation(program, 'uTopoPlate');
  const topoTravelLocation = gl.getUniformLocation(program, 'uTopoTravel');
  const topoScaleLocation = gl.getUniformLocation(program, 'uTopoScale');
  const topoElevationLocation = gl.getUniformLocation(program, 'uTopoElevation');
  const weatherLocation = gl.getUniformLocation(program, 'uWeatherEnabled');
  const weatherOpacityLocation = gl.getUniformLocation(program, 'uWeatherOpacity');
  const weatherModeLocation = gl.getUniformLocation(program, 'uWeatherMode');
  const weatherIntensityLocation = gl.getUniformLocation(program, 'uWeatherIntensity');
  const weatherSpeedLocation = gl.getUniformLocation(program, 'uWeatherSpeed');
  const portalLocation = gl.getUniformLocation(program, 'uPortalEnabled');
  const portalOpacityLocation = gl.getUniformLocation(program, 'uPortalOpacity');
  const portalShiftLocation = gl.getUniformLocation(program, 'uPortalShift');
  const portalPosLocation = gl.getUniformLocation(program, 'uPortalPos[0]');
  const portalRadiusLocation = gl.getUniformLocation(program, 'uPortalRadius[0]');
  const portalActiveLocation = gl.getUniformLocation(program, 'uPortalActive[0]');
  const oscilloLocation = gl.getUniformLocation(program, 'uOscilloEnabled');
  const oscilloOpacityLocation = gl.getUniformLocation(program, 'uOscilloOpacity');
  const oscilloModeLocation = gl.getUniformLocation(program, 'uOscilloMode');
  const oscilloFreezeLocation = gl.getUniformLocation(program, 'uOscilloFreeze');
  const oscilloRotateLocation = gl.getUniformLocation(program, 'uOscilloRotate');
  const oscilloDataLocation = gl.getUniformLocation(program, 'uOscillo[0]');
  const gravityPosLocation = gl.getUniformLocation(program, 'uGravityPos[0]');
  const gravityStrengthLocation = gl.getUniformLocation(program, 'uGravityStrength[0]');
  const gravityPolarityLocation = gl.getUniformLocation(program, 'uGravityPolarity[0]');
  const gravityActiveLocation = gl.getUniformLocation(program, 'uGravityActive[0]');
  const gravityCollapseLocation = gl.getUniformLocation(program, 'uGravityCollapse');
  const spectrumArrayLocation = gl.getUniformLocation(program, 'uSpectrum');
  const contrastLocation = gl.getUniformLocation(program, 'uContrast');
  const saturationLocation = gl.getUniformLocation(program, 'uSaturation');
  const paletteShiftLocation = gl.getUniformLocation(program, 'uPaletteShift');
  const paletteLocation = gl.getUniformLocation(program, 'uPalette');
  const plasmaOpacityLocation = gl.getUniformLocation(program, 'uPlasmaOpacity');
  const plasmaSpeedLocation = gl.getUniformLocation(program, 'uPlasmaSpeed');
  const plasmaScaleLocation = gl.getUniformLocation(program, 'uPlasmaScale');
  const spectrumOpacityLocation = gl.getUniformLocation(program, 'uSpectrumOpacity');
  const origamiOpacityLocation = gl.getUniformLocation(program, 'uOrigamiOpacity');
  const origamiFoldStateLocation = gl.getUniformLocation(program, 'uOrigamiFoldState');
  const origamiFoldSharpnessLocation = gl.getUniformLocation(program, 'uOrigamiFoldSharpness');
  const origamiSpeedLocation = gl.getUniformLocation(program, 'uOrigamiSpeed');
  const effectsEnabledLocation = gl.getUniformLocation(program, 'uEffectsEnabled');
  const bloomLocation = gl.getUniformLocation(program, 'uBloom');
  const blurLocation = gl.getUniformLocation(program, 'uBlur');
  const chromaLocation = gl.getUniformLocation(program, 'uChroma');
  const posterizeLocation = gl.getUniformLocation(program, 'uPosterize');
  const kaleidoscopeLocation = gl.getUniformLocation(program, 'uKaleidoscope');
  const kaleidoscopeRotationLocation = gl.getUniformLocation(program, 'uKaleidoscopeRotation');
  const feedbackLocation = gl.getUniformLocation(program, 'uFeedback');
  const persistenceLocation = gl.getUniformLocation(program, 'uPersistence');
  const trailSpectrumLocation = gl.getUniformLocation(program, 'uTrailSpectrum');
  const plasmaAssetEnabledLocation = gl.getUniformLocation(program, 'uPlasmaAssetEnabled');
  const plasmaAssetSamplerLocation = gl.getUniformLocation(program, 'uPlasmaAsset');
  const plasmaAssetBlendLocation = gl.getUniformLocation(program, 'uPlasmaAssetBlend');
  const plasmaAssetAudioReactLocation = gl.getUniformLocation(program, 'uPlasmaAssetAudioReact');
  const spectrumAssetEnabledLocation = gl.getUniformLocation(program, 'uSpectrumAssetEnabled');
  const spectrumAssetSamplerLocation = gl.getUniformLocation(program, 'uSpectrumAsset');
  const spectrumAssetBlendLocation = gl.getUniformLocation(program, 'uSpectrumAssetBlend');
  const spectrumAssetAudioReactLocation = gl.getUniformLocation(program, 'uSpectrumAssetAudioReact');
  const debugTintLocation = gl.getUniformLocation(program, 'uDebugTint');
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

  type AssetLayerId = 'layer-plasma' | 'layer-spectrum';
  const ASSET_LAYER_UNITS: Record<AssetLayerId, number> = {
    'layer-plasma': 1,
    'layer-spectrum': 2
  };

  interface AssetCacheEntry {
    assetId: string;
    texture: WebGLTexture;
    video?: HTMLVideoElement;
    width?: number;
    height?: number;
    options?: AssetItem['options'];
    frameBlendCanvas?: HTMLCanvasElement;
    frameBlendBackCanvas?: HTMLCanvasElement;
  }

  const assetCache = new Map<string, AssetCacheEntry>();
  const pendingAssetLoads = new Map<string, Promise<AssetCacheEntry>>();
  const layerBindings: Partial<Record<AssetLayerId, AssetCacheEntry>> = {};

  const isPowerOf2 = (value: number) => (value & (value - 1)) === 0;
  const getSamplingFilter = (sampling: AssetTextureSampling | undefined) =>
    sampling === 'nearest' ? gl.NEAREST : gl.LINEAR;

  const applyTextureSampling = (
    sampling: AssetTextureSampling | undefined,
    generateMipmaps: boolean,
    width?: number,
    height?: number
  ) => {
    const filter = getSamplingFilter(sampling);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    if (generateMipmaps && width && height && isPowerOf2(width) && isPowerOf2(height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  };

  const loadImageAsset = (asset: AssetItem): Promise<AssetCacheEntry> =>
    new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) {
        resolve({ assetId: asset.id, texture: gl.createTexture()! });
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (!asset.path) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        resolve({
          assetId: asset.id,
          texture,
          width: asset.width,
          height: asset.height
        });
        return;
      }
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        applyTextureSampling(
          asset.options?.textureSampling,
          Boolean(asset.options?.generateMipmaps),
          image.width,
          image.height
        );
        resolve({
          assetId: asset.id,
          texture,
          width: image.width,
          height: image.height
        });
      };
      image.onerror = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        resolve({
          assetId: asset.id,
          texture,
          width: asset.width,
          height: asset.height
        });
      };
      image.src = toFileUrl(asset.path);
    });

  const loadVideoAsset = (asset: AssetItem, videoOverride?: HTMLVideoElement): Promise<AssetCacheEntry> =>
    new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) {
        resolve({ assetId: asset.id, texture: gl.createTexture()! });
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const video = videoOverride ?? document.createElement('video');
      if (!videoOverride) {
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.loop = asset.options?.loop ?? true;
        video.playsInline = true;
        video.preload = 'auto';
        video.autoplay = true;
        video.playbackRate = asset.options?.playbackRate ?? 1;
      }
      const applyPlaybackDirection = () => {
        const baseRate = asset.options?.playbackRate ?? 1;
        if (asset.options?.reverse) {
          const rate = Math.max(0.01, Math.abs(baseRate));
          video.playbackRate = -rate;
          if (video.duration) {
            video.currentTime = video.duration;
          }
        } else {
          video.playbackRate = baseRate;
        }
      };

      const finalize = () => {
        applyPlaybackDirection();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        applyTextureSampling(asset.options?.textureSampling, false, video.videoWidth, video.videoHeight);
        resolve({
          assetId: asset.id,
          texture,
          video,
          width: video.videoWidth || asset.width,
          height: video.videoHeight || asset.height,
          options: asset.options
        });
      };
      const ensureReverseLoop = () => {
        if (!asset.options?.reverse) return;
        video.addEventListener('ended', () => {
          video.currentTime = video.duration || 0;
          video.playbackRate = -Math.abs(asset.options?.playbackRate ?? 1);
          void video.play().catch(() => undefined);
        });
      };
      const scheduleFinalize = () => {
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
          finalize();
        } else {
          video.addEventListener('loadeddata', finalize, { once: true });
        }
      };
      if (!videoOverride) {
        video.addEventListener(
          'error',
          () => {
            resolve({ assetId: asset.id, texture, video });
          },
          { once: true }
        );
        if (asset.path) {
          video.src = toFileUrl(asset.path);
          void video.play().catch(() => undefined);
        } else {
          resolve({ assetId: asset.id, texture, video });
          return;
        }
      }
      ensureReverseLoop();
      scheduleFinalize();
    });

  const assetOptionsHash = (options?: AssetItem['options']) => JSON.stringify(options ?? {});

  const loadTextAsset = (asset: AssetItem, canvas: HTMLCanvasElement): Promise<AssetCacheEntry> =>
    new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) {
        resolve({ assetId: asset.id, texture: gl.createTexture()! });
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      resolve({
        assetId: asset.id,
        texture,
        width: canvas.width,
        height: canvas.height,
        options: asset.options
      });
    });

  const ensureAssetEntry = (
    asset: AssetItem,
    videoOverride?: HTMLVideoElement,
    textCanvas?: HTMLCanvasElement
  ) => {
    if (assetCache.has(asset.id)) {
      const cached = assetCache.get(asset.id)!;
      if (assetOptionsHash(cached.options) === assetOptionsHash(asset.options)) {
        return Promise.resolve(cached);
      }
      assetCache.delete(asset.id);
    }
    if (pendingAssetLoads.has(asset.id)) {
      return pendingAssetLoads.get(asset.id)!;
    }
    let loader: Promise<AssetCacheEntry>;
    if (asset.kind === 'video' || asset.kind === 'live') {
      loader = loadVideoAsset(asset, videoOverride);
    } else if (asset.kind === 'text' && textCanvas) {
      loader = loadTextAsset(asset, textCanvas);
    } else {
      loader = loadImageAsset(asset);
    }
    pendingAssetLoads.set(asset.id, loader);
    loader.then((entry) => {
      assetCache.set(asset.id, entry);
      pendingAssetLoads.delete(asset.id);
    });
    return loader;
  };

  const ensureFrameBlendCanvases = (entry: AssetCacheEntry, width: number, height: number) => {
    const make = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    };
    if (!entry.frameBlendCanvas) {
      entry.frameBlendCanvas = make();
    }
    if (!entry.frameBlendBackCanvas) {
      entry.frameBlendBackCanvas = make();
    }
    [entry.frameBlendCanvas, entry.frameBlendBackCanvas].forEach((canvas) => {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    });
  };

  const blendVideoTexture = (entry: AssetCacheEntry, width: number, height: number, blend: number) => {
    if (!entry.video || blend <= 0) return null;
    ensureFrameBlendCanvases(entry, width, height);
    const target = entry.frameBlendCanvas!;
    const prev = entry.frameBlendBackCanvas!;
    const ctx = target.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - blend;
    ctx.drawImage(entry.video, 0, 0, width, height);
    ctx.globalAlpha = blend;
    ctx.drawImage(prev, 0, 0, width, height);
    [entry.frameBlendCanvas, entry.frameBlendBackCanvas] = [prev, target];
    return target;
  };

  const getVideoDimensions = (entry: AssetCacheEntry) => {
    const width = entry.video?.videoWidth || entry.width || canvas.width;
    const height = entry.video?.videoHeight || entry.height || canvas.height;
    return { width, height };
  };

  const updateVideoTextures = () => {
    (Object.keys(ASSET_LAYER_UNITS) as AssetLayerId[]).forEach((layerId) => {
      const entry = layerBindings[layerId];
      if (entry?.video && entry.texture && entry.video.readyState >= entry.video.HAVE_CURRENT_DATA) {
        const unitIndex = ASSET_LAYER_UNITS[layerId];
        gl.activeTexture(gl.TEXTURE0 + unitIndex);
        gl.bindTexture(gl.TEXTURE_2D, entry.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        const { width, height } = getVideoDimensions(entry);
        const blend = entry.options?.frameBlend ?? 0;
        const blendedSource = blendVideoTexture(entry, width, height, blend);
        const source = blendedSource ?? entry.video;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        entry.width = width;
        entry.height = height;
      }
    });
  };

  const applyLayerBinding = (
    layerId: AssetLayerId,
    enabledLocation: WebGLUniformLocation | null,
    samplerLocation: WebGLUniformLocation | null
  ) => {
    const entry = layerBindings[layerId];
    const unitIndex = ASSET_LAYER_UNITS[layerId];
    const enabled = Boolean(entry);
    if (enabledLocation) {
      gl.uniform1f(enabledLocation, enabled ? 1 : 0);
    }
    if (samplerLocation) {
      gl.uniform1i(samplerLocation, unitIndex);
    }
    gl.activeTexture(gl.TEXTURE0 + unitIndex);
    gl.bindTexture(gl.TEXTURE_2D, entry?.texture ?? null);
  };

  const setLayerAsset = async (
    layerId: AssetLayerId,
    asset: AssetItem | null,
    videoOverride?: HTMLVideoElement,
    textCanvas?: HTMLCanvasElement
  ) => {
    if (!ASSET_LAYER_UNITS[layerId]) return;
    if (!asset) {
      delete layerBindings[layerId];
      return;
    }
    const entry = await ensureAssetEntry(asset, videoOverride, textCanvas);
    layerBindings[layerId] = entry;
  };

  const setPalette = (colors: [string, string, string, string, string]) => {
    const parsed = colors.map((hex) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return [r, g, b];
    }).flat();
    gl.uniform3fv(paletteLocation, parsed);
  };

  const render = (state: RenderState) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.02, 0.03, 0.06, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    updateVideoTextures();
    if (timeLocation) gl.uniform1f(timeLocation, state.timeMs * 0.001);
    if (rmsLocation) gl.uniform1f(rmsLocation, state.rms);
    if (peakLocation) gl.uniform1f(peakLocation, state.peak);
    if (strobeLocation) gl.uniform1f(strobeLocation, state.strobe);
    if (plasmaLocation) gl.uniform1f(plasmaLocation, state.plasmaEnabled ? 1 : 0);
    if (spectrumLocation) gl.uniform1f(spectrumLocation, state.spectrumEnabled ? 1 : 0);
    if (origamiLocation) gl.uniform1f(origamiLocation, state.origamiEnabled ? 1 : 0);
    if (glyphLocation) gl.uniform1f(glyphLocation, state.glyphEnabled ? 1 : 0);
    if (glyphOpacityLocation) gl.uniform1f(glyphOpacityLocation, state.glyphOpacity);
    if (glyphModeLocation) gl.uniform1f(glyphModeLocation, state.glyphMode);
    if (glyphSeedLocation) gl.uniform1f(glyphSeedLocation, state.glyphSeed);
    if (glyphBeatLocation) gl.uniform1f(glyphBeatLocation, state.glyphBeat);
    if (glyphSpeedLocation) gl.uniform1f(glyphSpeedLocation, state.glyphSpeed || 1.0);
    if (crystalLocation) gl.uniform1f(crystalLocation, state.crystalEnabled ? 1 : 0);
    if (crystalOpacityLocation) gl.uniform1f(crystalOpacityLocation, state.crystalOpacity);
    if (crystalModeLocation) gl.uniform1f(crystalModeLocation, state.crystalMode);
    if (crystalBrittleLocation) gl.uniform1f(crystalBrittleLocation, state.crystalBrittleness);
    if (crystalScaleLocation) gl.uniform1f(crystalScaleLocation, state.crystalScale || 1.0);
    if (crystalSpeedLocation) gl.uniform1f(crystalSpeedLocation, state.crystalSpeed || 1.0);
    if (inkLocation) gl.uniform1f(inkLocation, state.inkEnabled ? 1 : 0);
    if (inkOpacityLocation) gl.uniform1f(inkOpacityLocation, state.inkOpacity);
    if (inkBrushLocation) gl.uniform1f(inkBrushLocation, state.inkBrush);
    if (inkPressureLocation) gl.uniform1f(inkPressureLocation, state.inkPressure);
    if (inkLifespanLocation) gl.uniform1f(inkLifespanLocation, state.inkLifespan);
    if (inkSpeedLocation) gl.uniform1f(inkSpeedLocation, state.inkSpeed || 1.0);
    if (inkScaleLocation) gl.uniform1f(inkScaleLocation, state.inkScale || 1.0);
    if (topoLocation) gl.uniform1f(topoLocation, state.topoEnabled ? 1 : 0);
    if (topoOpacityLocation) gl.uniform1f(topoOpacityLocation, state.topoOpacity);
    if (topoQuakeLocation) gl.uniform1f(topoQuakeLocation, state.topoQuake);
    if (topoSlideLocation) gl.uniform1f(topoSlideLocation, state.topoSlide);
    if (topoPlateLocation) gl.uniform1f(topoPlateLocation, state.topoPlate);
    if (topoTravelLocation) gl.uniform1f(topoTravelLocation, state.topoTravel);
    if (topoScaleLocation) gl.uniform1f(topoScaleLocation, state.topoScale || 1.0);
    if (topoElevationLocation) gl.uniform1f(topoElevationLocation, state.topoElevation || 1.0);
    if (weatherLocation) gl.uniform1f(weatherLocation, state.weatherEnabled ? 1 : 0);
    if (weatherOpacityLocation) gl.uniform1f(weatherOpacityLocation, state.weatherOpacity);
    if (weatherModeLocation) gl.uniform1f(weatherModeLocation, state.weatherMode);
    if (weatherIntensityLocation) gl.uniform1f(weatherIntensityLocation, state.weatherIntensity);
    if (weatherSpeedLocation) gl.uniform1f(weatherSpeedLocation, state.weatherSpeed || 1.0);
    if (portalLocation) gl.uniform1f(portalLocation, state.portalEnabled ? 1 : 0);
    if (portalOpacityLocation) gl.uniform1f(portalOpacityLocation, state.portalOpacity);
    if (portalShiftLocation) gl.uniform1f(portalShiftLocation, state.portalShift);
    if (portalPosLocation) gl.uniform2fv(portalPosLocation, state.portalPositions);
    if (portalRadiusLocation) gl.uniform1fv(portalRadiusLocation, state.portalRadii);
    if (portalActiveLocation) gl.uniform1fv(portalActiveLocation, state.portalActives);
    if (oscilloLocation) gl.uniform1f(oscilloLocation, state.oscilloEnabled ? 1 : 0);
    if (oscilloOpacityLocation) gl.uniform1f(oscilloOpacityLocation, state.oscilloOpacity);
    if (oscilloModeLocation) gl.uniform1f(oscilloModeLocation, state.oscilloMode);
    if (oscilloFreezeLocation) gl.uniform1f(oscilloFreezeLocation, state.oscilloFreeze);
    if (oscilloRotateLocation) gl.uniform1f(oscilloRotateLocation, state.oscilloRotate);
    if (oscilloDataLocation) gl.uniform1fv(oscilloDataLocation, state.oscilloData);
    if (gravityPosLocation) gl.uniform2fv(gravityPosLocation, state.gravityPositions);
    if (gravityStrengthLocation) gl.uniform1fv(gravityStrengthLocation, state.gravityStrengths);
    if (gravityPolarityLocation) gl.uniform1fv(gravityPolarityLocation, state.gravityPolarities);
    if (gravityActiveLocation) gl.uniform1fv(gravityActiveLocation, state.gravityActives);
    if (gravityCollapseLocation) gl.uniform1f(gravityCollapseLocation, state.gravityCollapse);
    if (spectrumArrayLocation) {
      gl.uniform1fv(spectrumArrayLocation, state.spectrum);
    }
    if (contrastLocation) gl.uniform1f(contrastLocation, state.contrast);
    if (saturationLocation) gl.uniform1f(saturationLocation, state.saturation);
    if (paletteShiftLocation) gl.uniform1f(paletteShiftLocation, state.paletteShift);
    if (plasmaOpacityLocation) gl.uniform1f(plasmaOpacityLocation, state.plasmaOpacity);
    if (plasmaSpeedLocation) gl.uniform1f(plasmaSpeedLocation, state.plasmaSpeed || 1.0);
    if (plasmaScaleLocation) gl.uniform1f(plasmaScaleLocation, state.plasmaScale || 1.0);
    if (spectrumOpacityLocation) gl.uniform1f(spectrumOpacityLocation, state.spectrumOpacity);
    if (origamiOpacityLocation) gl.uniform1f(origamiOpacityLocation, state.origamiOpacity);
    if (origamiFoldStateLocation) gl.uniform1f(origamiFoldStateLocation, state.origamiFoldState);
    if (origamiFoldSharpnessLocation) gl.uniform1f(origamiFoldSharpnessLocation, state.origamiFoldSharpness);
    if (origamiSpeedLocation) gl.uniform1f(origamiSpeedLocation, state.origamiSpeed || 1.0);
    if (effectsEnabledLocation) gl.uniform1f(effectsEnabledLocation, state.effectsEnabled ? 1 : 0);
    if (bloomLocation) gl.uniform1f(bloomLocation, state.bloom);
    if (blurLocation) gl.uniform1f(blurLocation, state.blur);
    if (chromaLocation) gl.uniform1f(chromaLocation, state.chroma);
    if (posterizeLocation) gl.uniform1f(posterizeLocation, state.posterize);
    if (kaleidoscopeLocation) gl.uniform1f(kaleidoscopeLocation, state.kaleidoscope);
    if (kaleidoscopeRotationLocation) gl.uniform1f(kaleidoscopeRotationLocation, state.kaleidoscopeRotation || 0.0);
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
    applyLayerBinding('layer-plasma', plasmaAssetEnabledLocation, plasmaAssetSamplerLocation);
    if (plasmaAssetBlendLocation) gl.uniform1f(plasmaAssetBlendLocation, state.plasmaAssetBlendMode);
    if (plasmaAssetAudioReactLocation) gl.uniform1f(plasmaAssetAudioReactLocation, state.plasmaAssetAudioReact);
    applyLayerBinding('layer-spectrum', spectrumAssetEnabledLocation, spectrumAssetSamplerLocation);
    if (spectrumAssetBlendLocation) gl.uniform1f(spectrumAssetBlendLocation, state.spectrumAssetBlendMode);
    if (spectrumAssetAudioReactLocation) gl.uniform1f(spectrumAssetAudioReactLocation, state.spectrumAssetAudioReact);
    if (debugTintLocation) gl.uniform1f(debugTintLocation, state.debugTint ?? 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  return {
    render,
    setLayerAsset,
    setPalette
  };
};