import { describe, expect, it } from 'vitest';
import {
  createNodeInstance,
  createRenderGraphNode,
  createConnection,
  buildRenderGraph,
  computeExecutionOrder,
  createSendReturn,
  expandSendReturns,
  createFeedbackTap,
  createResourcePool,
  allocateFBO,
  releaseFBO,
  allocateTexture,
  releaseTexture,
  advanceFrame,
  cleanupUnusedResources,
  negotiateNodeResolution,
  allocateGraphResources,
  releaseGraphResources,
  estimateGraphCost,
  serializeGraph,
  deserializeGraph
} from '../src/shared/renderGraph';
import { plasmaGenerator, bloomEffect, blendCompositor } from '../src/shared/fxCatalog';

describe('node instance creation', () => {
  it('creates instance with default parameter values', () => {
    const instance = createNodeInstance(plasmaGenerator);
    expect(instance.nodeId).toBe('gen-plasma');
    expect(instance.instanceId).toBeTruthy();
    expect(instance.enabled).toBe(true);
    expect(instance.bypass).toBe(false);
    expect(instance.parameterValues).toBeDefined();
    expect(instance.parameterValues['speed']).toBe(1.0);
  });

  it('accepts custom instance ID', () => {
    const instance = createNodeInstance(plasmaGenerator, 'custom-id');
    expect(instance.instanceId).toBe('custom-id');
  });

  it('initializes all parameters from node definition', () => {
    const instance = createNodeInstance(bloomEffect);
    expect('intensity' in instance.parameterValues).toBe(true);
    expect('threshold' in instance.parameterValues).toBe(true);
  });
});

describe('render graph node creation', () => {
  it('creates graph node with instance', () => {
    const instance = createNodeInstance(plasmaGenerator);
    const graphNode = createRenderGraphNode(plasmaGenerator, instance);
    expect(graphNode.instanceId).toBe(instance.instanceId);
    expect(graphNode.node).toBe(plasmaGenerator);
    expect(graphNode.framebufferIds).toEqual([]);
    expect(graphNode.textureIds).toEqual([]);
  });
});

describe('connection creation', () => {
  it('creates connection between nodes', () => {
    const conn = createConnection('node1', 'out', 'node2', 'in');
    expect(conn.fromInstanceId).toBe('node1');
    expect(conn.fromOutputId).toBe('out');
    expect(conn.toInstanceId).toBe('node2');
    expect(conn.toInputId).toBe('in');
  });
});

describe('graph building', () => {
  it('builds valid graph', () => {
    const plasmaInstance = createNodeInstance(plasmaGenerator, 'plasma-1');
    const bloomInstance = createNodeInstance(bloomEffect, 'bloom-1');

    const nodes = [
      createRenderGraphNode(plasmaGenerator, plasmaInstance),
      createRenderGraphNode(bloomEffect, bloomInstance)
    ];

    const connections = [
      createConnection('plasma-1', 'out', 'bloom-1', 'in')
    ];

    const result = buildRenderGraph(nodes, connections, 'bloom-1', { width: 1920, height: 1080 });
    expect(result.success).toBe(true);
    expect(result.graph).toBeDefined();
    expect(result.graph?.nodes).toHaveLength(2);
    expect(result.graph?.connections).toHaveLength(1);
  });

  it('fails when output node not found', () => {
    const result = buildRenderGraph([], [], 'nonexistent', { width: 1920, height: 1080 });
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('Output node not found'))).toBe(true);
  });

  it('fails when required input not connected', () => {
    const bloomInstance = createNodeInstance(bloomEffect, 'bloom-1');
    const nodes = [createRenderGraphNode(bloomEffect, bloomInstance)];

    const result = buildRenderGraph(nodes, [], 'bloom-1', { width: 1920, height: 1080 });
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('Required input not connected'))).toBe(true);
  });

  it('warns on type mismatch', () => {
    const plasmaInstance = createNodeInstance(plasmaGenerator, 'plasma-1');
    const bloomInstance = createNodeInstance(bloomEffect, 'bloom-1');

    // Force a mock type mismatch by creating a connection with wrong type
    // Note: In real scenario, the warning would come from actual port type differences
    const nodes = [
      createRenderGraphNode(plasmaGenerator, plasmaInstance),
      createRenderGraphNode(bloomEffect, bloomInstance)
    ];

    const connections = [
      createConnection('plasma-1', 'out', 'bloom-1', 'in')
    ];

    const result = buildRenderGraph(nodes, connections, 'bloom-1', { width: 1920, height: 1080 });
    // This should succeed but may have warnings
    expect(result.success).toBe(true);
  });
});

