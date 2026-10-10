// Dump patched source lines around given line numbers for one saved shader.
// Usage: ts-node --transpile-only scripts/dump-patched.ts <name> <warp|comp> [batch]
import fs from 'fs';
import path from 'path';
import { patchMilkDropGlsl } from '../src/shared/milkwaveGlslPatcher';
const [name, stage, batch = '9221'] = process.argv.slice(2);
const file = path.resolve(__dirname, `../milkwave-test-results/shaders/batch-${batch}/${name}.${stage}.glsl`);
const patched = patchMilkDropGlsl(fs.readFileSync(file, 'utf-8'));
const lines = patched.split('\n');
const targets = process.argv.slice(5).map(Number);
for (const t of targets) {
  for (let i = Math.max(0, t - 2); i < Math.min(lines.length, t + 1); i++) {
    console.log(`${String(i + 1).padStart(4)} ${i + 1 === t ? '>' : ' '} ${lines[i]}`);
  }
  console.log('');
}
