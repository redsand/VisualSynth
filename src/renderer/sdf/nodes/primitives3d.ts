import { defineNode } from '../registry';

// ============================================================================
// 3D Primitives
// ============================================================================

export const sphere = defineNode()
  .id('sphere')
  .name('Sphere')
  .category('shapes3d')
  .coordSpace('3d')
  .costTier('LOW')
  .description('A simple sphere')
  .param('radius', 'Radius', 'float', 0.5, { min: 0, max: 2 })
  .modTarget('radius')
  .glsl(
    'float sdSphere(vec3 p, float s)',
    'return length(p) - s;'
  )
  .register();

export const box3d = defineNode()
  .id('box3d')
  .name('Box')
  .category('shapes3d')
  .coordSpace('3d')
  .costTier('LOW')
  .description('A 3D box')
  .param('size', 'Size', 'vec3', [0.5, 0.5, 0.5], { min: 0, max: 2 })
  .modTarget('size')
  .glsl(
    'float sdBox3D(vec3 p, vec3 b)',
    'vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);'
  )
  .register();

export const torus = defineNode()
  .id('torus')
  .name('Torus')
  .category('shapes3d')
  .coordSpace('3d')
  .costTier('LOW')
  .description('A doughnut shape')
  .param('size', 'Size', 'vec2', [0.5, 0.2], { min: 0, max: 2, tooltip: 'x: radius, y: thickness' })
  .modTarget('size')
  .glsl(
    'float sdTorus(vec3 p, vec2 t)',
    'vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y;'
  )
  .register();

export const cylinder = defineNode()
  .id('cylinder')
  .name('Cylinder')
  .category('shapes3d')
  .coordSpace('3d')
  .costTier('LOW')
  .description('Capped cylinder')
  .param('h', 'Height', 'float', 0.5, { min: 0, max: 2 })
  .param('r', 'Radius', 'float', 0.25, { min: 0, max: 2 })
  .modTarget('h')
  .modTarget('r')
  .glsl(
    'float sdCappedCylinder(vec3 p, float h, float r)',
    'vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));'
  )
  .register();
