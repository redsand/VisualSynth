import { describe, expect, it } from 'vitest';
import {
  createNodeInstance,
  resetInstanceIdCounter,
  setInstanceIdCounter,
  generateInstanceId,
  createSendReturn,
  createFeedbackTap,
  allocateFBO,
  allocateTexture,
  createResourcePool
} from '../src/shared/renderGraph';
import {
  createVisualNode,
  createFloatParameter,
  createInputPort,
  createOutputPort
} from '../src/shared/visualNode';

describe('renderGraph determinism', () => {
  it('instance IDs are deterministic when counter is reset', () => {
    // Reset counter and create two nodes - they should get sequential IDs
    resetInstanceIdCounter();
    const node1 = createVisualNode({
      id: 'test-node-1',
      name: 'Test Node 1',
      kind: 'generator',
      category: 'generative',
      outputs: [createOutputPort('out', 'Output', 'rgba')]
    });
    const instance1 = createNodeInstance(node1);
    expect(instance1.instanceId).toBe('test-node-1-0');

    const instance2 = createNodeInstance(node1);
    expect(instance2.instanceId).toBe('test-node-1-1');
  });

  it('resetInstanceIdCounter allows reproducible instance IDs across runs', () => {
    resetInstanceIdCounter();
    const node = createVisualNode({
      id: 'test-node',
      name: 'Test Node',
      kind: 'generator',
      category: 'generative',
      outputs: [createOutputPort('out', 'Output', 'rgba')]
    });

    const instanceId1 = createNodeInstance(node).instanceId;

    // Simulate reinitialization - reset counter should produce same ID
    resetInstanceIdCounter();
    const instanceId2 = createNodeInstance(node).instanceId;

    expect(instanceId1).toBe(instanceId2);
  });

  it('setInstanceIdCounter allows fine-grained control', () => {
    setInstanceIdCounter(100);
    const node = createVisualNode({
      id: 'test-node',
      name: 'Test Node',
      kind: 'generator',
      category: 'generative',
      outputs: [createOutputPort('out', 'Output', 'rgba')]
    });

    const instance1 = createNodeInstance(node);
    expect(instance1.instanceId).toBe('test-node-100');

    setInstanceIdCounter(200);
    const instance2 = createNodeInstance(node);
    expect(instance2.instanceId).toBe('test-node-200');
  });

  it('generateInstanceId is deterministic with counter', () => {
    resetInstanceIdCounter();
    const id1 = generateInstanceId('node-a');

    resetInstanceIdCounter();
    const id2 = generateInstanceId('node-a');

    expect(id1).toBe(id2);
  });

  it('SendReturn IDs are deterministic', () => {
    resetInstanceIdCounter();
    const sr1 = createSendReturn('test', 'node1', 'out', ['fx1'], 'node2', 'in');
    expect(sr1.id).toBe('send-0');

    resetInstanceIdCounter();
    const sr2 = createSendReturn('test', 'node1', 'out', ['fx1'], 'node2', 'in');
    expect(sr2.id).toBe('send-0');
  });

  it('FeedbackTap IDs are deterministic', () => {
    resetInstanceIdCounter();
    const ft1 = createFeedbackTap('node1', 'out', 'node2', 'in');
    expect(ft1.id).toBe('feedback-0');

    resetInstanceIdCounter();
    const ft2 = createFeedbackTap('node1', 'out', 'node2', 'in');
    expect(ft2.id).toBe('feedback-0');
  });

  it('FBO IDs are deterministic', () => {
    const pool = createResourcePool();
    pool.currentFrame = 0;
    resetInstanceIdCounter();

    const fboId1 = allocateFBO(pool, 1920, 1080);
    expect(fboId1).toBe('fbo-0');

    resetInstanceIdCounter();
    const fboId2 = allocateFBO(pool, 1920, 1080);
    expect(fboId2).toBe('fbo-0');
  });

  it('Texture IDs are deterministic', () => {
    const pool = createResourcePool();
    pool.currentFrame = 0;
    resetInstanceIdCounter();

    const texId1 = allocateTexture(pool, 1920, 1080);
    expect(texId1).toBe('tex-0');

    resetInstanceIdCounter();
    const texId2 = allocateTexture(pool, 1920, 1080);
    expect(texId2).toBe('tex-0');
  });

  it('Instance IDs are sequential even across different node types', () => {
    resetInstanceIdCounter();

    const nodeA = createVisualNode({
      id: 'node-a',
      name: 'Node A',
      kind: 'generator',
      category: 'generative',
      outputs: [createOutputPort('out', 'Output', 'rgba')]
    });

    const nodeB = createVisualNode({
      id: 'node-b',
      name: 'Node B',
      kind: 'effect',
      category: 'blur',
      inputs: [createInputPort('in', 'Input', 'rgba', true)],
      outputs: [createOutputPort('out', 'Output', 'rgba')]
    });

    const instanceA1 = createNodeInstance(nodeA);
    const instanceB1 = createNodeInstance(nodeB);
    const instanceA2 = createNodeInstance(nodeA);

    expect(instanceA1.instanceId).toBe('node-a-0');
    expect(instanceB1.instanceId).toBe('node-b-1');
    expect(instanceA2.instanceId).toBe('node-a-2');
  });
});
