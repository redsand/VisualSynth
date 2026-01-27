/**
 * SDF Domain Transforms
 *
 * Transform operations that modify the coordinate space before evaluating SDF.
 */

import type { SdfNodeDefinition } from '../../api';
import {
  createFloatParam,
  createIntParam,
  createAngleParam,
  createVec2Param,
  createVec3Param,
  createBoolParam,
  createModTarget
} from '../../api';

// ============================================================================
// Translate 2D
// ============================================================================

export const domTranslate2D: SdfNodeDefinition = {
  id: 'dom-translate-2d',
  name: 'Translate 2D',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Moves the shape in 2D space',
  tags: ['translate', 'move', 'offset', 'position'],
  parameters: [
    createFloatParam('x', 'X', 0.0, -2.0, 2.0, { group: 'Position' }),
    createFloatParam('y', 'Y', 0.0, -2.0, 2.0, { group: 'Position' })
  ],
  modTargets: [
    createModTarget('x', -2.0, 2.0, true),
    createModTarget('y', -2.0, 2.0, true)
  ],
  glsl: {
    signature: 'vec2 domTranslate2D(vec2 p, vec2 offset)',
    body: 'return p - offset;'
  },
  defaults: { x: 0.0, y: 0.0 },
  deterministic: true
};

// ============================================================================
// Translate 3D
// ============================================================================

export const domTranslate3D: SdfNodeDefinition = {
  id: 'dom-translate-3d',
  name: 'Translate 3D',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'Moves the shape in 3D space',
  tags: ['translate', 'move', 'offset', 'position'],
  parameters: [
    createFloatParam('x', 'X', 0.0, -5.0, 5.0, { group: 'Position' }),
    createFloatParam('y', 'Y', 0.0, -5.0, 5.0, { group: 'Position' }),
    createFloatParam('z', 'Z', 0.0, -5.0, 5.0, { group: 'Position' })
  ],
  modTargets: [
    createModTarget('x', -5.0, 5.0, true),
    createModTarget('y', -5.0, 5.0, true),
    createModTarget('z', -5.0, 5.0, true)
  ],
  glsl: {
    signature: 'vec3 domTranslate3D(vec3 p, vec3 offset)',
    body: 'return p - offset;'
  },
  defaults: { x: 0.0, y: 0.0, z: 0.0 },
  deterministic: true
};

// ============================================================================
// Rotate 2D
// ============================================================================

export const domRotate2D: SdfNodeDefinition = {
  id: 'dom-rotate-2d',
  name: 'Rotate 2D',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Rotates the shape around the origin',
  tags: ['rotate', 'spin', 'angle', 'turn'],
  parameters: [
    createAngleParam('angle', 'Angle', 0.0, { group: 'Rotation' })
  ],
  modTargets: [
    createModTarget('angle', 0.0, Math.PI * 2, true)
  ],
  glsl: {
    signature: 'vec2 domRotate2D(vec2 p, float angle)',
    body: `float c = cos(angle);
float s = sin(angle);
return vec2(c * p.x + s * p.y, -s * p.x + c * p.y);`
  },
  defaults: { angle: 0.0 },
  deterministic: true
};

// ============================================================================
// Rotate 3D
// ============================================================================

export const domRotate3D: SdfNodeDefinition = {
  id: 'dom-rotate-3d',
  name: 'Rotate 3D',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'Rotates the shape around XYZ axes',
  tags: ['rotate', 'spin', 'angle', 'euler'],
  parameters: [
    createAngleParam('rotX', 'Rotation X', 0.0, { group: 'Rotation' }),
    createAngleParam('rotY', 'Rotation Y', 0.0, { group: 'Rotation' }),
    createAngleParam('rotZ', 'Rotation Z', 0.0, { group: 'Rotation' })
  ],
  modTargets: [
    createModTarget('rotX', 0.0, Math.PI * 2, true),
    createModTarget('rotY', 0.0, Math.PI * 2, true),
    createModTarget('rotZ', 0.0, Math.PI * 2, true)
  ],
  glsl: {
    signature: 'vec3 domRotate3D(vec3 p, vec3 angles)',
    body: `float cx = cos(angles.x), sx = sin(angles.x);
float cy = cos(angles.y), sy = sin(angles.y);
float cz = cos(angles.z), sz = sin(angles.z);
mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cx, -sx, 0.0, sx, cx);
mat3 ry = mat3(cy, 0.0, sy, 0.0, 1.0, 0.0, -sy, 0.0, cy);
mat3 rz = mat3(cz, -sz, 0.0, sz, cz, 0.0, 0.0, 0.0, 1.0);
return rz * ry * rx * p;`
  },
  defaults: { rotX: 0.0, rotY: 0.0, rotZ: 0.0 },
  deterministic: true
};

