/**
 * SDF Field Nodes
 *
 * Field-based shapes generated from noise, voronoi, and other patterns.
 * These are more expensive but create interesting organic/procedural shapes.
 */

import type { SdfNodeDefinition } from '../../api';
import { createFloatParam, createIntParam, createBoolParam, createModTarget } from '../../api';

// ============================================================================
// Voronoi 2D Field
// ============================================================================

export const fieldVoronoi2D: SdfNodeDefinition = {
  id: 'field-voronoi-2d',
  name: 'Voronoi 2D',
  version: '1.0.0',
  category: 'fields',
  coordSpace: '2d',
  gpuCostTier: 'MED',
  description: 'Voronoi cell pattern as distance field',
  tags: ['voronoi', 'cells', 'pattern', 'organic'],
  parameters: [
    createFloatParam('scale', 'Scale', 5.0, 1.0, 30.0, { group: 'Pattern' }),
    createFloatParam('thickness', 'Edge Thickness', 0.02, 0.001, 0.2, { group: 'Pattern' }),
    createFloatParam('jitter', 'Jitter', 1.0, 0.0, 1.0, { group: 'Pattern', tooltip: 'Cell point randomization' }),
    createFloatParam('seed', 'Seed', 0.0, 0.0, 100.0, { group: 'Pattern' })
  ],
  modTargets: [
    createModTarget('scale', 1.0, 30.0),
    createModTarget('thickness', 0.001, 0.2),
    createModTarget('jitter', 0.0, 1.0)
  ],
  glsl: {
    signature: 'float fieldVoronoi2D(vec2 p, float scale, float thickness, float jitter, float seed)',
    body: `p *= scale;
vec2 n = floor(p);
vec2 f = fract(p);
float md = 8.0;
for (int j = -1; j <= 1; j++) {
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = vec2(hash21(n + g + seed), hash21(n + g + seed + 13.7)) * jitter;
    vec2 r = g + o - f;
    float d = dot(r, r);
    md = min(md, d);
  }
}
return sqrt(md) / scale - thickness;`,
    requires: ['hash21']
  },
  defaults: { scale: 5.0, thickness: 0.02, jitter: 1.0, seed: 0.0 },
  deterministic: true
};

// ============================================================================
// Worley Noise Field (Cell Edges)
// ============================================================================

export const fieldWorley2D: SdfNodeDefinition = {
  id: 'field-worley-2d',
  name: 'Worley Noise 2D',
  version: '1.0.0',
  category: 'fields',
  coordSpace: '2d',
  gpuCostTier: 'MED',
  description: 'Worley (cellular) noise as distance field edges',
  tags: ['worley', 'cellular', 'crack', 'pattern'],
  parameters: [
    createFloatParam('scale', 'Scale', 4.0, 0.5, 20.0, { group: 'Pattern' }),
    createFloatParam('thickness', 'Thickness', 0.03, 0.005, 0.2, { group: 'Pattern' }),
    createFloatParam('seed', 'Seed', 0.0, 0.0, 100.0, { group: 'Pattern' })
  ],
  modTargets: [
    createModTarget('scale', 0.5, 20.0),
    createModTarget('thickness', 0.005, 0.2)
  ],
  glsl: {
    signature: 'float fieldWorley2D(vec2 p, float scale, float thickness, float seed)',
    body: `p *= scale;
vec2 n = floor(p);
vec2 f = fract(p);
float md1 = 8.0, md2 = 8.0;
for (int j = -1; j <= 1; j++) {
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = vec2(hash21(n + g + seed), hash21(n + g + seed + 17.3));
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md1) { md2 = md1; md1 = d; }
    else if (d < md2) { md2 = d; }
  }
}
float edge = (sqrt(md2) - sqrt(md1)) / scale;
return edge - thickness;`,
    requires: ['hash21']
  },
  defaults: { scale: 4.0, thickness: 0.03, seed: 0.0 },
  deterministic: true
};

// ============================================================================
// Perlin Noise Field
// ============================================================================

