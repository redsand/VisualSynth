import fs from 'fs';
import path from 'path';
import { parse } from '@shaderfrog/glsl-parser';
import { _preprocess } from '../src/shared/milkwaveGlslPatcher';

const file = process.argv[2];
const pass = process.argv[3] || 'comp';
const presetsDir = path.resolve(__dirname, '../assets/presets');
const p = JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf-8'));
const shader = p._shaderData?.[pass] as string;
if (!shader) { console.log('No shader for pass:', pass); process.exit(1); }

const preprocessed = _preprocess(shader);
const lines = preprocessed.split('\n');
lines.forEach((l: string, i: number) => console.log(`${(i+1).toString().padStart(4)}: ${l}`));

console.log(`\n--- Total lines: ${lines.length} ---`);

// Try to parse
try {
  parse(preprocessed, { stage: 'fragment', quiet: true });
  console.log('PARSE: OK');
} catch (e: any) {
  console.log('PARSE FAILED:', e.message.split('\n')[0]);
  if (e.location) {
    console.log('At line:', e.location.start.line, 'col:', e.location.start.column);
  }
}
