/**
 * SDF Operations
 *
 * Boolean and smooth boolean operations for combining SDF shapes.
 */

import type { SdfNodeDefinition } from '../../api';
import { createFloatParam, createModTarget } from '../../api';

// ============================================================================
// Union (Minimum)
// ============================================================================

export const opUnion: SdfNodeDefinition = {
  id: 'op-union',
  name: 'Union',
  version: '1.0.0',
  category: 'ops',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Combines two shapes (logical OR)',
  tags: ['union', 'combine', 'add', 'or'],
  parameters: [],
  modTargets: [],
  glsl: {
    signature: 'float opUnion(float d1, float d2)',
    body: 'return min(d1, d2);'
  },
  defaults: {},
  deterministic: true
};

// ============================================================================
// Subtraction
// ============================================================================

export const opSubtract: SdfNodeDefinition = {
  id: 'op-subtract',
  name: 'Subtract',
  version: '1.0.0',
  category: 'ops',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Subtracts second shape from first',
  tags: ['subtract', 'cut', 'difference', 'carve'],
  parameters: [],
  modTargets: [],
  glsl: {
    signature: 'float opSubtract(float d1, float d2)',
    body: 'return max(d1, -d2);'
  },
  defaults: {},
  deterministic: true
};

// ============================================================================
// Intersection
// ============================================================================

export const opIntersect: SdfNodeDefinition = {
  id: 'op-intersect',
  name: 'Intersect',
  version: '1.0.0',
  category: 'ops',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Keeps only the overlap of two shapes (logical AND)',
  tags: ['intersect', 'and', 'overlap', 'common'],
  parameters: [],
  modTargets: [],
  glsl: {
    signature: 'float opIntersect(float d1, float d2)',
    body: 'return max(d1, d2);'
  },
  defaults: {},
  deterministic: true
};

// ============================================================================
// XOR (Exclusive OR)
// ============================================================================

export const opXor: SdfNodeDefinition = {
  id: 'op-xor',
  name: 'XOR',
  version: '1.0.0',
  category: 'ops',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Exclusive OR - keeps non-overlapping parts',
  tags: ['xor', 'exclusive', 'symmetric difference'],
  parameters: [],
  modTargets: [],
  glsl: {
    signature: 'float opXor(float d1, float d2)',
    body: 'return max(min(d1, d2), -max(d1, d2));'
  },
  defaults: {},
  deterministic: true
};

// ============================================================================
// Smooth Union (Polynomial)
// ============================================================================

export const opSmoothUnion: SdfNodeDefinition = {
  id: 'op-smooth-union',
  name: 'Smooth Union',
  version: '1.0.0',
  category: 'ops-smooth',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Combines shapes with smooth blending',
  tags: ['smooth', 'union', 'blend', 'merge'],
  parameters: [
    createFloatParam('k', 'Smoothness', 0.1, 0.001, 1.0, {
      group: 'Blend',
      tooltip: 'Blend radius - higher = smoother transition'
    })
  ],
  modTargets: [
    createModTarget('k', 0.001, 1.0)
  ],
  glsl: {
    signature: 'float opSmoothUnion(float d1, float d2, float k)',
    body: `float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
return mix(d2, d1, h) - k * h * (1.0 - h);`
  },
  defaults: { k: 0.1 },
  deterministic: true
};

// ============================================================================
// Smooth Subtraction
// ============================================================================

export const opSmoothSubtract: SdfNodeDefinition = {
  id: 'op-smooth-subtract',
  name: 'Smooth Subtract',
  version: '1.0.0',
  category: 'ops-smooth',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Subtracts with smooth blending',
  tags: ['smooth', 'subtract', 'blend', 'carve'],
  parameters: [
    createFloatParam('k', 'Smoothness', 0.1, 0.001, 1.0, {
      group: 'Blend',
      tooltip: 'Blend radius - higher = smoother transition'
    })
  ],
  modTargets: [
    createModTarget('k', 0.001, 1.0)
  ],
  glsl: {
    signature: 'float opSmoothSubtract(float d1, float d2, float k)',
    body: `float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
return mix(d1, -d2, h) + k * h * (1.0 - h);`
  },
  defaults: { k: 0.1 },
  deterministic: true
};

// ============================================================================
// Smooth Intersection
// ============================================================================

export const opSmoothIntersect: SdfNodeDefinition = {
  id: 'op-smooth-intersect',
  name: 'Smooth Intersect',
  version: '1.0.0',
  category: 'ops-smooth',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Intersects with smooth blending',
  tags: ['smooth', 'intersect', 'blend', 'and'],
  parameters: [
    createFloatParam('k', 'Smoothness', 0.1, 0.001, 1.0, {
      group: 'Blend',
      tooltip: 'Blend radius - higher = smoother transition'
    })
  ],
  modTargets: [
    createModTarget('k', 0.001, 1.0)
  ],
  glsl: {
    signature: 'float opSmoothIntersect(float d1, float d2, float k)',
    body: `float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
return mix(d2, d1, h) + k * h * (1.0 - h);`
  },
  defaults: { k: 0.1 },
  deterministic: true
};

// ============================================================================
// Exponential Smooth Union
// ============================================================================

