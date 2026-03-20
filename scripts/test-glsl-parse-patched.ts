import fs from 'fs';
import path from 'path';
import { parse } from '@shaderfrog/glsl-parser';
import { patchMilkDropGlsl } from '../src/shared/milkwaveGlslPatcher';

const presetsDir = path.resolve(__dirname, '../assets/presets');
const files = fs.readdirSync(presetsDir)
  .filter(f => f.includes('-milkwave-') && f.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

let total = 0, parsed = 0, failed = 0;
const errors = new Map<string, number>();
const failedPresets: string[] = [];

for (const file of files) {
  const preset = JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf-8'));
  const sd = preset._shaderData;
  if (!sd) continue;

  for (const [pass, shader] of [['warp', sd.warp], ['comp', sd.comp]] as const) {
    if (!shader || typeof shader !== 'string') continue;
    total++;
    const patched = patchMilkDropGlsl(shader);
    try {
      parse(patched, { stage: 'fragment', quiet: true });
      parsed++;
    } catch (e: any) {
      failed++;
      const msg = (e.message || '').split('\n')[0].slice(0, 100);
      errors.set(msg, (errors.get(msg) || 0) + 1);
      if (failedPresets.length < 5) failedPresets.push(`${file} [${pass}]`);
    }
  }
}

console.log(`Total: ${total}, Parsed: ${parsed} (${(parsed/total*100).toFixed(1)}%), Failed: ${failed}`);
console.log('\nTop error types:');
[...errors.entries()].sort((a,b) => b[1] - a[1]).slice(0, 15).forEach(([msg, count]) => {
  console.log(`  ${count}x  ${msg}`);
});
if (failedPresets.length > 0) {
  console.log('\nFirst 5 failed presets:');
  failedPresets.forEach(p => console.log(`  ${p}`));
}