// ============================================================================
// Scale 2D
// ============================================================================

export const domScale2D: SdfNodeDefinition = {
  id: 'dom-scale-2d',
  name: 'Scale 2D',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Scales the shape uniformly or non-uniformly',
  tags: ['scale', 'size', 'zoom', 'stretch'],
  parameters: [
    createFloatParam('scaleX', 'Scale X', 1.0, 0.1, 5.0, { group: 'Scale' }),
    createFloatParam('scaleY', 'Scale Y', 1.0, 0.1, 5.0, { group: 'Scale' }),
    createBoolParam('uniform', 'Uniform', true, { group: 'Scale', modulatable: false })
  ],
  modTargets: [
    createModTarget('scaleX', 0.1, 5.0),
    createModTarget('scaleY', 0.1, 5.0)
  ],
  glsl: {
    signature: 'vec2 domScale2D(vec2 p, vec2 s)',
    body: 'return p / s;'
  },
  defaults: { scaleX: 1.0, scaleY: 1.0, uniform: true },
  deterministic: true
};

// ============================================================================
// Scale 3D
// ============================================================================

export const domScale3D: SdfNodeDefinition = {
  id: 'dom-scale-3d',
  name: 'Scale 3D',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'Scales the shape in 3D',
  tags: ['scale', 'size', 'zoom'],
  parameters: [
    createFloatParam('scaleX', 'Scale X', 1.0, 0.1, 5.0, { group: 'Scale' }),
    createFloatParam('scaleY', 'Scale Y', 1.0, 0.1, 5.0, { group: 'Scale' }),
    createFloatParam('scaleZ', 'Scale Z', 1.0, 0.1, 5.0, { group: 'Scale' })
  ],
  modTargets: [
    createModTarget('scaleX', 0.1, 5.0),
    createModTarget('scaleY', 0.1, 5.0),
    createModTarget('scaleZ', 0.1, 5.0)
  ],
  glsl: {
    signature: 'vec3 domScale3D(vec3 p, vec3 s)',
    body: 'return p / s;'
  },
  defaults: { scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0 },
  deterministic: true
};

// ============================================================================
// Mirror X 2D
// ============================================================================

export const domMirrorX2D: SdfNodeDefinition = {
  id: 'dom-mirror-x-2d',
  name: 'Mirror X 2D',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Mirrors the shape along the X axis',
  tags: ['mirror', 'flip', 'symmetry', 'reflect'],
  parameters: [
    createFloatParam('offset', 'Offset', 0.0, -1.0, 1.0, { group: 'Mirror', tooltip: 'Mirror plane offset' })
  ],
  modTargets: [
    createModTarget('offset', -1.0, 1.0, true)
  ],
  glsl: {
    signature: 'vec2 domMirrorX2D(vec2 p, float offset)',
    body: 'return vec2(abs(p.x - offset) + offset, p.y);'
  },
  defaults: { offset: 0.0 },
  deterministic: true
};

// ============================================================================
// Mirror Y 2D
// ============================================================================

export const domMirrorY2D: SdfNodeDefinition = {
  id: 'dom-mirror-y-2d',
  name: 'Mirror Y 2D',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Mirrors the shape along the Y axis',
  tags: ['mirror', 'flip', 'symmetry', 'reflect'],
  parameters: [
    createFloatParam('offset', 'Offset', 0.0, -1.0, 1.0, { group: 'Mirror' })
  ],
  modTargets: [
    createModTarget('offset', -1.0, 1.0, true)
  ],
  glsl: {
    signature: 'vec2 domMirrorY2D(vec2 p, float offset)',
    body: 'return vec2(p.x, abs(p.y - offset) + offset);'
  },
  defaults: { offset: 0.0 },
  deterministic: true
};

// ============================================================================
// Symmetry Fold (N-fold)
// ============================================================================