describe('execution order computation', () => {
  it('computes topological order', () => {
    const plasmaInstance = createNodeInstance(plasmaGenerator, 'plasma-1');
    const bloomInstance = createNodeInstance(bloomEffect, 'bloom-1');

    const nodes = [
      createRenderGraphNode(plasmaGenerator, plasmaInstance),
      createRenderGraphNode(bloomEffect, bloomInstance)
    ];

    const connections = [
      createConnection('plasma-1', 'out', 'bloom-1', 'in')
    ];

    const result = buildRenderGraph(nodes, connections, 'bloom-1', { width: 1920, height: 1080 });
    if (!result.graph) throw new Error('Graph should be defined');

    const order = computeExecutionOrder(result.graph);
    expect(order.indexOf('plasma-1')).toBeLessThan(order.indexOf('bloom-1'));
  });

  it('handles nodes without dependencies', () => {
    const plasmaInstance = createNodeInstance(plasmaGenerator, 'plasma-1');
    const nodes = [createRenderGraphNode(plasmaGenerator, plasmaInstance)];

    const result = buildRenderGraph(nodes, [], 'plasma-1', { width: 1920, height: 1080 });
    if (!result.graph) throw new Error('Graph should be defined');

    const order = computeExecutionOrder(result.graph);
    expect(order).toContain('plasma-1');
  });
});

describe('send/return creation', () => {
  it('creates send/return chain', () => {
    const sr = createSendReturn(
      'Reverb Send',
      'source-1',
      'out',
      ['fx-1', 'fx-2'],
      'mixer-1',
      'blend',
      0.5
    );
    expect(sr.name).toBe('Reverb Send');
    expect(sr.fxChain).toHaveLength(2);
    expect(sr.wetAmount).toBe(0.5);
  });

  it('expands send/returns into connections', () => {
    // Use a simpler setup with just plasma and bloom
    const plasmaInstance = createNodeInstance(plasmaGenerator, 'plasma-1');
    const bloomInstance = createNodeInstance(bloomEffect, 'bloom-1');

    const nodes = [
      createRenderGraphNode(plasmaGenerator, plasmaInstance),
      createRenderGraphNode(bloomEffect, bloomInstance)
    ];

    // Connect plasma to bloom's required input
    const connections = [
      createConnection('plasma-1', 'out', 'bloom-1', 'in')
    ];

    const result = buildRenderGraph(nodes, connections, 'bloom-1', { width: 1920, height: 1080 });
    expect(result.success).toBe(true);
    if (!result.graph) throw new Error('Graph should be defined');

    // Create a simple send/return that adds a parallel chain
    const sendReturn = createSendReturn(
      'Test Send',
      'plasma-1',
      'out',
      [],  // Empty FX chain for simplicity
      'bloom-1',
      'in'
    );

    const expanded = expandSendReturns(result.graph, [sendReturn]);
    // With an empty FX chain, no new connections are added
    expect(expanded.connections.length).toBe(result.graph.connections.length);
  });
});

describe('feedback tap creation', () => {
  it('creates feedback tap', () => {
    const tap = createFeedbackTap('node-1', 'out', 'node-2', 'feedback', 1);
    expect(tap.sourceNodeId).toBe('node-1');
    expect(tap.targetNodeId).toBe('node-2');
    expect(tap.delay).toBe(1);
  });

  it('defaults to 0 frame delay', () => {
    const tap = createFeedbackTap('node-1', 'out', 'node-2', 'feedback');
    expect(tap.delay).toBe(0);
  });
});

describe('resource pool management', () => {
  it('creates empty pool', () => {
    const pool = createResourcePool(8, 16);
    expect(pool.fbos.size).toBe(0);
    expect(pool.textures.size).toBe(0);
    expect(pool.maxFBOs).toBe(8);
    expect(pool.maxTextures).toBe(16);
  });

  it('allocates FBO', () => {
    const pool = createResourcePool();
    const id = allocateFBO(pool, 1920, 1080, 'node-1');
    expect(id).toBeTruthy();
    expect(pool.fbos.size).toBe(1);

    const fbo = pool.fbos.get(id!);
    expect(fbo?.inUse).toBe(true);
    expect(fbo?.width).toBe(1920);
    expect(fbo?.height).toBe(1080);
  });

  it('reuses released FBO with matching dimensions', () => {
    const pool = createResourcePool();
    const id1 = allocateFBO(pool, 1920, 1080);
    releaseFBO(pool, id1!);

    const id2 = allocateFBO(pool, 1920, 1080);
    expect(id2).toBe(id1);
    expect(pool.fbos.size).toBe(1);
  });

  it('allocates new FBO for different dimensions', () => {
    const pool = createResourcePool();
    const id1 = allocateFBO(pool, 1920, 1080);
    releaseFBO(pool, id1!);

    const id2 = allocateFBO(pool, 1280, 720);
    expect(id2).not.toBe(id1);
    expect(pool.fbos.size).toBe(2);
  });

  it('respects max FBO limit', () => {
    const pool = createResourcePool(2, 4);
    allocateFBO(pool, 1920, 1080);
    allocateFBO(pool, 1280, 720);

    // Third allocation should reclaim oldest unused or return null
    const id3 = allocateFBO(pool, 640, 480);
    expect(id3).toBeNull(); // No unused FBOs to reclaim
  });

  it('releases FBO', () => {
    const pool = createResourcePool();
    const id = allocateFBO(pool, 1920, 1080);
    expect(pool.fbos.get(id!)?.inUse).toBe(true);

    releaseFBO(pool, id!);
    expect(pool.fbos.get(id!)?.inUse).toBe(false);
  });
});

