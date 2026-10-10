// Debug: run one preset's _shaderData through patchMilkDropGlsl and print
// the patched GLSL around given line numbers (compile errors are reported
// against the patched source).
//   ./node_modules/.bin/ts-node --transpile-only scripts/debug-patcher-output.ts <preset-id> <pass=warp|comp> <line...>
import fs from 'fs';
import path from 'path';
import { patchMilkDropGlsl } from '../src/shared/milkwaveGlslPatcher';

const [presetId, passArg, ...lineArgs] = process.argv.slice(2);
if (!presetId) {
  console.error('Usage: ts-node scripts/debug-patcher-output.ts <preset-id> [warp|comp] [line ...]');
  process.exit(1);
}
const pass = passArg === 'comp' ? 'comp' : 'warp';

const presetPath = path.resolve(__dirname, '../assets/presets', `${presetId}.json`);
const preset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
const shaderData = preset._shaderData;
if (!shaderData) {
  console.error('No _shaderData on preset');
  process.exit(1);
}

const raw = pass === 'comp' ? shaderData.comp : shaderData.warp;
if (!raw) {
  console.error(`No ${pass} shader in _shaderData`);
  process.exit(1);
}

let patched: string;
try {
  patched = patchMilkDropGlsl(raw);
} catch (err) {
  console.error('patchMilkDropGlsl threw:', err);
  process.exit(1);
}

fs.writeFileSync(`/tmp/milkwave-debug-${pass}.glsl`, patched);
console.log(`Patched ${pass} written to /tmp/milkwave-debug-${pass}.glsl (${patched.split('\n').length} lines)`);

const lines = patched.split('\n');
for (const arg of lineArgs) {
  const n = Number(arg);
  if (!Number.isFinite(n)) continue;
  console.log(`\n── lines ${Math.max(1, n - 4)}-${Math.min(lines.length, n + 2)} (error reported at ${n}) ──`);
  for (let i = Math.max(1, n - 4); i <= Math.min(lines.length, n + 2); i++) {
    console.log(`${String(i).padStart(4)}: ${lines[i - 1]}`);
  }
}