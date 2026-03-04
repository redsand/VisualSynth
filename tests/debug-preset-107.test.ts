import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { migratePreset, applyPresetV6 } from '../src/shared/presetMigration';
import { projectSchema } from '../src/shared/projectSchema';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('Debug Preset Glyph Matrix', () => {
  it('should load, migrate, and validate preset-013-glyph-matrix.json', () => {
    const presetPath = path.resolve(__dirname, '../assets/presets/preset-013-glyph-matrix.json');
    const content = fs.readFileSync(presetPath, 'utf-8');
    const data = JSON.parse(content);

    // 1. Check Version
    expect(data.version).toBe(6);

    // 2. Migrate
    const migrationResult = migratePreset(data);
    expect(migrationResult.success).toBe(true);
    expect(migrationResult.errors).toHaveLength(0);

    // 3. Apply V6
    const migratedPreset = migrationResult.preset;
    expect(migratedPreset.version).toBe(6);
    const applyResult = applyPresetV6(migratedPreset, DEFAULT_PROJECT);
    expect(applyResult.project).toBeDefined();

    // 4. Validate Project Schema
    const projectParsed = projectSchema.safeParse(applyResult.project);
    if (!projectParsed.success) {
      console.error('Project Validation Errors:', JSON.stringify(projectParsed.error.format(), null, 2));
    }
    expect(projectParsed.success).toBe(true);
  });
});