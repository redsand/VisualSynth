/**
 * GLSL Utility Functions
 *
 * Common utility functions used by SDF nodes.
 * These are inserted into the shader as needed.
 */

// ============================================================================
// Hash Functions
// ============================================================================

export const GLSL_HASH = `
// Hash functions for procedural generation
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 hash22(vec2 p) {
  vec3 a = fract(p.xyx * vec3(0.1031, 0.1030, 0.0973));
  a += dot(a, a.yzx + 33.33);
  return fract((a.xx + a.yz) * a.zy);
}

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
`;

// ============================================================================
// Rotation Functions
// ============================================================================

export const GLSL_ROTATE = `
// 2D rotation
vec2 rotate2d(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// 3D rotation around X axis
vec3 rotateX(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

// 3D rotation around Y axis
vec3 rotateY(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

// 3D rotation around Z axis
vec3 rotateZ(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

// Rotation matrix from Euler angles (XYZ order)
mat3 rotationMatrix(vec3 angles) {
  float cx = cos(angles.x), sx = sin(angles.x);
  float cy = cos(angles.y), sy = sin(angles.y);
  float cz = cos(angles.z), sz = sin(angles.z);
  return mat3(
    cy * cz, -cy * sz, sy,
    sx * sy * cz + cx * sz, -sx * sy * sz + cx * cz, -sx * cy,
    -cx * sy * cz + sx * sz, cx * sy * sz + sx * cz, cx * cy
  );
}
`;

// ============================================================================
// Noise Functions
// ============================================================================

export const GLSL_NOISE = `
// Value noise 2D
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Value noise 3D
float valueNoise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 157.0 + 113.0 * i.z;
  return mix(
    mix(mix(hash11(n), hash11(n + 1.0), f.x),
        mix(hash11(n + 157.0), hash11(n + 158.0), f.x), f.y),
    mix(mix(hash11(n + 113.0), hash11(n + 114.0), f.x),
        mix(hash11(n + 270.0), hash11(n + 271.0), f.x), f.y),
    f.z
  );
}

// Gradient noise 2D (Perlin-like)
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

// FBM (Fractal Brownian Motion)
float fbm(vec2 p, int octaves, float lacunarity, float gain) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < octaves; i++) {
    value += amplitude * gradientNoise(p * frequency);
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return value;
}
`;

// ============================================================================
// Math Utilities
// ============================================================================

export const GLSL_MATH = `
// Common math utilities
#define PI 3.14159265359
#define TAU 6.28318530718
#define HALF_PI 1.57079632679

// Smooth minimum (polynomial)
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Smooth maximum
float smax(float a, float b, float k) {
  return -smin(-a, -b, k);
}

// Exponential smooth minimum
float sminExp(float a, float b, float k) {
  float res = exp2(-k * a) + exp2(-k * b);
  return -log2(res) / k;
}

// Power smooth minimum
float sminPow(float a, float b, float k) {
  a = pow(a, k);
  b = pow(b, k);
  return pow((a * b) / (a + b), 1.0 / k);
}

// Smooth absolute value
float sabs(float x, float k) {
  return sqrt(x * x + k * k);
}

// Bias function
float bias(float x, float b) {
  return x / ((1.0 / b - 2.0) * (1.0 - x) + 1.0);
}

// Gain function
float gain(float x, float g) {
  if (x < 0.5) {
    return bias(2.0 * x, g) * 0.5;
  }
  return 1.0 - bias(2.0 - 2.0 * x, g) * 0.5;
}

// NDot (used in some SDF formulas)
float ndot(vec2 a, vec2 b) {
  return a.x * b.x - a.y * b.y;
}

// Length with power (for superellipse/superquadric)
float length2(vec2 p) { return dot(p, p); }
float length4(vec2 p) { p = p * p; return sqrt(p.x + p.y); }
float length6(vec2 p) { p = p * p * p; return pow(p.x + p.y, 1.0 / 3.0); }
float length8(vec2 p) { p = p * p; p = p * p; return sqrt(sqrt(p.x + p.y)); }

// Safe normalize
vec2 safeNormalize(vec2 v) {
  float l = length(v);
  return l > 0.0001 ? v / l : vec2(0.0);
}

vec3 safeNormalize3(vec3 v) {
  float l = length(v);
  return l > 0.0001 ? v / l : vec3(0.0);
}
`;

// ============================================================================
// SDF Utility Functions
// ============================================================================