export const fieldPerlin2D: SdfNodeDefinition = {
  id: 'field-perlin-2d',
  name: 'Perlin Noise 2D',
  version: '1.0.0',
  category: 'fields',
  coordSpace: '2d',
  gpuCostTier: 'MED',
  description: 'Perlin noise contours as distance field',
  tags: ['perlin', 'noise', 'organic', 'smooth'],
  parameters: [
    createFloatParam('scale', 'Scale', 3.0, 0.5, 15.0, { group: 'Pattern' }),
    createFloatParam('threshold', 'Threshold', 0.0, -1.0, 1.0, { group: 'Pattern', tooltip: 'Contour level' }),
    createFloatParam('thickness', 'Thickness', 0.05, 0.01, 0.3, { group: 'Pattern' }),
    createIntParam('octaves', 'Octaves', 3, 1, 6, { group: 'Pattern', modulatable: false })
  ],
  modTargets: [
    createModTarget('scale', 0.5, 15.0),
    createModTarget('threshold', -1.0, 1.0, true),
    createModTarget('thickness', 0.01, 0.3)
  ],
  glsl: {
    signature: 'float fieldPerlin2D(vec2 p, float scale, float threshold, float thickness, float octaves)',
    body: `p *= scale;
float value = 0.0;
float amplitude = 0.5;
float frequency = 1.0;
for (int i = 0; i < 6; i++) {
  if (float(i) >= octaves) break;
  value += amplitude * gradientNoise(p * frequency);
  amplitude *= 0.5;
  frequency *= 2.0;
}
return abs(value - threshold) - thickness;`,
    requires: ['gradientNoise', 'hash22']
  },
  defaults: { scale: 3.0, threshold: 0.0, thickness: 0.05, octaves: 3 },
  deterministic: true
};

// ============================================================================
// Simplex Noise Field
// ============================================================================

export const fieldSimplex2D: SdfNodeDefinition = {
  id: 'field-simplex-2d',
  name: 'Simplex Noise 2D',
  version: '1.0.0',
  category: 'fields',
  coordSpace: '2d',
  gpuCostTier: 'MED',
  description: 'Simplex noise contours as distance field',
  tags: ['simplex', 'noise', 'organic', 'smooth'],
  parameters: [
    createFloatParam('scale', 'Scale', 4.0, 0.5, 20.0, { group: 'Pattern' }),
    createFloatParam('threshold', 'Threshold', 0.0, -1.0, 1.0, { group: 'Pattern' }),
    createFloatParam('thickness', 'Thickness', 0.04, 0.01, 0.2, { group: 'Pattern' })
  ],
  modTargets: [
    createModTarget('scale', 0.5, 20.0),
    createModTarget('threshold', -1.0, 1.0, true),
    createModTarget('thickness', 0.01, 0.2)
  ],
  glsl: {
    signature: 'float fieldSimplex2D(vec2 p, float scale, float threshold, float thickness)',
    body: `p *= scale;
const float K1 = 0.366025404;
const float K2 = 0.211324865;
vec2 i = floor(p + (p.x + p.y) * K1);
vec2 a = p - i + (i.x + i.y) * K2;
float m = step(a.y, a.x);
vec2 o = vec2(m, 1.0 - m);
vec2 b = a - o + K2;
vec2 c = a - 1.0 + 2.0 * K2;
vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
h = h * h * h * h;
vec3 n = h * vec3(
  dot(a, hash22(i) * 2.0 - 1.0),
  dot(b, hash22(i + o) * 2.0 - 1.0),
  dot(c, hash22(i + 1.0) * 2.0 - 1.0)
);
float value = dot(n, vec3(70.0));
return abs(value - threshold) - thickness;`,
    requires: ['hash22']
  },
  defaults: { scale: 4.0, threshold: 0.0, thickness: 0.04 },
  deterministic: true
};

// ============================================================================
// Distance to Polyline
// ============================================================================

