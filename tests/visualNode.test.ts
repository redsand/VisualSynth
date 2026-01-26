import { describe, expect, it } from 'vitest';
import {
  visualNodeSchema,
  parameterSchema,
  modulationTargetSchema,
  createParameter,
  createFloatParameter,
  createBoolParameter,
  createEnumParameter,
  createInputPort,
  createOutputPort,
  createVisualNode,
  createModulationTarget,
  createResourceRequirements,
  createTestHooks,
  gpuCostEstimate
} from '../src/shared/visualNode';

describe('parameter schema', () => {
  it('validates float parameter', () => {
    const param = createFloatParameter('intensity', 'Intensity', 0.5, 0, 1);
    const result = parameterSchema.safeParse(param);
    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('float');
    expect(result.data?.defaultValue).toBe(0.5);
    expect(result.data?.min).toBe(0);
    expect(result.data?.max).toBe(1);
  });

  it('validates bool parameter', () => {
    const param = createBoolParameter('enabled', 'Enabled', true);
    const result = parameterSchema.safeParse(param);
    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('bool');
    expect(result.data?.defaultValue).toBe(true);
  });

  it('validates enum parameter', () => {
    const param = createEnumParameter('mode', 'Mode', 'normal', [
      { value: 'normal', label: 'Normal' },
      { value: 'additive', label: 'Additive' }
    ]);
    const result = parameterSchema.safeParse(param);
    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('enum');
    expect(result.data?.options).toHaveLength(2);
  });

  it('supports parameter groups', () => {
    const param = createFloatParameter('speed', 'Speed', 1.0, 0, 5, { group: 'animation' });
    expect(param.group).toBe('animation');
  });

  it('supports UI hints', () => {
    const param = createFloatParameter('rotation', 'Rotation', 0, -Math.PI, Math.PI, { uiHint: 'knob' });
    expect(param.uiHint).toBe('knob');
  });
});

describe('port creation', () => {
  it('creates input port', () => {
    const port = createInputPort('in', 'Input', 'rgba', true);
    expect(port.id).toBe('in');
    expect(port.name).toBe('Input');
    expect(port.type).toBe('rgba');
    expect(port.required).toBe(true);
  });

  it('creates output port', () => {
    const port = createOutputPort('out', 'Output', 'color');
    expect(port.id).toBe('out');
    expect(port.type).toBe('color');
  });

  it('defaults required to false', () => {
    const port = createInputPort('mask', 'Mask', 'mask');
    expect(port.required).toBe(false);
  });
});

describe('modulation target schema', () => {
  it('validates modulation target', () => {
    const target = createModulationTarget('intensity', { minRange: 0, maxRange: 2 });
    const result = modulationTargetSchema.safeParse(target);
    expect(result.success).toBe(true);
    expect(result.data?.parameterId).toBe('intensity');
    expect(result.data?.maxRange).toBe(2);
  });

  it('supports bipolar modulation', () => {
    const target = createModulationTarget('pan', { bipolar: true, minRange: -1, maxRange: 1 });
    expect(target.bipolar).toBe(true);
  });

  it('supports smoothing', () => {
    const target = createModulationTarget('cutoff', { smoothingMs: 50 });
    expect(target.smoothingMs).toBe(50);
  });

  it('supports different curves', () => {
    const target = createModulationTarget('volume', { curve: 'exponential' });
    expect(target.curve).toBe('exponential');
  });
});

