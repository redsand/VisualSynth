import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  parseMilkFile,
  extractAuthorFromFilename,
  extractNameFromFilename
} from '../src/shared/milkwaveParser';
import { transpileMilkDropShader, inferPresetCategory } from '../src/shared/hlslToGlsl';
import { presetV6Schema } from '../src/shared/presetMigration';

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