export const fieldPolyline: SdfNodeDefinition = {
  id: 'field-polyline',
  name: 'Polyline Distance',
  version: '1.0.0',
  category: 'fields',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Distance to a simple polyline path',
  tags: ['line', 'path', 'curve', 'stroke'],
  parameters: [
    createFloatParam('thickness', 'Thickness', 0.03, 0.005, 0.2, { group: 'Line' }),
    createFloatParam('x0', 'X0', -0.4, -1.0, 1.0, { group: 'Points' }),
    createFloatParam('y0', 'Y0', 0.0, -1.0, 1.0, { group: 'Points' }),
    createFloatParam('x1', 'X1', 0.0, -1.0, 1.0, { group: 'Points' }),
    createFloatParam('y1', 'Y1', 0.3, -1.0, 1.0, { group: 'Points' }),
    createFloatParam('x2', 'X2', 0.4, -1.0, 1.0, { group: 'Points' }),
    createFloatParam('y2', 'Y2', 0.0, -1.0, 1.0, { group: 'Points' })
  ],
  modTargets: [
    createModTarget('thickness', 0.005, 0.2),
    createModTarget('x0', -1.0, 1.0, true),
    createModTarget('y0', -1.0, 1.0, true),
    createModTarget('x1', -1.0, 1.0, true),
    createModTarget('y1', -1.0, 1.0, true),
    createModTarget('x2', -1.0, 1.0, true),
    createModTarget('y2', -1.0, 1.0, true)
  ],
  glsl: {
    signature: 'float fieldPolyline(vec2 p, float th, vec2 p0, vec2 p1, vec2 p2)',
    body: `float d = 1e10;
// Segment 0-1
vec2 pa = p - p0, ba = p1 - p0;
float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
d = min(d, length(pa - ba * h));
// Segment 1-2
pa = p - p1; ba = p2 - p1;
h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
d = min(d, length(pa - ba * h));
return d - th;`
  },
  defaults: { thickness: 0.03, x0: -0.4, y0: 0.0, x1: 0.0, y1: 0.3, x2: 0.4, y2: 0.0 },
  deterministic: true
};

// ============================================================================
// Reaction-Diffusion Field (Lightweight Approximation)
// ============================================================================

export const fieldReactionDiffusion: SdfNodeDefinition = {
  id: 'field-reaction-diffusion',
  name: 'Reaction-Diffusion',
  version: '1.0.0',
  category: 'fields',
  coordSpace: '2d',
  gpuCostTier: 'MED',
  description: 'Approximated reaction-diffusion pattern',
  tags: ['turing', 'pattern', 'organic', 'biological'],
  parameters: [
    createFloatParam('scale', 'Scale', 6.0, 1.0, 20.0, { group: 'Pattern' }),
    createFloatParam('threshold', 'Threshold', 0.0, -1.0, 1.0, { group: 'Pattern' }),
    createFloatParam('thickness', 'Thickness', 0.02, 0.005, 0.15, { group: 'Pattern' }),
    createFloatParam('complexity', 'Complexity', 0.5, 0.0, 1.0, { group: 'Pattern' })
  ],
  modTargets: [
    createModTarget('scale', 1.0, 20.0),
    createModTarget('threshold', -1.0, 1.0, true),
    createModTarget('thickness', 0.005, 0.15),
    createModTarget('complexity', 0.0, 1.0)
  ],
  glsl: {
    signature: 'float fieldReactionDiffusion(vec2 p, float scale, float threshold, float thickness, float complexity)',
    body: `// Simplified Turing-like pattern using layered sine waves
p *= scale;
float n1 = sin(p.x * 1.0) * sin(p.y * 1.0);
float n2 = sin(p.x * 2.3 + p.y * 1.7) * 0.5;
float n3 = sin(p.x * 3.7 - p.y * 2.3 + n1 * 2.0 * complexity) * 0.3;
float n4 = sin(p.y * 4.1 + p.x * 3.3 - n2 * 1.5 * complexity) * 0.2;
float value = (n1 + n2 + n3 + n4) / 2.0;
return abs(value - threshold) - thickness;`
  },
  defaults: { scale: 6.0, threshold: 0.0, thickness: 0.02, complexity: 0.5 },
  deterministic: true
};

// ============================================================================
// Voronoi 3D Field (for raymarching)
// ============================================================================