describe('visual node schema', () => {
  it('validates minimal generator node', () => {
    const node = createVisualNode({
      id: 'test-gen',
      name: 'Test Generator',
      kind: 'generator'
    });
    const result = visualNodeSchema.safeParse(node);
    expect(result.success).toBe(true);
    expect(result.data?.kind).toBe('generator');
  });

  it('validates complete effect node', () => {
    const node = createVisualNode({
      id: 'test-fx',
      name: 'Test Effect',
      kind: 'effect',
      category: 'blur',
      tags: ['blur', 'smooth'],
      inputs: [createInputPort('in', 'Input', 'rgba', true)],
      outputs: [createOutputPort('out', 'Output', 'rgba')],
      parameters: [
        createFloatParameter('radius', 'Radius', 0.5, 0, 1),
        createBoolParameter('enabled', 'Enabled', true)
      ],
      modulationTargets: [
        createModulationTarget('radius')
      ],
      gpuCostTier: 'moderate',
      resourceRequirements: createResourceRequirements({ framebuffers: 2 }),
      testHooks: createTestHooks({ toleranceThreshold: 0.02 })
    });

    const result = visualNodeSchema.safeParse(node);
    expect(result.success).toBe(true);
    expect(result.data?.inputs).toHaveLength(1);
    expect(result.data?.outputs).toHaveLength(1);
    expect(result.data?.parameters).toHaveLength(2);
  });

  it('validates compositor node', () => {
    const node = createVisualNode({
      id: 'blend',
      name: 'Blend',
      kind: 'compositor',
      inputs: [
        createInputPort('base', 'Base', 'rgba', true),
        createInputPort('blend', 'Blend', 'rgba', true)
      ],
      outputs: [createOutputPort('out', 'Output', 'rgba')]
    });

    expect(node.kind).toBe('compositor');
    expect(node.inputs).toHaveLength(2);
  });

  it('defaults gpu cost to moderate', () => {
    const node = createVisualNode({
      id: 'test',
      name: 'Test',
      kind: 'generator'
    });
    expect(node.gpuCostTier).toBe('moderate');
  });

  it('supports audio reactivity flag', () => {
    const node = createVisualNode({
      id: 'reactive',
      name: 'Reactive',
      kind: 'generator',
      supportsAudioReactivity: true
    });
    expect(node.supportsAudioReactivity).toBe(true);
  });

  it('supports feedback flag', () => {
    const node = createVisualNode({
      id: 'feedback',
      name: 'Feedback',
      kind: 'effect',
      supportsFeedback: true
    });
    expect(node.supportsFeedback).toBe(true);
  });
});

describe('resource requirements', () => {
  it('creates default requirements', () => {
    const reqs = createResourceRequirements();
    expect(reqs.framebuffers).toBe(0);
    expect(reqs.textures).toBe(0);
    expect(reqs.preferredResolution).toBe('full');
  });

  it('supports custom framebuffer count', () => {
    const reqs = createResourceRequirements({ framebuffers: 3 });
    expect(reqs.framebuffers).toBe(3);
  });

  it('supports resolution preferences', () => {
    const reqs = createResourceRequirements({ preferredResolution: 'half' });
    expect(reqs.preferredResolution).toBe('half');
  });

  it('supports double buffering flag', () => {
    const reqs = createResourceRequirements({ requiresDoubleBuffer: true });
    expect(reqs.requiresDoubleBuffer).toBe(true);
  });
});

describe('test hooks', () => {
  it('creates default test hooks', () => {
    const hooks = createTestHooks();
    expect(hooks.deterministicSeed).toBe(true);
    expect(hooks.fixedTimestep).toBe(true);
    expect(hooks.toleranceThreshold).toBe(0.01);
  });

  it('supports snapshot points', () => {
    const hooks = createTestHooks({ snapshotPoints: ['frame-0', 'frame-30'] });
    expect(hooks.snapshotPoints).toContain('frame-0');
    expect(hooks.snapshotPoints).toContain('frame-30');
  });

  it('supports reference image path', () => {
    const hooks = createTestHooks({ referenceImagePath: '/golden/test.png' });
    expect(hooks.referenceImagePath).toBe('/golden/test.png');
  });
});

describe('gpu cost estimates', () => {
  it('provides cost estimates for all tiers', () => {
    expect(gpuCostEstimate.trivial).toBe(0.1);
    expect(gpuCostEstimate.light).toBe(0.3);
    expect(gpuCostEstimate.moderate).toBe(1.0);
    expect(gpuCostEstimate.heavy).toBe(3.0);
    expect(gpuCostEstimate.extreme).toBe(8.0);
  });
});
