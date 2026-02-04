import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { migratePreset, validatePreset } from '../src/shared/presetMigration';

type PresetReport = {
  file: string;
  version?: number;
  migratedVersion?: number;
  migrationErrors: string[];
  validationErrors: string[];
  validationWarnings: string[];
};

const presetsDir = path.join(process.cwd(), 'assets', 'presets');
const files = fs
  .readdirSync(presetsDir)
  .filter((file) => file.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

const reports: PresetReport[] = [];

for (const file of files) {
  const fullPath = path.join(presetsDir, file);
  let raw: string;
  try {
    raw = fs.readFileSync(fullPath, 'utf8');
  } catch (err: any) {
    reports.push({
      file,
      migrationErrors: [`Read failed: ${err?.message ?? String(err)}`],
      validationErrors: [],
      validationWarnings: []
    });
    continue;
  }

  let preset: any;
  try {
    preset = JSON.parse(raw);
  } catch (err: any) {
    reports.push({
      file,
      migrationErrors: [`JSON parse failed: ${err?.message ?? String(err)}`],
      validationErrors: [],
      validationWarnings: []
    });
    continue;
  }

  const migration = migratePreset(preset);
  const migrated = migration.preset;
  const validation = validatePreset(migrated);

  if (!migration.success || !validation.valid || validation.warnings.length > 0) {
    reports.push({
      file,
      version: preset?.version,
      migratedVersion: migrated?.version,
      migrationErrors: migration.errors,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings
    });
  }
}

const failures = reports.filter(
  (report) => report.migrationErrors.length > 0 || report.validationErrors.length > 0
);

console.log(`Presets scanned: ${files.length}`);
console.log(`Presets with errors: ${failures.length}`);
console.log(`Presets with warnings: ${reports.filter((r) => r.validationWarnings.length > 0).length}`);

if (reports.length > 0) {
  console.log('');
  for (const report of reports) {
    console.log(`- ${report.file} (v${report.version ?? 'unknown'} -> v${report.migratedVersion ?? 'unknown'})`);
    if (report.migrationErrors.length > 0) {
      console.log(`  migration errors: ${report.migrationErrors.join(' | ')}`);
    }
    if (report.validationErrors.length > 0) {
      console.log(`  validation errors: ${report.validationErrors.join(' | ')}`);
    }
    if (report.validationWarnings.length > 0) {
      console.log(`  validation warnings: ${report.validationWarnings.join(' | ')}`);
    }
  }
}
