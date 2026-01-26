import { describe, expect, it } from 'vitest';
import {
  FX_CATALOG,
  getNodeById,
  getNodesByKind,
  getNodesByCategory,
  getNodesByTag,
  getGenerators,
  getEffects,
  getCompositors,
  getCostEstimate,
  validateNodeChain,
  plasmaGenerator,
  bloomEffect,
  blendCompositor,
  particleFieldGenerator,
  sdfShapeGenerator,
  feedbackEffect,
  kaleidoscopeEffect,
  noiseGenerator,
  glitchEffect,
  colorCorrectionEffect
} from '../src/shared/fxCatalog';

describe('FX catalog registry', () => {
  it('contains all built-in nodes', () => {
    expect(FX_CATALOG.length).toBeGreaterThan(10);
  });

  it('has unique node IDs', () => {
    const ids = FX_CATALOG.map((n) => n.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all nodes have required fields', () => {
    for (const node of FX_CATALOG) {
      expect(node.id).toBeTruthy();
      expect(node.name).toBeTruthy();
      expect(node.kind).toBeTruthy();
      expect(node.gpuCostTier).toBeTruthy();
    }
  });
});

describe('node lookup functions', () => {
  it('finds node by ID', () => {
    const node = getNodeById('gen-plasma');
    expect(node).toBeDefined();
    expect(node?.name).toBe('Plasma');
  });

  it('returns undefined for unknown ID', () => {
    const node = getNodeById('unknown-node');
    expect(node).toBeUndefined();
  });

  it('filters by kind', () => {
    const generators = getNodesByKind('generator');
    expect(generators.length).toBeGreaterThan(0);
    expect(generators.every((n) => n.kind === 'generator')).toBe(true);
  });

  it('filters by category', () => {
    const blurNodes = getNodesByCategory('blur');
    expect(blurNodes.length).toBeGreaterThan(0);
    expect(blurNodes.every((n) => n.category === 'blur')).toBe(true);
  });

  it('filters by tag', () => {
    const reactiveNodes = getNodesByTag('reactive');
    expect(reactiveNodes.length).toBeGreaterThan(0);
    expect(reactiveNodes.every((n) => n.tags.includes('reactive'))).toBe(true);
  });
});

describe('convenience getters', () => {
  it('gets all generators', () => {
    const gens = getGenerators();
    expect(gens.length).toBeGreaterThan(0);
    expect(gens.every((n) => n.kind === 'generator')).toBe(true);
  });

  it('gets all effects', () => {
    const fx = getEffects();
    expect(fx.length).toBeGreaterThan(0);
    expect(fx.every((n) => n.kind === 'effect')).toBe(true);
  });

  it('gets all compositors', () => {
    const comps = getCompositors();
    expect(comps.length).toBeGreaterThan(0);
    expect(comps.every((n) => n.kind === 'compositor')).toBe(true);
  });
});

describe('plasma generator', () => {
  it('has correct kind', () => {
    expect(plasmaGenerator.kind).toBe('generator');
  });

  it('has output port', () => {
    expect(plasmaGenerator.outputs).toHaveLength(1);
    expect(plasmaGenerator.outputs[0].type).toBe('rgba');
  });

  it('has speed parameter', () => {
    const speedParam = plasmaGenerator.parameters.find((p) => p.id === 'speed');
    expect(speedParam).toBeDefined();
    expect(speedParam?.type).toBe('float');
    expect(speedParam?.min).toBe(0.1);
    expect(speedParam?.max).toBe(5.0);
  });

  it('supports audio reactivity', () => {
    expect(plasmaGenerator.supportsAudioReactivity).toBe(true);
  });

  it('has modulation targets', () => {
    expect(plasmaGenerator.modulationTargets.length).toBeGreaterThan(0);
    const speedMod = plasmaGenerator.modulationTargets.find((m) => m.parameterId === 'speed');
    expect(speedMod).toBeDefined();
  });
});

describe('particle field generator', () => {
  it('has density and speed parameters', () => {
    const density = particleFieldGenerator.parameters.find((p) => p.id === 'density');
    const speed = particleFieldGenerator.parameters.find((p) => p.id === 'speed');
    expect(density).toBeDefined();
    expect(speed).toBeDefined();
  });

  it('has shape enum parameter', () => {
    const shape = particleFieldGenerator.parameters.find((p) => p.id === 'shape');
    expect(shape).toBeDefined();
    expect(shape?.type).toBe('enum');
    expect(shape?.options?.length).toBeGreaterThan(0);
  });
});

describe('sdf shape generator', () => {
  it('has multiple output ports', () => {
    expect(sdfShapeGenerator.outputs.length).toBeGreaterThanOrEqual(1);
  });

  it('has shape selection parameter', () => {
    const shape = sdfShapeGenerator.parameters.find((p) => p.id === 'shape');
    expect(shape).toBeDefined();
    expect(shape?.options?.length).toBeGreaterThan(3);
  });

  it('supports rotation modulation', () => {
    const rotMod = sdfShapeGenerator.modulationTargets.find((m) => m.parameterId === 'rotation');
    expect(rotMod).toBeDefined();
    expect(rotMod?.bipolar).toBe(true);
  });
});

describe('bloom effect', () => {
  it('has correct kind', () => {
    expect(bloomEffect.kind).toBe('effect');
  });

  it('has required input', () => {
    expect(bloomEffect.inputs).toHaveLength(1);
    expect(bloomEffect.inputs[0].required).toBe(true);
  });

  it('has intensity and threshold parameters', () => {
    const intensity = bloomEffect.parameters.find((p) => p.id === 'intensity');
    const threshold = bloomEffect.parameters.find((p) => p.id === 'threshold');
    expect(intensity).toBeDefined();
    expect(threshold).toBeDefined();
  });

  it('requires multiple framebuffers', () => {
    expect(bloomEffect.resourceRequirements.framebuffers).toBeGreaterThan(1);
  });

  it('prefers half resolution', () => {
    expect(bloomEffect.resourceRequirements.preferredResolution).toBe('half');
  });
});

describe('feedback effect', () => {
  it('supports feedback', () => {
    expect(feedbackEffect.supportsFeedback).toBe(true);
  });

  it('requires double buffer', () => {
    expect(feedbackEffect.resourceRequirements.requiresDoubleBuffer).toBe(true);
  });

  it('has zoom and rotation parameters', () => {
    const zoom = feedbackEffect.parameters.find((p) => p.id === 'zoom');
    const rotation = feedbackEffect.parameters.find((p) => p.id === 'rotation');
    expect(zoom).toBeDefined();
    expect(rotation).toBeDefined();
  });
});

describe('kaleidoscope effect', () => {
  it('has segments parameter', () => {
    const segments = kaleidoscopeEffect.parameters.find((p) => p.id === 'segments');
    expect(segments).toBeDefined();
    expect(segments?.min).toBeGreaterThanOrEqual(2);
  });

  it('is classified as distortion', () => {
    expect(kaleidoscopeEffect.category).toBe('distortion');
  });
});

describe('noise generator', () => {
  it('has noise type enum', () => {
    const typeParam = noiseGenerator.parameters.find((p) => p.id === 'type');
    expect(typeParam).toBeDefined();
    expect(typeParam?.type).toBe('enum');
    expect(typeParam?.options?.some((o) => o.value === 'simplex')).toBe(true);
    expect(typeParam?.options?.some((o) => o.value === 'perlin')).toBe(true);
  });

  it('has octaves and persistence for FBM', () => {
    const octaves = noiseGenerator.parameters.find((p) => p.id === 'octaves');
    const persistence = noiseGenerator.parameters.find((p) => p.id === 'persistence');
    expect(octaves).toBeDefined();
    expect(persistence).toBeDefined();
  });
});

describe('glitch effect', () => {
  it('has audio sync option', () => {
    const syncParam = glitchEffect.parameters.find((p) => p.id === 'syncToAudio');
    expect(syncParam).toBeDefined();
    expect(syncParam?.type).toBe('bool');
  });

  it('supports audio reactivity', () => {
    expect(glitchEffect.supportsAudioReactivity).toBe(true);
  });
});

describe('color correction effect', () => {
  it('has standard color parameters', () => {
    const brightness = colorCorrectionEffect.parameters.find((p) => p.id === 'brightness');
    const contrast = colorCorrectionEffect.parameters.find((p) => p.id === 'contrast');
    const saturation = colorCorrectionEffect.parameters.find((p) => p.id === 'saturation');
    const hue = colorCorrectionEffect.parameters.find((p) => p.id === 'hue');
    expect(brightness).toBeDefined();
    expect(contrast).toBeDefined();
    expect(saturation).toBeDefined();
    expect(hue).toBeDefined();
  });

  it('has trivial GPU cost', () => {
    expect(colorCorrectionEffect.gpuCostTier).toBe('trivial');
  });
});

describe('blend compositor', () => {
  it('has correct kind', () => {
    expect(blendCompositor.kind).toBe('compositor');
  });

  it('has two inputs', () => {
    expect(blendCompositor.inputs).toHaveLength(2);
  });

  it('has blend mode enum', () => {
    const mode = blendCompositor.parameters.find((p) => p.id === 'mode');
    expect(mode).toBeDefined();
    expect(mode?.type).toBe('enum');
    expect(mode?.options?.length).toBeGreaterThan(5);
  });

  it('has opacity parameter', () => {
    const opacity = blendCompositor.parameters.find((p) => p.id === 'opacity');
    expect(opacity).toBeDefined();
    expect(opacity?.min).toBe(0);
    expect(opacity?.max).toBe(1);
  });
});

describe('cost estimation', () => {
  it('calculates total cost for node chain', () => {
    const cost = getCostEstimate(['gen-plasma', 'fx-bloom', 'fx-blur']);
    expect(cost).toBeGreaterThan(0);
  });

  it('returns 0 for empty chain', () => {
    const cost = getCostEstimate([]);
    expect(cost).toBe(0);
  });

  it('handles unknown nodes gracefully', () => {
    const cost = getCostEstimate(['unknown-node']);
    expect(cost).toBe(0);
  });
});

describe('node chain validation', () => {
  it('validates valid chain', () => {
    const result = validateNodeChain(['gen-plasma', 'fx-bloom']);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports unknown nodes', () => {
    const result = validateNodeChain(['unknown-node']);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unknown node: unknown-node');
  });

  it('validates empty chain', () => {
    const result = validateNodeChain([]);
    expect(result.valid).toBe(true);
  });
});
