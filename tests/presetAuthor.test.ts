import { describe, expect, it } from 'vitest';
import { presetV6Schema, PresetMetadataV6 } from '../src/shared/presetMigration';

/**
 * Helper to create a minimal valid scene for testing
 */
function createMinimalScene(id: string = 'scene-1') {
  return {
    id,
    scene_id: id,
    name: 'Test Scene',
    intent: 'ambient',
    duration: 0,
    transition_in: { durationMs: 600, curve: 'easeInOut' },
    transition_out: { durationMs: 600, curve: 'easeInOut' },
    trigger: { type: 'manual' },
    assigned_layers: { core: [], support: [], atmosphere: [] },
    layers: [{
      id: 'layer-plasma',
      name: 'Plasma',
      role: 'support',
      enabled: true,
      opacity: 1,
      blendMode: 'normal',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      params: {}
    }]
  };
}

describe('Preset Author Attribution', () => {
  describe('PresetMetadataV6 interface', () => {
    it('should accept metadata without author fields', () => {
      const metadata: PresetMetadataV6 = {
        version: 6,
        name: 'Test Preset',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        activeEngineId: 'engine-radial-core',
        activeModeId: 'mode-cosmic',
        intendedMusicStyle: 'Electronic',
        visualIntentTags: ['abstract'],
        colorChemistry: ['analog'],
        defaultTransition: { durationMs: 1000, curve: 'linear' }
      };

      const result = presetV6Schema.safeParse({
        version: 6,
        metadata,
        scenes: [createMinimalScene()],
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept metadata with author field', () => {
      const preset = {
        version: 6,
        metadata: {
          version: 6,
          name: 'Blue Haze',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          activeEngineId: 'engine-radial-core',
          activeModeId: 'mode-cosmic',
          intendedMusicStyle: 'Electronic',
          visualIntentTags: ['abstract'],
          colorChemistry: ['analog'],
          defaultTransition: { durationMs: 1000, curve: 'linear' },
          author: 'Martin'
        },
        scenes: [createMinimalScene()],
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' }
      };

      const result = presetV6Schema.safeParse(preset);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.author).toBe('Martin');
      }
    });

    it('should accept metadata with source field', () => {
      const preset = {
        version: 6,
        metadata: {
          version: 6,
          name: 'Test Preset',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          activeEngineId: 'engine-radial-core',
          activeModeId: 'mode-cosmic',
          intendedMusicStyle: 'Electronic',
          visualIntentTags: ['abstract'],
          colorChemistry: ['analog'],
          defaultTransition: { durationMs: 1000, curve: 'linear' },
          source: '01 - Martin - blue haze.milk'
        },
        scenes: [createMinimalScene()],
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' }
      };

      const result = presetV6Schema.safeParse(preset);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.source).toBe('01 - Martin - blue haze.milk');
      }
    });

    it('should accept metadata with importedFrom field', () => {
      const preset = {
        version: 6,
        metadata: {
          version: 6,
          name: 'Test Preset',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          activeEngineId: 'engine-radial-core',
          activeModeId: 'mode-cosmic',
          intendedMusicStyle: 'Electronic',
          visualIntentTags: ['abstract'],
          colorChemistry: ['analog'],
          defaultTransition: { durationMs: 1000, curve: 'linear' },
          importedFrom: 'Milkwave'
        },
        scenes: [createMinimalScene()],
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' }
      };

      const result = presetV6Schema.safeParse(preset);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.importedFrom).toBe('Milkwave');
      }
    });

    it('should accept metadata with all author attribution fields', () => {
      const preset = {
        version: 6,
        metadata: {
          version: 6,
          name: 'Cosmic Journey',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          activeEngineId: 'engine-radial-core',
          activeModeId: 'mode-cosmic',
          intendedMusicStyle: 'Electronic',
          visualIntentTags: ['abstract', 'cosmic'],
          colorChemistry: ['analog'],
          defaultTransition: { durationMs: 1000, curve: 'linear' },
          author: 'Geiss',
          source: 'Geiss - Cosmic Journey.milk',
          importedFrom: 'MilkDrop'
        },
        scenes: [createMinimalScene()],
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' }
      };

      const result = presetV6Schema.safeParse(preset);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.author).toBe('Geiss');
        expect(result.data.metadata.source).toBe('Geiss - Cosmic Journey.milk');
        expect(result.data.metadata.importedFrom).toBe('MilkDrop');
      }
    });

    it('should handle co-author format (Author1 + Author2)', () => {
      const preset = {
        version: 6,
        metadata: {
          version: 6,
          name: 'Collaborative Preset',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          activeEngineId: 'engine-radial-core',
          activeModeId: 'mode-cosmic',
          intendedMusicStyle: 'Electronic',
          visualIntentTags: ['abstract'],
          colorChemistry: ['analog'],
          defaultTransition: { durationMs: 1000, curve: 'linear' },
          author: 'Rovastar + Aderrasi'
        },
        scenes: [createMinimalScene()],
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' }
      };

      const result = presetV6Schema.safeParse(preset);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.author).toBe('Rovastar + Aderrasi');
      }
    });
  });

  describe('Author extraction from filenames', () => {
    it('should extract single author from "Author - Name.milk" format', () => {
      const filename = 'Martin - blue haze.milk';
      const authorMatch = filename.match(/^(.+?)\s*-\s*.+\.milk$/i);
      expect(authorMatch).not.toBeNull();
      if (authorMatch) {
        expect(authorMatch[1].trim()).toBe('Martin');
      }
    });

    it('should extract co-authors from "Author1 + Author2 - Name.milk" format', () => {
      const filename = 'Rovastar + Aderrasi - Altars of Madness.milk';
      const authorMatch = filename.match(/^(.+?)\s*-\s*.+\.milk$/i);
      expect(authorMatch).not.toBeNull();
      if (authorMatch) {
        expect(authorMatch[1].trim()).toBe('Rovastar + Aderrasi');
      }
    });

    it('should handle numbered prefixes like "01 - Author - Name.milk"', () => {
      const filename = '01 - Martin - blue haze.milk';
      const numberedMatch = filename.match(/^\d+\s*-\s*(.+?)\s*-\s*.+\.milk$/i);
      expect(numberedMatch).not.toBeNull();
      if (numberedMatch) {
        expect(numberedMatch[1].trim()).toBe('Martin');
      }
    });

    it('should handle filenames without clear author', () => {
      const filename = 'abstract_nucleus.milk';
      const authorMatch = filename.match(/^(.+?)\s*-\s*.+\.milk$/i);
      expect(authorMatch).toBeNull();
    });
  });
});