export const GLSL_SDF_UTILS = `
// Onion (shell/hollow)
float opOnion(float d, float thickness) {
  return abs(d) - thickness;
}

// Round (add radius to any shape)
float opRound(float d, float radius) {
  return d - radius;
}

// Extrusion (2D to 3D)
float opExtrusion(vec3 p, float d2d, float h) {
  vec2 w = vec2(d2d, abs(p.z) - h);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}

// Revolution (2D to 3D around Y axis)
float opRevolution(vec3 p, float d2d, float offset) {
  vec2 q = vec2(length(p.xz) - offset, p.y);
  return d2d; // d2d should be evaluated at q instead of p.xy
}

// Elongation (stretch in one direction)
vec2 opElongate2D(vec2 p, vec2 h) {
  return p - clamp(p, -h, h);
}

vec3 opElongate3D(vec3 p, vec3 h) {
  return p - clamp(p, -h, h);
}

// Symmetry operations
vec2 opSymX(vec2 p) { return vec2(abs(p.x), p.y); }
vec2 opSymY(vec2 p) { return vec2(p.x, abs(p.y)); }
vec3 opSymXY(vec3 p) { return vec3(abs(p.x), abs(p.y), p.z); }
vec3 opSymXZ(vec3 p) { return vec3(abs(p.x), p.y, abs(p.z)); }
vec3 opSymYZ(vec3 p) { return vec3(p.x, abs(p.y), abs(p.z)); }
vec3 opSymXYZ(vec3 p) { return abs(p); }

// Infinite repetition
vec2 opRepeat2D(vec2 p, vec2 c) {
  return mod(p + 0.5 * c, c) - 0.5 * c;
}

vec3 opRepeat3D(vec3 p, vec3 c) {
  return mod(p + 0.5 * c, c) - 0.5 * c;
}

// Limited repetition
vec2 opRepeatLimited2D(vec2 p, float c, vec2 l) {
  return p - c * clamp(floor(p / c + 0.5), -l, l);
}

vec3 opRepeatLimited3D(vec3 p, float c, vec3 l) {
  return p - c * clamp(floor(p / c + 0.5), -l, l);
}

// Polar repetition
vec2 opPolar(vec2 p, float n) {
  float angle = PI / n;
  float a = atan(p.y, p.x) + angle;
  float r = length(p);
  a = mod(a, 2.0 * angle) - angle;
  return vec2(cos(a), sin(a)) * r;
}
`;

// ============================================================================
// All Utilities Combined
// ============================================================================

export const ALL_GLSL_UTILS = [
  GLSL_HASH,
  GLSL_ROTATE,
  GLSL_MATH,
  GLSL_SDF_UTILS
].join('\n');

export const ALL_GLSL_UTILS_WITH_NOISE = [
  GLSL_HASH,
  GLSL_ROTATE,
  GLSL_NOISE,
  GLSL_MATH,
  GLSL_SDF_UTILS
].join('\n');

// ============================================================================
// Utility Names for Dependency Resolution
// ============================================================================

export const UTIL_FUNCTIONS = {
  // Hash
  'hash11': GLSL_HASH,
  'hash21': GLSL_HASH,
  'hash22': GLSL_HASH,
  'hash31': GLSL_HASH,
  'hash33': GLSL_HASH,

  // Rotation
  'rotate2d': GLSL_ROTATE,
  'rotateX': GLSL_ROTATE,
  'rotateY': GLSL_ROTATE,
  'rotateZ': GLSL_ROTATE,
  'rotationMatrix': GLSL_ROTATE,

  // Noise
  'valueNoise': GLSL_NOISE,
  'valueNoise3D': GLSL_NOISE,
  'gradientNoise': GLSL_NOISE,
  'fbm': GLSL_NOISE,

  // Math
  'smin': GLSL_MATH,
  'smax': GLSL_MATH,
  'sminExp': GLSL_MATH,
  'sminPow': GLSL_MATH,
  'sabs': GLSL_MATH,
  'bias': GLSL_MATH,
  'gain': GLSL_MATH,
  'ndot': GLSL_MATH,
  'length2': GLSL_MATH,
  'length4': GLSL_MATH,
  'length6': GLSL_MATH,
  'length8': GLSL_MATH,
  'safeNormalize': GLSL_MATH,
  'safeNormalize3': GLSL_MATH,

  // SDF Utils
  'opOnion': GLSL_SDF_UTILS,
  'opRound': GLSL_SDF_UTILS,
  'opExtrusion': GLSL_SDF_UTILS,
  'opRevolution': GLSL_SDF_UTILS,
  'opElongate2D': GLSL_SDF_UTILS,
  'opElongate3D': GLSL_SDF_UTILS,
  'opSymX': GLSL_SDF_UTILS,
  'opSymY': GLSL_SDF_UTILS,
  'opSymXY': GLSL_SDF_UTILS,
  'opSymXZ': GLSL_SDF_UTILS,
  'opSymYZ': GLSL_SDF_UTILS,
  'opSymXYZ': GLSL_SDF_UTILS,
  'opRepeat2D': GLSL_SDF_UTILS,
  'opRepeat3D': GLSL_SDF_UTILS,
  'opRepeatLimited2D': GLSL_SDF_UTILS,
  'opRepeatLimited3D': GLSL_SDF_UTILS,
  'opPolar': GLSL_SDF_UTILS
} as const;
