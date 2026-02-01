import { toFileUrl } from '../shared/fileUrl';
import type { AssetItem } from '../shared/project';
import type { AssetTextureSampling } from '../shared/assets';
import { buildSdfShader } from './sdf/compile/glslBuilder';

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
  mediaEnabled: boolean;
  oscilloEnabled: boolean;
  spectrum: Float32Array;
  contrast: number;
  saturation: number;
  paletteShift: number;
  plasmaOpacity: number;
  plasmaSpeed: number;
  plasmaScale: number;
  plasmaComplexity: number;
  plasmaAudioReact: number;
  spectrumEnabled: boolean;
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
  portalStyle: number;
  portalPositions: Float32Array;
  portalRadii: Float32Array;
  portalActives: Float32Array;
  mediaOpacity: number;
  mediaBurstPositions: Float32Array;
  mediaBurstRadii: Float32Array;
  mediaBurstTypes: Float32Array;
  mediaBurstActives: Float32Array;
  oscilloOpacity: number;
  oscilloMode: number;
  oscilloFreeze: number;
  oscilloRotate: number;
  oscilloData: Float32Array;
  modulatorValues: Float32Array;
  midiData: Float32Array;
  plasmaAssetBlendMode: number;
  plasmaAssetAudioReact: number;
  spectrumAssetBlendMode: number;
  spectrumAssetAudioReact: number;
  mediaAssetBlendMode: number;
  mediaAssetAudioReact: number;
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
  expressiveEnergyBloom: number;
  expressiveEnergyThreshold: number;
  expressiveEnergyAccumulation: number;
  expressiveRadialGravity: number;
  expressiveRadialStrength: number;
  expressiveRadialRadius: number;
  expressiveRadialFocusX: number;
  expressiveRadialFocusY: number;
  expressiveMotionEcho: number;
  expressiveMotionEchoDecay: number;
  expressiveMotionEchoWarp: number;
  expressiveSpectralSmear: number;
  expressiveSpectralOffset: number;
  expressiveSpectralMix: number;
  particlesEnabled: boolean;
  particleDensity: number;
  particleSpeed: number;
  particleSize: number;
  particleGlow: number;
  particleTurbulence: number;
  particleAudioLift: number;
  sdfEnabled: boolean;
  sdfShape: number;
  sdfScale: number;
  sdfEdge: number;
  sdfGlow: number;
  sdfRotation: number;
  sdfFill: number;
  sdfColor?: [number, number, number];
  globalColor?: [number, number, number];
  hasInternalAsset?: boolean;
  sdfScene?: any; // Config for Advanced mode
  feedbackZoom: number;
  feedbackRotation: number;
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
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  if (!gl) {
    throw new Error('WebGL2 required');
  }

  let customPlasmaSource: string | null = null;

  const vertexShaderSrc = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

  const createFragmentShaderSrc = (
    sdfUniforms = '',
    sdfFunctions = '',
    sdfMapBody = '10.0',
    plasmaSource: string | null = null
  ) => `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAspect;
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
uniform float uPortalStyle;
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
uniform float uPlasmaComplexity;
uniform float uPlasmaAudioReact;
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
uniform float uFeedbackZoom;
uniform float uFeedbackRotation;
uniform float uPersistence;
uniform float uTrailSpectrum[64];
uniform float uExpressiveEnergyBloom;
uniform float uExpressiveEnergyThreshold;
uniform float uExpressiveEnergyAccumulation;
uniform float uExpressiveRadialGravity;
uniform float uExpressiveRadialStrength;
uniform float uExpressiveRadialRadius;
uniform float uExpressiveRadialFocusX;
uniform float uExpressiveRadialFocusY;
uniform float uExpressiveMotionEcho;
uniform float uExpressiveMotionEchoDecay;
uniform float uExpressiveMotionEchoWarp;
uniform float uExpressiveSpectralSmear;
uniform float uExpressiveSpectralOffset;
uniform float uExpressiveSpectralMix;
uniform float uParticlesEnabled;
uniform float uParticleDensity;
uniform float uParticleSpeed;
uniform float uParticleSize;
uniform float uParticleGlow;
uniform float uParticleTurbulence;
uniform float uParticleAudioLift;
uniform float uSdfEnabled;
uniform float uSdfShape;
uniform float uSdfScale;
uniform float uSdfEdge;
uniform float uSdfGlow;
uniform float uSdfRotation;
uniform float uSdfFill;
uniform vec3 uSdfColor;
uniform float uPlasmaAssetEnabled;
uniform sampler2D uPlasmaAsset;
uniform float uPlasmaAssetBlend;
uniform float uPlasmaAssetAudioReact;
uniform float uSpectrumAssetEnabled;
uniform sampler2D uSpectrumAsset;
uniform float uSpectrumAssetBlend;
uniform float uSpectrumAssetAudioReact;
uniform float uMediaEnabled;
uniform float uMediaOpacity;
uniform float uMediaAssetEnabled;
uniform sampler2D uMediaAsset;
uniform float uMediaAssetBlend;
uniform float uMediaAssetAudioReact;
uniform vec2 uMediaBurstPos[8];
uniform float uMediaBurstRadius[8];
uniform float uMediaBurstType[8];
uniform float uMediaBurstActive[8];
uniform sampler2D uWaveformTex;
uniform sampler2D uSpectrumTex;
uniform sampler2D uModulatorTex;
uniform sampler2D uMidiTex;
uniform float uWaveformEnabled;
uniform float uSpectrumEnabledInternal;
uniform float uModulatorsEnabled;
uniform float uMidiEnabled;
uniform vec3 uGlobalColor;
uniform float uDebugTint;

// --- Advanced SDF Injections ---
uniform float uAdvancedSdfEnabled;
uniform vec3 uSdfLightDir;
uniform vec3 uSdfLightColor;
uniform float uSdfLightIntensity;
uniform float uSdfAoEnabled;
uniform float uSdfShadowsEnabled;
uniform float uInternalSource;
uniform vec3 uCameraPos;
uniform vec3 uCameraTarget;
uniform float uCameraFov;
${sdfUniforms}

${sdfFunctions}

float sdfSceneMap(vec3 p) {
  return 10.0; // Placeholder for simple mode, overridden in advanced
}

vec2 advancedSdfMap(vec3 p) {
  // Default returns distance and material (0.0 for no material)
  return vec2(${sdfMapBody}, 0.0);
}

vec3 calcSdfNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    advancedSdfMap(p + e.xyy).x - advancedSdfMap(p - e.xyy).x,
    advancedSdfMap(p + e.yxy).x - advancedSdfMap(p - e.yxy).x,
    advancedSdfMap(p + e.yyx).x - advancedSdfMap(p - e.yyx).x
  ));
}

vec3 getSdfColor(float id) {
  return vec3(1.0);
}

float calcSdfShadow(vec3 ro, vec3 rd, float k) {
  float res = 1.0;
  float t = 0.01;
  for(int i = 0; i < 16; i++) {
    float h = advancedSdfMap(ro + rd * t).x;
    res = min(res, k * h / t);
    t += clamp(h, 0.01, 0.2);
    if(res < 0.001 || t > 5.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcSdfAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for(int i = 0; i < 5; i++) {
    float hr = 0.01 + 0.12 * float(i) / 4.0;
    float d = advancedSdfMap(p + n * hr).x;
    occ += (hr - d) * sca;
    sca *= 0.95;
  }
  return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

mat3 setCamera(vec3 ro, vec3 ta, float cr) {
  vec3 cw = normalize(ta - ro);
  vec3 cp = vec3(sin(cr), cos(cr), 0.0);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = normalize(cross(cu, cw));
  return mat3(cu, cv, cw);
}

vec3 getRayDirection(vec2 uv, vec3 ro, vec3 ta, float fov) {
  mat3 ca = setCamera(ro, ta, 0.0);
  return ca * normalize(vec3(uv, fov));
}
// --- End Injections ---

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

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 6; ++i) {
    v += a * noise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

float voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float m = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash21(n + g), hash21(n + g + 13.7));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < m) m = d;
    }
  }
  return sqrt(m);
}

float getWaveform(float t) {
  return texture(uWaveformTex, vec2(t, 0.5)).r;
}

float getSpectrum(float t) {
  return texture(uSpectrumTex, vec2(t, 0.5)).r;
}

float getModulator(int index) {
  return texture(uModulatorTex, vec2((float(index) + 0.5) / 8.0, 0.5)).r;
}

vec2 getMidiNote(int index) {
  return texture(uMidiTex, vec2((float(index) + 0.5) / 128.0, 0.5)).rg;
}

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

vec3 palette(float t);

float plasmaDefault(vec2 uv, float t) {
  float v = 0.0;
  vec2 p = uv * uPlasmaScale;
  float audio = (uRms * 0.5 + uPeak * 0.5) * uPlasmaAudioReact;
  
  for (float i = 1.0; i < 9.0; i++) {
      if (i > uPlasmaComplexity) break;
      v += sin(p.x * i + t * uPlasmaSpeed * (1.0 + i * 0.1) + audio * i);
      v += sin(p.y * i - t * uPlasmaSpeed * (1.1 + i * 0.15) + audio * 0.5);
      p += vec2(sin(t * 0.1), cos(t * 0.1)) * 0.5;
  }
  
  return v / uPlasmaComplexity * 0.5 + 0.5;
}

vec3 samplePlasma(vec2 uv, float t) {
#ifdef HAS_CUSTOM_PLASMA
  return customPlasma(uv, t);
#else
  float p = plasmaDefault(uv, t);
  return palette(p);
#endif
}

float particleField(vec2 uv, float t, float density, float speed, float size) {
  float grid = mix(18.0, 90.0, density);
  float audio = (uRms * 0.4 + uPeak * 0.6) * uParticleAudioLift;
  vec2 drift = vec2(t * 0.02 * (0.2 + speed), t * 0.015 * (0.2 + speed));
  
  // Add turbulence
  vec2 turb = vec2(
      sin(uv.y * 4.0 + t * 0.5),
      cos(uv.x * 4.0 + t * 0.5)
  ) * uParticleTurbulence * 0.5;
  
  vec2 gv = uv * grid + drift + turb;
  vec2 cell = floor(gv);
  vec2 f = fract(gv);
  float rnd = hash21(cell);
  vec2 pos = vec2(hash21(cell + 1.3), hash21(cell + 9.1));
  pos = 0.2 + 0.6 * pos;
  
  float twinkle = 0.4 + 0.6 * sin(t * (1.5 + rnd * 2.5) + rnd * 6.2831) + audio;
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

float sdRing(vec2 p, float r, float th) {
  return abs(length(p) - r) - th;
}

float opDisplace(float d, vec3 p, float amount, float freq) {
  float displacement = sin(freq * p.x) * sin(freq * p.y) * sin(freq * p.z) * amount;
  return d + displacement;
}

float opOnion(float d, float thickness) {
  return abs(d) - thickness;
}

float opRound(float d, float r) {
  return d - r;
}

float opAnnular(float d, float thickness) {
  return abs(d) - thickness * 0.5;
}

float sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

float sdStar(vec2 p, float r, int n, float m) {
  float an = 3.141593 / float(n);
  float en = 3.141593 / m;
  vec2 acs = vec2(cos(an), sin(an));
  vec2 ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
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

${plasmaSource ? '#define HAS_CUSTOM_PLASMA' : ''}
${plasmaSource ?? ''}

void main() {
  vec2 uv = vUv;
  vec2 effectUv = kaleidoscope(uv, uKaleidoscope);
  float low = 0.0;
  for (int i = 0; i < 8; i += 1) { low += uSpectrum[i]; }
  low /= 8.0;
  float mid = 0.0;
  for (int i = 8; i < 24; i += 1) { mid += uSpectrum[i]; }
  mid /= 16.0;
  float high = 0.0;
  for (int i = 24; i < 64; i += 1) { high += uSpectrum[i]; }
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
  if (uFeedback > 0.01 || abs(uFeedbackZoom) > 0.01 || abs(uFeedbackRotation) > 0.01) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float radius = length(centered);
    float angle = atan(centered.y, centered.x);
    
    // Twist from amount
    angle += uFeedback * radius * 2.0;
    
    // Explicit rotation
    angle += uFeedbackRotation;
    
    // Zoom/Scale (Zoom in if zoom > 0)
    float zoomFactor = 1.0 - uFeedbackZoom * 0.5;
    float stretch = 1.0 + uFeedback * 0.5;
    float newRadius = pow(radius * zoomFactor, stretch);
    
    effectUv = vec2(cos(angle), sin(angle)) * newRadius * 0.5 + 0.5;
  }
  if (uExpressiveRadialGravity > 0.01) {
    vec2 focus = vec2(uExpressiveRadialFocusX, uExpressiveRadialFocusY);
    vec2 toFocus = focus - effectUv;
    float dist = length(toFocus);
    float radius = mix(0.1, 1.2, clamp(uExpressiveRadialRadius, 0.0, 1.0));
    float strength = uExpressiveRadialGravity * clamp(uExpressiveRadialStrength, 0.0, 1.0);
    float falloff = smoothstep(radius, 0.0, dist);
    vec2 pull = normalize(toFocus + 0.0001) * strength * falloff * 0.12;
    effectUv = clamp(effectUv + pull, 0.0, 1.0);
  }
  vec3 color = vec3(0.02, 0.04, 0.08);
  if (uPlasmaEnabled > 0.5) {
    vec3 plasmaColor = samplePlasma(effectUv, uTime);
    color += plasmaColor * uPlasmaOpacity;
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
    if (uPersistence > 0.01) { color += palette(trail) * trailBar * 0.5 * uPersistence; }
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
  if (uMediaEnabled > 0.5 && uMediaAssetEnabled > 0.5) {
    vec2 assetUv = effectUv;
    float audioMod = 1.0 + (uRms * 0.3 + uPeak * 0.5) * uMediaAssetAudioReact;
    vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
    centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
    vec4 assetSample = texture(uMediaAsset, centeredAssetUv);
    vec3 assetColor = assetSample.rgb * (0.85 + audioMod * 0.15);
    float alpha = assetSample.a * clamp(uMediaOpacity, 0.0, 1.0);
    color = applyBlendMode(color, assetColor, uMediaAssetBlend, alpha);
  }
  if (uMediaEnabled > 0.5) {
    for (int i = 0; i < 8; i += 1) {
      float activeAmt = uMediaBurstActive[i];
      if (activeAmt <= 0.01) continue;
      vec2 delta = effectUv - uMediaBurstPos[i];
      float r = uMediaBurstRadius[i];
      float w = 0.01 + activeAmt * 0.015;
      float type = uMediaBurstType[i];
      float shape = 0.0;
      if (type < 0.5) {
        float dist = length(delta);
        shape = smoothstep(r + w, r, dist) * smoothstep(r, r - w * 2.2, dist);
      } else if (type < 1.5) {
        float t = sdEquilateralTriangle(delta, r);
        shape = smoothstep(w, 0.0, abs(t));
      } else {
        float line = smoothstep(w, 0.0, abs(delta.y)) * smoothstep(r, r - w * 6.0, abs(delta.x));
        shape = line;
      }
      vec3 burstColor = palette(fract(float(i) * 0.17 + uPaletteShift * 0.2));
      color += burstColor * shape * activeAmt * uMediaOpacity;
    }
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
    if (uGlyphMode < 0.5) { local.y += (mod(cell.x, 3.0) - 1.0) * (0.08 + bandVal * 0.12); }
    else if (uGlyphMode < 1.5) { local = rotate2d(local, uTime * 0.15 * uGlyphSpeed + cellId * 0.12); }
    else if (uGlyphMode < 2.5) { local += normalize(local + 0.0001) * (uGlyphBeat * 0.35 + bandVal * 0.12); }
    else { local.x += sin(uTime * 0.2 * uGlyphSpeed + cell.y * 0.6) * 0.2; local.y += (cell.x / grid.x - 0.5) * 0.12; }
    if (uGlyphMode > 2.5) { local.y += (mod(cell.y, 4.0) - 1.5) * 0.06; local.x += sin(uTime * 0.2 * uGlyphSpeed + cell.y * 0.8) * 0.06; }
    float dist = glyphShape(local, seed, band, complexity);
    float stroke = smoothstep(0.04, 0.0, dist);
    vec3 glyphColor = bandIndex < 2 ? vec3(0.65, 0.8, 0.95) : bandIndex < 4 ? vec3(0.95, 0.75, 0.6) : bandIndex < 6 ? vec3(0.7, 0.9, 0.78) : vec3(0.82, 0.72, 0.95);
    glyphColor *= 0.55 + complexity * 0.75;
    color += glyphColor * stroke * uGlyphOpacity;
  }
  if (uCrystalEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float alignment = smoothstep(0.2, 0.7, uRms);
    float bassStability = clamp(low * 1.4, 0.0, 1.0);
    float timeScale = uCrystalSpeed > 0.01 ? uCrystalSpeed : 1.0;
    float cell = crystalField(centered, uTime * 0.02 * timeScale + uCrystalMode * 2.0, mix(4.0, 10.0, bassStability) * (uCrystalScale > 0.01 ? uCrystalScale : 1.0));
    float shard = smoothstep(0.22, 0.02, cell);
    float growth = mix(0.35, 0.9, alignment) + mid * 0.2;
    vec3 base = vec3(0.55, 0.75, 0.95), core = vec3(0.25, 0.5, 0.9), caustic = vec3(0.9, 0.95, 1.0);
    vec3 crystal = mix(base, core, (1.0 - cell) * (0.6 + bassStability * 0.6));
    crystal += caustic * smoothstep(0.1, 0.0, cell - high * 0.05) * clamp(uPeak - uRms, 0.0, 1.0) * (0.6 + high);
    crystal *= growth + (uCrystalMode < 0.5 ? 0.15 : uCrystalMode < 1.5 ? 0.35 : uCrystalMode < 2.5 ? 0.7 : 0.05);
    crystal *= 0.4 + (1.0 - clamp(uCrystalBrittleness, 0.0, 1.0)) * 0.6;
    color += crystal * shard * uCrystalOpacity;
  }
  if (uInkEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float flowScale = mix(1.5, 4.0, uRms) * uInkScale;
    vec2 flow = vec2(sin(centered.y * flowScale + uTime * 0.4 * uInkSpeed + uPeak * 1.2), cos(centered.x * flowScale - uTime * 0.35 * uInkSpeed + uRms));
    flow += vec2(-centered.y, centered.x) * (0.25 + uPeak * 0.5);
    if (uGlyphBeat > 0.1) flow = vec2(flow.y, -flow.x);
    vec2 inkUv = effectUv + flow * 0.08;
    float stroke = smoothstep(0.6, 0.0, abs(sin((inkUv.x + inkUv.y) * 18.0 * uInkScale + uTime * 0.6 * uInkSpeed))) * (0.4 + uInkPressure * 0.8);
    vec3 inkColor = uInkBrush < 0.5 ? vec3(0.12, 0.08, 0.06) : uInkBrush < 1.5 ? vec3(0.2, 0.15, 0.1) : vec3(0.1, 0.85, 0.95);
    if (uInkBrush > 0.5 && uInkBrush < 1.5) stroke *= 0.6 + abs(sin(inkUv.x * 12.0 + uTime * 0.4 * uInkSpeed)) * 0.6;
    color += inkColor * stroke * mix(0.3, 0.9, uInkLifespan) * uInkOpacity;
  }
  if (uTopoEnabled > 0.5) {
    vec2 centered = (effectUv * 2.0 - 1.0) * (2.0 - clamp(uTopoScale, 0.1, 1.9));
    float travel = uTopoTravel + uTopoPlate * 0.4;
    vec2 flow = centered + vec2(travel * 0.4, travel * 0.2);
    float elevation = (low * 0.6 + mid * 0.3 + high * 0.1) * uTopoElevation;
    float terrain = (abs(sin(flow.x * 2.4 + travel) + cos(flow.y * 2.2 - travel)) * 0.35) * (0.6 + elevation) + elevation * 0.6;
    terrain += uTopoQuake * 0.6 * sin(flow.x * 6.0 + uTime * 1.4);
    terrain -= uTopoSlide * 0.5 * smoothstep(0.2, 0.9, terrain);
    float mask = smoothstep(0.12, 0.02, abs(sin(terrain * mix(6.0, 18.0, high))) * mix(0.2, 1.0, mid));
    color += mix(vec3(0.18, 0.28, 0.35), vec3(0.4, 0.6, 0.7), clamp(terrain, 0.0, 1.0)) * mask * uTopoOpacity;
  }
  if (uWeatherEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float pressure = low * 1.2 + uWeatherIntensity * 0.4;
    vec2 flow = vec2(sin(centered.y * 1.6 + uTime * 0.2 * uWeatherSpeed), cos(centered.x * 1.4 - uTime * 0.18 * uWeatherSpeed));
    flow += vec2(-centered.y, centered.x) * (0.2 + (uWeatherMode > 2.5 ? 1.0 : 0.0) * 0.6) * (0.4 + pressure);
    vec2 wUv = effectUv + flow * (0.08 + mid * 1.1 * 0.15);
    float cloud = smoothstep(0.1, 0.7, (sin(wUv.x * 3.2 + uTime * 0.1 * uWeatherSpeed) + cos(wUv.y * 2.6 - uTime * 0.08 * uWeatherSpeed)) * 0.35 + pressure);
    vec3 cCol = mix(vec3(0.6, 0.65, 0.7), vec3(0.85, 0.88, 0.9), cloud);
    if (uWeatherMode < 0.5) cCol = mix(cCol, vec3(0.45, 0.55, 0.65), 1.0);
    else if (uWeatherMode < 2.5) cCol = mix(cCol, vec3(0.7, 0.75, 0.8), 1.0);
    float pHigh = high * 1.2 + uWeatherIntensity * 0.2;
    float rain = smoothstep(0.6, 0.0, abs(sin((wUv.x + uTime * 0.4 * uWeatherSpeed) * 30.0)) * pHigh) * (uWeatherMode < 0.5 || uWeatherMode > 2.5 ? 1.0 : 0.0);
    float snow = smoothstep(0.65, 0.0, abs(sin((wUv.y - uTime * 0.2 * uWeatherSpeed) * 18.0)) * pHigh) * (uWeatherMode > 0.5 && uWeatherMode < 1.5 ? 1.0 : 0.0);
    color += (cCol * cloud + vec3(0.4, 0.55, 0.8) * rain + vec3(0.8, 0.85, 0.9) * snow + vec3(1.2, 1.1, 0.9) * smoothstep(0.9, 1.0, pHigh) * (uWeatherMode < 0.5 ? 1.0 : 0.0) * uGlyphBeat) * (0.5 + uWeatherIntensity * 0.6) * uWeatherOpacity;
  }
  if (uPortalEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    vec2 warp = vec2(0.0); float ringGlow = 0.0;
    float style = clamp(uPortalStyle, 0.0, 2.0);
    float ringWidth = mix(0.02, 0.05, step(0.5, style));
    ringWidth = mix(ringWidth, 0.08, step(1.5, style));
    for (int i = 0; i < 4; i += 1) {
      if (uPortalActive[i] < 0.5) continue;
      vec2 delta = centered - uPortalPos[i]; float dist = length(delta), rad = uPortalRadius[i];
      ringGlow += smoothstep(rad + ringWidth, rad, dist) * smoothstep(rad - ringWidth, rad - ringWidth * 2.5, dist);
      warp += normalize(delta + 0.0001) * (rad - dist) * mix(0.06, 0.12, step(1.5, style));
    }
    effectUv = clamp(effectUv + warp * mix(0.45, 0.6, step(0.5, style)), 0.0, 1.0);
    vec3 baseCol = vec3(0.2, 0.6, 0.9);
    if (style > 0.5 && style < 1.5) baseCol = vec3(0.7, 0.35, 0.95);
    if (style >= 1.5) baseCol = vec3(0.2, 0.9, 0.55);
    color += (baseCol + vec3(0.2, 0.1, 0.3) * uPortalShift) * ringGlow * uPortalOpacity;
  }
  if (uOscilloEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float rot = uOscilloRotate * 0.6 + uTime * 0.12 * (1.0 - uOscilloFreeze), minDist = 10.0, arcGlow = 0.0;
    for (int i = 0; i < 64; i += 1) {
      float t = float(i) / 63.0, rad = 0.28 + oscilloSample(t) * 0.22 + uRms * 0.12;
      vec2 p = rotate2d(vec2(cos(t * 6.28318 * (1.0 + floor(uOscilloMode) * 0.35)), sin(t * 6.28318 * (1.0 + floor(uOscilloMode) * 0.35))) * rad, rot);
      minDist = min(minDist, length(centered - p));
      arcGlow += smoothstep(0.08, 0.0, abs(length(centered) - (rad + 0.06 * sin(t * 12.0 + uTime * 0.3)))) * 0.2;
    }
    color += (mix(vec3(0.95, 0.82, 0.6), vec3(0.6, 0.8, 1.0), uSpectrum[28]) * (0.6 + smoothstep(0.2, 0.7, uRms) * 0.5) + mix(vec3(0.95, 0.5, 0.2), vec3(0.7, 0.9, 1.0), uSpectrum[8]) * (0.2 + uPeak * 0.6) + vec3(0.2, 0.15, 0.4) * arcGlow) * (smoothstep(0.07, 0.0, minDist) + smoothstep(0.18, 0.0, minDist) * 0.35 + arcGlow) * uOscilloOpacity;
  }
  if (gravityLens > 0.0 || gravityRing > 0.0) color += vec3(0.08, 0.12, 0.2) * gravityLens + vec3(0.2, 0.35, 0.5) * gravityRing * (0.4 + high);
  if (uOrigamiEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float sharp = mix(0.12, 0.02, clamp(uOrigamiFoldSharpness, 0.0, 1.0));
    float foldField = ( (1.0 - smoothstep(0.0, sharp, min(abs(sin((centered.x * 0.9 + centered.y * 0.4) * mix(2.5, 7.5, low) + uTime * 0.35 * uOrigamiSpeed)), abs(sin((centered.x * -0.4 + centered.y * 0.9) * mix(2.5, 7.5, low) + 1.7))))) * (0.6 + low) + (1.0 - smoothstep(0.0, sharp * 0.8, abs(sin(centered.x * mix(6.0, 18.0, mid))) * abs(sin(centered.y * mix(6.0, 18.0, mid))))) * (0.4 + mid) ) * (0.6 + uOrigamiFoldSharpness) + sin(centered.x * mix(18.0, 60.0, high) + uTime * uOrigamiSpeed) * sin(centered.y * mix(18.0, 60.0, high) - uTime * 0.8 * uOrigamiSpeed) * high * 0.3;
    float displacement = (foldField + (step(1.5, uOrigamiFoldState) * (1.0 - step(2.5, uOrigamiFoldState)) - step(2.5, uOrigamiFoldState)) * smoothstep(0.9, 0.0, length(centered)) * (0.4 + low)) * (uOrigamiFoldState < 0.5 ? 1.0 : (uOrigamiFoldState < 1.5 ? -1.0 : (uOrigamiFoldState < 2.5 ? 1.0 : -1.0)));
    vec3 normal = normalize(vec3(-dFdx(displacement), -dFdy(displacement), 1.0));
    float diff = clamp(dot(normal, normalize(vec3(-0.4, 0.6, 0.9))), 0.0, 1.0);
    float grain = hash21(effectUv * 420.0) * 0.12 + hash21(effectUv * 1200.0) * 0.06;
    color = applyBlendMode(color, clamp(vec3(0.92, 0.9, 0.86) * (0.65 + diff * 0.45) + smoothstep(0.2, 0.75, foldField) * vec3(0.12, 0.1, 0.08) + vec3(sin((effectUv.y + grain) * 900.0) * 0.03 + grain) * 0.15 - smoothstep(0.7, 0.98, abs(sin(centered.x * mix(18.0, 60.0, high) + uTime * uOrigamiSpeed) * sin(centered.y * mix(18.0, 60.0, high) - uTime * 0.8 * uOrigamiSpeed))) * high * (0.6 + grain) * vec3(0.18, 0.12, 0.08), 0.0, 1.0), 3.0, clamp(uOrigamiOpacity, 0.0, 1.0));
  }
  if (uParticlesEnabled > 0.5) color += vec3(0.2, 0.7, 1.0) * particleField(effectUv, uTime, uParticleDensity, uParticleSpeed, uParticleSize) * uParticleGlow * (0.5 + uRms * 0.8);
  if (uSdfEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    if (uAdvancedSdfEnabled > 0.5) {
      vec2 uv = centered * vec2(uAspect, 1.0);
      vec3 ro = uCameraPos;
      vec3 rd = getRayDirection(uv, ro, uCameraTarget, uCameraFov);
      float t = 0.0; vec2 res = vec2(0.0); bool hit = false;
      for (int i = 0; i < 64; i++) {
        vec3 p = ro + rd * t; res = advancedSdfMap(p); 
        if (res.x < 0.001) { hit = true; break; }
        if (t > 10.0) break;
        t += res.x;
      }
      if (hit) {
        vec3 p = ro + rd * t, n = calcSdfNormal(p), l = normalize(uSdfLightDir);
        float diff = max(dot(n, l), 0.0) * uSdfLightIntensity;
        float amb = 0.2;
        float shadow = uSdfShadowsEnabled > 0.5 ? calcSdfShadow(p, l, 8.0) : 1.0;
        float ao = uSdfAoEnabled > 0.5 ? calcSdfAO(p, n) : 1.0;
        vec3 lighting = uSdfLightColor * (diff * shadow + amb) * ao;
        float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 32.0) * 0.5 * shadow;
        
        // Dynamic sampling based on internal source
        vec3 baseCol = getSdfColor(res.y);
        if (uInternalSource > 0.5) {
            float sampleVal = getWaveform(fract(res.y * 0.123 + uTime * 0.1));
            baseCol = mix(baseCol, vec3(sampleVal), 0.5);
        }
        
        baseCol *= uSdfColor;
        color += (baseCol * lighting + spec + smoothstep(0.1, 0.0, res.x) * uSdfGlow) * uSdfFill;
      }
    } else {
      centered = rotate2d(centered, uSdfRotation); 
      float scale = mix(0.2, 0.9, uSdfScale);
      float sdfValue;
      if (uSdfShape < 0.5) sdfValue = sdCircle(centered, scale);
      else if (uSdfShape < 1.5) sdfValue = sdBox(centered, vec2(scale));
      else if (uSdfShape < 2.5) sdfValue = sdEquilateralTriangle(centered, scale);
      else if (uSdfShape < 3.5) sdfValue = sdHexagon(centered, scale);
      else if (uSdfShape < 4.5) sdfValue = sdStar(centered, scale, 5, 2.0);
      else sdfValue = sdRing(centered, scale, uSdfEdge * 0.5);
      
      color += uSdfColor * max(smoothstep(0.02, -0.02, sdfValue) * uSdfFill, smoothstep(uSdfEdge + 0.02, 0.0, abs(sdfValue)) * uSdfGlow) * (0.85 + uPeak * 0.6);
    }
  }
  if (uExpressiveEnergyBloom > 0.01) {
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    float energy = smoothstep(
      uExpressiveEnergyThreshold,
      1.0,
      luma + uRms * 0.45 + uPeak * 0.55
    );
    float bloomBoost = uExpressiveEnergyAccumulation * uExpressiveEnergyBloom;
    color += color * energy * (0.6 + low * 0.4) * bloomBoost;
  }
  if (uExpressiveMotionEcho > 0.01) {
    float trail = 0.0;
    for (int i = 0; i < 8; i += 1) { trail += uTrailSpectrum[i]; }
    trail /= 8.0;
    float echoMix = uExpressiveMotionEcho * (0.25 + trail * 0.75);
    float decay = clamp(uExpressiveMotionEchoDecay, 0.0, 1.0);
    float pulse = 0.5 + 0.5 * sin(uTime * 0.8 + dot(uv, vec2(6.0, 4.0)));
    float warp = clamp(uExpressiveMotionEchoWarp, 0.0, 1.0);
    vec2 warpVec = vec2(
      sin(uTime * (0.6 + warp) + uv.y * 4.0),
      cos(uTime * (0.5 + warp * 0.8) + uv.x * 3.0)
    ) * warp * 0.03;
    vec3 echoTint = shiftPalette(color, (low - high) * 0.15 + pulse * 0.05);
    vec3 echoColor = mix(color, echoTint, 0.35 + pulse * 0.25);
    echoColor += vec3(warpVec.x, warpVec.y, -warpVec.x) * 0.15;
    echoColor *= 0.85 + pulse * 0.2;
    color = mix(color, echoColor, echoMix * (1.0 - decay));
  }
  if (uExpressiveSpectralSmear > 0.01) {
    float smear = uExpressiveSpectralSmear;
    float offset = uExpressiveSpectralOffset * 0.02;
    float mixAmt = uExpressiveSpectralMix;
    vec2 dir = normalize(vec2(mid - low, high - mid) + 0.0001);
    float phase = sin(uTime * 0.4 + dot(uv, dir) * 12.0);
    float channelShift = phase * offset * (0.4 + smear);
    vec3 displaced = vec3(
      color.r + channelShift * (0.5 + high),
      color.g - channelShift * (0.4 + mid),
      color.b + channelShift * (0.3 + low)
    );
    color = mix(color, clamp(displaced, 0.0, 1.0), smear * mixAmt);
  }
  color += vec3(uStrobe * 1.5) + vec3(uPeak * 0.2, uRms * 0.5, uRms * 0.8);
  if (uEffectsEnabled > 0.5) { color += pow(color, vec3(2.0)) * uBloom; color = posterize(color, uPosterize); }
  if (uEffectsEnabled > 0.5 && uChroma > 0.01) color = mix(color, vec3(color.r + uChroma * 0.02, color.g, color.b - uChroma * 0.02), 0.3);
  if (uEffectsEnabled > 0.5 && uBlur > 0.01) color = mix(color, vec3((color.r + color.g + color.b) / 3.0), uBlur * 0.3);
  color = shiftPalette(color, uPaletteShift);
  color = applySaturation(color, uSaturation);
  color = applyContrast(color, uContrast);
  color = color / (vec3(1.0) + color);
  color = pow(color, vec3(1.0 / 1.35));
  color *= uGlobalColor;
  if (uDebugTint > 0.5) color += vec3(0.02, 0.0, 0.0);
  outColor = vec4(color, 1.0);
}
`;

  let currentPalette: [number, number, number][] = [
    [0.05, 0.0, 0.15], // Deep Purple
    [0.0, 0.0, 0.8],   // Blue
    [0.0, 0.8, 0.8],   // Cyan
    [0.9, 0.0, 0.6],   // Magenta
    [1.0, 1.0, 1.0]    // White
  ];
  let advancedSdfProgram: WebGLProgram | null = null;
  let advancedSdfUniforms: any[] = [];
  let advancedSdfUniformLocations: Map<string, WebGLUniformLocation | null> = new Map();
  
  const waveformTexture = gl.createTexture();
  const spectrumTexture = gl.createTexture();
  const modulatorTexture = gl.createTexture();
  const midiTexture = gl.createTexture();

  const initInternalTextures = () => {
    [waveformTexture, spectrumTexture, modulatorTexture, midiTexture].forEach(tex => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    });
  };
  initInternalTextures();

  const compileShader = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      console.error('Shader compile error:', log);
      const hasCustom = source.includes('customPlasma');
      if (hasCustom || source.length < 4000) {
        const numbered = source
          .split('\n')
          .map((line, i) => `${String(i + 1).padStart(4, '0')}: ${line}`)
          .join('\n');
        console.error('Shader source (numbered):\n', numbered);
      } else {
        console.error('Shader source omitted (too large).');
      }
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const createProgram = (vSource: string, fSource: string) => {
    const vs = compileShader(gl.VERTEX_SHADER, vSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fSource);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  };

  let standardProgram = createProgram(vertexShaderSrc, createFragmentShaderSrc());
  if (!standardProgram) {
    throw new Error('Failed to compile standard shader program.');
  }
  let currentProgram = standardProgram;
  let lastSdfSceneJson = '';

  const updateAdvancedSdfProgram = (scene: any) => {
    const sceneJson = JSON.stringify(scene || {});
    if (sceneJson === lastSdfSceneJson) return;
    lastSdfSceneJson = sceneJson;
    if (!scene || !scene.nodes || scene.nodes.length === 0) {
      advancedSdfProgram = null; return;
    }
    try {
      const compiled = buildSdfShader(scene.nodes, scene.connections || [], scene.mode || '2d');
      const uniformsCode = compiled.uniforms.map(u => `uniform ${u.type} ${u.name};`).join('\n');
      const fSource = createFragmentShaderSrc(
        uniformsCode,
        compiled.functionsCode,
        compiled.mapBody,
        customPlasmaSource
      );
      const newProg = createProgram(vertexShaderSrc, fSource);
      if (newProg) {
        advancedSdfProgram = newProg;
        advancedSdfUniforms = compiled.uniforms;
        advancedSdfUniformLocations.clear();
        advancedSdfUniforms.forEach(u => advancedSdfUniformLocations.set(u.name, gl.getUniformLocation(newProg, u.name)));
      }
    } catch (err) {
      console.error('Failed to build advanced SDF shader:', err);
      advancedSdfProgram = null;
    }
  };

  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) throw new Error('Buffer creation failed');
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  const updateStandardUniforms = (prog: WebGLProgram, state: RenderState) => {
    gl.useProgram(prog);
    const getLocation = (name: string) => gl.getUniformLocation(prog, name);
    gl.uniform1f(getLocation('uTime'), state.timeMs / 1000);
    gl.uniform1f(getLocation('uRms'), state.rms);
    gl.uniform1f(getLocation('uPeak'), state.peak);
    gl.uniform1f(getLocation('uStrobe'), state.strobe);
    gl.uniform1f(getLocation('uAspect'), canvas.width / canvas.height);
    gl.uniform2f(getLocation('uResolution'), canvas.width, canvas.height);
    gl.uniform1f(getLocation('uPlasmaEnabled'), state.plasmaEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uPlasmaOpacity'), state.plasmaOpacity);
    gl.uniform1f(getLocation('uPlasmaSpeed'), state.plasmaSpeed || 1.0);
    gl.uniform1f(getLocation('uPlasmaScale'), state.plasmaScale || 1.0);
    gl.uniform1f(getLocation('uPlasmaComplexity'), state.plasmaComplexity || 3.0);
    gl.uniform1f(getLocation('uPlasmaAudioReact'), state.plasmaAudioReact || 0.5);
    gl.uniform1f(getLocation('uSpectrumEnabled'), state.spectrumEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uSpectrumOpacity'), state.spectrumOpacity);
    gl.uniform1fv(getLocation('uSpectrum[0]'), state.spectrum);
    gl.uniform1f(getLocation('uOrigamiEnabled'), state.origamiEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uOrigamiOpacity'), state.origamiOpacity);
    gl.uniform1f(getLocation('uOrigamiFoldState'), state.origamiFoldState);
    gl.uniform1f(getLocation('uOrigamiFoldSharpness'), state.origamiFoldSharpness);
    gl.uniform1f(getLocation('uOrigamiSpeed'), state.origamiSpeed || 1.0);
    gl.uniform1f(getLocation('uGlyphEnabled'), state.glyphEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uGlyphOpacity'), state.glyphOpacity);
    gl.uniform1f(getLocation('uGlyphMode'), state.glyphMode);
    gl.uniform1f(getLocation('uGlyphSeed'), state.glyphSeed);
    gl.uniform1f(getLocation('uGlyphBeat'), state.glyphBeat);
    gl.uniform1f(getLocation('uGlyphSpeed'), state.glyphSpeed || 1.0);
    gl.uniform1f(getLocation('uCrystalEnabled'), state.crystalEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uCrystalOpacity'), state.crystalOpacity);
    gl.uniform1f(getLocation('uCrystalMode'), state.crystalMode);
    gl.uniform1f(getLocation('uCrystalBrittleness'), state.crystalBrittleness);
    gl.uniform1f(getLocation('uCrystalScale'), state.crystalScale || 1.0);
    gl.uniform1f(getLocation('uCrystalSpeed'), state.crystalSpeed || 1.0);
    gl.uniform1f(getLocation('uInkEnabled'), state.inkEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uInkOpacity'), state.inkOpacity);
    gl.uniform1f(getLocation('uInkBrush'), state.inkBrush);
    gl.uniform1f(getLocation('uInkPressure'), state.inkPressure);
    gl.uniform1f(getLocation('uInkLifespan'), state.inkLifespan);
    gl.uniform1f(getLocation('uInkSpeed'), state.inkSpeed || 1.0);
    gl.uniform1f(getLocation('uInkScale'), state.inkScale || 1.0);
    gl.uniform1f(getLocation('uTopoEnabled'), state.topoEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uTopoOpacity'), state.topoOpacity);
    gl.uniform1f(getLocation('uTopoQuake'), state.topoQuake);
    gl.uniform1f(getLocation('uTopoSlide'), state.topoSlide);
    gl.uniform1f(getLocation('uTopoPlate'), state.topoPlate);
    gl.uniform1f(getLocation('uTopoTravel'), state.topoTravel);
    gl.uniform1f(getLocation('uTopoScale'), state.topoScale || 1.0);
    gl.uniform1f(getLocation('uTopoElevation'), state.topoElevation || 1.0);
    gl.uniform1f(getLocation('uWeatherEnabled'), state.weatherEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uWeatherOpacity'), state.weatherOpacity);
    gl.uniform1f(getLocation('uWeatherMode'), state.weatherMode);
    gl.uniform1f(getLocation('uWeatherIntensity'), state.weatherIntensity);
    gl.uniform1f(getLocation('uWeatherSpeed'), state.weatherSpeed || 1.0);
    gl.uniform1f(getLocation('uPortalEnabled'), state.portalEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uPortalOpacity'), state.portalOpacity);
    gl.uniform1f(getLocation('uPortalShift'), state.portalShift);
    gl.uniform1f(getLocation('uPortalStyle'), state.portalStyle);
    gl.uniform2fv(getLocation('uPortalPos[0]'), state.portalPositions);
    gl.uniform1fv(getLocation('uPortalRadius[0]'), state.portalRadii);
    gl.uniform1fv(getLocation('uPortalActive[0]'), state.portalActives);
    gl.uniform1f(getLocation('uMediaEnabled'), state.mediaEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uMediaOpacity'), state.mediaOpacity);
    gl.uniform1f(getLocation('uMediaAssetBlend'), state.mediaAssetBlendMode);
    gl.uniform1f(getLocation('uMediaAssetAudioReact'), state.mediaAssetAudioReact);
    gl.uniform2fv(getLocation('uMediaBurstPos[0]'), state.mediaBurstPositions);
    gl.uniform1fv(getLocation('uMediaBurstRadius[0]'), state.mediaBurstRadii);
    gl.uniform1fv(getLocation('uMediaBurstType[0]'), state.mediaBurstTypes);
    gl.uniform1fv(getLocation('uMediaBurstActive[0]'), state.mediaBurstActives);
    gl.uniform1f(getLocation('uOscilloEnabled'), state.oscilloEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uOscilloOpacity'), state.oscilloOpacity);
    gl.uniform1f(getLocation('uOscilloMode'), state.oscilloMode);
    gl.uniform1f(getLocation('uOscilloFreeze'), state.oscilloFreeze);
    gl.uniform1f(getLocation('uOscilloRotate'), state.oscilloRotate);
    gl.uniform1fv(getLocation('uOscillo[0]'), state.oscilloData);
    gl.uniform2fv(getLocation('uGravityPos[0]'), state.gravityPositions);
    gl.uniform1fv(getLocation('uGravityStrength[0]'), state.gravityStrengths);
    gl.uniform1fv(getLocation('uGravityPolarity[0]'), state.gravityPolarities);
    gl.uniform1fv(getLocation('uGravityActive[0]'), state.gravityActives);
    gl.uniform1f(getLocation('uGravityCollapse'), state.gravityCollapse);
    gl.uniform1f(getLocation('uContrast'), state.contrast);
    gl.uniform1f(getLocation('uSaturation'), state.saturation);
    gl.uniform1f(getLocation('uPaletteShift'), state.paletteShift);
    gl.uniform1f(getLocation('uEffectsEnabled'), state.effectsEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uBloom'), state.bloom);
    gl.uniform1f(getLocation('uBlur'), state.blur);
    gl.uniform1f(getLocation('uChroma'), state.chroma);
    gl.uniform1f(getLocation('uPosterize'), state.posterize);
    gl.uniform1f(getLocation('uKaleidoscope'), state.kaleidoscope);
    gl.uniform1f(getLocation('uKaleidoscopeRotation'), state.kaleidoscopeRotation || 0.0);
    gl.uniform1f(getLocation('uFeedback'), state.feedback);
    gl.uniform1f(getLocation('uFeedbackZoom'), state.feedbackZoom || 0.0);
    gl.uniform1f(getLocation('uFeedbackRotation'), state.feedbackRotation || 0.0);
    gl.uniform1f(getLocation('uPersistence'), state.persistence);
    gl.uniform1fv(getLocation('uTrailSpectrum[0]'), state.trailSpectrum);
    gl.uniform1f(getLocation('uExpressiveEnergyBloom'), state.expressiveEnergyBloom);
    gl.uniform1f(getLocation('uExpressiveEnergyThreshold'), state.expressiveEnergyThreshold);
    gl.uniform1f(getLocation('uExpressiveEnergyAccumulation'), state.expressiveEnergyAccumulation);
    gl.uniform1f(getLocation('uExpressiveRadialGravity'), state.expressiveRadialGravity);
    gl.uniform1f(getLocation('uExpressiveRadialStrength'), state.expressiveRadialStrength);
    gl.uniform1f(getLocation('uExpressiveRadialRadius'), state.expressiveRadialRadius);
    gl.uniform1f(getLocation('uExpressiveRadialFocusX'), state.expressiveRadialFocusX);
    gl.uniform1f(getLocation('uExpressiveRadialFocusY'), state.expressiveRadialFocusY);
    gl.uniform1f(getLocation('uExpressiveMotionEcho'), state.expressiveMotionEcho);
    gl.uniform1f(getLocation('uExpressiveMotionEchoDecay'), state.expressiveMotionEchoDecay);
    gl.uniform1f(getLocation('uExpressiveMotionEchoWarp'), state.expressiveMotionEchoWarp);
    gl.uniform1f(getLocation('uExpressiveSpectralSmear'), state.expressiveSpectralSmear);
    gl.uniform1f(getLocation('uExpressiveSpectralOffset'), state.expressiveSpectralOffset);
    gl.uniform1f(getLocation('uExpressiveSpectralMix'), state.expressiveSpectralMix);
    gl.uniform1f(getLocation('uParticlesEnabled'), state.particlesEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uParticleDensity'), state.particleDensity);
    gl.uniform1f(getLocation('uParticleSpeed'), state.particleSpeed);
    gl.uniform1f(getLocation('uParticleSize'), state.particleSize);
    gl.uniform1f(getLocation('uParticleGlow'), state.particleGlow);
    gl.uniform1f(getLocation('uParticleTurbulence'), state.particleTurbulence || 0.3);
    gl.uniform1f(getLocation('uParticleAudioLift'), state.particleAudioLift || 0.5);
    gl.uniform1f(getLocation('uSdfEnabled'), state.sdfEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uSdfShape'), state.sdfShape);
    gl.uniform1f(getLocation('uSdfScale'), state.sdfScale);
    gl.uniform1f(getLocation('uSdfEdge'), state.sdfEdge);
    gl.uniform1f(getLocation('uSdfGlow'), state.sdfGlow);
    gl.uniform1f(getLocation('uSdfRotation'), state.sdfRotation);
    gl.uniform1f(getLocation('uSdfFill'), state.sdfFill);
    gl.uniform3fv(getLocation('uSdfColor'), state.sdfColor || [1.0, 0.6, 0.25]);
    gl.uniform1f(getLocation('uInternalSource'), state.hasInternalAsset ? 1 : 0);
    gl.uniform3fv(getLocation('uGlobalColor'), state.globalColor || [1.0, 1.0, 1.0]);
    gl.uniform1f(getLocation('uDebugTint'), state.debugTint ?? 0);
    gl.uniform1f(getLocation('uAdvancedSdfEnabled'), (state.sdfScene && prog === advancedSdfProgram) ? 1 : 0);
    if (currentPalette.length >= 5) gl.uniform3fv(getLocation('uPalette[0]'), currentPalette.flat());
    const pLoc = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(pLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
  };

  type AssetLayerId = 'layer-plasma' | 'layer-spectrum' | 'layer-media';
  const ASSET_LAYER_UNITS: Record<AssetLayerId, number> = {
    'layer-plasma': 1,
    'layer-spectrum': 2,
    'layer-media': 3
  };

  interface AssetCacheEntry {
    assetId: string;
    texture: WebGLTexture;
    internalSourceId?: string;
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
      if (!texture) { resolve({ assetId: asset.id, texture: gl.createTexture()! }); return; }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (!asset.path) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        resolve({ assetId: asset.id, texture, width: asset.width, height: asset.height });
        return;
      }
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        applyTextureSampling(asset.options?.textureSampling, Boolean(asset.options?.generateMipmaps), image.width, image.height);
        resolve({ assetId: asset.id, texture, width: image.width, height: image.height });
      };
      image.onerror = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        resolve({ assetId: asset.id, texture, width: asset.width, height: asset.height });
      };
      image.src = toFileUrl(asset.path);
    });

  const loadVideoAsset = (asset: AssetItem, videoOverride?: HTMLVideoElement): Promise<AssetCacheEntry> =>
    new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) { resolve({ assetId: asset.id, texture: gl.createTexture()! }); return; }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const video = videoOverride ?? document.createElement('video');
      if (!videoOverride) { 
        video.crossOrigin = 'anonymous'; video.muted = true; video.loop = asset.options?.loop ?? true;
        video.playsInline = true; video.preload = 'auto'; video.autoplay = true;
        video.playbackRate = asset.options?.playbackRate ?? 1;
      }
      const finalize = () => {
        const baseRate = asset.options?.playbackRate ?? 1;
        video.playbackRate = asset.options?.reverse ? -Math.max(0.01, Math.abs(baseRate)) : baseRate;
        if (asset.options?.reverse && video.duration) video.currentTime = video.duration;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        applyTextureSampling(asset.options?.textureSampling, false, video.videoWidth, video.videoHeight);
        resolve({ assetId: asset.id, texture, video, width: video.videoWidth || asset.width, height: video.videoHeight || asset.height, options: asset.options });
      };
      if (!videoOverride) {
        video.addEventListener('error', () => resolve({ assetId: asset.id, texture, video }), { once: true });
        if (asset.path) { video.src = toFileUrl(asset.path); void video.play().catch(() => undefined); }
        else { resolve({ assetId: asset.id, texture, video }); return; }
      }
      if (video.readyState >= video.HAVE_CURRENT_DATA) finalize();
      else video.addEventListener('loadeddata', finalize, { once: true });
    });

  const loadTextAsset = (asset: AssetItem, canvas: HTMLCanvasElement): Promise<AssetCacheEntry> =>
    new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) { resolve({ assetId: asset.id, texture: gl.createTexture()! }); return; }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      resolve({ assetId: asset.id, texture, width: canvas.width, height: canvas.height, options: asset.options });
    });

  const loadInternalAsset = (asset: AssetItem): Promise<AssetCacheEntry> => {
    let texture = waveformTexture!;
    if (asset.internalSource === 'audio-spectrum') texture = spectrumTexture!;
    if (asset.internalSource === 'modulators') texture = modulatorTexture!;
    
    return Promise.resolve({
        assetId: asset.id,
        texture,
        internalSourceId: asset.internalSource,
        width: 256,
        height: 1
    });
  };

  const ensureAssetEntry = (asset: AssetItem, videoOverride?: HTMLVideoElement, textCanvas?: HTMLCanvasElement) => {
    if (assetCache.has(asset.id)) {
      const cached = assetCache.get(asset.id)!;
      if (JSON.stringify(cached.options ?? {}) === JSON.stringify(asset.options ?? {})) return Promise.resolve(cached);
      assetCache.delete(asset.id);
    }
    if (pendingAssetLoads.has(asset.id)) return pendingAssetLoads.get(asset.id)!;
    let loader: Promise<AssetCacheEntry>;
    if (asset.kind === 'internal') loader = loadInternalAsset(asset);
    else if (asset.kind === 'video' || asset.kind === 'live') loader = loadVideoAsset(asset, videoOverride);
    else if (asset.kind === 'text' && textCanvas) loader = loadTextAsset(asset, textCanvas);
    else loader = loadImageAsset(asset);
    pendingAssetLoads.set(asset.id, loader);
    loader.then((entry) => { assetCache.set(asset.id, entry); pendingAssetLoads.delete(asset.id); });
    return loader;
  };

  const updateVideoTextures = () => {
    (Object.keys(ASSET_LAYER_UNITS) as AssetLayerId[]).forEach((layerId) => {
      const entry = layerBindings[layerId];
      if (entry?.video && entry.texture && entry.video.readyState >= entry.video.HAVE_CURRENT_DATA) {
        gl.activeTexture(gl.TEXTURE0 + ASSET_LAYER_UNITS[layerId]);
        gl.bindTexture(gl.TEXTURE_2D, entry.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.video);
      }
    });
  };

  const updateInternalTextures = (state: RenderState) => {
    // 1. Waveform (256x1)
    gl.bindTexture(gl.TEXTURE_2D, waveformTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 256, 1, 0, gl.RED, gl.FLOAT, state.oscilloData);

    // 2. Spectrum (64x1)
    gl.bindTexture(gl.TEXTURE_2D, spectrumTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 64, 1, 0, gl.RED, gl.FLOAT, state.spectrum);

    // 3. Modulators
    gl.bindTexture(gl.TEXTURE_2D, modulatorTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, state.modulatorValues.length, 1, 0, gl.RED, gl.FLOAT, state.modulatorValues);

    // 4. MIDI History
    gl.bindTexture(gl.TEXTURE_2D, midiTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, 128, 1, 0, gl.RG, gl.FLOAT, state.midiData);
  };

  const applyInternalTextures = (prog: WebGLProgram) => {
    const units = { waveform: 10, spectrum: 11, modulators: 12 };
    
    gl.activeTexture(gl.TEXTURE0 + units.waveform);
    gl.bindTexture(gl.TEXTURE_2D, waveformTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uWaveformTex'), units.waveform);

    gl.activeTexture(gl.TEXTURE0 + units.spectrum);
    gl.bindTexture(gl.TEXTURE_2D, spectrumTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uSpectrumTex'), units.spectrum);

    gl.activeTexture(gl.TEXTURE0 + units.modulators);
    gl.bindTexture(gl.TEXTURE_2D, modulatorTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uModulatorTex'), units.modulators);

    gl.activeTexture(gl.TEXTURE0 + 13);
    gl.bindTexture(gl.TEXTURE_2D, midiTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uMidiTex'), 13);
  };

  const applyLayerBinding = (prog: WebGLProgram, layerId: AssetLayerId) => {
    const entry = layerBindings[layerId];
    const unitIndex = ASSET_LAYER_UNITS[layerId];
    const prefix =
      layerId === 'layer-plasma' ? 'uPlasma' : layerId === 'layer-spectrum' ? 'uSpectrum' : 'uMedia';
    const enabledLoc = gl.getUniformLocation(prog, `${prefix}AssetEnabled`);
    const samplerLoc = gl.getUniformLocation(prog, `${prefix}Asset`);
    
    if (enabledLoc) gl.uniform1f(enabledLoc, entry ? 1 : 0);
    
    if (entry?.internalSourceId) {
        let internalUnit = 10; // waveform
        if (entry.internalSourceId === 'audio-spectrum') internalUnit = 11;
        if (entry.internalSourceId === 'modulators') internalUnit = 12;
        if (entry.internalSourceId === 'midi-history') internalUnit = 13;
        
        if (samplerLoc) gl.uniform1i(samplerLoc, internalUnit);
    } else {
        if (samplerLoc) gl.uniform1i(samplerLoc, unitIndex);
        gl.activeTexture(gl.TEXTURE0 + unitIndex);
        gl.bindTexture(gl.TEXTURE_2D, entry?.texture ?? null);
    }
  };

  const setLayerAsset = async (layerId: AssetLayerId, asset: AssetItem | null, videoOverride?: HTMLVideoElement, textCanvas?: HTMLCanvasElement) => {
    if (!asset) { delete layerBindings[layerId]; return; }
    const entry = await ensureAssetEntry(asset, videoOverride, textCanvas);
    layerBindings[layerId] = entry;
  };

  const setPalette = (colors: [string, string, string, string, string]) => {
    currentPalette = colors.map(hex => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return [r, g, b];
    });
  };

  const setPlasmaShaderSource = (source: string | null) => {
    const trimmed = source?.trim();
    const nextSource = trimmed ? trimmed : null;
    const nextProgram = createProgram(
      vertexShaderSrc,
      createFragmentShaderSrc('', '', '10.0', nextSource)
    );
    if (!nextProgram) {
      return { ok: false };
    }
    standardProgram = nextProgram;
    customPlasmaSource = nextSource;
    return { ok: true };
  };

  const render = (state: RenderState) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    updateInternalTextures(state);
    updateAdvancedSdfProgram(state.sdfScene);
    currentProgram = (state.sdfScene && advancedSdfProgram) ? advancedSdfProgram : standardProgram;
    if (!currentProgram) {
      console.error('Render program unavailable; skipping frame.');
      return;
    }
    updateStandardUniforms(currentProgram, state);
    applyInternalTextures(currentProgram);
    updateVideoTextures();
    applyLayerBinding(currentProgram, 'layer-plasma');
    applyLayerBinding(currentProgram, 'layer-spectrum');
    applyLayerBinding(currentProgram, 'layer-media');
    
    if (currentProgram === advancedSdfProgram && state.sdfScene) {
      const s = state.sdfScene;
      if (s.mode === '3d' && s.render3d) {
          const l = s.render3d.lighting;
          gl.uniform3fv(gl.getUniformLocation(currentProgram, 'uSdfLightDir'), l.direction);
          gl.uniform3fv(gl.getUniformLocation(currentProgram, 'uSdfLightColor'), l.color);
          gl.uniform1f(gl.getUniformLocation(currentProgram, 'uSdfLightIntensity'), l.intensity);
          gl.uniform1f(gl.getUniformLocation(currentProgram, 'uSdfAoEnabled'), s.render3d.aoEnabled ? 1 : 0);
          gl.uniform1f(gl.getUniformLocation(currentProgram, 'uSdfShadowsEnabled'), s.render3d.softShadowsEnabled ? 1 : 0);
          
          // Camera defaults if not in config
          const camPos = s.render3d.cameraPosition || [0, 0, 2];
          const camTarget = s.render3d.cameraTarget || [0, 0, 0];
          const camFov = s.render3d.cameraFov || 1.0;
          gl.uniform3fv(gl.getUniformLocation(currentProgram, 'uCameraPos'), camPos);
          gl.uniform3fv(gl.getUniformLocation(currentProgram, 'uCameraTarget'), camTarget);
          gl.uniform1f(gl.getUniformLocation(currentProgram, 'uCameraFov'), camFov);
      }

      advancedSdfUniforms.forEach(u => {
        const loc = advancedSdfUniformLocations.get(u.name);
        if (loc) {
          const node = state.sdfScene.nodes.find((n: any) => n.instanceId === u.instanceId);
          const val = node?.params[u.parameterId];
          if (typeof val === 'number') gl.uniform1f(loc, val);
          else if (Array.isArray(val)) {
            if (val.length === 2) gl.uniform2fv(loc, val);
            else if (val.length === 3) gl.uniform3fv(loc, val);
          }
        }
      });
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  return { render, setLayerAsset, setPalette, setPlasmaShaderSource };
};