export const domSymmetry: SdfNodeDefinition = {
  id: 'dom-symmetry',
  name: 'Symmetry (N-fold)',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Creates N-fold rotational symmetry',
  tags: ['symmetry', 'fold', 'kaleidoscope', 'radial'],
  parameters: [
    createIntParam('folds', 'Folds', 6, 2, 24, { group: 'Symmetry', modulatable: false })
  ],
  modTargets: [],
  glsl: {
    signature: 'vec2 domSymmetry(vec2 p, float n)',
    body: `float angle = 3.14159265 / n;
float a = atan(p.y, p.x) + angle;
float r = length(p);
a = mod(a, 2.0 * angle) - angle;
return vec2(cos(a), sin(a)) * r;`
  },
  defaults: { folds: 6 },
  deterministic: true
};

// ============================================================================
// Grid Repeat 2D
// ============================================================================

export const domRepeat2D: SdfNodeDefinition = {
  id: 'dom-repeat-2d',
  name: 'Repeat 2D',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Infinitely repeats the shape in a grid',
  tags: ['repeat', 'grid', 'tile', 'infinite'],
  parameters: [
    createFloatParam('spacingX', 'Spacing X', 0.5, 0.1, 3.0, { group: 'Grid' }),
    createFloatParam('spacingY', 'Spacing Y', 0.5, 0.1, 3.0, { group: 'Grid' })
  ],
  modTargets: [
    createModTarget('spacingX', 0.1, 3.0),
    createModTarget('spacingY', 0.1, 3.0)
  ],
  glsl: {
    signature: 'vec2 domRepeat2D(vec2 p, vec2 c)',
    body: 'return mod(p + 0.5 * c, c) - 0.5 * c;'
  },
  defaults: { spacingX: 0.5, spacingY: 0.5 },
  deterministic: true
};

// ============================================================================
// Grid Repeat 3D
// ============================================================================

export const domRepeat3D: SdfNodeDefinition = {
  id: 'dom-repeat-3d',
  name: 'Repeat 3D',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'Infinitely repeats the shape in 3D',
  tags: ['repeat', 'grid', 'tile', 'infinite'],
  parameters: [
    createFloatParam('spacingX', 'Spacing X', 1.0, 0.1, 5.0, { group: 'Grid' }),
    createFloatParam('spacingY', 'Spacing Y', 1.0, 0.1, 5.0, { group: 'Grid' }),
    createFloatParam('spacingZ', 'Spacing Z', 1.0, 0.1, 5.0, { group: 'Grid' })
  ],
  modTargets: [
    createModTarget('spacingX', 0.1, 5.0),
    createModTarget('spacingY', 0.1, 5.0),
    createModTarget('spacingZ', 0.1, 5.0)
  ],
  glsl: {
    signature: 'vec3 domRepeat3D(vec3 p, vec3 c)',
    body: 'return mod(p + 0.5 * c, c) - 0.5 * c;'
  },
  defaults: { spacingX: 1.0, spacingY: 1.0, spacingZ: 1.0 },
  deterministic: true
};

// ============================================================================
// Limited Repeat 2D
// ============================================================================

export const domRepeatLimited2D: SdfNodeDefinition = {
  id: 'dom-repeat-limited-2d',
  name: 'Limited Repeat 2D',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Repeats the shape a limited number of times',
  tags: ['repeat', 'grid', 'array', 'limited'],
  parameters: [
    createFloatParam('spacing', 'Spacing', 0.4, 0.1, 2.0, { group: 'Grid' }),
    createIntParam('countX', 'Count X', 3, 1, 20, { group: 'Grid', modulatable: false }),
    createIntParam('countY', 'Count Y', 3, 1, 20, { group: 'Grid', modulatable: false })
  ],
  modTargets: [
    createModTarget('spacing', 0.1, 2.0)
  ],
  glsl: {
    signature: 'vec2 domRepeatLimited2D(vec2 p, float c, vec2 l)',
    body: 'return p - c * clamp(floor(p / c + 0.5), -l, l);'
  },
  defaults: { spacing: 0.4, countX: 3, countY: 3 },
  deterministic: true
};

// ============================================================================
// Polar Repeat
// ============================================================================

export const domPolarRepeat: SdfNodeDefinition = {
  id: 'dom-polar-repeat',
  name: 'Polar Repeat',
  version: '1.0.0',
  category: 'domain',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Repeats the shape radially around the center',
  tags: ['polar', 'radial', 'circular', 'repeat'],
  parameters: [
    createIntParam('count', 'Count', 6, 2, 32, { group: 'Polar', modulatable: false }),
    createFloatParam('offset', 'Offset', 0.3, 0.0, 2.0, { group: 'Polar', tooltip: 'Distance from center' })
  ],
  modTargets: [
    createModTarget('offset', 0.0, 2.0)
  ],
  glsl: {
    signature: 'vec2 domPolarRepeat(vec2 p, float n, float offset)',
    body: `float angle = 3.14159265 / n;
float a = atan(p.y, p.x) + angle;
float r = length(p);
a = mod(a, 2.0 * angle) - angle;
return vec2(cos(a), sin(a)) * r - vec2(offset, 0.0);`
  },
  defaults: { count: 6, offset: 0.3 },
  deterministic: true
};

