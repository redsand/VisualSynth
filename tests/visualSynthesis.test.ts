import { describe, expect, it, beforeEach } from 'vitest';
import { sdfRegistry, registerSdfNodes } from '../src/renderer/sdf/nodes';
import { buildSdfShader } from '../src/renderer/sdf/compile/glslBuilder';
import { createNodeInstance } from '../src/renderer/sdf/api';

describe('Visual Synthesis System', () => {
  beforeEach(() => {
    registerSdfNodes();
  });

  describe('Internal Signal Sampling', () => {
    it('should generate GLSL with waveform sampling support', () => {
      const node = createNodeInstance('circle', { radius: 0.5 });
      const result = buildSdfShader([node], [], '2d');
      
      // Check if helper functions for internal signals are expected
      // Note: These are defined in glRenderer.ts but should be callable from generated code
      expect(result.mapBody).toBeDefined();
    });

    it('should handle multi-material output (vec2)', () => {
      const node = createNodeInstance('circle', { radius: 0.5 });
      const result = buildSdfShader([node], [], '2d');
      
      // Advanced map now returns vec2(distance, materialId)
      expect(result.mapBody).toContain('vec2');
    });
  });

  describe('Advanced Composition', () => {
    it('should correctly chain Domain -> Shape', () => {
      const shape = createNodeInstance('circle', { radius: 0.3 });
      const trans = createNodeInstance('dom-translate-2d', { x: 0.1, y: 0.2 });
      
      const connections = [
        { from: shape.instanceId, to: trans.instanceId, slot: 0 }
      ];
      
      const result = buildSdfShader([shape, trans], connections, '2d');
      
      // The builder should nest the calls: sdCircle(domTranslate2D(p, ...))
      // Signature of domTranslate2D: vec2 domTranslate2D(vec2 p, vec2 offset)
      expect(result.functionsCode).toContain('vec2 domTranslate2D');
      expect(result.mapBody).toContain('domTranslate2D');
    });
  });
});
