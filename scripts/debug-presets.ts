import fs from 'fs';
import path from 'path';
import { presetV3Schema, migratePreset, applyPresetV3 } from '../src/shared/presetMigration';
import { projectSchema } from '../src/shared/projectSchema';
import { DEFAULT_PROJECT } from '../src/shared/project';

const presetsDir = path.join(process.cwd(), 'assets/presets');
console.log('Checking presets directory:', presetsDir);

if (!fs.existsSync(presetsDir)) {
  console.error('Presets directory does not exist!');
  process.exit(1);
}

// 1. List all presets and check name extraction
const files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.json'));
console.log(`Found ${files.length} preset files.`);

files.forEach(file => {
  const filePath = path.join(presetsDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    let name = 'Unknown';
    if (data.version === 3 && data.metadata?.name) {
      name = data.metadata.name;
    } else if (typeof data.name === 'string') {
      name = data.name;
    }

    if (name === 'Unknown' || name === file) {
      console.warn(`[WARNING] Could not extract name for ${file}. Version: ${data.version}`);
    }
  } catch (e) {
    console.error(`[ERROR] Failed to read/parse ${file}:`, e);
  }
});

// 2. Deep debug of preset-107-glyph-matrix.json
const targetPreset = 'preset-107-glyph-matrix.json';
console.log(`
--- Debugging ${targetPreset} ---`);
const targetPath = path.join(presetsDir, targetPreset);

if (!fs.existsSync(targetPath)) {
    console.error(`File ${targetPreset} not found!`);
    process.exit(1);
}

try {
  const content = fs.readFileSync(targetPath, 'utf-8');
  const data = JSON.parse(content);
  console.log('JSON Parse: OK');
  console.log('Version:', data.version);

  if (data.version === 3) {
    const v3Result = presetV3Schema.safeParse(data);
    if (!v3Result.success) {
      console.error('V3 Schema Validation FAILED:');
      // console.error(JSON.stringify(v3Result.error.format(), null, 2));
      console.dir(v3Result.error.format(), { depth: null });
    } else {
      console.log('V3 Schema Validation: OK');
    }

    const migration = migratePreset(data);
    if (!migration.success) {
      console.error('Migration FAILED:', migration.errors);
      console.error('Warnings:', migration.warnings);
    } else {
      console.log('Migration: OK');
      if (migration.warnings.length) console.log('Migration Warnings:', migration.warnings);
    }

    if (migration.success) {
        const applied = applyPresetV3(migration.preset, DEFAULT_PROJECT);
        if (!applied.project) {
            console.error('Apply Preset V3 FAILED (no project returned)');
        } else {
            console.log('Apply Preset V3: OK');
            if (applied.warnings.length) console.log('Apply Warnings:', applied.warnings);

            const v2Result = projectSchema.safeParse(applied.project);
            if (!v2Result.success) {
                console.error('V2 Project Schema Validation FAILED:');
                // console.error(JSON.stringify(v2Result.error.format(), null, 2));
                console.dir(v2Result.error.format(), { depth: null });
            } else {
                console.log('V2 Project Schema Validation: OK');
            }
        }
    }
  } else {
      console.log('Not V3, skipping V3 checks.');
      const v2Result = projectSchema.safeParse(data);
       if (!v2Result.success) {
            console.error('V2 Project Schema Validation FAILED:');
            // console.error(JSON.stringify(v2Result.error.format(), null, 2));
            console.dir(v2Result.error.format(), { depth: null });
        } else {
            console.log('V2 Project Schema Validation: OK');
        }
  }

} catch (e) {
  console.error('Exception during debug:', e);
}
