/**
 * 3D SDF Primitive Shapes
 *
 * Basic 3D signed distance field primitives for raymarching.
 */

import type { SdfNodeDefinition } from '../../api';
import {
  createFloatParam,
  createVec3Param,
  createModTarget
} from '../../api';

// ============================================================================
// Sphere
// ============================================================================

export const sdSphere: SdfNodeDefinition = {
  id: 'sphere',
  name: 'Sphere',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A perfect sphere centered at origin',
  tags: ['sphere', 'ball', 'round', 'basic'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.5, 0.01, 5.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('radius', 0.01, 5.0)
  ],
  glsl: {
    signature: 'float sdSphere(vec3 p, float r)',
    body: 'return length(p) - r;'
  },
  defaults: { radius: 0.5 },
  deterministic: true
};

// ============================================================================
// Ellipsoid
// ============================================================================

export const sdEllipsoid: SdfNodeDefinition = {
  id: 'ellipsoid',
  name: 'Ellipsoid',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'An ellipsoid with independent X, Y, Z radii',
  tags: ['ellipsoid', 'oval', 'stretch'],
  parameters: [
    createFloatParam('radiusX', 'Radius X', 0.5, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('radiusY', 'Radius Y', 0.3, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('radiusZ', 'Radius Z', 0.4, 0.01, 5.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('radiusX', 0.01, 5.0),
    createModTarget('radiusY', 0.01, 5.0),
    createModTarget('radiusZ', 0.01, 5.0)
  ],
  glsl: {
    signature: 'float sdEllipsoid(vec3 p, vec3 r)',
    body: `float k0 = length(p / r);
float k1 = length(p / (r * r));
return k0 * (k0 - 1.0) / k1;`
  },
  defaults: { radiusX: 0.5, radiusY: 0.3, radiusZ: 0.4 },
  deterministic: true
};

// ============================================================================
// Box
// ============================================================================

export const sdBox3D: SdfNodeDefinition = {
  id: 'box-3d',
  name: 'Box 3D',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A 3D box/cube centered at origin',
  tags: ['box', 'cube', 'rectangular'],
  parameters: [
    createFloatParam('width', 'Width', 0.5, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.5, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('depth', 'Depth', 0.5, 0.01, 5.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('width', 0.01, 5.0),
    createModTarget('height', 0.01, 5.0),
    createModTarget('depth', 0.01, 5.0)
  ],
  glsl: {
    signature: 'float sdBox3D(vec3 p, vec3 b)',
    body: `vec3 q = abs(p) - b;
return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);`
  },
  defaults: { width: 0.5, height: 0.5, depth: 0.5 },
  deterministic: true
};

// ============================================================================
// Rounded Box 3D
// ============================================================================

export const sdRoundedBox3D: SdfNodeDefinition = {
  id: 'rounded-box-3d',
  name: 'Rounded Box 3D',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A 3D box with rounded edges',
  tags: ['box', 'rounded', 'smooth'],
  parameters: [
    createFloatParam('width', 'Width', 0.4, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.4, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('depth', 'Depth', 0.4, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('radius', 'Corner Radius', 0.1, 0.0, 1.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('width', 0.01, 5.0),
    createModTarget('height', 0.01, 5.0),
    createModTarget('depth', 0.01, 5.0),
    createModTarget('radius', 0.0, 1.0)
  ],
  glsl: {
    signature: 'float sdRoundedBox3D(vec3 p, vec3 b, float r)',
    body: `vec3 q = abs(p) - b + r;
return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;`
  },
  defaults: { width: 0.4, height: 0.4, depth: 0.4, radius: 0.1 },
  deterministic: true
};

// ============================================================================
// Capsule 3D
// ============================================================================

export const sdCapsule3D: SdfNodeDefinition = {
  id: 'capsule-3d',
  name: 'Capsule 3D',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A 3D capsule (cylinder with hemispherical caps)',
  tags: ['capsule', 'pill', 'rounded', 'cylinder'],
  parameters: [
    createFloatParam('height', 'Height', 0.6, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('radius', 'Radius', 0.2, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('height', 0.01, 5.0),
    createModTarget('radius', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdCapsule3D(vec3 p, float h, float r)',
    body: `p.y -= clamp(p.y, -h * 0.5, h * 0.5);
return length(p) - r;`
  },
  defaults: { height: 0.6, radius: 0.2 },
  deterministic: true
};

// ============================================================================
// Cylinder
// ============================================================================

export const sdCylinder: SdfNodeDefinition = {
  id: 'cylinder',
  name: 'Cylinder',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A finite cylinder along the Y axis',
  tags: ['cylinder', 'tube', 'column'],
  parameters: [
    createFloatParam('height', 'Height', 0.5, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('radius', 'Radius', 0.3, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('height', 0.01, 5.0),
    createModTarget('radius', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdCylinder(vec3 p, float h, float r)',
    body: `vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));`
  },
  defaults: { height: 0.5, radius: 0.3 },
  deterministic: true
};

// ============================================================================
// Capped Cylinder (with rounded edges)
// ============================================================================

export const sdCappedCylinder: SdfNodeDefinition = {
  id: 'capped-cylinder',
  name: 'Capped Cylinder',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A cylinder with optional rounded caps',
  tags: ['cylinder', 'capped', 'rounded'],
  parameters: [
    createFloatParam('height', 'Height', 0.4, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('radius', 'Radius', 0.25, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('rounding', 'Cap Rounding', 0.05, 0.0, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('height', 0.01, 5.0),
    createModTarget('radius', 0.01, 2.0),
    createModTarget('rounding', 0.0, 0.5)
  ],
  glsl: {
    signature: 'float sdCappedCylinder(vec3 p, float h, float r, float rnd)',
    body: `vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r - rnd, h - rnd);
return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rnd;`
  },
  defaults: { height: 0.4, radius: 0.25, rounding: 0.05 },
  deterministic: true
};

// ============================================================================
// Cone
// ============================================================================

export const sdCone: SdfNodeDefinition = {
  id: 'cone',
  name: 'Cone',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A cone with apex at origin, pointing up',
  tags: ['cone', 'point', 'pyramid'],
  parameters: [
    createFloatParam('height', 'Height', 0.6, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('radius', 'Base Radius', 0.3, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('height', 0.01, 5.0),
    createModTarget('radius', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdCone(vec3 p, float h, float r)',
    body: `vec2 c = normalize(vec2(h, r));
vec2 q = vec2(length(p.xz), p.y);
float d1 = q.y - h;
float d2 = max(dot(q, c), q.y);
return length(max(vec2(d1, d2), 0.0)) + min(max(d1, d2), 0.0);`
  },
  defaults: { height: 0.6, radius: 0.3 },
  deterministic: true
};

// ============================================================================
// Truncated Cone (Capped Cone)
// ============================================================================

export const sdCappedCone: SdfNodeDefinition = {
  id: 'capped-cone',
  name: 'Truncated Cone',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A truncated cone (frustum)',
  tags: ['cone', 'truncated', 'frustum', 'tapered'],
  parameters: [
    createFloatParam('height', 'Height', 0.5, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('radiusBottom', 'Bottom Radius', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('radiusTop', 'Top Radius', 0.2, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('height', 0.01, 5.0),
    createModTarget('radiusBottom', 0.01, 2.0),
    createModTarget('radiusTop', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdCappedCone(vec3 p, float h, float r1, float r2)',
    body: `vec2 q = vec2(length(p.xz), p.y);
vec2 k1 = vec2(r2, h);
vec2 k2 = vec2(r2 - r1, 2.0 * h);
vec2 ca = vec2(q.x - min(q.x, (q.y < 0.0) ? r1 : r2), abs(q.y) - h);
vec2 cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot(k2, k2), 0.0, 1.0);
float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
return s * sqrt(min(dot(ca, ca), dot(cb, cb)));`
  },
  defaults: { height: 0.5, radiusBottom: 0.4, radiusTop: 0.2 },
  deterministic: true
};

// ============================================================================
// Torus
// ============================================================================

export const sdTorus: SdfNodeDefinition = {
  id: 'torus',
  name: 'Torus',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A torus (donut shape)',
  tags: ['torus', 'donut', 'ring', 'tube'],
  parameters: [
    createFloatParam('majorRadius', 'Major Radius', 0.4, 0.05, 3.0, { group: 'Shape', tooltip: 'Distance from center to tube center' }),
    createFloatParam('minorRadius', 'Minor Radius', 0.15, 0.01, 1.0, { group: 'Shape', tooltip: 'Tube thickness' })
  ],
  modTargets: [
    createModTarget('majorRadius', 0.05, 3.0),
    createModTarget('minorRadius', 0.01, 1.0)
  ],
  glsl: {
    signature: 'float sdTorus(vec3 p, vec2 t)',
    body: `vec2 q = vec2(length(p.xz) - t.x, p.y);
return length(q) - t.y;`
  },
  defaults: { majorRadius: 0.4, minorRadius: 0.15 },
  deterministic: true
};

// ============================================================================
// Capped Torus
// ============================================================================

export const sdCappedTorus: SdfNodeDefinition = {
  id: 'capped-torus',
  name: 'Capped Torus',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A partial torus (arc)',
  tags: ['torus', 'arc', 'partial', 'segment'],
  parameters: [
    createFloatParam('majorRadius', 'Major Radius', 0.4, 0.05, 3.0, { group: 'Shape' }),
    createFloatParam('minorRadius', 'Minor Radius', 0.1, 0.01, 1.0, { group: 'Shape' }),
    createFloatParam('aperture', 'Aperture', 1.57, 0.1, 3.14, { group: 'Shape', tooltip: 'Half-angle of the torus cap' })
  ],
  modTargets: [
    createModTarget('majorRadius', 0.05, 3.0),
    createModTarget('minorRadius', 0.01, 1.0),
    createModTarget('aperture', 0.1, 3.14)
  ],
  glsl: {
    signature: 'float sdCappedTorus(vec3 p, float ra, float rb, float an)',
    body: `vec2 sc = vec2(sin(an), cos(an));
p.x = abs(p.x);
float k = (sc.y * p.x > sc.x * p.z) ? dot(p.xz, sc) : length(p.xz);
return sqrt(dot(p, p) + ra * ra - 2.0 * ra * k) - rb;`
  },
  defaults: { majorRadius: 0.4, minorRadius: 0.1, aperture: 1.57 },
  deterministic: true
};

// ============================================================================
// Pyramid
// ============================================================================

export const sdPyramid: SdfNodeDefinition = {
  id: 'pyramid',
  name: 'Pyramid',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A 4-sided pyramid',
  tags: ['pyramid', 'tetrahedron', 'point'],
  parameters: [
    createFloatParam('height', 'Height', 0.6, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('base', 'Base Size', 0.5, 0.01, 3.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('height', 0.01, 5.0),
    createModTarget('base', 0.01, 3.0)
  ],
  glsl: {
    signature: 'float sdPyramid(vec3 p, float h, float b)',
    body: `float m2 = h * h + 0.25;
p.xz = abs(p.xz) * b;
p.xz = (p.z > p.x) ? p.zx : p.xz;
p.xz -= 0.5;
vec3 q = vec3(p.z, h * p.y - 0.5 * p.x, h * p.x + 0.5 * p.y);
float s = max(-q.x, 0.0);
float t = clamp((q.y - 0.5 * p.z) / (m2 + 0.25), 0.0, 1.0);
float a = m2 * (q.x + s) * (q.x + s) + q.y * q.y;
float bb = m2 * (q.x + 0.5 * t) * (q.x + 0.5 * t) + (q.y - m2 * t) * (q.y - m2 * t);
float d2 = min(q.y, -q.x * m2 - q.y * 0.5) > 0.0 ? 0.0 : min(a, bb);
return sqrt((d2 + q.z * q.z) / m2) * sign(max(q.z, -p.y));`
  },
  defaults: { height: 0.6, base: 0.5 },
  deterministic: true
};

// ============================================================================
// Hexagonal Prism
// ============================================================================

export const sdHexPrism: SdfNodeDefinition = {
  id: 'hex-prism',
  name: 'Hexagonal Prism',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A hexagonal prism (6-sided column)',
  tags: ['hexagon', 'prism', 'column', '6-sided'],
  parameters: [
    createFloatParam('height', 'Height', 0.4, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('radius', 'Radius', 0.3, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('height', 0.01, 5.0),
    createModTarget('radius', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdHexPrism(vec3 p, vec2 h)',
    body: `vec3 k = vec3(-0.8660254, 0.5, 0.57735);
p = abs(p);
p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
vec2 d = vec2(
  length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x),
  p.z - h.y
);
return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));`
  },
  defaults: { height: 0.4, radius: 0.3 },
  deterministic: true
};

// ============================================================================
// Triangular Prism
// ============================================================================

export const sdTriPrism: SdfNodeDefinition = {
  id: 'tri-prism',
  name: 'Triangular Prism',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A triangular prism (3-sided column)',
  tags: ['triangle', 'prism', 'column', '3-sided'],
  parameters: [
    createFloatParam('height', 'Height', 0.4, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('radius', 'Radius', 0.3, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('height', 0.01, 5.0),
    createModTarget('radius', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdTriPrism(vec3 p, vec2 h)',
    body: `vec3 q = abs(p);
return max(q.z - h.y, max(q.x * 0.866025 + p.y * 0.5, -p.y) - h.x * 0.5);`
  },
  defaults: { height: 0.4, radius: 0.3 },
  deterministic: true
};

// ============================================================================
// Infinite Plane
// ============================================================================

export const sdPlane: SdfNodeDefinition = {
  id: 'plane',
  name: 'Plane',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'An infinite plane with normal direction',
  tags: ['plane', 'floor', 'ground', 'infinite'],
  parameters: [
    createFloatParam('height', 'Height', 0.0, -5.0, 5.0, { group: 'Shape', tooltip: 'Distance from origin along normal' }),
    createFloatParam('normalX', 'Normal X', 0.0, -1.0, 1.0, { group: 'Normal' }),
    createFloatParam('normalY', 'Normal Y', 1.0, -1.0, 1.0, { group: 'Normal' }),
    createFloatParam('normalZ', 'Normal Z', 0.0, -1.0, 1.0, { group: 'Normal' })
  ],
  modTargets: [
    createModTarget('height', -5.0, 5.0, true)
  ],
  glsl: {
    signature: 'float sdPlane(vec3 p, vec3 n, float h)',
    body: 'return dot(p, normalize(n)) + h;'
  },
  defaults: { height: 0.0, normalX: 0.0, normalY: 1.0, normalZ: 0.0 },
  deterministic: true
};

// ============================================================================
// Box Frame (Wireframe Box)
// ============================================================================

export const sdBoxFrame: SdfNodeDefinition = {
  id: 'box-frame',
  name: 'Box Frame',
  version: '1.0.0',
  category: 'shapes3d',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A wireframe box (edges only)',
  tags: ['box', 'frame', 'wireframe', 'edges'],
  parameters: [
    createFloatParam('width', 'Width', 0.5, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.5, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('depth', 'Depth', 0.5, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('thickness', 'Edge Thickness', 0.03, 0.005, 0.3, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('width', 0.01, 5.0),
    createModTarget('height', 0.01, 5.0),
    createModTarget('depth', 0.01, 5.0),
    createModTarget('thickness', 0.005, 0.3)
  ],
  glsl: {
    signature: 'float sdBoxFrame(vec3 p, vec3 b, float e)',
    body: `p = abs(p) - b;
vec3 q = abs(p + e) - e;
return min(min(
  length(max(vec3(p.x, q.y, q.z), 0.0)) + min(max(p.x, max(q.y, q.z)), 0.0),
  length(max(vec3(q.x, p.y, q.z), 0.0)) + min(max(q.x, max(p.y, q.z)), 0.0)),
  length(max(vec3(q.x, q.y, p.z), 0.0)) + min(max(q.x, max(q.y, p.z)), 0.0));`
  },
  defaults: { width: 0.5, height: 0.5, depth: 0.5, thickness: 0.03 },
  deterministic: true
};

// ============================================================================
// All 3D Primitives Export
// ============================================================================

export const shapes3dPrimitives: SdfNodeDefinition[] = [
  sdSphere,
  sdEllipsoid,
  sdBox3D,
  sdRoundedBox3D,
  sdCapsule3D,
  sdCylinder,
  sdCappedCylinder,
  sdCone,
  sdCappedCone,
  sdTorus,
  sdCappedTorus,
  sdPyramid,
  sdHexPrism,
  sdTriPrism,
  sdPlane,
  sdBoxFrame
];
