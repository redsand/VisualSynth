import { describe, expect, it } from 'vitest';
import {
  PLUGIN_API_VERSION,
  pluginManifestSchema,
  capabilityFlagsSchema,
  sandboxConfigSchema,
  assetAccessRulesSchema,
  validatePluginManifest,
  validatePluginShader,
  createPluginRuntimeState,
  checkPluginCompatibility
} from '../src/shared/pluginSchema';

describe('plugin API version', () => {
  it('exports current API version', () => {
    expect(PLUGIN_API_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('capability flags schema', () => {
  it('validates empty capabilities with defaults', () => {
    const result = capabilityFlagsSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.requiresWebGL2).toBe(true);
    expect(result.data?.canAccessAudio).toBe(false);
  });

  it('validates custom capabilities', () => {
    const result = capabilityFlagsSchema.safeParse({
      requiresFloatTextures: true,
      canAccessAudio: true,
      supportsHotReload: true
    });
    expect(result.success).toBe(true);
    expect(result.data?.requiresFloatTextures).toBe(true);
    expect(result.data?.canAccessAudio).toBe(true);
  });
});

describe('sandbox config schema', () => {
  it('validates empty config with defaults', () => {
    const result = sandboxConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.maxTextureMemoryMB).toBe(256);
    expect(result.data?.maxFramebuffers).toBe(4);
    expect(result.data?.crashIsolation).toBe(true);
  });

  it('validates custom limits', () => {
    const result = sandboxConfigSchema.safeParse({
      maxTextureMemoryMB: 512,
      maxLoopIterations: 2000,
      timeoutMs: 200
    });
    expect(result.success).toBe(true);
    expect(result.data?.maxTextureMemoryMB).toBe(512);
    expect(result.data?.maxLoopIterations).toBe(2000);
  });
});

describe('asset access rules schema', () => {
  it('validates empty rules with defaults', () => {
    const result = assetAccessRulesSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.allowedAssetTypes).toContain('texture');
    expect(result.data?.canCreateAssets).toBe(false);
  });

  it('validates custom access rules', () => {
    const result = assetAccessRulesSchema.safeParse({
      allowedAssetTypes: ['texture', 'video'],
      maxAssetSizeMB: 128,
      canModifyAssets: true
    });
    expect(result.success).toBe(true);
    expect(result.data?.allowedAssetTypes).toHaveLength(2);
    expect(result.data?.canModifyAssets).toBe(true);
  });
});

describe('plugin manifest schema', () => {
  it('validates minimal manifest', () => {
    const manifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      kind: 'effect',
      entry: 'index.js'
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it('validates full manifest', () => {
    const manifest = {
      id: 'my-awesome-fx',
      name: 'Awesome FX',
      version: '2.1.0',
      author: 'Developer',
      description: 'An awesome visual effect',
      license: 'MIT',
      kind: 'effect',
      category: 'distortion',
      tags: ['glitch', 'modern'],
      entry: 'index.js',
      shaderEntry: 'shader.glsl',
      inputs: [
        { id: 'in', name: 'Input', type: 'rgba', required: true }
      ],
      outputs: [
        { id: 'out', name: 'Output', type: 'rgba' }
      ],
      parameters: [
        {
          id: 'intensity',
          name: 'Intensity',
          type: 'float',
          defaultValue: 0.5,
          min: 0,
          max: 1
        }
      ],
      gpuCostTier: 'moderate',
      capabilities: {
        requiresFloatTextures: true
      },
      sandbox: {
        maxTextureMemoryMB: 128
      }
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it('rejects invalid plugin ID format', () => {
    const manifest = {
      id: 'Invalid ID With Spaces',
      name: 'Test',
      version: '1.0.0',
      kind: 'effect',
      entry: 'index.js'
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid version format', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: 'v1.0',
      kind: 'effect',
      entry: 'index.js'
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it('defaults API version', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      kind: 'generator',
      entry: 'index.js'
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
    expect(result.data?.apiVersion).toBe(PLUGIN_API_VERSION);
  });

  it('defaults output port', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      kind: 'generator',
      entry: 'index.js'
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
    expect(result.data?.outputs).toHaveLength(1);
    expect(result.data?.outputs[0].id).toBe('out');
  });
});

describe('manifest validation', () => {
  it('validates valid manifest', () => {
    const manifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      kind: 'effect',
      entry: 'index.js'
    };
    const result = validatePluginManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.manifest).toBeDefined();
  });

  it('reports schema errors', () => {
    const manifest = {
      id: 123, // Invalid type
      name: 'Test'
    };
    const result = validatePluginManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects duplicate parameter IDs', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      kind: 'effect',
      entry: 'index.js',
      parameters: [
        { id: 'param1', name: 'Param 1', type: 'float', defaultValue: 0 },
        { id: 'param1', name: 'Param 1 Duplicate', type: 'float', defaultValue: 0 }
      ]
    };
    const result = validatePluginManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate parameter ID'))).toBe(true);
  });

  it('detects duplicate input port IDs', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      kind: 'compositor',
      entry: 'index.js',
      inputs: [
        { id: 'in', name: 'Input 1', type: 'rgba' },
        { id: 'in', name: 'Input 2', type: 'rgba' }
      ]
    };
    const result = validatePluginManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate input port ID'))).toBe(true);
  });

  it('detects duplicate output port IDs', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      kind: 'generator',
      entry: 'index.js',
      outputs: [
        { id: 'out', name: 'Output 1', type: 'rgba' },
        { id: 'out', name: 'Output 2', type: 'rgba' }
      ]
    };
    const result = validatePluginManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate output port ID'))).toBe(true);
  });
});

describe('shader validation', () => {
  it('returns valid result for stub implementation', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      kind: 'effect' as const,
      entry: 'index.js',
      apiVersion: PLUGIN_API_VERSION,
      author: 'Unknown',
      license: 'MIT',
      tags: [],
      inputs: [],
      outputs: [{ id: 'out', name: 'Output', type: 'rgba' as const }],
      parameters: [],
      gpuCostTier: 'moderate' as const,
      preferredResolution: 'full' as const,
      capabilities: {},
      sandbox: {},
      assetAccess: {},
      dependencies: [],
      optionalDependencies: []
    };
    const result = validatePluginShader('void main() {}', manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('plugin runtime state', () => {
  it('creates runtime state from manifest', () => {
    const { manifest } = validatePluginManifest({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      kind: 'effect',
      entry: 'index.js',
      parameters: [
        { id: 'amount', name: 'Amount', type: 'float', defaultValue: 0.5 }
      ]
    });
    if (!manifest) throw new Error('Manifest should be valid');

    const state = createPluginRuntimeState(manifest);
    expect(state.manifest).toBe(manifest);
    expect(state.loaded).toBe(false);
    expect(state.enabled).toBe(false);
    expect(state.error).toBeNull();
    expect(state.parameterValues['amount']).toBe(0.5);
    expect(state.resourceUsage.textureMemoryMB).toBe(0);
  });
});

describe('plugin compatibility checking', () => {
  it('reports compatible when capabilities match', () => {
    const { manifest } = validatePluginManifest({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      kind: 'effect',
      entry: 'index.js',
      capabilities: {
        requiresWebGL2: true
      }
    });
    if (!manifest) throw new Error('Manifest should be valid');

    const result = checkPluginCompatibility(manifest, {
      requiresWebGL2: true
    });
    expect(result.compatible).toBe(true);
    expect(result.missingCapabilities).toHaveLength(0);
  });

  it('reports incompatible when capabilities missing', () => {
    const { manifest } = validatePluginManifest({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      kind: 'effect',
      entry: 'index.js',
      capabilities: {
        requiresFloatTextures: true,
        requiresComputeShaders: true
      }
    });
    if (!manifest) throw new Error('Manifest should be valid');

    const result = checkPluginCompatibility(manifest, {
      requiresWebGL2: true,
      requiresFloatTextures: false,
      requiresComputeShaders: false
    });
    expect(result.compatible).toBe(false);
    expect(result.missingCapabilities).toContain('Float Textures');
    expect(result.missingCapabilities).toContain('Compute Shaders');
  });
});
