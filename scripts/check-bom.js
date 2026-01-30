const fs = require('fs');
const path = require('path');

const filePath = path.join('assets/presets/preset-107-glyph-matrix.json');
const buffer = fs.readFileSync(filePath);

console.log('First 4 bytes:', buffer.slice(0, 4));
console.log('Hex:', buffer.slice(0, 4).toString('hex'));

if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
  console.log('BOM detected!');
} else {
  console.log('No BOM detected.');
}
