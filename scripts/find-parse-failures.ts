import fs from 'fs';
import path from 'path';
import { patchMilkDropGlsl } from '../src/shared/milkwaveGlslPatcher';

const presetsDir = path.resolve(__dirname, '../assets/presets');
const files = fs.readdirSync(presetsDir)
  .filter(f => f.includes('-milkwave-') && f.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

let failCount = 0;
for (const file of files) {
  const preset = JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf-8'));
  const sd = preset._shaderData;
  if (!sd) continue;
  for (const [pass, shader] of [['warp', sd.warp], ['comp', sd.comp]] as const) {
    if (!shader || typeof shader !== 'string') continue;
    try {
      patchMilkDropGlsl(shader);
    } catch (e: any) {
      failCount++;
      console.log(`${file} [${pass}]: ${e.message.split('\n')[0].slice(0, 120)}`);
    }
  }
}
console.log(`\nTotal failures: ${failCount}`);
