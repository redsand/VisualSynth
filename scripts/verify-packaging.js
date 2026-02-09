const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const requiredPaths = [
  'assets/presets',
  'assets/templates',
  'showcase-performance.project.json'
];

const missing = requiredPaths.filter((relPath) => {
  const fullPath = path.join(projectRoot, relPath);
  return !fs.existsSync(fullPath);
});

if (missing.length > 0) {
  console.error('Packaging validation failed. Missing required paths:');
  missing.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

const showcasePath = path.join(projectRoot, 'showcase-performance.project.json');
try {
  const data = fs.readFileSync(showcasePath, 'utf-8');
  JSON.parse(data);
} catch (error) {
  console.error('Packaging validation failed. Showcase project is not valid JSON.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.log('Packaging validation passed.');
