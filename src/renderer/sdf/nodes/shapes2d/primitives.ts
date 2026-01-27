/**
 * 2D SDF Primitive Shapes
 *
 * Basic 2D signed distance field primitives.
 */

import type { SdfNodeDefinition } from '../../api';
import {
  createFloatParam,
  createIntParam,
  createAngleParam,
  createVec2Param,
  createModTarget
} from '../../api';

// ============================================================================
// Circle / Disk
// ============================================================================

export const sdCircle: SdfNodeDefinition = {
  id: 'circle',
  name: 'Circle',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A perfect circle (disk) centered at origin',
  tags: ['circle', 'disk', 'round', 'basic'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.5, 0.01, 2.0, { group: 'Shape', tooltip: 'Circle radius' })
  ],
  modTargets: [
    createModTarget('radius', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdCircle(vec2 p, float r)',
    body: 'return length(p) - r;'
  },
  defaults: { radius: 0.5 },
  deterministic: true
};

// ============================================================================
// Ring / Annulus
// ============================================================================

export const sdRing: SdfNodeDefinition = {
  id: 'ring',
  name: 'Ring',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A ring (annulus) - circle with thickness',
  tags: ['ring', 'annulus', 'donut', 'hollow'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('thickness', 'Thickness', 0.1, 0.001, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('radius', 0.01, 2.0),
    createModTarget('thickness', 0.001, 0.5)
  ],
  glsl: {
    signature: 'float sdRing(vec2 p, float r, float thickness)',
    body: 'return abs(length(p) - r) - thickness;'
  },
  defaults: { radius: 0.4, thickness: 0.1 },
  deterministic: true
};

// ============================================================================
// Ellipse
// ============================================================================

export const sdEllipse: SdfNodeDefinition = {
  id: 'ellipse',
  name: 'Ellipse',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'An ellipse with independent X and Y radii',
  tags: ['ellipse', 'oval', 'stretch'],
  parameters: [
    createFloatParam('radiusX', 'Radius X', 0.5, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('radiusY', 'Radius Y', 0.3, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('radiusX', 0.01, 2.0),
    createModTarget('radiusY', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdEllipse(vec2 p, vec2 ab)',
    body: `p = abs(p);
if (p.x > p.y) { p = p.yx; ab = ab.yx; }
float l = ab.y * ab.y - ab.x * ab.x;
float m = ab.x * p.x / l;
float m2 = m * m;
float n = ab.y * p.y / l;
float n2 = n * n;
float c = (m2 + n2 - 1.0) / 3.0;
float c3 = c * c * c;
float q = c3 + m2 * n2 * 2.0;
float d = c3 + m2 * n2;
float g = m + m * n2;
float co;
if (d < 0.0) {
  float h = acos(q / c3) / 3.0;
  float s = cos(h);
  float t = sin(h) * sqrt(3.0);
  float rx = sqrt(-c * (s + t + 2.0) + m2);
  float ry = sqrt(-c * (s - t + 2.0) + m2);
  co = (ry + sign(l) * rx + abs(g) / (rx * ry) - m) / 2.0;
} else {
  float h = 2.0 * m * n * sqrt(d);
  float s = sign(q + h) * pow(abs(q + h), 1.0 / 3.0);
  float u = sign(q - h) * pow(abs(q - h), 1.0 / 3.0);
  float rx = -s - u - c * 4.0 + 2.0 * m2;
  float ry = (s - u) * sqrt(3.0);
  float rm = sqrt(rx * rx + ry * ry);
  co = (ry / sqrt(rm - rx) + 2.0 * g / rm - m) / 2.0;
}
vec2 r = ab * vec2(co, sqrt(1.0 - co * co));
return length(r - p) * sign(p.y - r.y);`
  },
  defaults: { radiusX: 0.5, radiusY: 0.3 },
  deterministic: true
};

// ============================================================================
// Line Segment
// ============================================================================

export const sdSegment: SdfNodeDefinition = {
  id: 'segment',
  name: 'Line Segment',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A line segment between two points',
  tags: ['line', 'segment', 'edge'],
  parameters: [
    createVec2Param('pointA', 'Point A', [-0.4, 0.0], { group: 'Shape' }),
    createVec2Param('pointB', 'Point B', [0.4, 0.0], { group: 'Shape' })
  ],
  modTargets: [],
  glsl: {
    signature: 'float sdSegment(vec2 p, vec2 a, vec2 b)',
    body: `vec2 pa = p - a, ba = b - a;
float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
return length(pa - ba * h);`
  },
  defaults: { pointA: [-0.4, 0.0], pointB: [0.4, 0.0] },
  deterministic: true
};

// ============================================================================
// Capsule
// ============================================================================

export const sdCapsule: SdfNodeDefinition = {
  id: 'capsule',
  name: 'Capsule',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A capsule (stadium) shape - segment with rounded ends',
  tags: ['capsule', 'stadium', 'pill', 'rounded'],
  parameters: [
    createFloatParam('length', 'Length', 0.5, 0.0, 2.0, { group: 'Shape' }),
    createFloatParam('radius', 'Radius', 0.15, 0.01, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('length', 0.0, 2.0),
    createModTarget('radius', 0.01, 0.5)
  ],
  glsl: {
    signature: 'float sdCapsule(vec2 p, float h, float r)',
    body: `p.x = abs(p.x);
p.x -= min(p.x, h);
return length(p) - r;`
  },
  defaults: { length: 0.5, radius: 0.15 },
  deterministic: true
};

// ============================================================================
// Box / Rectangle
// ============================================================================

export const sdBox: SdfNodeDefinition = {
  id: 'box',
  name: 'Box',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A rectangle (box) centered at origin',
  tags: ['box', 'rectangle', 'square', 'rect'],
  parameters: [
    createFloatParam('width', 'Width', 0.6, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.4, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('width', 0.01, 2.0),
    createModTarget('height', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdBox(vec2 p, vec2 b)',
    body: `vec2 d = abs(p) - b;
return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);`
  },
  defaults: { width: 0.6, height: 0.4 },
  deterministic: true
};

// ============================================================================
// Rounded Box
// ============================================================================

export const sdRoundedBox: SdfNodeDefinition = {
  id: 'rounded-box',
  name: 'Rounded Box',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A rectangle with uniform rounded corners',
  tags: ['box', 'rectangle', 'rounded', 'corner'],
  parameters: [
    createFloatParam('width', 'Width', 0.5, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.3, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('radius', 'Corner Radius', 0.1, 0.0, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('width', 0.01, 2.0),
    createModTarget('height', 0.01, 2.0),
    createModTarget('radius', 0.0, 0.5)
  ],
  glsl: {
    signature: 'float sdRoundedBox(vec2 p, vec2 b, float r)',
    body: `vec2 q = abs(p) - b + r;
return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;`
  },
  defaults: { width: 0.5, height: 0.3, radius: 0.1 },
  deterministic: true
};

// ============================================================================
// Chamfered Box
// ============================================================================

export const sdChamferedBox: SdfNodeDefinition = {
  id: 'chamfered-box',
  name: 'Chamfered Box',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A rectangle with chamfered (cut) corners',
  tags: ['box', 'rectangle', 'chamfer', 'cut', 'octagon'],
  parameters: [
    createFloatParam('width', 'Width', 0.5, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('chamfer', 'Chamfer Size', 0.1, 0.0, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('width', 0.01, 2.0),
    createModTarget('height', 0.01, 2.0),
    createModTarget('chamfer', 0.0, 0.5)
  ],
  glsl: {
    signature: 'float sdChamferedBox(vec2 p, vec2 b, float c)',
    body: `p = abs(p);
float m = max(p.x - b.x + c, p.y - b.y + c);
p = (p.x > p.y) ? p : p.yx;
b = (b.x > b.y) ? b : b.yx;
float k = clamp((p.x - p.y - b.x + b.y) / 2.0, 0.0, c);
vec2 q = vec2(p.x - b.x + k, p.y - b.y + c - k);
return min(m, length(max(q, 0.0)));`
  },
  defaults: { width: 0.5, height: 0.4, chamfer: 0.1 },
  deterministic: true
};

// ============================================================================
// Per-Corner Radii Box
// ============================================================================

export const sdBoxPerCorner: SdfNodeDefinition = {
  id: 'box-per-corner',
  name: 'Box (Per-Corner)',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A rectangle with independent corner radii',
  tags: ['box', 'rectangle', 'rounded', 'corner', 'asymmetric'],
  parameters: [
    createFloatParam('width', 'Width', 0.5, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('topRight', 'Top Right', 0.1, 0.0, 0.5, { group: 'Corners' }),
    createFloatParam('bottomRight', 'Bottom Right', 0.05, 0.0, 0.5, { group: 'Corners' }),
    createFloatParam('topLeft', 'Top Left', 0.15, 0.0, 0.5, { group: 'Corners' }),
    createFloatParam('bottomLeft', 'Bottom Left', 0.0, 0.0, 0.5, { group: 'Corners' })
  ],
  modTargets: [
    createModTarget('width', 0.01, 2.0),
    createModTarget('height', 0.01, 2.0),
    createModTarget('topRight', 0.0, 0.5),
    createModTarget('bottomRight', 0.0, 0.5),
    createModTarget('topLeft', 0.0, 0.5),
    createModTarget('bottomLeft', 0.0, 0.5)
  ],
  glsl: {
    signature: 'float sdBoxPerCorner(vec2 p, vec2 b, vec4 r)',
    body: `// r.x = top right, r.y = bottom right, r.z = top left, r.w = bottom left
r.xy = (p.x > 0.0) ? r.xy : r.zw;
r.x = (p.y > 0.0) ? r.x : r.y;
vec2 q = abs(p) - b + r.x;
return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;`
  },
  defaults: { width: 0.5, height: 0.4, topRight: 0.1, bottomRight: 0.05, topLeft: 0.15, bottomLeft: 0.0 },
  deterministic: true
};

// ============================================================================
// Equilateral Triangle
// ============================================================================

export const sdEquilateralTriangle: SdfNodeDefinition = {
  id: 'triangle-equilateral',
  name: 'Equilateral Triangle',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'An equilateral triangle centered at origin',
  tags: ['triangle', 'equilateral', '3-sided'],
  parameters: [
    createFloatParam('size', 'Size', 0.5, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('size', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdEquilateralTriangle(vec2 p, float r)',
    body: `float k = 1.7320508; // sqrt(3)
p.x = abs(p.x) - r;
p.y = p.y + r / k;
if (p.x + k * p.y > 0.0) {
  p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
}
p.x -= clamp(p.x, -2.0 * r, 0.0);
return -length(p) * sign(p.y);`
  },
  defaults: { size: 0.5 },
  deterministic: true
};

// ============================================================================
// Isosceles Triangle
// ============================================================================

export const sdTriangleIsosceles: SdfNodeDefinition = {
  id: 'triangle-isosceles',
  name: 'Isosceles Triangle',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'An isosceles triangle with configurable base and height',
  tags: ['triangle', 'isosceles', '3-sided'],
  parameters: [
    createFloatParam('base', 'Base', 0.6, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('height', 'Height', 0.5, 0.01, 2.0, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('base', 0.01, 2.0),
    createModTarget('height', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdTriangleIsosceles(vec2 p, vec2 q)',
    body: `p.x = abs(p.x);
vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
float s = -sign(q.y);
vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)),
             vec2(dot(b, b), s * (p.y - q.y)));
return -sqrt(d.x) * sign(d.y);`
  },
  defaults: { base: 0.6, height: 0.5 },
  deterministic: true
};

// ============================================================================
// Regular Polygon (N-gon)
// ============================================================================

export const sdPolygon: SdfNodeDefinition = {
  id: 'polygon',
  name: 'Regular Polygon',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A regular polygon with N sides',
  tags: ['polygon', 'ngon', 'regular', 'pentagon', 'hexagon', 'octagon'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createIntParam('sides', 'Sides', 6, 3, 32, { group: 'Shape', modulatable: false })
  ],
  modTargets: [
    createModTarget('radius', 0.01, 2.0)
  ],
  glsl: {
    signature: 'float sdPolygon(vec2 p, float r, float n)',
    body: `float an = 3.14159265 / n;
float he = r * tan(an);
p = vec2(abs(p.x), p.y);
vec2 bn = vec2(sin(an), cos(an));
float d = dot(p, bn);
p -= bn * clamp(d, 0.0, he);
return length(p) * sign(p.y);`
  },
  defaults: { radius: 0.4, sides: 6 },
  deterministic: true
};

// ============================================================================
// Star
// ============================================================================

export const sdStar: SdfNodeDefinition = {
  id: 'star',
  name: 'Star',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'An N-pointed star shape',
  tags: ['star', 'pointed', 'sparkle'],
  parameters: [
    createFloatParam('outerRadius', 'Outer Radius', 0.45, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('innerRadius', 'Inner Radius', 0.2, 0.01, 1.0, { group: 'Shape' }),
    createIntParam('points', 'Points', 5, 3, 16, { group: 'Shape', modulatable: false })
  ],
  modTargets: [
    createModTarget('outerRadius', 0.01, 2.0),
    createModTarget('innerRadius', 0.01, 1.0)
  ],
  glsl: {
    signature: 'float sdStar(vec2 p, float r, float rf, float n)',
    body: `float an = 3.14159265 / n;
float en = 3.14159265 / (n * 2.0 - 2.0);
vec2 acs = vec2(cos(an), sin(an));
vec2 ecs = vec2(cos(en), sin(en));
float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
p = length(p) * vec2(cos(bn), abs(sin(bn)));
p -= r * acs;
p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
return length(p) * sign(p.x);`
  },
  defaults: { outerRadius: 0.45, innerRadius: 0.2, points: 5 },
  deterministic: true
};

// ============================================================================
// Arc
// ============================================================================

export const sdArc: SdfNodeDefinition = {
  id: 'arc',
  name: 'Arc',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A circular arc segment',
  tags: ['arc', 'curve', 'partial', 'circle'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('thickness', 'Thickness', 0.05, 0.001, 0.3, { group: 'Shape' }),
    createAngleParam('aperture', 'Aperture', 1.57, { group: 'Shape', tooltip: 'Half-angle of the arc opening' })
  ],
  modTargets: [
    createModTarget('radius', 0.01, 2.0),
    createModTarget('thickness', 0.001, 0.3),
    createModTarget('aperture', 0, Math.PI)
  ],
  glsl: {
    signature: 'float sdArc(vec2 p, float ra, float rb, float ap)',
    body: `vec2 sc = vec2(sin(ap), cos(ap));
p.x = abs(p.x);
return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;`
  },
  defaults: { radius: 0.4, thickness: 0.05, aperture: 1.57 },
  deterministic: true
};

// ============================================================================
// Pie / Sector
// ============================================================================

export const sdPie: SdfNodeDefinition = {
  id: 'pie',
  name: 'Pie / Sector',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A pie slice / sector of a circle',
  tags: ['pie', 'sector', 'slice', 'wedge'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createAngleParam('aperture', 'Aperture', 0.785, { group: 'Shape', tooltip: 'Half-angle of the pie slice' })
  ],
  modTargets: [
    createModTarget('radius', 0.01, 2.0),
    createModTarget('aperture', 0, Math.PI)
  ],
  glsl: {
    signature: 'float sdPie(vec2 p, float r, float ap)',
    body: `vec2 c = vec2(sin(ap), cos(ap));
p.x = abs(p.x);
float l = length(p) - r;
float m = length(p - c * clamp(dot(p, c), 0.0, r));
return max(l, m * sign(c.y * p.x - c.x * p.y));`
  },
  defaults: { radius: 0.4, aperture: 0.785 },
  deterministic: true
};

// ============================================================================
// Cross / Plus
// ============================================================================

export const sdCross: SdfNodeDefinition = {
  id: 'cross',
  name: 'Cross / Plus',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A cross (plus) shape',
  tags: ['cross', 'plus', '+'],
  parameters: [
    createFloatParam('length', 'Length', 0.5, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('thickness', 'Thickness', 0.15, 0.01, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('length', 0.01, 2.0),
    createModTarget('thickness', 0.01, 0.5)
  ],
  glsl: {
    signature: 'float sdCross(vec2 p, vec2 b)',
    body: `p = abs(p);
p = (p.y > p.x) ? p.yx : p;
vec2 q = p - b;
float k = max(q.y, q.x);
vec2 w = (k > 0.0) ? q : vec2(b.y - p.x, -k);
return sign(k) * length(max(w, 0.0));`
  },
  defaults: { length: 0.5, thickness: 0.15 },
  deterministic: true
};

// ============================================================================
// X Shape
// ============================================================================

export const sdX: SdfNodeDefinition = {
  id: 'x-shape',
  name: 'X Shape',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'An X shape (rotated cross)',
  tags: ['x', 'cross', 'diagonal'],
  parameters: [
    createFloatParam('size', 'Size', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('thickness', 'Thickness', 0.1, 0.01, 0.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('size', 0.01, 2.0),
    createModTarget('thickness', 0.01, 0.5)
  ],
  glsl: {
    signature: 'float sdX(vec2 p, float size, float thickness)',
    body: `p = abs(p);
float d1 = abs(p.x - p.y) / 1.41421356;
float d2 = max(p.x, p.y);
return max(d1 - thickness, d2 - size);`,
    requires: ['rotate2d']
  },
  defaults: { size: 0.4, thickness: 0.1 },
  deterministic: true
};

// ============================================================================
// Crescent / Moon
// ============================================================================

export const sdCrescent: SdfNodeDefinition = {
  id: 'crescent',
  name: 'Crescent / Moon',
  version: '1.0.0',
  category: 'shapes2d',
  coordSpace: '2d',
  gpuCostTier: 'LOW',
  description: 'A crescent moon shape (difference of two circles)',
  tags: ['crescent', 'moon', 'subtract'],
  parameters: [
    createFloatParam('radius', 'Radius', 0.4, 0.01, 2.0, { group: 'Shape' }),
    createFloatParam('offset', 'Offset', 0.2, 0.0, 1.0, { group: 'Shape', tooltip: 'Inner circle offset' }),
    createFloatParam('innerScale', 'Inner Scale', 0.9, 0.5, 1.5, { group: 'Shape' })
  ],
  modTargets: [
    createModTarget('radius', 0.01, 2.0),
    createModTarget('offset', 0.0, 1.0),
    createModTarget('innerScale', 0.5, 1.5)
  ],
  glsl: {
    signature: 'float sdCrescent(vec2 p, float r, float offset, float innerScale)',
    body: `float outer = length(p) - r;
float inner = length(p - vec2(offset, 0.0)) - r * innerScale;
return max(outer, -inner);`
  },
  defaults: { radius: 0.4, offset: 0.2, innerScale: 0.9 },
  deterministic: true
};

// ============================================================================
// All 2D Primitives Export
// ============================================================================

export const shapes2dPrimitives: SdfNodeDefinition[] = [
  sdCircle,
  sdRing,
  sdEllipse,
  sdSegment,
  sdCapsule,
  sdBox,
  sdRoundedBox,
  sdChamferedBox,
  sdBoxPerCorner,
  sdEquilateralTriangle,
  sdTriangleIsosceles,
  sdPolygon,
  sdStar,
  sdArc,
  sdPie,
  sdCross,
  sdX,
  sdCrescent
];
