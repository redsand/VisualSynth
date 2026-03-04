/**
 * Validate all presets and report errors
 */

import fs from 'fs';
import path from 'path';
import { presetV6Schema } from '../src/shared/presetMigration';

const presetsDir = path.resolve(__dirname, '../assets/presets');

const files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.json'));

let valid = 0;
let invalid = 0;
const errors: string[] = [];

for (const file of files) {
  const filePath = path.join(presetsDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const version = data.version || 2;

    if (version === 6) {
      const result = presetV6Schema.safeParse(data);
      if (!result.success) {
        invalid++;
        const errorSummary = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        errors.push(`${file}: ${errorSummary}`);
      } else {
        valid++;
      }
    } else {
      valid++; // Skip non-v6 presets
    }
  } catch (err) {
    invalid++;
    errors.push(`${file}: Parse error - ${err}`);
  }
}

console.log(`Valid presets: ${valid}`);
console.log(`Invalid presets: ${invalid}`);

if (errors.length > 0) {
  console.log('\nErrors:');
  errors.slice(0, 20).forEach(e => console.log(`  - ${e}`));
  if (errors.length > 20) {
    console.log(`  ... and ${errors.length - 20} more errors`);
  }
}
