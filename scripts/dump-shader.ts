import fs from 'fs';
import path from 'path';

const file = process.argv[2];
const pass = process.argv[3] || 'comp';
const mode = process.argv[4] || 'raw'; // 'raw' or 'preprocessed'
const presetsDir = path.resolve(__dirname, '../assets/presets');
const p = JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf-8'));
const shader = p._shaderData?.[pass] as string;
if (!shader) { console.log('No shader for pass:', pass); process.exit(1); }

if (mode === 'preprocessed') {
  // Dynamic import for the preprocess function
  const { patchMilkDropGlsl } = require('../src/shared/milkwaveGlslPatcher');
  // We need to export preprocess separately, but for now let's just show raw
  // Actually, let's parse the file to find the preprocess function
  console.log('(preprocessed mode not yet supported, showing raw)');
}

// Show full shader with line numbers
const lines = shader.split('\n');
lines.forEach((l: string, i: number) => console.log(`${(i+1).toString().padStart(4)}: ${l}`));
