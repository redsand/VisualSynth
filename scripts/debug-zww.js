const { patchMilkDropGlsl, _preprocess } = require('../dist/main/shared/milkwaveGlslPatcher');
const fs = require('fs');

const shaderPath = process.argv[2];
if (!shaderPath) {
  console.log('Usage: node debug-zww.js <shader-path>');
  process.exit(1);
}

const shader = fs.readFileSync(shaderPath, 'utf8');
console.log('=== RAW SOURCE ===');
const rawLines = shader.split('\n');
for (let i = 0; i < rawLines.length; i++) {
  if (rawLines[i].includes('zww') || rawLines[i].includes('texsize_noisevol')) {
    console.log((i+1).toString().padStart(4) + ':', rawLines[i].substring(0, 100));
  }
}

console.log('\n=== PREPROCESSED ===');
const preprocessed = _preprocess(shader);
const ppLines = preprocessed.split('\n');
for (let i = 0; i < ppLines.length; i++) {
  if (ppLines[i].includes('zww') || ppLines[i].includes('texsize_noisevol')) {
    console.log((i+1).toString().padStart(4) + ':', ppLines[i].substring(0, 100));
  }
}

console.log('\n=== PATCHED ===');
const patched = patchMilkDropGlsl(shader);
const pLines = patched.split('\n');
for (let i = 0; i < pLines.length; i++) {
  if (pLines[i].includes('zww') || pLines[i].includes('texsize_noisevol') || pLines[i].includes('.x') && pLines[i].includes('min(')) {
    console.log((i+1).toString().padStart(4) + ':', pLines[i].substring(0, 100));
  }
}