export const opSmoothUnionExp: SdfNodeDefinition = {
  id: 'op-smooth-union-exp',
  name: 'Smooth Union (Exp)',
  version: '1.0.0',
  category: 'ops-smooth',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Smooth union using exponential blending',
  tags: ['smooth', 'union', 'exponential', 'blend'],
  parameters: [
    createFloatParam('k', 'Sharpness', 16.0, 1.0, 64.0, {
      group: 'Blend',
      tooltip: 'Higher = sharper transition'
    })
  ],
  modTargets: [
    createModTarget('k', 1.0, 64.0)
  ],
  glsl: {
    signature: 'float opSmoothUnionExp(float d1, float d2, float k)',
    body: `float res = exp2(-k * d1) + exp2(-k * d2);
return -log2(res) / k;`
  },
  defaults: { k: 16.0 },
  deterministic: true
};

// ============================================================================
// Power Smooth Union
// ============================================================================

export const opSmoothUnionPow: SdfNodeDefinition = {
  id: 'op-smooth-union-pow',
  name: 'Smooth Union (Power)',
  version: '1.0.0',
  category: 'ops-smooth',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Smooth union using power blending (metaball-like)',
  tags: ['smooth', 'union', 'power', 'metaball'],
  parameters: [
    createFloatParam('k', 'Power', 8.0, 1.0, 32.0, {
      group: 'Blend',
      tooltip: 'Exponent for blending'
    })
  ],
  modTargets: [
    createModTarget('k', 1.0, 32.0)
  ],
  glsl: {
    signature: 'float opSmoothUnionPow(float d1, float d2, float k)',
    body: `float a = pow(max(0.0, d1), k);
float b = pow(max(0.0, d2), k);
return pow((a * b) / (a + b + 0.0001), 1.0 / k);`
  },
  defaults: { k: 8.0 },
  deterministic: true
};

// ============================================================================
// Onion (Shell/Hollow)
// ============================================================================

export const opOnion: SdfNodeDefinition = {
  id: 'op-onion',
  name: 'Onion / Shell',
  version: '1.0.0',
  category: 'ops',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Creates a hollow shell from any shape',
  tags: ['onion', 'shell', 'hollow', 'surface'],
  parameters: [
    createFloatParam('thickness', 'Thickness', 0.05, 0.001, 0.5, {
      group: 'Shell',
      tooltip: 'Shell wall thickness'
    })
  ],
  modTargets: [
    createModTarget('thickness', 0.001, 0.5)
  ],
  glsl: {
    signature: 'float opOnion(float d, float thickness)',
    body: 'return abs(d) - thickness;'
  },
  defaults: { thickness: 0.05 },
  deterministic: true
};

// ============================================================================
// Round (Add Radius)
// ============================================================================

export const opRound: SdfNodeDefinition = {
  id: 'op-round',
  name: 'Round',
  version: '1.0.0',
  category: 'ops',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Adds rounding to any shape',
  tags: ['round', 'smooth', 'bevel', 'fillet'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.05, 0.0, 0.5, {
      group: 'Round',
      tooltip: 'Rounding radius'
    })
  ],
  modTargets: [
    createModTarget('radius', 0.0, 0.5)
  ],
  glsl: {
    signature: 'float opRound(float d, float r)',
    body: 'return d - r;'
  },
  defaults: { radius: 0.05 },
  deterministic: true
};

// ============================================================================
// Annular (Ring)
// ============================================================================

export const opAnnular: SdfNodeDefinition = {
  id: 'op-annular',
  name: 'Annular',
  version: '1.0.0',
  category: 'ops',
  coordSpace: 'both',
  gpuCostTier: 'LOW',
  description: 'Creates an annular (ring) version of any shape',
  tags: ['annular', 'ring', 'outline', 'stroke'],
  parameters: [
    createFloatParam('thickness', 'Thickness', 0.05, 0.001, 0.5, {
      group: 'Ring',
      tooltip: 'Ring thickness'
    })
  ],
  modTargets: [
    createModTarget('thickness', 0.001, 0.5)
  ],
  glsl: {
    signature: 'float opAnnular(float d, float thickness)',
    body: 'return abs(d) - thickness * 0.5;'
  },
  defaults: { thickness: 0.05 },
  deterministic: true
};

// ============================================================================
// Displacement (Noise-based)
// ============================================================================

export const opDisplace: SdfNodeDefinition = {
  id: 'op-displace',
  name: 'Displace',
  version: '1.0.0',
  category: 'ops',
  coordSpace: 'both',
  gpuCostTier: 'MED',
  description: 'Adds displacement/noise to a shape surface',
  tags: ['displace', 'noise', 'rough', 'organic'],
  parameters: [
    createFloatParam('amount', 'Amount', 0.1, 0.0, 1.0, {
      group: 'Displace',
      tooltip: 'Displacement strength'
    }),
    createFloatParam('frequency', 'Frequency', 5.0, 0.5, 50.0, {
      group: 'Displace',
      tooltip: 'Noise frequency'
    })
  ],
  modTargets: [
    createModTarget('amount', 0.0, 1.0),
    createModTarget('frequency', 0.5, 50.0)
  ],
  glsl: {
    signature: 'float opDisplace(float d, vec3 p, float amount, float freq)',
    body: `float displacement = sin(freq * p.x) * sin(freq * p.y) * sin(freq * p.z) * amount;
return d + displacement;`
  },
  defaults: { amount: 0.1, frequency: 5.0 },
  deterministic: true
};

// ============================================================================
// All Operations Export
// ============================================================================

export const allOperations: SdfNodeDefinition[] = [
  opUnion,
  opSubtract,
  opIntersect,
  opXor,
  opSmoothUnion,
  opSmoothSubtract,
  opSmoothIntersect,
  opSmoothUnionExp,
  opSmoothUnionPow,
  opOnion,
  opRound,
  opAnnular,
  opDisplace
];
