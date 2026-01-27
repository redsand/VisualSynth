import { defineNode } from '../registry';

export const translate = defineNode()
  .id('translate')
  .name('Translate')
  .category('domain')
  .coordSpace('both')
  .costTier('LOW')
  .description('Move space')
  .param('offset', 'Offset', 'vec3', [0, 0, 0], { min: -5, max: 5 })
  .modTarget('offset')
  .glsl(
    'vec3 opTranslate(vec3 p, vec3 offset)',
    'return p - offset;'
  )
  .register();

export const rotate2d = defineNode()
  .id('rotate2d')
  .name('Rotate')
  .category('domain')
  .coordSpace('2d')
  .costTier('LOW')
  .description('Rotate 2D space')
  .param('angle', 'Angle', 'angle', 0)
  .modTarget('angle', 0, 6.28)
  .glsl(
    'vec2 opRotate2d(vec2 p, float angle)',
    'float c = cos(angle); float s = sin(angle); return vec2(c*p.x - s*p.y, s*p.x + c*p.y);'
  )
  .register();

export const rotate3d = defineNode()
  .id('rotate3d')
  .name('Rotate 3D')
  .category('domain')
  .coordSpace('3d')
  .costTier('LOW')
  .description('Rotate 3D space')
  .param('angles', 'Angles', 'vec3', [0, 0, 0], { min: 0, max: 6.28 })
  .modTarget('angles')
  .glsl(
    'vec3 opRotate3d(vec3 p, vec3 ang)',
    `vec3 c = cos(ang); vec3 s = sin(ang);
     mat3 rx = mat3(1, 0, 0, 0, c.x, -s.x, 0, s.x, c.x);
     mat3 ry = mat3(c.y, 0, s.y, 0, 1, 0, -s.y, 0, c.y);
     mat3 rz = mat3(c.z, -s.z, 0, s.z, c.z, 0, 0, 0, 1);
     return rz * ry * rx * p;`
  )
  .register();

export const repeat = defineNode()
  .id('repeat')
  .name('Repeat (Grid)')
  .category('domain')
  .coordSpace('both')
  .costTier('LOW')
  .description('Infinite grid repetition')
  .param('period', 'Spacing', 'vec3', [2, 2, 2], { min: 0.1, max: 10 })
  .modTarget('period')
  .glsl(
    'vec3 opRepeat(vec3 p, vec3 c)',
    'return mod(p + 0.5 * c, c) - 0.5 * c;'
  )
  .register();

export const mirror = defineNode()
  .id('mirror')
  .name('Mirror')
  .category('domain')
  .coordSpace('both')
  .costTier('LOW')
  .description('Mirror across axis')
  .param('axis', 'Axis (XYZ)', 'vec3', [1, 0, 0], { min: 0, max: 1 })
  .glsl(
    'vec3 opMirror(vec3 p, vec3 axis)',
    'return p - 2.0 * min(0.0, dot(p, axis)) * axis;'
  )
  .register();
