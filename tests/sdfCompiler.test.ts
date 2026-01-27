
import { describe, it, expect, beforeEach } from 'vitest';
import { buildSdfShader } from '../src/renderer/sdf/compile/glslBuilder';
import { registerSdfNodes } from '../src/renderer/sdf/nodes';
import { SdfNodeInstance, SdfConnection } from '../src/renderer/sdf/api';

describe('SDF Shader Compiler', () => {
  beforeEach(() => {
    // Ensure nodes are registered
    registerSdfNodes();
  });

  it('should compile a simple circle', () => {
    const nodes: SdfNodeInstance[] = [
      {
        instanceId: 'circle-1',
        nodeId: 'circle',
        params: { radius: 0.5 },
        enabled: true,
        order: 0
      }
    ];
    const connections: SdfConnection[] = [];
    
    const compiled = buildSdfShader(nodes, connections, '2d');
    
    expect(compiled.errors).toHaveLength(0);
    expect(compiled.functionsCode).toContain('float sdCircle');
    expect(compiled.mapBody).toContain('sdCircle');
    expect(compiled.uniforms).toContainEqual(expect.objectContaining({
      instanceId: 'circle-1',
      parameterId: 'radius'
    }));
  });

  it('should compile a union of two shapes', () => {
    const nodes: SdfNodeInstance[] = [
      {
        instanceId: 'c1',
        nodeId: 'circle',
        params: { radius: 0.3 },
        enabled: true,
        order: 0
      },
      {
        instanceId: 'c2',
        nodeId: 'circle',
        params: { radius: 0.4 },
        enabled: true,
        order: 1
      },
      {
        instanceId: 'u1',
        nodeId: 'union',
        params: {},
        enabled: true,
        order: 2
      }
    ];
    const connections: SdfConnection[] = [
      { from: 'c1', to: 'u1', slot: 0 },
      { from: 'c2', to: 'u1', slot: 1 }
    ];
    
    const compiled = buildSdfShader(nodes, connections, '2d');
    
    expect(compiled.errors).toHaveLength(0);
    expect(compiled.functionsCode).toContain('float opUnion');
    expect(compiled.mapBody).toContain('opUnion');
    // Root should call children
    expect(compiled.mapBody).toContain('sdCircle');
  });

  it('should handle domain transforms', () => {
     const nodes: SdfNodeInstance[] = [
      {
        instanceId: 'c1',
        nodeId: 'circle',
        params: { radius: 0.3 },
        enabled: true,
        order: 0
      },
      {
        instanceId: 't1',
        nodeId: 'translate',
        params: { offset: [0.5, 0, 0] },
        enabled: true,
        order: 1
      }
    ];
    const connections: SdfConnection[] = [
      { from: 'c1', to: 't1', slot: 0 }
    ];
    
    const compiled = buildSdfShader(nodes, connections, '2d');
    
    expect(compiled.errors).toHaveLength(0);
    expect(compiled.functionsCode).toContain('vec3 opTranslate');
    expect(compiled.mapBody).toContain('opTranslate');
  });
});