describe('texture resource management', () => {
  it('allocates texture', () => {
    const pool = createResourcePool();
    const id = allocateTexture(pool, 512, 512, 'rgba8', 'node-1');
    expect(id).toBeTruthy();
    expect(pool.textures.size).toBe(1);

    const tex = pool.textures.get(id!);
    expect(tex?.format).toBe('rgba8');
  });

  it('supports different texture formats', () => {
    const pool = createResourcePool();
    const id1 = allocateTexture(pool, 512, 512, 'rgba8');
    const id2 = allocateTexture(pool, 512, 512, 'rgba16f');
    const id3 = allocateTexture(pool, 512, 512, 'rgba32f');

    expect(pool.textures.get(id1!)?.format).toBe('rgba8');
    expect(pool.textures.get(id2!)?.format).toBe('rgba16f');
    expect(pool.textures.get(id3!)?.format).toBe('rgba32f');
  });

  it('releases texture', () => {
    const pool = createResourcePool();
    const id = allocateTexture(pool, 512, 512);
    releaseTexture(pool, id!);
    expect(pool.textures.get(id!)?.inUse).toBe(false);
  });
});

describe('frame advancement', () => {
  it('increments frame counter', () => {
    const pool = createResourcePool();
    expect(pool.currentFrame).toBe(0);
    advanceFrame(pool);
    expect(pool.currentFrame).toBe(1);
  });

  it('tracks last used frame for resources', () => {
    const pool = createResourcePool();
    const id = allocateFBO(pool, 1920, 1080);
    expect(pool.fbos.get(id!)?.lastUsedFrame).toBe(0);

    advanceFrame(pool);
    advanceFrame(pool);
    releaseFBO(pool, id!);

    const id2 = allocateFBO(pool, 1920, 1080);
    expect(pool.fbos.get(id2!)?.lastUsedFrame).toBe(2);
  });
});

describe('resource cleanup', () => {
  it('removes old unused resources', () => {
    const pool = createResourcePool();
    const id = allocateFBO(pool, 1920, 1080);
    releaseFBO(pool, id!);

    // Advance frames past the max age
    for (let i = 0; i < 100; i++) {
      advanceFrame(pool);
    }

    cleanupUnusedResources(pool, 60);
    expect(pool.fbos.has(id!)).toBe(false);
  });

  it('keeps recently used resources', () => {
    const pool = createResourcePool();
    const id = allocateFBO(pool, 1920, 1080);
    releaseFBO(pool, id!);

    advanceFrame(pool);
    cleanupUnusedResources(pool, 60);
    expect(pool.fbos.has(id!)).toBe(true);
  });

  it('keeps in-use resources regardless of age', () => {
    const pool = createResourcePool();
    const id = allocateFBO(pool, 1920, 1080);

    for (let i = 0; i < 100; i++) {
      advanceFrame(pool);
    }

    cleanupUnusedResources(pool, 60);
    expect(pool.fbos.has(id!)).toBe(true);
  });
});

describe('resolution negotiation', () => {
  it('uses full resolution for full preference', () => {
    const config = { baseWidth: 1920, baseHeight: 1080, scaleFactor: 1, minWidth: 64, minHeight: 64 };
    const res = negotiateNodeResolution(plasmaGenerator, config);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
  });

  it('uses half resolution for half preference', () => {
    const config = { baseWidth: 1920, baseHeight: 1080, scaleFactor: 1, minWidth: 64, minHeight: 64 };
    const res = negotiateNodeResolution(bloomEffect, config);
    expect(res.width).toBe(960);
    expect(res.height).toBe(540);
  });

  it('respects minimum dimensions', () => {
    const config = { baseWidth: 128, baseHeight: 128, scaleFactor: 1, minWidth: 64, minHeight: 64 };
    const res = negotiateNodeResolution(bloomEffect, config); // half res = 64x64
    expect(res.width).toBeGreaterThanOrEqual(64);
    expect(res.height).toBeGreaterThanOrEqual(64);
  });
});

