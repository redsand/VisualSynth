import { defineNode } from '../registry';

// ============================================================================
// 2D Primitives
// ============================================================================

export const circle = defineNode()
  .id('circle')
  .name('Circle')
  .category('shapes2d')
  .coordSpace('2d')
  .costTier('LOW')
  .description('A simple circle/disk primitive')
  .param('radius', 'Radius', 'float', 0.5, { min: 0, max: 2, group: 'Dimensions' })
  .modTarget('radius')
  .glsl(
    'float sdCircle(vec2 p, float r)',
    'return length(p) - r;'
  )
  .register();

export const rect = defineNode()
  .id('rect')
  .name('Rectangle')
  .category('shapes2d')
  .coordSpace('2d')
  .costTier('LOW')
  .description('A box/rectangle with width and height')
  .param('size', 'Size', 'vec2', [0.5, 0.3], { min: 0, max: 2, group: 'Dimensions' })
  .modTarget('size')
  .glsl(
    'float sdBox(vec2 p, vec2 b)',
    'vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);'
  )
  .register();

export const segment = defineNode()
  .id('segment')
  .name('Line Segment')
  .category('shapes2d')
  .coordSpace('2d')
  .costTier('LOW')
  .description('A line segment with rounded caps (capsule)')
  .param('a', 'Point A', 'vec2', [-0.4, -0.4], { min: -1, max: 1, group: 'Points' })
  .param('b', 'Point B', 'vec2', [0.4, 0.4], { min: -1, max: 1, group: 'Points' })
  .param('thickness', 'Thickness', 'float', 0.05, { min: 0, max: 0.5, group: 'Dimensions' })
  .modTarget('thickness')
  .glsl(
    'float sdSegment(vec2 p, vec2 a, vec2 b, float th)',
    'vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - th;'
  )
  .register();

export const hexagon = defineNode()
  .id('hexagon')
  .name('Hexagon')
  .category('shapes2d')
  .coordSpace('2d')
  .costTier('LOW')
  .description('A regular hexagon')
  .param('radius', 'Radius', 'float', 0.4, { min: 0, max: 2 })
  .modTarget('radius')
  .glsl(
    'float sdHexagon(vec2 p, float r)',
    `const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
     p = abs(p);
     p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
     p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
     return length(p) * sign(p.y);`
  )
  .register();

export const triangle = defineNode()
  .id('triangle')
  .name('Triangle')
  .category('shapes2d')
  .coordSpace('2d')
  .costTier('LOW')
  .description('Equilateral triangle')
  .param('radius', 'Radius', 'float', 0.5, { min: 0, max: 2 })
  .modTarget('radius')
  .glsl(
    'float sdTriangle(vec2 p, float r)',
    `const float k = sqrt(3.0);
     p.x = abs(p.x) - r;
     p.y = p.y + r / k;
     if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
     p.x -= clamp(p.x, -2.0 * r, 0.0);
     return -length(p) * sign(p.y);`
  )
  .register();

export const star = defineNode()
  .id('star')
  .name('Star')
  .category('shapes2d')
  .coordSpace('2d')
  .costTier('MED')
  .description('N-pointed star')
  .param('radius', 'Radius', 'float', 0.5, { min: 0.1, max: 2 })
  .param('ratio', 'Ratio', 'float', 0.5, { min: 0.1, max: 1 })
  .param('points', 'Points', 'int', 5, { min: 3, max: 12 })
  .modTarget('radius')
  .modTarget('ratio')
  .glsl(
    'float sdStar(vec2 p, float r, int n, float m)',
    `// m is the inner/outer radius ratio in (0,1]: m=1 -> regular n-gon,
     // m->0 -> spikiest star. Map to iq's shape parameter mi in [1,n]
     // (mi=1 polygon, mi=n spikiest) so the ratio slider is monotonic.
     float mi = 1.0 + (1.0 - m) * (float(n) - 1.0);
     float an = 3.141593 / float(n);
     float en = 3.141593 / mi;
     vec2  acs = vec2(cos(an), sin(an));
     vec2  ecs = vec2(cos(en), sin(en));
     // reduce to the first sector
     float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
     p = length(p) * vec2(cos(bn), abs(sin(bn)));
     // line equation (outer vertex -> inner vertex)
     p -= r * acs;
     p += ecs * clamp(-dot(p, ecs) / dot(ecs, ecs), 0.0, r * acs.y / max(ecs.y, 1e-6));
     return length(p) * sign(p.x);`
  )
  .register();
