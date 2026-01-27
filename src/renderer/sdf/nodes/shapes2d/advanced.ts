/**
 * 2D SDF Advanced Shapes
 *
 * More complex 2D signed distance field shapes.
 */

import type { SdfNodeDefinition } from '../../api';
import {
  createFloatParam,
  createIntParam,
  createAngleParam,
  createModTarget
} from '../../api';

// ============================================================================
// Trapezoid
// ============================================================================

export const sdTrapezoid: SdfNodeDefinition = {
  id: 'trapezoid',
  name: 'Trapezoid',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A trapezoid shape',
  tags: ['trapezoid', 'trapezium', 'quadrilateral'],
  parameters: [
    createFloatParam('topWidth', 'Top Width', 0.3, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('bottomWidth', 'Bottom Width', 0.5, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.4, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('topWidth', 0.01, 2.0),
    createModTarget('bottomWidth', 0.01, 2.0),
    createModTarget('height', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdTrapezoid(vec2 p, float r1, float r2, float he)',
    body: `vec2 k1 = vec2(r2, he);
vec2 k2 = vec2(r2 - r1, 2.0 * he);
p.x = abs(p.x);
vec2 ca = vec2(p.x - min(p.x, (p.y < 0.0) ? r1 : r2), abs(p.y) - he);
vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
return s * sqrt(min(dot(ca, ca), dot(cb, cb)));`
  },
  defaults: { topWidth: 0.3, bottomWidth: 0.5, height: 0.4 },
  deterministic: true
};

// ============================================================================
// Parallelogram
// ============================================================================

export const sdParallelogram: SdfNodeDefinition = {
  id: 'parallelogram',
  name: 'Parallelogram',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A parallelogram shape',
  tags: ['parallelogram', 'skewed', 'quadrilateral'],
  parameters: [
    createFloatParam('width', 'Width', 0.5, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.3, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('skew', 'Skew', 0.2, -0.5, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('width', 0.01, 2.0),
    createModTarget('height', 0.01, 2.0),
    createModTarget('skew', -0.5, 0.5, true)
  ],
  glsl: {
    signature: 'float sdParallelogram(vec2 p, float wi, float he, float sk)',
    body: `vec2 e = vec2(sk, he);
p = (p.y < 0.0) ? -p : p;
vec2 w = p - e;
w.x -= clamp(w.x, -wi, wi);
vec2 d = vec2(dot(w, w), -w.y);
float s = p.x * e.y - p.y * e.x;
p = (s < 0.0) ? -p : p;
vec2 v = p - vec2(wi, 0.0);
v -= e * clamp(dot(v, e) / dot(e, e), -1.0, 1.0);
d = min(d, vec2(dot(v, v), wi * he - abs(s)));
return sqrt(d.x) * sign(-d.y);`
  },
  defaults: { width: 0.5, height: 0.3, skew: 0.2 },
  deterministic: true
};

// ============================================================================
// Rhombus / Diamond
// ============================================================================

export const sdRhombus: SdfNodeDefinition = {
  id: 'rhombus',
  name: 'Rhombus',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A rhombus (diamond) shape',
  tags: ['rhombus', 'diamond', 'lozenge'],
  parameters: [
    createFloatParam('width', 'Width', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.5, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('width', 0.01, 2.0),
    createModTarget('height', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdRhombus(vec2 p, vec2 b)',
    body: `p = abs(p);
float h = clamp(ndot(b - 2.0 * p, b) / dot(b, b), -1.0, 1.0);
float d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h));
return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);`,
    requires: ['ndot']
  },
  defaults: { width: 0.4, height: 0.5 },
  deterministic: true
};

// ============================================================================
// Chevron / Arrow Head
// ============================================================================

export const sdChevron: SdfNodeDefinition = {
  id: 'chevron',
  name: 'Chevron',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A chevron (arrow head) shape',
  tags: ['chevron', 'arrow', 'v-shape'],
  parameters: [
    createFloatParam('width', 'Width', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.3, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('thickness', 'Thickness', 0.08, 0.01, 0.3, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('width', 0.01, 2.0),
    createModTarget('height', 0.01, 2.0),
    createModTarget('thickness', 0.01, 0.3)
  ],
  glsl: {
    signature: 'float sdChevron(vec2 p, float w, float h, float th)',
    body: `p.x = abs(p.x);
vec2 a = vec2(0.0, h);
vec2 b = vec2(w, -h);
vec2 ab = b - a;
vec2 pa = p - a;
float t = clamp(dot(pa, ab) / dot(ab, ab), 0.0, 1.0);
float d = length(pa - ab * t);
return d - th;`
  },
  defaults: { width: 0.4, height: 0.3, thickness: 0.08 },
  deterministic: true
};

// ============================================================================
// Arrow
// ============================================================================

export const sdArrow: SdfNodeDefinition = {
  id: 'arrow',
  name: 'Arrow',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'An arrow shape with shaft and head',
  tags: ['arrow', 'pointer', 'direction'],
  parameters: [
    createFloatParam('length', 'Length', 0.7, 0.1, 2.0, { group: 'Shape' }),
    createFloatParam('shaftWidth', 'Shaft Width', 0.08, 0.01, 0.3, { group: 'Shape' }),
    createFloatParam('headWidth', 'Head Width', 0.2, 0.05, 0.5, { group: 'Shape' }),
    createFloatParam('headLength', 'Head Length', 0.2, 0.05, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('length', 0.1, 2.0),
    createModTarget('shaftWidth', 0.01, 0.3),
    createModTarget('headWidth', 0.05, 0.5),
    createModTarget('headLength', 0.05, 0.5)
  ],
  glsl: {
    signature: 'float sdArrow(vec2 p, float len, float sw, float hw, float hl)',
    body: `float shaftLen = len - hl;
float dShaft = length(max(abs(p - vec2(0.0, -shaftLen * 0.5)) - vec2(sw * 0.5, shaftLen * 0.5), 0.0));
vec2 headP = p - vec2(0.0, shaftLen * 0.5);
vec2 q = vec2(abs(headP.x), headP.y);
vec2 a = vec2(0.0, hl);
vec2 b = vec2(hw * 0.5, 0.0);
vec2 ba = a - b;
float t = clamp(dot(q - b, ba) / dot(ba, ba), 0.0, 1.0);
float dHead = length(q - b - ba * t);
dHead = (q.y < 0.0 || q.y > hl) ? 1e10 : dHead;
float inside = (headP.y > 0.0 && headP.y < hl && abs(headP.x) < hw * 0.5 * (1.0 - headP.y / hl)) ? -0.001 : 0.0;
return min(dShaft, dHead) + inside;`
  },
  defaults: { length: 0.7, shaftWidth: 0.08, headWidth: 0.2, headLength: 0.2 },
  deterministic: true
};

// ============================================================================
// Heart
// ============================================================================

export const sdHeart: SdfNodeDefinition = {
  id: 'heart',
  name: 'Heart',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A heart shape',
  tags: ['heart', 'love', 'valentine'],
  parameters: [
    createFloatParam('size', 'Size', 0.4, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('size', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdHeart(vec2 p, float s)',
    body: `p /= s;
p.y -= 0.3;
p.x = abs(p.x);
if (p.y + p.x > 1.0) {
  return (sqrt(length2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0) * s;
}
return (sqrt(min(length2(p - vec2(0.0, 1.0)),
                 length2(p - 0.5 * max(p.x + p.y, 0.0)))) *
        sign(p.x - p.y)) * s;`,
    requires: ['length2']
  },
  defaults: { size: 0.4 },
  deterministic: true
};

// ============================================================================
// Teardrop
// ============================================================================

export const sdTeardrop: SdfNodeDefinition = {
  id: 'teardrop',
  name: 'Teardrop',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A teardrop shape',
  tags: ['teardrop', 'drop', 'water'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.3, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.5, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('radius', 0.01, 2.0),
    createModTarget('height', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdTeardrop(vec2 p, float r, float h)',
    body: `p.x = abs(p.x);
float b = (r - p.y) / h;
float a = sqrt(1.0 - b * b);
float k = dot(p, vec2(-a, b));
if (k < 0.0) return length(p) - r;
if (k > a * h) return length(p - vec2(0.0, h));
return dot(p, vec2(a, b)) - r;`
  },
  defaults: { radius: 0.3, height: 0.5 },
  deterministic: true
};

// ============================================================================
// Vesica Piscis (Eye Shape)
// ============================================================================

export const sdVesica: SdfNodeDefinition = {
  id: 'vesica',
  name: 'Vesica Piscis',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A vesica piscis (eye/almond) shape',
  tags: ['vesica', 'eye', 'almond', 'mandorla'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('offset', 'Offset', 0.25, 0.01, 1.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('radius', 0.01, 2.0),
    createModTarget('offset', 0.01, 1.0)
  ],
  glsl: {
    signature: 'float sdVesica(vec2 p, float r, float d)',
    body: `p = abs(p);
float b = sqrt(r * r - d * d);
return ((p.y - b) * d > p.x * b) ? length(p - vec2(0.0, b)) : length(p - vec2(-d, 0.0)) - r;`
  },
  defaults: { radius: 0.4, offset: 0.25 },
  deterministic: true
};

// ============================================================================
// Clover / Trefoil
// ============================================================================

export const sdClover: SdfNodeDefinition = {
  id: 'clover',
  name: 'Clover',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A clover/trefoil shape with N lobes',
  tags: ['clover', 'trefoil', 'shamrock', 'flower'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createIntParam('lobes', 'Lobes', 3, 2, 8, { group: 'Shape', modulatable: false })
  ],
  modTargets: [
    createModTarget('radius', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdClover(vec2 p, float r, float n)',
    body: `float a = atan(p.y, p.x);
float d = length(p);
float f = cos(a * n) * 0.5 + 0.5;
return d - r * f * 0.8 - r * 0.2;`
  },
  defaults: { radius: 0.4, lobes: 3 },
  deterministic: true
};

// ============================================================================
// Spiral (Archimedean)
// ============================================================================

export const sdSpiral: SdfNodeDefinition = {
  id: 'spiral',
  name: 'Spiral',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'MED',
  description: 'An Archimedean spiral',
  tags: ['spiral', 'coil', 'swirl'],
  parameters: [
    createFloatParam('thickness', 'Thickness', 0.03, 0.005, 0.2, { group: 'Shape' }),
    createFloatParam('spacing', 'Spacing', 0.12, 0.05, 0.5, { group: 'Shape' }),
    createFloatParam('turns', 'Turns', 3.0, 0.5, 10.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('thickness', 0.005, 0.2),
    createModTarget('spacing', 0.05, 0.5),
    createModTarget('turns', 0.5, 10.0)
  ],
  glsl: {
    signature: 'float sdSpiral(vec2 p, float th, float sp, float turns)',
    body: `float a = atan(p.y, p.x);
float r = length(p);
float targetR = sp * (a + 3.14159265) / 6.28318530718;
float d = 1e10;
for (float i = -1.0; i < turns + 1.0; i += 1.0) {
  float spiralR = targetR + i * sp;
  if (spiralR > 0.0) {
    d = min(d, abs(r - spiralR));
  }
}
return d - th;`
  },
  defaults: { thickness: 0.03, spacing: 0.12, turns: 3.0 },
  deterministic: true
};

// ============================================================================
// Superellipse / Squircle
// ============================================================================

export const sdSuperellipse: SdfNodeDefinition = {
  id: 'superellipse',
  name: 'Superellipse',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A superellipse (squircle) with configurable power',
  tags: ['superellipse', 'squircle', 'rounded', 'lamé'],
  parameters: [
    createFloatParam('width', 'Width', 0.45, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.35, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('power', 'Power', 4.0, 0.5, 10.0, { group: 'Shape', tooltip: '2=ellipse, 4=squircle, higher=more square' })
  ],
  modTargets: [
    createModTarget('width', 0.01, 2.0),
    createModTarget('height', 0.01, 2.0),
    createModTarget('power', 0.5, 10.0)
  ],
  glsl: {
    signature: 'float sdSuperellipse(vec2 p, vec2 ab, float n)',
    body: `p = abs(p) / ab;
float k = pow(pow(p.x, n) + pow(p.y, n), 1.0 / n);
return (k - 1.0) * min(ab.x, ab.y);`
  },
  defaults: { width: 0.45, height: 0.35, power: 4.0 },
  deterministic: true
};

// ============================================================================
// Gear / Cog (2D)
// ============================================================================

export const sdGear2D: SdfNodeDefinition = {
  id: 'gear-2d',
  name: 'Gear (2D)',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'MED',
  description: 'A gear/cog wheel shape',
  tags: ['gear', 'cog', 'wheel', 'mechanical'],
  parameters: [
    createFloatParam('outerRadius', 'Outer Radius', 0.45, 0.1, 2.0, { group: 'Shape' }),
    createFloatParam('innerRadius', 'Inner Radius', 0.35, 0.05, 1.5, { group: 'Shape' }),
    createIntParam('teeth', 'Teeth', 8, 4, 24, { group: 'Shape', modulatable: false }),
    createFloatParam('toothDepth', 'Tooth Depth', 0.1, 0.02, 0.3, { group: 'Shape' }),
    createFloatParam('holeRadius', 'Hole Radius', 0.1, 0.0, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('outerRadius', 0.1, 2.0),
    createModTarget('innerRadius', 0.05, 1.5),
    createModTarget('toothDepth', 0.02, 0.3),
    createModTarget('holeRadius', 0.0, 0.5)
  ],
  glsl: {
    signature: 'float sdGear2D(vec2 p, float ro, float ri, float teeth, float depth, float hole)',
    body: `float a = atan(p.y, p.x);
float r = length(p);
float toothAngle = 3.14159265 / teeth;
float tooth = cos(a * teeth) * 0.5 + 0.5;
float gearR = ri + depth * tooth;
float outerD = r - gearR;
float holeD = hole - r;
return max(outerD, holeD);`
  },
  defaults: { outerRadius: 0.45, innerRadius: 0.35, teeth: 8, toothDepth: 0.1, holeRadius: 0.1 },
  deterministic: true
};

// ============================================================================
// Wave Strip
// ============================================================================

export const sdWaveStrip: SdfNodeDefinition = {
  id: 'wave-strip',
  name: 'Wave Strip',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A horizontal strip with sine wave deformation',
  tags: ['wave', 'sine', 'strip', 'oscillate'],
  parameters: [
    createFloatParam('width', 'Width', 0.8, 0.1, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.1, 0.01, 0.5, { group: 'Shape' }),
    createFloatParam('amplitude', 'Amplitude', 0.15, 0.0, 0.5, { group: 'Wave' }),
    createFloatParam('frequency', 'Frequency', 4.0, 0.5, 20.0, { group: 'Wave' }),
    createFloatParam('phase', 'Phase', 0.0, 0.0, 6.283, { group: 'Wave' })
  ],
  modTargets: [
    createModTarget('width', 0.1, 2.0),
    createModTarget('height', 0.01, 0.5),
    createModTarget('amplitude', 0.0, 0.5),
    createModTarget('frequency', 0.5, 20.0),
    createModTarget('phase', 0.0, 6.283)
  ],
  glsl: {
    signature: 'float sdWaveStrip(vec2 p, float w, float h, float amp, float freq, float phase)',
    body: `float wave = sin(p.x * freq + phase) * amp;
vec2 q = vec2(p.x, p.y - wave);
vec2 d = abs(q) - vec2(w, h);
return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);`
  },
  defaults: { width: 0.8, height: 0.1, amplitude: 0.15, frequency: 4.0, phase: 0.0 },
  deterministic: true
};

// ============================================================================
// Egg
// ============================================================================

export const sdEgg: SdfNodeDefinition = {
  id: 'egg',
  name: 'Egg',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'An egg shape',
  tags: ['egg', 'oval', 'organic'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.35, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('pointiness', 'Pointiness', 0.15, 0.0, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('radius', 0.01, 2.0),
    createModTarget('pointiness', 0.0, 0.5)
  ],
  glsl: {
    signature: 'float sdEgg(vec2 p, float r, float k)',
    body: `float h = r * (1.0 + k);
p.x = abs(p.x);
float ra = r * (1.0 + k * p.y / h);
return length(vec2(p.x, abs(p.y) - h * 0.5)) - ra * 0.7;`
  },
  defaults: { radius: 0.35, pointiness: 0.15 },
  deterministic: true
};

// ============================================================================
// Moon (Filled Crescent)
// ============================================================================

export const sdMoon: SdfNodeDefinition = {
  id: 'moon',
  name: 'Moon',
  version: '1.0.0',
  category: 'shapes2d-advanced',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A filled moon/crescent shape',
  tags: ['moon', 'crescent', 'lunar'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.4, 0.05, 2.0, { group: 'Shape' }),
    createFloatParam('phase', 'Phase', 0.7, 0.0, 1.0, { group: 'Shape', tooltip: '0=new, 0.5=half, 1=full' })
  ],
  modTargets: [
    createModTarget('radius', 0.05, 2.0),
    createModTarget('phase', 0.0, 1.0)
  ],
  glsl: {
    signature: 'float sdMoon(vec2 p, float r, float ph)',
    body: `float offset = r * (1.0 - ph * 2.0);
float d1 = length(p) - r;
float d2 = length(p - vec2(offset, 0.0)) - r;
return (ph > 0.5) ? max(d1, -d2) : max(-d1, d2);`
  },
  defaults: { radius: 0.4, phase: 0.7 },
  deterministic: true
};

// ============================================================================
// All 2D Advanced Shapes Export
// ============================================================================

export const shapes2dAdvanced: SdfNodeDefinition[] = [
  sdTrapezoid,
  sdParallelogram,
  sdRhombus,
  sdChevron,
  sdArrow,
  sdHeart,
  sdTeardrop,
  sdVesica,
  sdClover,
  sdSpiral,
  sdSuperellipse,
  sdGear2D,
  sdWaveStrip,
  sdEgg,
  sdMoon
];
