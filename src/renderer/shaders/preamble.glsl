#version 300 es
precision highp float;

uniform float uTime;
uniform float uAspect;
uniform vec2 uResolution;
uniform float uRms;
uniform float uPeak;
uniform float uStrobe;
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
uniform sampler2D uWaveformTex;
uniform sampler2D uSpectrumTex;
uniform sampler2D uModulatorTex;
uniform sampler2D uMidiTex;
uniform vec3 uGlobalColor;
uniform float uDebugTint;
uniform float uDebugColorStage;
uniform vec3 uRoleWeights; // x: core, y: support, z: atmosphere
uniform float uTransitionAmount;
uniform float uTransitionType;
uniform float uChemistryMode;
uniform float uMotionTemplate;
uniform float uEngineMass;
uniform float uEngineFriction;
uniform float uEngineElasticity;
uniform float uMaxBloom;
uniform float uForceFeedback;
uniform float uEngineGrain;
uniform float uEngineVignette;
uniform float uEngineCA;
uniform float uEngineSignature;
uniform float uEffectsEnabled;

// Post-FX & feedback uniforms (always needed by mainTemplate)
uniform sampler2D uPreviousFrame;
uniform float uKaleidoscope;
uniform float uKaleidoscopeRotation;
uniform float uFeedback;
uniform float uFeedbackRotation;
uniform float uFeedbackZoom;
uniform float uPosterize;
uniform float uChroma;
uniform float uBlur;
uniform float uBloom;
uniform float uPersistence;
uniform float uGlyphBeat;

// Strobe uniforms (used in mainTemplate post-processing)
uniform float uStrobeEnabled;
uniform float uStrobeRate;
uniform float uStrobeDutyCycle;
uniform float uStrobeThreshold;
uniform float uStrobeAudioTrigger;
uniform float uStrobeOpacity;
uniform float uStrobeFadeOut;
uniform float uStrobeMode;
uniform float uStrobePattern;

// VHS scanline uniforms (used in mainTemplate post-processing)
uniform float uVhsScanlineEnabled;
uniform float uVhsScanlineMode;
uniform float uVhsScanlineFrequency;
uniform float uVhsScanlineSpeed;
uniform float uVhsScanlineIntensity;
uniform float uVhsScanlineWarp;

/* @@GENERATOR_UNIFORMS */

float sdfSceneMap(vec3 p) {
  return 10.0; // Placeholder for simple mode, overridden in advanced
}

vec2 advancedSdfMap(vec3 p) {
  // Default returns distance and material (0.0 for no material)
  return vec2(/* @@SDF_MAP_BODY */, 0.0);
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
  for (float i = 0.0; i < 16.0; i += 1.0) {
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
  for (float i = 0.0; i < 5.0; i += 1.0) {
    float hr = 0.01 + 0.12 * i / 4.0;
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

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p * p);
}

float gradientNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(hash22(i) * 2.0 - 1.0, f);
  float b = dot(hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0, f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * gradientNoise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v * 0.5 + 0.5;
}

vec3 palette(float t) {
  float s = clamp(t, 0.0, 1.0) * 4.0;
  int i = int(floor(s));
  float f = fract(s);
  if (i >= 4) return uPalette[4];
  return mix(uPalette[i], uPalette[i + 1], smoothstep(0.0, 1.0, f));
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

vec3 posterize(vec3 color, float amount) {
  if (amount <= 0.01) return color;
  float levels = mix(16.0, 3.0, amount);
  return floor(color * levels) / levels;
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
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

float sdArc(vec2 p, vec2 c, float r, float w) {
  p -= c;
  float l = length(p);
  if (l > r) return l - r;
  float a = atan(p.y, p.x);
  float halfW = w * 0.5;
  if (abs(a) > halfW) {
    vec2 q = vec2(cos(halfW), sin(halfW)) * r;
    return distance(p, sign(p.y) * q);
  }
  return r - l;
}

float getWaveform(float t) {
  return texture(uWaveformTex, vec2(clamp(t, 0.0, 1.0), 0.5)).r;
}

vec3 hueRotate(vec3 col, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat3 m = mat3(
    0.299 + 0.701*c - 0.168*s, 0.587 - 0.587*c + 0.330*s, 0.114 - 0.114*c - 0.497*s,
    0.299 - 0.299*c + 0.328*s, 0.587 + 0.413*c + 0.035*s, 0.114 - 0.114*c - 0.292*s,
    0.299 - 0.300*c - 0.900*s, 0.587 - 0.588*c + 1.050*s, 0.114 + 0.886*c + 0.203*s
  );
  return clamp(m * col, 0.0, 1.0);
}
