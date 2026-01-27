/**
 * 3D SDF Advanced Shapes
 *
 * More complex 3D signed distance field shapes for raymarching.
 */

import type { SdfNodeDefinition } from '../../api';
import {
  createFloatParam,
  createIntParam,
  createModTarget
} from '../../api';

// ============================================================================
// Tetrahedron
// ============================================================================

export const sdTetrahedron: SdfNodeDefinition = {
  id: 'tetrahedron',
  name: 'Tetrahedron',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A regular tetrahedron (4-sided polyhedron)',
  tags: ['tetrahedron', 'pyramid', 'platonic'],
  parameters: [
    createFloatParam('size', 'Size', 0.5, 0.01, 3.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('size', 0.01, 3.0)
  ],
  glsl: {
    signature: 'float sdTetrahedron(vec3 p, float r)',
    body: `float m = sqrt(2.0);
p /= r;
vec3 q = p;
float t = max(max(-p.x - p.y - p.z, p.x + p.y - p.z),
              max(-p.x + p.y + p.z, p.x - p.y + p.z));
return (t - 1.0) * r / m;`
  },
  defaults: { size: 0.5 },
  deterministic: true
};

// ============================================================================
// Octahedron
// ============================================================================

export const sdOctahedron: SdfNodeDefinition = {
  id: 'octahedron',
  name: 'Octahedron',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A regular octahedron (8-sided polyhedron)',
  tags: ['octahedron', 'diamond', 'platonic'],
  parameters: [
    createFloatParam('size', 'Size', 0.5, 0.01, 3.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('size', 0.01, 3.0)
  ],
  glsl: {
    signature: 'float sdOctahedron(vec3 p, float s)',
    body: `p = abs(p);
float m = p.x + p.y + p.z - s;
vec3 q;
if (3.0 * p.x < m) q = p.xyz;
else if (3.0 * p.y < m) q = p.yzx;
else if (3.0 * p.z < m) q = p.zxy;
else return m * 0.57735027;
float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
return length(vec3(q.x, q.y - s + k, q.z - k));`
  },
  defaults: { size: 0.5 },
  deterministic: true
};

// ============================================================================
// Icosahedron (Approximation)
// ============================================================================

export const sdIcosahedron: SdfNodeDefinition = {
  id: 'icosahedron',
  name: 'Icosahedron',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'MED',
  description: 'A regular icosahedron (20-sided polyhedron)',
  tags: ['icosahedron', 'd20', 'platonic'],
  parameters: [
    createFloatParam('size', 'Size', 0.5, 0.01, 3.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('size', 0.01, 3.0)
  ],
  glsl: {
    signature: 'float sdIcosahedron(vec3 p, float r)',
    body: `float phi = 1.618033988749895;
vec3 n1 = normalize(vec3(1.0, phi, 0.0));
vec3 n2 = normalize(vec3(-1.0, phi, 0.0));
vec3 n3 = normalize(vec3(0.0, 1.0, phi));
vec3 n4 = normalize(vec3(0.0, 1.0, -phi));
vec3 n5 = normalize(vec3(phi, 0.0, 1.0));
vec3 n6 = normalize(vec3(-phi, 0.0, 1.0));
p = abs(p);
float d = dot(p, n1);
d = max(d, dot(p, n2));
d = max(d, dot(p, n3));
d = max(d, dot(p, n4));
d = max(d, dot(p, n5));
d = max(d, dot(p, n6));
return d - r;`
  },
  defaults: { size: 0.5 },
  deterministic: true
};

// ============================================================================
// Dodecahedron (Approximation)
// ============================================================================

export const sdDodecahedron: SdfNodeDefinition = {
  id: 'dodecahedron',
  name: 'Dodecahedron',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'MED',
  description: 'A regular dodecahedron (12-sided polyhedron)',
  tags: ['dodecahedron', 'd12', 'platonic', 'pentagon'],
  parameters: [
    createFloatParam('size', 'Size', 0.5, 0.01, 3.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('size', 0.01, 3.0)
  ],
  glsl: {
    signature: 'float sdDodecahedron(vec3 p, float r)',
    body: `float phi = 1.618033988749895;
vec3 n1 = normalize(vec3(0.0, 1.0, phi));
vec3 n2 = normalize(vec3(0.0, 1.0, -phi));
vec3 n3 = normalize(vec3(1.0, phi, 0.0));
vec3 n4 = normalize(vec3(1.0, -phi, 0.0));
vec3 n5 = normalize(vec3(phi, 0.0, 1.0));
vec3 n6 = normalize(vec3(-phi, 0.0, 1.0));
p = abs(p);
float d = dot(p, n1);
d = max(d, dot(p, n2));
d = max(d, dot(p, n3));
d = max(d, dot(p, n4));
d = max(d, dot(p, n5));
d = max(d, dot(p, n6));
return d - r * 0.795;`
  },
  defaults: { size: 0.5 },
  deterministic: true
};

// ============================================================================
// Superquadric / Superellipsoid
// ============================================================================

export const sdSuperquadric: SdfNodeDefinition = {
  id: 'superquadric',
  name: 'Superquadric',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A superellipsoid with configurable powers',
  tags: ['superquadric', 'superellipsoid', 'parametric'],
  parameters: [
    createFloatParam('sizeX', 'Size X', 0.4, 0.01, 3.0, { group: 'Shape' }),
    createFloatParam('sizeY', 'Size Y', 0.3, 0.01, 3.0, { group: 'Shape' }),
    createFloatParam('sizeZ', 'Size Z', 0.4, 0.01, 3.0, { group: 'Shape' }),
    createFloatParam('power1', 'Power 1', 2.0, 0.2, 8.0, { group: 'Exponents', tooltip: 'Roundness in XZ plane' }),
    createFloatParam('power2', 'Power 2', 2.0, 0.2, 8.0, { group: 'Exponents', tooltip: 'Roundness in Y direction' })
  ],
  modTargets: [
    createModTarget('sizeX', 0.01, 3.0),
    createModTarget('sizeY', 0.01, 3.0),
    createModTarget('sizeZ', 0.01, 3.0),
    createModTarget('power1', 0.2, 8.0),
    createModTarget('power2', 0.2, 8.0)
  ],
  glsl: {
    signature: 'float sdSuperquadric(vec3 p, vec3 s, float e1, float e2)',
    body: `vec3 ap = abs(p) / s;
float r1 = pow(pow(ap.x, e1) + pow(ap.z, e1), e2 / e1);
float r2 = pow(r1 + pow(ap.y, e2), 1.0 / e2);
return (r2 - 1.0) * min(min(s.x, s.y), s.z) * 0.5;`
  },
  defaults: { sizeX: 0.4, sizeY: 0.3, sizeZ: 0.4, power1: 2.0, power2: 2.0 },
  deterministic: true
};

// ============================================================================
// Tube / Pipe
// ============================================================================

export const sdTube: SdfNodeDefinition = {
  id: 'tube',
  name: 'Tube',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A hollow tube/pipe',
  tags: ['tube', 'pipe', 'hollow', 'cylinder'],
  parameters: [
    createFloatParam('height', 'Height', 0.5, 0.01, 5.0, { group: 'Shape' }),
    createFloatParam('outerRadius', 'Outer Radius', 0.3, 0.02, 2.0, { group: 'Shape' }),
    createFloatParam('thickness', 'Wall Thickness', 0.05, 0.005, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('height', 0.01, 5.0),
    createModTarget('outerRadius', 0.02, 2.0),
    createModTarget('thickness', 0.005, 0.5)
  ],
  glsl: {
    signature: 'float sdTube(vec3 p, float h, float ro, float th)',
    body: `vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(ro, h);
float outer = min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
float inner = length(p.xz) - (ro - th);
float cap = abs(p.y) - h;
return max(outer, -max(inner, -cap));`
  },
  defaults: { height: 0.5, outerRadius: 0.3, thickness: 0.05 },
  deterministic: true
};

// ============================================================================
// Helix Tube
// ============================================================================

export const sdHelixTube: SdfNodeDefinition = {
  id: 'helix-tube',
  name: 'Helix Tube',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'MED',
  description: 'A helical/spiral tube shape',
  tags: ['helix', 'spiral', 'coil', 'spring'],
  parameters: [
    createFloatParam('radius', 'Helix Radius', 0.3, 0.05, 2.0, { group: 'Shape' }),
    createFloatParam('tubeRadius', 'Tube Radius', 0.08, 0.01, 0.5, { group: 'Shape' }),
    createFloatParam('pitch', 'Pitch', 0.15, 0.02, 1.0, { group: 'Shape', tooltip: 'Vertical spacing between turns' }),
    createFloatParam('turns', 'Turns', 3.0, 0.5, 10.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('radius', 0.05, 2.0),
    createModTarget('tubeRadius', 0.01, 0.5),
    createModTarget('pitch', 0.02, 1.0),
    createModTarget('turns', 0.5, 10.0)
  ],
  glsl: {
    signature: 'float sdHelixTube(vec3 p, float r, float tr, float pitch, float turns)',
    body: `float height = pitch * turns;
p.y = clamp(p.y, -height * 0.5, height * 0.5);
float a = atan(p.z, p.x);
float targetY = (a + 3.14159265) / 6.28318530718 * pitch;
float dy = p.y - targetY;
dy -= round(dy / pitch) * pitch;
vec2 q = vec2(length(p.xz) - r, dy);
return length(q) - tr;`
  },
  defaults: { radius: 0.3, tubeRadius: 0.08, pitch: 0.15, turns: 3.0 },
  deterministic: true
};

// ============================================================================
// Torus Knot (Approximate)
// ============================================================================

export const sdTorusKnot: SdfNodeDefinition = {
  id: 'torus-knot',
  name: 'Torus Knot',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'MED',
  description: 'A torus knot shape (approximate)',
  tags: ['knot', 'torus', 'braid', 'mathematical'],
  parameters: [
    createFloatParam('radius', 'Major Radius', 0.35, 0.1, 2.0, { group: 'Shape' }),
    createFloatParam('tubeRadius', 'Tube Radius', 0.08, 0.01, 0.3, { group: 'Shape' }),
    createIntParam('p', 'P (Winds)', 2, 1, 5, { group: 'Knot', modulatable: false }),
    createIntParam('q', 'Q (Rotations)', 3, 1, 7, { group: 'Knot', modulatable: false })
  ],
  modTargets: [
    createModTarget('radius', 0.1, 2.0),
    createModTarget('tubeRadius', 0.01, 0.3)
  ],
  glsl: {
    signature: 'float sdTorusKnot(vec3 p, float R, float r, float pn, float qn)',
    body: `float d = 1e10;
for (float i = 0.0; i < 64.0; i += 1.0) {
  float t = i / 64.0 * 6.28318530718;
  float phi = pn * t;
  float theta = qn * t;
  float rr = R + r * 0.5 * cos(theta);
  vec3 c = vec3(rr * cos(phi), r * 0.5 * sin(theta), rr * sin(phi));
  d = min(d, length(p - c) - r);
}
return d;`
  },
  defaults: { radius: 0.35, tubeRadius: 0.08, p: 2, q: 3 },
  deterministic: true
};

// ============================================================================
// Arch / Vault
// ============================================================================

export const sdArch: SdfNodeDefinition = {
  id: 'arch',
  name: 'Arch',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'An architectural arch shape',
  tags: ['arch', 'vault', 'door', 'architectural'],
  parameters: [
    createFloatParam('width', 'Width', 0.5, 0.1, 3.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.6, 0.1, 3.0, { group: 'Shape' }),
    createFloatParam('depth', 'Depth', 0.2, 0.05, 2.0, { group: 'Shape' }),
    createFloatParam('thickness', 'Wall Thickness', 0.05, 0.01, 0.3, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('width', 0.1, 3.0),
    createModTarget('height', 0.1, 3.0),
    createModTarget('depth', 0.05, 2.0),
    createModTarget('thickness', 0.01, 0.3)
  ],
  glsl: {
    signature: 'float sdArch(vec3 p, float w, float h, float d, float th)',
    body: `float archRadius = w * 0.5;
float archHeight = h - archRadius;
vec3 q = vec3(abs(p.x), p.y, abs(p.z));
float wall;
if (q.y > archHeight) {
  vec2 centered = vec2(q.x, q.y - archHeight);
  float arcDist = abs(length(centered) - archRadius) - th;
  wall = max(arcDist, q.z - d);
} else {
  float pillarDist = max(abs(q.x - archRadius) - th, q.z - d);
  float innerCut = -(archRadius - th - q.x);
  wall = max(pillarDist, innerCut);
}
return wall;`
  },
  defaults: { width: 0.5, height: 0.6, depth: 0.2, thickness: 0.05 },
  deterministic: true
};

// ============================================================================
// Stairs
// ============================================================================

export const sdStairs: SdfNodeDefinition = {
  id: 'stairs',
  name: 'Stairs',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'MED',
  description: 'A staircase shape',
  tags: ['stairs', 'steps', 'staircase'],
  parameters: [
    createFloatParam('width', 'Width', 0.6, 0.1, 3.0, { group: 'Shape' }),
    createFloatParam('stepHeight', 'Step Height', 0.08, 0.02, 0.3, { group: 'Shape' }),
    createFloatParam('stepDepth', 'Step Depth', 0.12, 0.05, 0.5, { group: 'Shape' }),
    createIntParam('steps', 'Steps', 5, 2, 20, { group: 'Shape', modulatable: false })
  ],
  modTargets: [
    createModTarget('width', 0.1, 3.0),
    createModTarget('stepHeight', 0.02, 0.3),
    createModTarget('stepDepth', 0.05, 0.5)
  ],
  glsl: {
    signature: 'float sdStairs(vec3 p, float w, float sh, float sd, float n)',
    body: `float d = 1e10;
for (float i = 0.0; i < n; i += 1.0) {
  vec3 stepPos = vec3(0.0, i * sh, i * sd);
  vec3 q = p - stepPos;
  vec3 boxSize = vec3(w * 0.5, sh * 0.5, sd * 0.5);
  vec3 dd = abs(q) - boxSize;
  float stepDist = length(max(dd, 0.0)) + min(max(dd.x, max(dd.y, dd.z)), 0.0);
  d = min(d, stepDist);
}
return d;`
  },
  defaults: { width: 0.6, stepHeight: 0.08, stepDepth: 0.12, steps: 5 },
  deterministic: true
};

// ============================================================================
// 3D Gear (Approximate)
// ============================================================================

export const sdGear3D: SdfNodeDefinition = {
  id: 'gear-3d',
  name: 'Gear 3D',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'MED',
  description: 'A 3D gear/cog shape',
  tags: ['gear', 'cog', 'mechanical', 'wheel'],
  parameters: [
    createFloatParam('outerRadius', 'Outer Radius', 0.4, 0.1, 2.0, { group: 'Shape' }),
    createFloatParam('innerRadius', 'Inner Radius', 0.3, 0.05, 1.5, { group: 'Shape' }),
    createFloatParam('thickness', 'Thickness', 0.1, 0.02, 0.5, { group: 'Shape' }),
    createIntParam('teeth', 'Teeth', 12, 4, 32, { group: 'Shape', modulatable: false }),
    createFloatParam('toothDepth', 'Tooth Depth', 0.08, 0.02, 0.3, { group: 'Shape' }),
    createFloatParam('holeRadius', 'Hole Radius', 0.1, 0.0, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('outerRadius', 0.1, 2.0),
    createModTarget('innerRadius', 0.05, 1.5),
    createModTarget('thickness', 0.02, 0.5),
    createModTarget('toothDepth', 0.02, 0.3),
    createModTarget('holeRadius', 0.0, 0.5)
  ],
  glsl: {
    signature: 'float sdGear3D(vec3 p, float ro, float ri, float th, float teeth, float depth, float hole)',
    body: `float a = atan(p.z, p.x);
float r = length(p.xz);
float tooth = cos(a * teeth) * 0.5 + 0.5;
float gearR = ri + depth * tooth;
float gearDist = r - gearR;
float capDist = abs(p.y) - th;
float cylDist = max(gearDist, capDist);
float holeDist = hole - r;
return max(cylDist, holeDist);`
  },
  defaults: { outerRadius: 0.4, innerRadius: 0.3, thickness: 0.1, teeth: 12, toothDepth: 0.08, holeRadius: 0.1 },
  deterministic: true
};

// ============================================================================
// Link (Chain Link)
// ============================================================================

export const sdLink: SdfNodeDefinition = {
  id: 'link',
  name: 'Chain Link',
  version: '1.0.0',
  category: 'shapes3d-advanced',
  coordSpace: '3d',
  gpuCostTier: 'LOW',
  description: 'A chain link shape',
  tags: ['link', 'chain', 'loop'],
  parameters: [
    createFloatParam('length', 'Length', 0.3, 0.05, 2.0, { group: 'Shape' }),
    createFloatParam('radius', 'Major Radius', 0.15, 0.05, 1.0, { group: 'Shape' }),
    createFloatParam('tubeRadius', 'Tube Radius', 0.05, 0.01, 0.3, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('length', 0.05, 2.0),
    createModTarget('radius', 0.05, 1.0),
    createModTarget('tubeRadius', 0.01, 0.3)
  ],
  glsl: {
    signature: 'float sdLink(vec3 p, float le, float r1, float r2)',
    body: `vec3 q = vec3(p.x, max(abs(p.y) - le, 0.0), p.z);
return length(vec2(length(q.xy) - r1, q.z)) - r2;`
  },
  defaults: { length: 0.3, radius: 0.15, tubeRadius: 0.05 },
  deterministic: true
};

// ============================================================================
// All 3D Advanced Shapes Export
// ============================================================================

export const shapes3dAdvanced: SdfNodeDefinition[] = [
  sdTetrahedron,
  sdOctahedron,
  sdIcosahedron,
  sdDodecahedron,
  sdSuperquadric,
  sdTube,
  sdHelixTube,
  sdTorusKnot,
  sdArch,
  sdStairs,
  sdGear3D,
  sdLink
];