export const fieldVoronoi3D: SdfNodeDefinition = {
  id: 'field-voronoi-3d',
  name: 'Voronoi 3D',
  version: '1.0.0',
  category: 'fields',
  coordSpace: '3d',
  gpuCostTier: 'HIGH',
  description: '3D Voronoi cell pattern',
  tags: ['voronoi', 'cells', 'pattern', '3d'],
  parameters: [
    createFloatParam('scale', 'Scale', 3.0, 0.5, 10.0, { group: 'Pattern' }),
    createFloatParam('thickness', 'Thickness', 0.03, 0.005, 0.2, { group: 'Pattern' }),
    createFloatParam('seed', 'Seed', 0.0, 0.0, 100.0, { group: 'Pattern' })
  ],
  modTargets: [
    createModTarget('scale', 0.5, 10.0),
    createModTarget('thickness', 0.005, 0.2)
  ],
  glsl: {
    signature: 'float fieldVoronoi3D(vec3 p, float scale, float thickness, float seed)',
    body: `p *= scale;
vec3 n = floor(p);
vec3 f = fract(p);
float md = 8.0;
for (int k = -1; k <= 1; k++) {
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec3 g = vec3(float(i), float(j), float(k));
      vec3 o = hash33(n + g + seed);
      vec3 r = g + o - f;
      float d = dot(r, r);
      md = min(md, d);
    }
  }
}
return sqrt(md) / scale - thickness;`,
    requires: ['hash33']
  },
  defaults: { scale: 3.0, thickness: 0.03, seed: 0.0 },
  deterministic: true
};

// ============================================================================
// Gyroid (Periodic Minimal Surface)
// ============================================================================

export const fieldGyroid: SdfNodeDefinition = {
  id: 'field-gyroid',
  name: 'Gyroid',
  version: '1.0.0',
  category: 'fields',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'Gyroid minimal surface',
  tags: ['gyroid', 'lattice', 'minimal surface', 'periodic'],
  parameters: [
    createFloatParam('scale', 'Scale', 4.0, 0.5, 15.0, { group: 'Pattern' }),
    createFloatParam('thickness', 'Thickness', 0.1, 0.01, 0.5, { group: 'Pattern' })
  ],
  modTargets: [
    createModTarget('scale', 0.5, 15.0),
    createModTarget('thickness', 0.01, 0.5)
  ],
  glsl: {
    signature: 'float fieldGyroid(vec3 p, float scale, float thickness)',
    body: `p *= scale;
float g = sin(p.x) * cos(p.y) + sin(p.y) * cos(p.z) + sin(p.z) * cos(p.x);
return abs(g) / scale - thickness;`
  },
  defaults: { scale: 4.0, thickness: 0.1 },
  deterministic: true
};

// ============================================================================
// Schwarz P Surface
// ============================================================================

export const fieldSchwarzP: SdfNodeDefinition = {
  id: 'field-schwarz-p',
  name: 'Schwarz P',
  version: '1.0.0',
  category: 'fields',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'Schwarz P minimal surface (lattice)',
  tags: ['schwarz', 'lattice', 'minimal surface', 'cubic'],
  parameters: [
    createFloatParam('scale', 'Scale', 4.0, 0.5, 15.0, { group: 'Pattern' }),
    createFloatParam('thickness', 'Thickness', 0.1, 0.01, 0.5, { group: 'Pattern' })
  ],
  modTargets: [
    createModTarget('scale', 0.5, 15.0),
    createModTarget('thickness', 0.01, 0.5)
  ],
  glsl: {
    signature: 'float fieldSchwarzP(vec3 p, float scale, float thickness)',
    body: `p *= scale;
float s = cos(p.x) + cos(p.y) + cos(p.z);
return abs(s) / scale - thickness;`
  },
  defaults: { scale: 4.0, thickness: 0.1 },
  deterministic: true
};

// ============================================================================
// All Field Nodes Export
// ============================================================================

export const allFields: SdfNodeDefinition[] = [
  fieldVoronoi2D,
  fieldWorley2D,
  fieldPerlin2D,
  fieldSimplex2D,
  fieldPolyline,
  fieldReactionDiffusion,
  fieldVoronoi3D,
  fieldGyroid,
  fieldSchwarzP
];