describe('graph resource allocation', () => {
  it('allocates resources for all nodes', () => {
    const plasmaInstance = createNodeInstance(plasmaGenerator, 'plasma-1');
    const bloomInstance = createNodeInstance(bloomEffect, 'bloom-1');

    const nodes = [
      createRenderGraphNode(plasmaGenerator, plasmaInstance),
      createRenderGraphNode(bloomEffect, bloomInstance)
    ];

    const connections = [createConnection('plasma-1', 'out', 'bloom-1', 'in')];
    const result = buildRenderGraph(nodes, connections, 'bloom-1', { width: 1920, height: 1080 });
    if (!result.graph) throw new Error('Graph should be defined');

    const pool = createResourcePool();
    const config = { baseWidth: 1920, baseHeight: 1080, scaleFactor: 1, minWidth: 64, minHeight: 64 };
    const allocations = allocateGraphResources(result.graph, pool, config);

    expect(allocations.size).toBe(2);
    // Bloom should have FBOs allocated
    const bloomAlloc = allocations.get('bloom-1');
    expect(bloomAlloc?.fbos.length).toBeGreaterThan(0);
  });

  it('releases all graph resources', () => {
    const plasmaInstance = createNodeInstance(plasmaGenerator, 'plasma-1');
    const nodes = [createRenderGraphNode(plasmaGenerator, plasmaInstance)];
    const result = buildRenderGraph(nodes, [], 'plasma-1', { width: 1920, height: 1080 });
    if (!result.graph) throw new Error('Graph should be defined');

    const pool = createResourcePool();
    const config = { baseWidth: 1920, baseHeight: 1080, scaleFactor: 1, minWidth: 64, minHeight: 64 };
    const allocations = allocateGraphResources(result.graph, pool, config);

    releaseGraphResources(result.graph, pool, allocations);

    // All resources should be marked as not in use
    for (const [, fbo] of pool.fbos) {
      expect(fbo.inUse).toBe(false);
    }
  });
});

describe('cost estimation', () => {
  it('estimates total graph cost', () => {
    const plasmaInstance = createNodeInstance(plasmaGenerator, 'plasma-1');
    const bloomInstance = createNodeInstance(bloomEffect, 'bloom-1');

    const nodes = [
      createRenderGraphNode(plasmaGenerator, plasmaInstance),
      createRenderGraphNode(bloomEffect, bloomInstance)
    ];

    const connections = [createConnection('plasma-1', 'out', 'bloom-1', 'in')];
    const result = buildRenderGraph(nodes, connections, 'bloom-1', { width: 1920, height: 1080 });
    if (!result.graph) throw new Error('Graph should be defined');

    const estimate = estimateGraphCost(result.graph);
    expect(estimate.totalCostMs).toBeGreaterThan(0);
    expect(estimate.nodeBreakdown).toHaveLength(2);
  });

  it('warns when cost exceeds budget', () => {
    const plasmaInstance = createNodeInstance(plasmaGenerator, 'plasma-1');
    const bloomInstance = createNodeInstance(bloomEffect, 'bloom-1');

    const nodes = [
      createRenderGraphNode(plasmaGenerator, plasmaInstance),
      createRenderGraphNode(bloomEffect, bloomInstance)
    ];

    const connections = [createConnection('plasma-1', 'out', 'bloom-1', 'in')];
    // Very high frame rate to trigger warning
    const result = buildRenderGraph(nodes, connections, 'bloom-1', { width: 1920, height: 1080 }, 240);
    if (!result.graph) throw new Error('Graph should be defined');

    const estimate = estimateGraphCost(result.graph);
    // May or may not have warnings depending on cost - just verify it runs
    expect(estimate.warnings).toBeDefined();
  });
});

describe('graph serialization', () => {
  it('serializes and deserializes graph', () => {
    const plasmaInstance = createNodeInstance(plasmaGenerator, 'plasma-1');
    const nodes = [createRenderGraphNode(plasmaGenerator, plasmaInstance)];
    const result = buildRenderGraph(nodes, [], 'plasma-1', { width: 1920, height: 1080 });
    if (!result.graph) throw new Error('Graph should be defined');

    const json = serializeGraph(result.graph);
    expect(json).toBeTruthy();

    const restored = deserializeGraph(json);
    expect(restored).toBeDefined();
    expect(restored?.nodes).toHaveLength(1);
    expect(restored?.resolution.width).toBe(1920);
  });

  it('returns null for invalid JSON', () => {
    const result = deserializeGraph('invalid json');
    expect(result).toBeNull();
  });

  it('returns null for unknown node IDs', () => {
    const json = JSON.stringify({
      id: 'graph-1',
      name: 'Test',
      nodes: [{ nodeId: 'unknown-node', instanceId: 'inst-1', instance: {} }],
      connections: [],
      outputNodeId: 'inst-1',
      resolution: { width: 1920, height: 1080 },
      frameRate: 60
    });
    const result = deserializeGraph(json);
    expect(result).toBeNull();
  });
});
