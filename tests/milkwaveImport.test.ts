import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  parseMilkFile,
  extractAuthorFromFilename,
  extractNameFromFilename
} from '../src/shared/milkwaveParser';
import { transpileMilkDropShader, inferPresetCategory } from '../src/shared/hlslToGlsl';
import { applyPresetV6, presetV6Schema } from '../src/shared/presetMigration';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { buildMilkwaveIR } from '../src/shared/milkwaveIr';
import { classifyMilkwaveIR } from '../src/shared/milkwaveCapability';
import { translateMilkwavePresetOffline } from '../src/shared/milkwaveOfflineTranslation';

const fixturesDir = join(__dirname, 'fixtures', 'milkwave');
const milkwavePath = join(__dirname, '..', '..', 'Milkwave', 'Visualizer', 'resources', 'presets');

describe('Milkwave Import Pipeline', () => {
  describe('Parser integration', () => {
    it('should parse simple preset file', () => {
      const content = readFileSync(join(fixturesDir, 'simple.milk'), 'utf-8');
      const result = parseMilkFile(content, 'Test - Simple.milk', 'TestFolder');

      expect(result).not.toBeNull();
      expect(result!.metadata.author).toBe('Test');
      expect(result!.metadata.name).toBe('Simple');
      expect(result!.metadata.folder).toBe('TestFolder');
      expect(result!.parameters).toBeDefined();
      expect(result!.perFrameCode.length).toBeGreaterThan(0);
      expect(result!.perPixelCode.length).toBeGreaterThan(0);
    });

    it('should parse preset with shaders', () => {
      const content = readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8');
      const result = parseMilkFile(content, 'Test - Shader.milk', 'TestFolder');

      expect(result).not.toBeNull();
      expect(result!.warpShader).not.toBeNull();
      expect(result!.warpShader).toContain('shader_body');
      expect(result!.compShader).not.toBeNull();
      expect(result!.version).toBe(201);
    });
  });

  describe('Shader transpilation integration', () => {
    it('should transpile warp shader from preset', () => {
      const content = readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8');
      const result = parseMilkFile(content, 'Test.milk', 'Test');

      expect(result).not.toBeNull();
      expect(result!.warpShader).not.toBeNull();

      const transpiled = transpileMilkDropShader(result!.warpShader!, 'warp');
      expect(transpiled.glsl).toContain('void main()');
      expect(transpiled.glsl).toContain('fragColor');
      expect(transpiled.glsl).toContain('uniform float uTime');
    });

    it('should transpile comp shader from preset', () => {
      const content = readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8');
      const result = parseMilkFile(content, 'Test.milk', 'Test');

      expect(result).not.toBeNull();
      expect(result!.compShader).not.toBeNull();

      const transpiled = transpileMilkDropShader(result!.compShader!, 'comp');
      expect(transpiled.glsl).toContain('void main()');
      expect(transpiled.glsl).toContain('fragColor');
    });
  });

  describe('Category inference', () => {
    it('should infer category from preset name', () => {
      expect(inferPresetCategory('Cosmic Journey', '')).toBe('Space');
      expect(inferPresetCategory('Tunnel Vision', '')).toBe('Abstract');
      expect(inferPresetCategory('Plasma Flow', '')).toBe('Organic');
      expect(inferPresetCategory('Audio Spectrum', '')).toBe('Audio Reactive');
    });

    it('should default to Imported for unknown presets', () => {
      expect(inferPresetCategory('Unknown Preset', '')).toBe('Imported');
    });
  });

  describe('Preset generation', () => {
    it('should create valid v6 preset from milk data', () => {
      const content = readFileSync(join(fixturesDir, 'simple.milk'), 'utf-8');
      const milkData = parseMilkFile(content, 'Author - Test Preset.milk', 'TestFolder');
      const ir = buildMilkwaveIR(milkData!);
      const capability = classifyMilkwaveIR(ir);

      expect(milkData).not.toBeNull();

      // Create preset structure
      const preset = {
        version: 6,
        metadata: {
          version: 6,
          name: milkData!.metadata.name,
          author: milkData!.metadata.author,
          source: milkData!.metadata.sourcePath,
          importedFrom: 'Milkwave',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          category: 'Imported',
          compatibility: { minVersion: '1.4.0' },
          milkwave: {
            format: ir.format,
            version: ir.version,
            supportTier: capability.tier,
            featureSummary: capability.featureSummary,
            reasons: capability.reasonsDetailed
          },
          activeEngineId: 'engine-radial-core',
          activeModeId: 'mode-cosmic',
          intendedMusicStyle: 'Electronic',
          visualIntentTags: ['imported', 'milkwave'],
          colorChemistry: ['analog', 'balanced'],
          defaultTransition: { durationMs: 600, curve: 'easeInOut' }
        },
        scenes: [{
          id: 'scene-1',
          scene_id: 'scene-1',
          name: 'Main',
          intent: 'ambient',
          duration: 0,
          transition_in: { durationMs: 600, curve: 'easeInOut' },
          transition_out: { durationMs: 600, curve: 'easeInOut' },
          trigger: { type: 'manual' },
          assigned_layers: { core: [], support: ['layer-milkwave'], atmosphere: [] },
          layers: [{
            id: 'layer-milkwave',
            name: 'Milkwave',
            role: 'support',
            enabled: true,
            opacity: 1,
            blendMode: 'screen',
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            params: { opacity: 1, enabled: true, blendMode: 'screen' }
          }]
        }],
        activeSceneId: 'scene-1',
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' }
      };

      const result = presetV6Schema.safeParse(preset);
      expect(result.success).toBe(true);
      expect(result.success ? (result.data as any).metadata.milkwave.supportTier : null).toBe(capability.tier);
    });

    it('preserves imported shader payload on v6 validation', () => {
      const preset = {
        version: 6,
        metadata: {
          version: 6,
          name: 'Milkwave Payload',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          category: 'Imported',
          compatibility: { minVersion: '1.4.0' },
          activeEngineId: 'engine-radial-core',
          activeModeId: 'mode-cosmic',
          intendedMusicStyle: 'Electronic',
          visualIntentTags: ['imported', 'milkwave'],
          colorChemistry: ['analog'],
          defaultTransition: { durationMs: 600, curve: 'easeInOut' }
        },
        scenes: [{
          id: 'scene-1',
          scene_id: 'scene-1',
          name: 'Main',
          intent: 'ambient',
          duration: 0,
          transition_in: { durationMs: 600, curve: 'easeInOut' },
          transition_out: { durationMs: 600, curve: 'easeInOut' },
          trigger: { type: 'manual' },
          assigned_layers: { core: [], support: ['layer-milkwave'], atmosphere: [] },
          layers: [{
            id: 'layer-milkwave',
            name: 'Milkwave',
            role: 'support',
            enabled: true,
            opacity: 1,
            blendMode: 'screen',
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            params: { opacity: 1, enabled: true }
          }]
        }],
        activeSceneId: 'scene-1',
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' },
        _shaderData: {
          warp: 'void main() { }',
          comp: 'void main() { }',
          perPixelCode: ['zoom = zoom + 0.01;'],
          waves: [],
          shapes: []
        }
      };

      const result = presetV6Schema.safeParse(preset);
      expect(result.success).toBe(true);
      expect(result.success ? (result.data as any)._shaderData : null).toEqual(preset._shaderData);
    });

    it('preserves imported shader payload without warnings', () => {
      const preset = {
        version: 6,
        metadata: {
          version: 6,
          name: 'Milkwave Payload',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          category: 'Imported',
          compatibility: { minVersion: '1.4.0' },
          activeEngineId: 'engine-radial-core',
          activeModeId: 'mode-cosmic',
          intendedMusicStyle: 'Electronic',
          visualIntentTags: ['imported', 'milkwave'],
          colorChemistry: ['analog'],
          defaultTransition: { durationMs: 600, curve: 'easeInOut' }
        },
        scenes: [{
          id: 'scene-1',
          scene_id: 'scene-1',
          name: 'Main',
          intent: 'ambient',
          duration: 0,
          transition_in: { durationMs: 600, curve: 'easeInOut' },
          transition_out: { durationMs: 600, curve: 'easeInOut' },
          trigger: { type: 'manual' },
          assigned_layers: { core: [], support: ['layer-milkwave'], atmosphere: [] },
          layers: [{
            id: 'layer-milkwave',
            name: 'Milkwave',
            role: 'support',
            enabled: true,
            opacity: 1,
            blendMode: 'screen',
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            params: { opacity: 1, enabled: true }
          }]
        }],
        activeSceneId: 'scene-1',
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' },
        _shaderData: {
          warp: 'void main() { }',
          comp: 'void main() { }',
          perFrameCode: [],
          perFrameInitCode: [],
          perPixelCode: ['rot = rot + 0.01;'],
          waves: [
            {
              enabled: true,
              samples: 512,
              sep: 0,
              bSpectrum: false,
              bUseDots: false,
              bDrawThick: false,
              bAdditive: false,
              scaling: 1,
              smoothing: 0.5,
              r: 1,
              g: 1,
              b: 1,
              a: 1,
              initCode: ['t1 = 0.2;'],
              perFrameCode: ['x = x + 0.1;'],
              perPointCode: ['y = sample;']
            }
          ],
          shapes: [
            {
              enabled: true,
              sides: 4,
              additive: false,
              thickOutline: false,
              textured: true,
              numInst: 2,
              x: 0.5,
              y: 0.5,
              rad: 0.2,
              ang: 0,
              texAng: 0,
              texZoom: 1,
              r: 1,
              g: 1,
              b: 1,
              a: 1,
              r2: 0.5,
              g2: 0.5,
              b2: 0.5,
              a2: 1,
              borderR: 1,
              borderG: 1,
              borderB: 1,
              borderA: 1,
              initCode: ['t2 = 0.3;'],
              perFrameCode: ['ang = ang + 0.1;'],
              perPointCode: ['x = x + 0.05;']
            }
          ],
          originalParameters: {}
        }
      };
 
      const result = applyPresetV6(preset, DEFAULT_PROJECT);
      expect(result.warnings).not.toContain(
        'Milkwave custom warp/comp shaders are not supported by the runtime yet; using the gen-milkwave fallback renderer.'
      );
      expect(result.project.scenes[0]._shaderData).toEqual(preset._shaderData);
      expect(result.project.scenes[0]._shaderData?.perPixelCode).toEqual(['rot = rot + 0.01;']);
      expect(result.project.scenes[0]._shaderData?.waves?.[0]?.initCode).toEqual(['t1 = 0.2;']);
      expect(result.project.scenes[0]._shaderData?.shapes?.[0]?.perPointCode).toEqual(['x = x + 0.05;']);
    });

    it('accepts offline translation metadata on imported shader payloads', () => {
      const content = readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8');
      const milkData = parseMilkFile(content, 'Test - Shader.milk', 'TestFolder');

      expect(milkData).not.toBeNull();

      const translated = translateMilkwavePresetOffline(milkData!);
      const preset = {
        version: 6,
        metadata: {
          version: 6,
          name: milkData!.metadata.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          category: 'Imported',
          compatibility: { minVersion: '1.4.0' },
          importedFrom: 'Milkwave',
          milkwave: {
            format: translated.ir.format,
            version: translated.ir.version,
            supportTier: translated.capability.tier,
            featureSummary: translated.capability.featureSummary,
            reasons: translated.capability.reasonsDetailed,
            translation: {
              pipeline: translated.translation.pipeline,
              runtimePatchRecommended: translated.translation.runtimePatchRecommended,
              generatedPasses: (['warp', 'comp'] as const).filter(
                (kind) => translated.translation.passes[kind].generated
              )
            }
          },
          activeEngineId: 'engine-radial-core',
          activeModeId: 'mode-cosmic',
          intendedMusicStyle: 'Electronic',
          visualIntentTags: ['imported', 'milkwave'],
          colorChemistry: ['analog'],
          defaultTransition: { durationMs: 600, curve: 'easeInOut' }
        },
        scenes: [{
          id: 'scene-1',
          scene_id: 'scene-1',
          name: 'Main',
          intent: 'ambient',
          duration: 0,
          transition_in: { durationMs: 600, curve: 'easeInOut' },
          transition_out: { durationMs: 600, curve: 'easeInOut' },
          trigger: { type: 'manual' },
          assigned_layers: { core: [], support: ['layer-milkwave'], atmosphere: [] },
          layers: [{
            id: 'layer-milkwave',
            name: 'Milkwave',
            role: 'support',
            enabled: true,
            opacity: 1,
            blendMode: 'screen',
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            params: { opacity: 1, enabled: true }
          }]
        }],
        activeSceneId: 'scene-1',
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' },
        _shaderData: {
          warp: translated.translation.passes.warp.source,
          comp: translated.translation.passes.comp.source,
          perFrameCode: milkData!.perFrameCode,
          perFrameInitCode: milkData!.perFrameInitCode,
          perPixelCode: milkData!.perPixelCode,
          waves: milkData!.waves,
          shapes: milkData!.shapes,
          originalParameters: milkData!.parameters,
          translation: translated.translation
        }
      };

      const result = presetV6Schema.safeParse(preset);
      expect(result.success).toBe(true);
      expect(result.success ? (result.data as any)._shaderData.translation.pipeline : null).toBe('milkwave-offline-v1');
      expect(result.success ? (result.data as any).metadata.milkwave.translation.generatedPasses : null).toContain('warp');
    });

    it('accepts persisted Milkwave capability metadata on imported presets', () => {
      const preset = {
        version: 6,
        metadata: {
          version: 6,
          name: 'Milkwave Capability Metadata',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          category: 'Imported',
          compatibility: { minVersion: '1.4.0' },
          importedFrom: 'Milkwave',
          milkwave: {
            format: 'milkwave-ir',
            version: 1,
            supportTier: 'fallback-only',
            featureSummary: ['custom-comp', 'custom-texture-slots'],
            reasons: [
              {
                key: 'custom_texture_slots',
                message: 'Requires custom texture-slot sampler binding and texture-manager evaluation.',
                severity: 'fallback'
              }
            ]
          },
          activeEngineId: 'engine-radial-core',
          activeModeId: 'mode-cosmic',
          intendedMusicStyle: 'Electronic',
          visualIntentTags: ['imported', 'milkwave'],
          colorChemistry: ['analog'],
          defaultTransition: { durationMs: 600, curve: 'easeInOut' }
        },
        scenes: [{
          id: 'scene-1',
          scene_id: 'scene-1',
          name: 'Main',
          intent: 'ambient',
          duration: 0,
          transition_in: { durationMs: 600, curve: 'easeInOut' },
          transition_out: { durationMs: 600, curve: 'easeInOut' },
          trigger: { type: 'manual' },
          assigned_layers: { core: [], support: ['layer-milkwave'], atmosphere: [] },
          layers: [{
            id: 'layer-milkwave',
            name: 'Milkwave',
            role: 'support',
            enabled: true,
            opacity: 1,
            blendMode: 'screen',
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            params: { opacity: 1, enabled: true }
          }]
        }],
        activeSceneId: 'scene-1',
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' },
        _shaderData: {
          warp: 'void main() { }',
          comp: 'void main() { }',
          perFrameCode: [],
          perFrameInitCode: [],
          perPixelCode: ['rot = rot + 0.01;'],
          waves: [
            {
              enabled: true,
              samples: 512,
              sep: 0,
              bSpectrum: false,
              bUseDots: false,
              bDrawThick: false,
              bAdditive: false,
              scaling: 1,
              smoothing: 0.5,
              r: 1,
              g: 1,
              b: 1,
              a: 1,
              initCode: ['t1 = 0.2;'],
              perFrameCode: ['x = x + 0.1;'],
              perPointCode: ['y = sample;']
            }
          ],
          shapes: [
            {
              enabled: true,
              sides: 4,
              additive: false,
              thickOutline: false,
              textured: true,
              numInst: 2,
              x: 0.5,
              y: 0.5,
              rad: 0.2,
              ang: 0,
              texAng: 0,
              texZoom: 1,
              r: 1,
              g: 1,
              b: 1,
              a: 1,
              r2: 0.5,
              g2: 0.5,
              b2: 0.5,
              a2: 1,
              borderR: 1,
              borderG: 1,
              borderB: 1,
              borderA: 1,
              initCode: ['t2 = 0.3;'],
              perFrameCode: ['ang = ang + 0.1;'],
              perPointCode: ['x = x + 0.05;']
            }
          ],
          originalParameters: {}
        }
      };

      const result = presetV6Schema.safeParse(preset);
      expect(result.success).toBe(true);
      expect(result.success ? (result.data as any).metadata.milkwave.supportTier : null).toBe('fallback-only');
    });
  });

  describe('Author extraction', () => {
    it('should handle various author formats', () => {
      expect(extractAuthorFromFilename('Martin - blue haze.milk')).toBe('Martin');
      expect(extractAuthorFromFilename('Rovastar + Aderrasi - Altars of Madness.milk')).toBe('Rovastar + Aderrasi');
      expect(extractAuthorFromFilename('01 - Geiss - Cosmic.milk')).toBe('Geiss');
      expect(extractAuthorFromFilename('Eo.S. + Geiss - glowsticks v2.milk')).toBe('Eo.S. + Geiss');
    });

    it('should return Unknown for unrecognized formats', () => {
      expect(extractAuthorFromFilename('abstract_nucleus.milk')).toBe('Unknown');
      expect(extractAuthorFromFilename('preset.milk')).toBe('Unknown');
    });
  });

  describe('Name extraction', () => {
    it('should extract preset name from filename', () => {
      expect(extractNameFromFilename('Martin - blue haze.milk')).toBe('blue haze');
      expect(extractNameFromFilename('01 - Geiss - Cosmic.milk')).toBe('Cosmic');
      expect(extractNameFromFilename('Eo.S. + Geiss - glowsticks v2.milk')).toBe('glowsticks v2');
    });
  });
});

// Integration test that requires Milkwave folder
describe('Milkwave folder integration (requires Milkwave project)', () => {
  const hasMilkwave = existsSync(milkwavePath);

  it.skipIf(!hasMilkwave)('should have access to Milkwave presets folder', () => {
    expect(hasMilkwave).toBe(true);
  });

  it.skipIf(!hasMilkwave)('should parse sample presets from Milkwave folder', () => {
    // Try to read a sample file
    const sampleFile = join(milkwavePath, 'Milkwave', '01 - Martin - blue haze.milk');
    if (!existsSync(sampleFile)) {
      console.log('Sample file not found, skipping test');
      return;
    }

    const content = readFileSync(sampleFile, 'utf-8');
    const result = parseMilkFile(content, '01 - Martin - blue haze.milk', 'Milkwave');

    expect(result).not.toBeNull();
    expect(result!.metadata.author).toBe('Martin');
    expect(result!.metadata.name).toBe('blue haze');
    expect(result!.warpShader).not.toBeNull();
    expect(result!.compShader).not.toBeNull();
  });
});
