const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src/renderer/glRenderer.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix float loop increments (i++ -> i += 1.0)
content = content.replace(/for\s*\(float\s+i\s*=\s*0\.0;\s*i\s*<\s*([^;]+);\s*i\+\+\)/g, 'for (float i = 0.0; i < $1; i += 1.0)');

// 2. Fix other float loop variants
content = content.replace(/for\s*\(float\s+i\s*=\s*1\.0;\s*i\s*<\s*([^;]+);\s*i\+\+\)/g, 'for (float i = 1.0; i < $1; i += 1.0)');

// 3. Fix literal assignments that might be treated as int
content = content.replace(/float\s+col\s*=\s*0;/g, 'float col = 0.0;');
content = content.replace(/float\s+v\s*=\s*0;/g, 'float v = 0.0;');
content = content.replace(/float\s+d\s*=\s*0;/g, 'float d = 0.0;');
content = content.replace(/float\s+heart\s*=\s*0;/g, 'float heart = 0.0;');
content = content.replace(/float\s+worm\s*=\s*0;/g, 'float worm = 0.0;');
content = content.replace(/float\s+pattern\s*=\s*0;/g, 'float pattern = 0.0;');
content = content.replace(/float\s+shape\s*=\s*0;/g, 'float shape = 0.0;');

// 4. Ensure scientific notation is handled correctly if any
// (1e10 is usually fine but let's be safe)
content = content.replace(/1e10/g, '10000000000.0');

fs.writeFileSync(filePath, content);
console.log('Successfully patched GLSL increments and float literals.');