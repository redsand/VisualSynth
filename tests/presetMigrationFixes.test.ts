import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { migratePreset, applyPresetV6 } from '../src/shared/presetMigration';
import { DEFAULT_PROJECT } from '../src/shared/project';

// migratePreset is a passthrough for version-6 presets, so applyPresetV6 sees
// the preset exactly as authored. DEFAULT_PROJECT.activeEngineId is
// 'engine-radial-core', whose first engine macro ('Energy') targets
// 'layer-plasma.opacity' — the default that used to replace user routing.

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// A structurally valid v6 preset (real glyph-matrix file) whose macros and
// modulations we override per test.
const basePreset = () => {
  const content = fs.readFileSync(
    path.resolve(__dirname, '../assets/presets/preset-013-glyph-matrix.json'),
    'utf-8'
  );
  return JSON.parse(content);
};

describe('preset migration: engine-active macro targets + modMatrix enabled', () => {
  it('#1 preserves a preset macro user routing (object-form target) instead of the engine default', () => {
    const preset = basePreset();
    // macro-1 matches engine-radial-core's first macro ('Energy') by id 'macro-1'.
    // Give it a custom user target distinct from the engine default
    // ('layer-plasma.opacity') in the serialized object form {type,param}.
    preset.macros = [
      { id: 'macro-1', name: 'Custom Speed', value: 0.3, targets: [{ target: { type: 'glyph', param: 'speed' }, amount: 0.6 }] }
    ];

    const { project } = applyPresetV6(migratePreset(preset).preset, clone(DEFAULT_PROJECT));

    const macro1 = project.macros[0];
    // Engine surface name is kept (adherence to the 5-7 macro surface)...
    expect(macro1.name).toBe('Energy');
    // ...but the user's value and routing survive, normalized to legacy string.
    expect(macro1.value).toBe(0.3);
    expect(macro1.targets).toEqual([{ target: 'layer-glyph.speed', amount: 0.6 }]);
    // And it is NOT the discarded engine default.
    expect(macro1.targets[0].target).not.toBe('layer-plasma.opacity');
  });

  it('#1 falls back to the engine default target when a preset macro has no targets', () => {
    const preset = basePreset();
    preset.macros = [{ id: 'macro-1', name: 'Custom', value: 0.4, targets: [] }];

    const { project } = applyPresetV6(migratePreset(preset).preset, clone(DEFAULT_PROJECT));

    expect(project.macros[0].value).toBe(0.4);
    expect(project.macros[0].targets).toEqual([{ target: 'layer-plasma.opacity', amount: 1.0 }]);
  });

  it('#9 preserves a disabled modMatrix connection through V6 load', () => {
    const preset = basePreset();
    preset.modulations = [
      { source: 'macro-1', target: 'layer-plasma.opacity', amount: 0.5, enabled: false }
    ];

    const { project } = applyPresetV6(migratePreset(preset).preset, clone(DEFAULT_PROJECT));

    expect(project.modMatrix.length).toBe(1);
    expect(project.modMatrix[0].enabled).toBe(false);
    expect(project.modMatrix[0].target).toBe('layer-plasma.opacity');
  });

  it('#9 defaults a connection to enabled when the enabled field is absent (legacy preset)', () => {
    const preset = basePreset();
    preset.modulations = [
      { source: 'macro-1', target: 'layer-plasma.opacity', amount: 0.5 }
    ];

    const { project } = applyPresetV6(migratePreset(preset).preset, clone(DEFAULT_PROJECT));

    expect(project.modMatrix[0].enabled).toBe(true);
  });
});