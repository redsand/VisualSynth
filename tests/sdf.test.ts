import { describe, expect, it, beforeEach } from 'vitest';
import { sdfRegistry, registerSdfNodes } from '../src/renderer/sdf/nodes';
import { buildSdfShader } from '../src/renderer/sdf/compile/glslBuilder';
import { createNodeInstance } from '../src/renderer/sdf/api';

describe('SDF System', () => {
  beforeEach(() => {
    registerSdfNodes();
  });

  describe('Registry', () => {
    it('should have nodes registered', () => {
      const nodes = sdfRegistry.getAll();
      expect(nodes.length).toBeGreaterThan(0);
    });

    it('should retrieve a node by ID', () => {
      const node = sdfRegistry.get('circle');
      expect(node).toBeDefined();
      expect(node?.id).toBe('circle');
    });

    it('should filter nodes by category', () => {
      const shapes = sdfRegistry.getByCategory('shapes2d');
      expect(shapes.length).toBeGreaterThan(0);
      expect(shapes.every(n => n.category === 'shapes2d')).toBe(true);
    });
  });

  describe('GLSL Builder', () => {
    it('should build a simple shader for a single node', () => {
      const node = createNodeInstance('circle', { radius: 0.5 });
      const result = buildSdfShader([node], [], '2d');
      
      expect(result.functionsCode).toContain('float sdCircle');
      expect(result.mapBody).toContain('sdCircle');
      expect(result.uniforms.some(u => u.parameterId === 'radius')).toBe(true);
    });

    it('should handle nested connections (Domain Transform -> Shape)', () => {
      const shape = createNodeInstance('circle', { radius: 0.3 });
      const trans = createNodeInstance('dom-translate-2d', { x: 0.1, y: 0.2 });
      
      const connections = [
        { from: shape.instanceId, to: trans.instanceId, slot: 0 }
      ];
      
      const result = buildSdfShader([shape, trans], connections, '2d');
      
      expect(result.mapBody).toContain('domTranslate2D');
      expect(result.mapBody).toContain('sdCircle');
      // The builder should nest the calls: sdCircle(domTranslate2D(p, ...))
    });

    it('should handle boolean operations (Shape + Shape -> Union)', () => {
      const s1 = createNodeInstance('circle', { radius: 0.2 });
      const s2 = createNodeInstance('box', { size: [0.2, 0.2] });
      const op = createNodeInstance('op-union', {});
      
      const connections = [
        { from: s1.instanceId, to: op.instanceId, slot: 0 },
        { from: s2.instanceId, to: op.instanceId, slot: 1 }
      ];
      
      const result = buildSdfShader([s1, s2, op], connections, '2d');
      
      expect(result.mapBody).toContain('opUnion');
      expect(result.functionsCode).toContain('vec2 opUnion(vec2 d1, vec2 d2)');
    });

    it('should support per-node colors and material IDs', () => {
      const s1 = createNodeInstance('circle', { radius: 0.5 });
      s1.color = [1, 0, 0]; // Red
      
      const result = buildSdfShader([s1], [], '2d');
      
      expect(result.functionsCode).toContain('getSdfColor');
      expect(result.uniforms.some(u => u.parameterId === 'color')).toBe(true);
      expect(result.mapBody).toContain('vec2'); // Should return vec2(dist, id)
    });
  });
});