// ============================================================================
// Twist 2D
// ============================================================================

export const domTwist2D: SdfNodeDefinition = {
  id: 'dom-twist-2d',
  name: 'Twist 2D',
  version: '1.0.0',
  category: 'domain-warp',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Twists the shape based on distance from center',
  tags: ['twist', 'spiral', 'rotate', 'warp'],
  parameters: [
    createFloatParam('strength', 'Strength', 2.0, -10.0, 10.0, { group: 'Twist' })
  ],
  modTargets: [
    createModTarget('strength', -10.0, 10.0, true)
  ],
  glsl: {
    signature: 'vec2 domTwist2D(vec2 p, float k)',
    body: `float r = length(p);
float a = atan(p.y, p.x) + k * r;
return vec2(cos(a), sin(a)) * r;`
  },
  defaults: { strength: 2.0 },
  deterministic: true
};

// ============================================================================
// Twist 3D
// ============================================================================

export const domTwist3D: SdfNodeDefinition = {
  id: 'dom-twist-3d',
  name: 'Twist 3D',
  version: '1.0.0',
  category: 'domain-warp',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'Twists the shape around the Y axis',
  tags: ['twist', 'spiral', 'rotate', 'warp'],
  parameters: [
    createFloatParam('strength', 'Strength', 3.0, -10.0, 10.0, { group: 'Twist' })
  ],
  modTargets: [
    createModTarget('strength', -10.0, 10.0, true)
  ],
  glsl: {
    signature: 'vec3 domTwist3D(vec3 p, float k)',
    body: `float c = cos(k * p.y);
float s = sin(k * p.y);
return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);`
  },
  defaults: { strength: 3.0 },
  deterministic: true
};

// ============================================================================
// Bend 2D
// ============================================================================

export const domBend2D: SdfNodeDefinition = {
  id: 'dom-bend-2d',
  name: 'Bend 2D',
  version: '1.0.0',
  category: 'domain-warp',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Bends the shape',
  tags: ['bend', 'curve', 'warp', 'distort'],
  parameters: [
    createFloatParam('strength', 'Strength', 1.0, -5.0, 5.0, { group: 'Bend' })
  ],
  modTargets: [
    createModTarget('strength', -5.0, 5.0, true)
  ],
  glsl: {
    signature: 'vec2 domBend2D(vec2 p, float k)',
    body: `float c = cos(k * p.x);
float s = sin(k * p.x);
return vec2(c * p.x - s * p.y, s * p.x + c * p.y);`
  },
  defaults: { strength: 1.0 },
  deterministic: true
};

// ============================================================================
// Bend 3D
// ============================================================================

export const domBend3D: SdfNodeDefinition = {
  id: 'dom-bend-3d',
  name: 'Bend 3D',
  version: '1.0.0',
  category: 'domain-warp',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'Bends the shape along an axis',
  tags: ['bend', 'curve', 'warp', 'distort'],
  parameters: [
    createFloatParam('strength', 'Strength', 1.0, -5.0, 5.0, { group: 'Bend' })
  ],
  modTargets: [
    createModTarget('strength', -5.0, 5.0, true)
  ],
  glsl: {
    signature: 'vec3 domBend3D(vec3 p, float k)',
    body: `float c = cos(k * p.x);
float s = sin(k * p.x);
return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);`
  },
  defaults: { strength: 1.0 },
  deterministic: true
};

// ============================================================================
// Taper 3D
// ============================================================================

export const domTaper3D: SdfNodeDefinition = {
  id: 'dom-taper-3d',
  name: 'Taper 3D',
  version: '1.0.0',
  category: 'domain-warp',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'Tapers the shape along the Y axis',
  tags: ['taper', 'scale', 'cone', 'pyramid'],
  parameters: [
    createFloatParam('amount', 'Amount', 0.5, -2.0, 2.0, { group: 'Taper', tooltip: 'Positive = narrower at top' })
  ],
  modTargets: [
    createModTarget('amount', -2.0, 2.0, true)
  ],
  glsl: {
    signature: 'vec3 domTaper3D(vec3 p, float k)',
    body: `float scale = 1.0 + k * p.y;
return vec3(p.x / scale, p.y, p.z / scale);`
  },
  defaults: { amount: 0.5 },
  deterministic: true
};

