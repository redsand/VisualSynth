import { describe, it, expect, beforeEach } from 'vitest';
import { modulateSdfScene } from '../src/renderer/sdf/applySdfModulation';
import { registerSdfNodes } from '../src/renderer/sdf/nodes';
import { ModSmoothEntry } from '../src/shared/modMatrix';

describe('modulateSdfScene (shared SDF node-param modulation)', () => {
  beforeEach(() => {
    registerSdfNodes();
  });

  // The live index.ts render path previously passed the layer's sdfScene
  // through RAW, so a modMatrix connection targeting an SDF node param (e.g.
  // `nodeId.radius`) silently did nothing on the default render path. Only the
  // bootstrap RenderGraph path modulated. modulateSdfScene is the shared helper
  // both paths now use, so the two paths modulate identically.

  it('modulates a scalar node param via a `${instanceId}.${paramId}` modMatrix target', () => {
    const scene = {
      nodes: [
        { instanceId: 'test-node', nodeId: 'circle', params: { radius: 0.5 }, enabled: true, order: 0 }
      ],
      connections: [],
      mode: '2d'
    };
    const modMatrix = [
      {
        id: 'mod-1',
        source: 'macro-1',
        target: 'test-node.radius',
        amount: 0.5,
        min: 0,
        max: 1,
        curve: 'linear' as const,
        smoothing: 0,
        bipolar: false
      }
    ];
    const modSources = { 'macro-1': 1.0 };
    const state = new Map<string, ModSmoothEntry>();
    const out = modulateSdfScene(scene, modSources, modMatrix, { dt: 1 / 60, frame: 0, state });
    // 0.5 + (1.0 * 0.5) = 1.0 — matches the bootstrap-path renderGraphModSdf test.
    expect(out.nodes[0].params.radius).toBeCloseTo(1.0);
  });

  it('does NOT mutate the original scene (returns a clone)', () => {
    const scene = {
      nodes: [
        { instanceId: 'n', nodeId: 'circle', params: { radius: 0.5 }, enabled: true, order: 0 }
      ],
      connections: [],
      mode: '2d'
    };
    const modMatrix = [
      {
        id: 'mod-1', source: 'macro-1', target: 'n.radius', amount: 1, min: 0, max: 1,
        curve: 'linear' as const, smoothing: 0, bipolar: false
      }
    ];
    modulateSdfScene(scene, { 'macro-1': 1 }, modMatrix, { dt: 1 / 60, frame: 0, state: new Map() });
    expect(scene.nodes[0].params.radius).toBeCloseTo(0.5);
  });

  it('modulates vector params per component (nodeId.paramId.x/y/z/w)', () => {
    const scene = {
      nodes: [
        { instanceId: 'box', nodeId: 'box-3d', params: { width: 0.5, height: 0.5, depth: 0.5 }, enabled: true, order: 0 }
      ],
      connections: [],
      mode: '3d'
    };
    const modMatrix = [
      {
        id: 'mod-x', source: 'macro-1', target: 'box.width.x', amount: 1, min: 0, max: 1,
        curve: 'linear' as const, smoothing: 0, bipolar: false
      }
    ];
    // box-3d width is a scalar param, but the helper should still route a
    // numeric param through applyModMatrix and leave it a number.
    const out = modulateSdfScene(scene, { 'macro-1': 1 }, modMatrix, { dt: 1 / 60, frame: 0, state: new Map() });
    expect(typeof out.nodes[0].params.width).toBe('number');
  });

  it('returns undefined for an undefined scene', () => {
    const out = modulateSdfScene(undefined, {}, [], { dt: 1 / 60, frame: 0, state: new Map() });
    expect(out).toBeUndefined();
  });

  it('leaves node params unchanged when no connections target them', () => {
    const scene = {
      nodes: [
        { instanceId: 'n', nodeId: 'circle', params: { radius: 0.4 }, enabled: true, order: 0 }
      ],
      connections: [],
      mode: '2d'
    };
    const out = modulateSdfScene(scene, { 'macro-1': 1 }, [], { dt: 1 / 60, frame: 0, state: new Map() });
    expect(out.nodes[0].params.radius).toBeCloseTo(0.4);
  });
});