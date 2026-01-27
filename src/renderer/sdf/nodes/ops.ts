import { defineNode } from '../registry';

// ============================================================================
// Boolean Operations
// ============================================================================

export const union = defineNode()
  .id('union')
  .name('Union')
  .category('ops')
  .coordSpace('both')
  .costTier('LOW')
  .description('Combine two shapes (A + B)')
  .glsl(
    'float opUnion(float d1, float d2)',
    'return min(d1, d2);'
  )
  .register();

export const subtract = defineNode()
  .id('subtract')
  .name('Subtract')
  .category('ops')
  .coordSpace('both')
  .costTier('LOW')
  .description('Subtract shape B from A')
  .glsl(
    'float opSubtract(float d1, float d2)',
    'return max(d1, -d2);'
  )
  .register();

export const intersect = defineNode()
  .id('intersect')
  .name('Intersect')
  .category('ops')
  .coordSpace('both')
  .costTier('LOW')
  .description('Intersection of A and B')
  .glsl(
    'float opIntersect(float d1, float d2)',
    'return max(d1, d2);'
  )
  .register();

export const smoothUnion = defineNode()
  .id('smooth-union')
  .name('Smooth Union')
  .category('ops-smooth')
  .coordSpace('both')
  .costTier('LOW')
  .description('Smoothly combine two shapes')
  .param('k', 'Smoothness', 'float', 0.1, { min: 0.01, max: 1.0 })
  .modTarget('k')
  .glsl(
    'float opSmoothUnion(float d1, float d2, float k)',
    `float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
     return mix(d2, d1, h) - k * h * (1.0 - h);`
  )
  .register();

export const smoothSubtract = defineNode()
  .id('smooth-subtract')
  .name('Smooth Subtract')
  .category('ops-smooth')
  .coordSpace('both')
  .costTier('LOW')
  .description('Smoothly subtract B from A')
  .param('k', 'Smoothness', 'float', 0.1, { min: 0.01, max: 1.0 })
  .modTarget('k')
  .glsl(
    'float opSmoothSubtract(float d1, float d2, float k)',
    `float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
     return mix(d1, -d2, h) + k * h * (1.0 - h);`
  )
  .register();

export const smoothIntersect = defineNode()
  .id('smooth-intersect')
  .name('Smooth Intersect')
  .category('ops-smooth')
  .coordSpace('both')
  .costTier('LOW')
  .description('Smoothly intersect A and B')
  .param('k', 'Smoothness', 'float', 0.1, { min: 0.01, max: 1.0 })
  .modTarget('k')
  .glsl(
    'float opSmoothIntersect(float d1, float d2, float k)',
    `float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
     return mix(d2, d1, h) + k * h * (1.0 - h);`
  )
  .register();
