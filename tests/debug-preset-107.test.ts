import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { presetV3Schema, migratePreset, applyPresetV4, applyPresetV5, applyPresetV6 } from '../src/shared/presetMigration';
import { projectSchema } from '../src/shared/projectSchema';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('Debug Preset 107', () => {
  it('should load, migrate, and validate preset-107-glyph-matrix.json', () => {
    const presetPath = path.resolve(__dirname, '../assets/presets/preset-107-glyph-matrix.json');
    const content = fs.readFileSync(presetPath, 'utf-8');
    const data = JSON.parse(content);

    // 1. Check Version
    expect(data.version).toBe(3);

    // 2. Validate V3 Schema
    const v3Parsed = presetV3Schema.safeParse(data);
    if (!v3Parsed.success) {
      console.error('V3 Validation Errors:', JSON.stringify(v3Parsed.error.format(), null, 2));
    }
    expect(v3Parsed.success).toBe(true);

    // 3. Migrate
    const migrationResult = migratePreset(data);
    expect(migrationResult.success).toBe(true);
    expect(migrationResult.errors).toHaveLength(0);

    // 4. Apply V3
    const migratedPreset = migrationResult.preset;
    const applyResult =
      migratedPreset.version === 6
        ? applyPresetV6(migratedPreset, DEFAULT_PROJECT)
        : migratedPreset.version === 5
          ? applyPresetV5(migratedPreset, DEFAULT_PROJECT)
          : applyPresetV4(migratedPreset, DEFAULT_PROJECT);
    expect(applyResult.project).toBeDefined();

    // 5. Validate V2 Schema (Project Schema)
    const v2Parsed = projectSchema.safeParse(applyResult.project);
    if (!v2Parsed.success) {
      console.error('V2 Validation Errors:', JSON.stringify(v2Parsed.error.format(), null, 2));
    }
    expect(v2Parsed.success).toBe(true);
  });
});
