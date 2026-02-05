const fs = require('fs');
const path = require('path');

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');
const files = fs.readdirSync(presetsDir).filter((f) => f.endsWith('.json'));

const audit = {
  total: files.length,
  overusedPulse: [],
  duplicatePalettes: {},
  lowQuality: [],
  highSimilarity: []
};

const palettes = {};

files.forEach(file => {
  const fullPath = path.join(presetsDir, file);
  try {
    const preset = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const name = preset?.metadata?.name || preset?.name || file;

    // 1. Check for Pulse Overuse
    let pulseCount = 0;
    if (preset.scenes) {
      preset.scenes.forEach(scene => {
        if (scene.intent === 'pulse') pulseCount++;
        if (scene.name && scene.name.toLowerCase().includes('pulse')) pulseCount++;
        if (scene.layers) {
          scene.layers.forEach(layer => {
            if (layer.id && layer.id.toLowerCase().includes('pulse')) pulseCount++;
          });
        }
      });
    }
    if (pulseCount > 2) {
      audit.overusedPulse.push({ file, name, count: pulseCount });
    }

    // 2. Color Similarity (Palette tracking)
    const paletteId = preset.metadata?.activePaletteId || preset.activePaletteId || 'default';
    if (!palettes[paletteId]) palettes[paletteId] = [];
    palettes[paletteId].push(file);

    // 3. Quality Score
    let score = 0;
    if (preset.modulations && preset.modulations.length > 0) score += 2;
    if (preset.macros && preset.macros.length > 4) score += 2;
    if (preset.scenes && preset.scenes.length > 1) score += 1;
    
    let layerComplexity = 0;
    if (preset.scenes) {
      preset.scenes.forEach(s => {
        layerComplexity += (s.layers ? s.layers.length : 0);
      });
    }
    if (layerComplexity > 3) score += 2;

    if (score < 3) {
      audit.lowQuality.push({ file, name, score });
    }
  } catch (e) {
    // console.error('Failed to parse ' + file);
  }
});

// Identify top palettes
Object.entries(palettes).forEach(([id, list]) => {
  if (id !== 'default' && list.length > 5) {
    audit.duplicatePalettes[id] = list.length;
  }
});

console.log('--- PRESET AUDIT REPORT ---');
console.log('Total Presets: ' + audit.total);
console.log('\n--- Potential Pulse Overuse ---');
audit.overusedPulse.sort((a,b) => b.count - a.count).slice(0, 10).forEach(p => {
  console.log('[' + p.count + '] ' + p.file + ' (' + p.name + ')');
});

console.log('\n--- Top Palettes (Potential Color Repetition) ---');
Object.entries(audit.duplicatePalettes).forEach(([id, count]) => {
  console.log(id + ': ' + count + ' presets');
});

console.log('\n--- Low Quality Candidates (Needs more layers/mods/macros) ---');
audit.lowQuality.slice(0, 10).forEach(q => {
  console.log('Score ' + q.score + ': ' + q.file);
});

console.log('\nAudit complete. Use "node scripts/preset-similarity.js --per-preset 1" for deep similarity check.');