// ============================================================================
// Shear 2D
// ============================================================================

export const domShear2D: SdfNodeDefinition = {
  id: 'dom-shear-2d',
  name: 'Shear 2D',
  version: '1.0.0',
  category: 'domain-warp',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Shears/skews the shape',
  tags: ['shear', 'skew', 'slant', 'distort'],
  parameters: [
    createFloatParam('shearX', 'Shear X', 0.0, -2.0, 2.0, { group: 'Shear' }),
    createFloatParam('shearY', 'Shear Y', 0.0, -2.0, 2.0, { group: 'Shear' })
  ],
  modTargets: [
    createModTarget('shearX', -2.0, 2.0, true),
    createModTarget('shearY', -2.0, 2.0, true)
  ],
  glsl: {
    signature: 'vec2 domShear2D(vec2 p, vec2 sh)',
    body: 'return vec2(p.x + sh.x * p.y, p.y + sh.y * p.x);'
  },
  defaults: { shearX: 0.0, shearY: 0.0 },
  deterministic: true
};

// ============================================================================
// Domain Warp (Noise)
// ============================================================================

export const domWarpNoise: SdfNodeDefinition = {
  id: 'dom-warp-noise',
  name: 'Domain Warp (Noise)',
  version: '1.0.0',
  category: 'domain-warp',
  coordSpace: '2d',
  gpuCostTier: 'MED',
  description: 'Warps coordinates using noise',
  tags: ['warp', 'noise', 'distort', 'organic'],
  parameters: [
    createFloatParam('amount', 'Amount', 0.15, 0.0, 1.0, { group: 'Warp' }),
    createFloatParam('frequency', 'Frequency', 3.0, 0.5, 20.0, { group: 'Warp' }),
    createFloatParam('speed', 'Speed', 0.0, 0.0, 5.0, { group: 'Animation' })
  ],
  modTargets: [
    createModTarget('amount', 0.0, 1.0),
    createModTarget('frequency', 0.5, 20.0),
    createModTarget('speed', 0.0, 5.0)
  ],
  glsl: {
    signature: 'vec2 domWarpNoise(vec2 p, float amount, float freq, float time)',
    body: `vec2 offset = vec2(
  sin(p.y * freq + time) + sin(p.x * freq * 0.7 + time * 1.3),
  cos(p.x * freq + time) + cos(p.y * freq * 0.7 + time * 0.8)
) * amount;
return p + offset;`
  },
  defaults: { amount: 0.15, frequency: 3.0, speed: 0.0 },
  deterministic: true
};

// ============================================================================
// Audio Warp
// ============================================================================

export const domWarpAudio: SdfNodeDefinition = {
  id: 'dom-warp-audio',
  name: 'Audio Warp',
  version: '1.0.0',
  category: 'domain-warp',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'Warps coordinates based on audio input',
  tags: ['warp', 'audio', 'reactive', 'music'],
  parameters: [
    createFloatParam('amount', 'Amount', 0.2, 0.0, 1.0, { group: 'Warp' }),
    createFloatParam('frequency', 'Frequency', 4.0, 0.5, 20.0, { group: 'Warp' })
  ],
  modTargets: [
    createModTarget('amount', 0.0, 1.0),
    createModTarget('frequency', 0.5, 20.0)
  ],
  glsl: {
    signature: 'vec2 domWarpAudio(vec2 p, float amount, float freq, float audio)',
    body: `float warp = sin(p.y * freq) * audio * amount;
return vec2(p.x + warp, p.y);`
  },
  defaults: { amount: 0.2, frequency: 4.0 },
  deterministic: true
};

// ============================================================================
// All Domain Transforms Export
// ============================================================================

export const allDomainTransforms: SdfNodeDefinition[] = [
  domTranslate2D,
  domTranslate3D,
  domRotate2D,
  domRotate3D,
  domScale2D,
  domScale3D,
  domMirrorX2D,
  domMirrorY2D,
  domSymmetry,
  domRepeat2D,
  domRepeat3D,
  domRepeatLimited2D,
  domPolarRepeat,
  domTwist2D,
  domTwist3D,
  domBend2D,
  domBend3D,
  domTaper3D,
  domShear2D,
  domWarpNoise,
  domWarpAudio
];
