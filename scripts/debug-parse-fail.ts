import fs from 'fs';
import path from 'path';

const presetsDir = path.resolve(__dirname, '../assets/presets');
const file = 'preset-557-milkwave-butterflies.json';
const preset = JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf-8'));
const shader = preset._shaderData.warp as string;
const lines = shader.split('\n');

// Track brace depth through the whole file
let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const prevDepth = depth;
  for (const ch of lines[i]) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  if (depth !== prevDepth || lines[i].includes('void') || lines[i].includes('shader_body')) {
    console.log(`  ${(i + 1).toString().padStart(3)}: [${prevDepth}→${depth}] ${lines[i].substring(0, 100)}`);
  }
}
console.log(`\nFinal depth: ${depth}`);
console.log(`Total lines: ${lines.length}`);
