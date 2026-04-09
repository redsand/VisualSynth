const { patchMilkDropGlsl, _preprocess } = require('../dist/main/shared/milkwaveGlslPatcher');
const fs = require('fs');

const shaderPath = process.argv[2];
if (!shaderPath || !fs.existsSync(shaderPath)) {
  console.log('Usage: node debug-preset.js <shader-path>');
  process.exit(1);
}

const shader = fs.readFileSync(shaderPath, 'utf8');
const preprocessed = _preprocess(shader);

console.log('=== PREPROCESSED (lines 130-145) ===');
const ppLines = preprocessed.split('\n');
for (let i = 129; i < 145 && i < ppLines.length; i++) {
  console.log((i+1).toString().padStart(4) + ':', ppLines[i]);
}

console.log('\n=== PATCHED (lines 130-145) ===');
const patched = patchMilkDropGlsl(shader);
const pLines = patched.split('\n');
for (let i = 129; i < 145 && i < pLines.length; i++) {
  console.log((i+1).toString().padStart(4) + ':', pLines[i]);
}

// Find all .xyz occurrences in preprocessed
console.log('\n=== .xyz in preprocessed ===');
for (let i = 0; i < ppLines.length; i++) {
  if (ppLines[i].includes('.xyz')) {
    console.log((i+1).toString().padStart(4) + ':', ppLines[i].substring(0, 80));
  }
}
