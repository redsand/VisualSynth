import fs from 'fs';
import path from 'path';
import { patchMilkDropGlsl } from '../src/shared/milkwaveGlslPatcher';

const presetsDir = path.resolve(__dirname, '../assets/presets');
const milkwavePresets = fs
  .readdirSync(presetsDir)
  .filter((f) => f.includes('-milkwave-') && f.endsWith('.json'));

let i = 0;
for (const fileName of milkwavePresets) {
  const preset = JSON.parse(
    fs.readFileSync(path.join(presetsDir, fileName), 'utf-8')
  );
  const shaderData = preset._shaderData;
  if (!shaderData) continue;
  
  for (const [pass, shader] of [
    ['warp', shaderData.warp],
    ['comp', shaderData.comp],
  ] as const) {
    if (!shader || typeof shader !== 'string') continue;
    try {
      console.log(`Testing ${fileName} [${pass}]`);
      patchMilkDropGlsl(shader);
    } catch(e) {
      console.log(`Failed on ${fileName} [${pass}]`, e);
    }
  }
}
console.log('Done!');
