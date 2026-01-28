import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { migratePreset, applyPresetV3, validatePreset } from '../src/shared/presetMigration';
import { projectSchema } from '../src/shared/projectSchema';
import { DEFAULT_PROJECT } from '../src/shared/project';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');

describe('Preset Functionality', () => {
  const presetFiles = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json'));

  it('contains at least 10 presets', () => {
    expect(presetFiles.length).toBeGreaterThanOrEqual(10);
  });

  // Test each preset for full functionality
  presetFiles.forEach((file) => {
    it(`preset "${file}" should be fully functional`, async () => {
      const payload = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
      const data = JSON.parse(payload);

      // 1. Parse and validate v3 format
      expect(data.version).toBe(3);
      expect(data.metadata).toBeDefined();
      expect(data.metadata.name).toBeDefined();
      expect(data.metadata.compatibility).toBeDefined();
      expect(data.layers).toBeInstanceOf(Array);
      expect(data.modulations).toBeInstanceOf(Array);
      expect(data.macros).toBeInstanceOf(Array);

      // 2. Validate against v3 schema
      const { presetV3Schema } = await import('../src/shared/presetMigration');
      const v3Parsed = presetV3Schema.safeParse(data);
      expect(v3Parsed.success).toBe(true);
      if (!v3Parsed.success) {
        throw new Error(`V3 schema validation failed: ${JSON.stringify(v3Parsed.error.format(), null, 2)}`);
      }

      // 3. Migration should succeed
      const migrationResult = migratePreset(data);
      expect(migrationResult.success, `Migration failed: ${migrationResult.errors.join(', ')}`).toBe(true);
      expect(migrationResult.preset.version).toBe(3);

      // 4. Validate migrated preset
      const validationResult = validatePreset(migrationResult.preset);
      expect(validationResult.valid).toBe(true);
      if (!validationResult.valid) {
        console.error(`Validation errors for ${file}:`, validationResult.errors);
        throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
      }

      // 5. Apply to project format (v3 -> v2)
      const applyResult = applyPresetV3(migrationResult.preset, DEFAULT_PROJECT);
      expect(applyResult.project).toBeDefined();
      expect(applyResult.project.scenes).toBeInstanceOf(Array);
      expect(applyResult.project.scenes.length).toBeGreaterThan(0);
      expect(applyResult.project.scenes[0].layers).toBeInstanceOf(Array);

      // 6. Validate against v2 project schema
      const v2Parsed = projectSchema.safeParse(applyResult.project);
      expect(v2Parsed.success).toBe(true);
      if (!v2Parsed.success) {
        const formatted = JSON.stringify(v2Parsed.error.format(), null, 2);
        console.error(`V2 schema validation failed for ${file}:`, formatted);
        throw new Error(`V2 schema validation failed`);
      }

      // 7. Verify all 11 layers are present in the converted project
      const convertedProject = applyResult.project;
      const scene = convertedProject.scenes[0];
      expect(scene.layers.length).toBeGreaterThanOrEqual(2); // At least the preset's layers

      // 8. Verify expected layer IDs are present
      const expectedLayerIds = [
        'layer-plasma',
        'layer-spectrum',
        'layer-origami',
        'layer-glyph',
        'layer-crystal',
        'layer-inkflow',
        'layer-topo',
        'layer-weather',
        'layer-portal',
        'layer-oscillo'
      ];

      const convertedLayerIds = scene.layers.map((l: any) => l.id);
      // All default layers should be present (disabled if not in preset)
      for (const layerId of expectedLayerIds) {
        expect(convertedLayerIds.includes(layerId), `Missing layer: ${layerId}`).toBe(true);
      }

      // 9. Verify preset layers are enabled
      const presetLayerIds = data.layers.map((l: any) => {
        const legacyId = l.type === 'plasma' ? 'layer-plasma' :
                           l.type === 'spectrum' ? 'layer-spectrum' :
                           l.type === 'origami' ? 'layer-origami' :
                           l.type === 'glyph' ? 'layer-glyph' :
                           l.type === 'crystal' ? 'layer-crystal' :
                           l.type === 'inkflow' ? 'layer-inkflow' :
                           l.type === 'topo' ? 'layer-topo' :
                           l.type === 'weather' ? 'layer-weather' :
                           l.type === 'portal' ? 'layer-portal' :
                           l.type === 'oscillo' ? 'layer-oscillo' :
                           `layer-${l.type}`;
        return legacyId;
      });

      for (const presetLayerId of presetLayerIds) {
        const layer = scene.layers.find((l: any) => l.id === presetLayerId);
        expect(layer, `Preset layer not found: ${presetLayerId}`).toBeDefined();
        expect(layer.enabled).toBe(true); // Preset layers should be enabled
      }

      // 10. Verify modMatrix structure
      expect(convertedProject.modMatrix).toBeInstanceOf(Array);
      if (data.modulations && data.modulations.length > 0) {
        expect(convertedProject.modMatrix.length).toBe(data.modulations.length);
        for (const mod of convertedProject.modMatrix) {
          expect(mod.id).toBeDefined();
          expect(mod.source).toBeDefined();
          expect(mod.target).toBeDefined();
          expect(typeof mod.amount).toBe('number');
          expect(typeof mod.min).toBe('number');
          expect(typeof mod.max).toBe('number');
          expect(['linear', 'exp', 'log']).toContain(mod.curve);
        }
      }

      // 11. Verify macros structure
      expect(convertedProject.macros).toBeInstanceOf(Array);
      if (data.macros && data.macros.length > 0) {
        expect(convertedProject.macros.length).toBe(data.macros.length);
        for (const macro of convertedProject.macros) {
          expect(macro.id).toBeDefined();
          expect(macro.name).toBeDefined();
          expect(typeof macro.value).toBe('number');
          expect(macro.targets).toBeInstanceOf(Array);
        }
      }

      // 12. Verify output configuration
      expect(convertedProject.output).toBeDefined();
      expect(convertedProject.output.width).toBeDefined();
      expect(convertedProject.output.height).toBeDefined();

      // 13. Verify effects configuration
      expect(convertedProject.effects).toBeDefined();
      expect(typeof convertedProject.effects.enabled).toBe('boolean');
      expect(typeof convertedProject.effects.bloom).toBe('number');
      expect(typeof convertedProject.effects.feedback).toBe('number');

      // 14. Verify LFOs
      expect(convertedProject.lfos).toBeInstanceOf(Array);

      // 15. Verify Envelopes
      expect(convertedProject.envelopes).toBeInstanceOf(Array);

      // 16. Verify Sample & Hold
      expect(convertedProject.sampleHold).toBeInstanceOf(Array);

      // 17. Verify no critical warnings
      const criticalErrors = migrationResult.errors.filter(e => e.length > 0);
      expect(criticalErrors.length).toBe(0);

      // 18. Verify metadata is complete
      expect(convertedProject.name || convertedProject.metadata?.name).toBeDefined();
    });
  });

  // Summary test to verify all presets passed
  it('all presets are fully functional', () => {
    const presetFiles = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json'));
    expect(presetFiles.length).toBeGreaterThan(0);

    // Quick smoke test - all presets should be loadable and valid
    let failedPresets: string[] = [];
    presetFiles.forEach((file) => {
      try {
        const payload = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
        const data = JSON.parse(payload);

        // Quick validation
        if (data.version !== 3) {
          failedPresets.push(`${file}: wrong version`);
          return;
        }

        const migrationResult = migratePreset(data);
        if (!migrationResult.success) {
          failedPresets.push(`${file}: migration failed`);
          return;
        }

        const applyResult = applyPresetV3(migrationResult.preset, DEFAULT_PROJECT);
        if (!applyResult.project) {
          failedPresets.push(`${file}: apply failed`);
          return;
        }

        const v2Parsed = projectSchema.safeParse(applyResult.project);
        if (!v2Parsed.success) {
          failedPresets.push(`${file}: validation failed`);
          return;
        }
      } catch (err) {
        failedPresets.push(`${file}: ${(err as Error).message}`);
      }
    });

    expect(failedPresets.length).toBe(0);
  });
});