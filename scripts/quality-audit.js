const fs = require('fs');
const path = require('path');

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');
const files = fs.readdirSync(presetsDir).filter((f) => f.endsWith('.json'));

const args = process.argv.slice(2);
const fix = args.includes('--fix');

console.log('--- PRESET QUALITY AUDIT & CLEANUP ---');
if (fix) console.log('FIX MODE ENABLED - Modifying files...');
console.log('');

const stats = {
  fixed: 0,
  deleted: 0,
  total: files.length
};

const similarityPairs = []; // To track similarity for cleanup

files.forEach(file => {
  const fullPath = path.join(presetsDir, file);
  try {
    let raw = fs.readFileSync(fullPath, 'utf8');
    let preset = JSON.parse(raw);
    let changed = false;

    // 1. Fix Dead Macros (remove targets array if empty or rename to generic if needed)
    // Actually, it's better to REMOVE macros that do nothing to declutter UI
    if (preset.macros) {
      const initialCount = preset.macros.length;
      preset.macros = preset.macros.filter(m => {
        const isGeneric = m.name === 'Macro ' + m.id.split('-')[1];
        const hasTargets = m.targets && m.targets.length > 0;
        return hasTargets || !isGeneric; // Keep if it has targets OR a custom name
      });
      if (preset.macros.length !== initialCount) changed = true;
    }

    // 2. Remove Generic "Pulse Scene" if it is just a copy-paste boilerplate and scene 1 is better
    if (preset.scenes && preset.scenes.length === 2) {
      const s2 = preset.scenes[1];
      if (s2.name === 'Pulse Scene' && s2.layers?.length === 1 && s2.layers[0].id === 'layer-spectrum') {
        if (fix) {
          console.log('  [FIX] Removing boilerplate Pulse Scene from ' + file);
          preset.scenes.splice(1, 1);
          changed = true;
        }
      }
    }

    // 3. Add default modulation if missing (Audio Reactivity is CORE to product)
    if ((!preset.modulations || preset.modulations.length === 0) && preset.scenes?.[0]?.layers?.length > 0) {
       if (fix) {
         const firstLayer = preset.scenes[0].layers[0];
         preset.modulations = [
           {
             source: 'audio.rms',
             target: { type: firstLayer.id.replace('layer-', ''), param: 'opacity' },
             amount: 0.3,
             min: 0.5,
             max: 1.0,
             curve: 'linear',
             smoothing: 0.5,
             bipolar: false
           }
         ];
         console.log('  [FIX] Added default modulation to ' + file);
         changed = true;
       }
    }

    if (changed && fix) {
      fs.writeFileSync(fullPath, JSON.stringify(preset, null, 2));
      stats.fixed++;
    }
  } catch (e) {}
});

// 4. Handle extreme similarity (Delete duplicates)
// We already know 068/069/066 are near identical.
const toDelete = [
  'preset-069-gravity-wells.json', // Duplicate of 068
  'preset-066-feedback-veil.json', // Duplicate of 068
  'preset-055-wormhole-core-echo.json', // Duplicate of 054
  'preset-053-tunnel-warp-spiral.json', // Duplicate of 052
  'preset-038-glitch-datamosh-hard.json', // Duplicate of 037
  'preset-044-kaleido-shard-iris.json', // Duplicate of 043
  'preset-003-ambient.json' // Duplicate of 001
];

if (fix) {
  toDelete.forEach(f => {
    const p = path.join(presetsDir, f);
    if (fs.existsSync(p)) {
      console.log('  [DELETE] Removing redundant preset: ' + f);
      fs.unlinkSync(p);
      stats.deleted++;
    }
  });
}

console.log('\n--- CLEANUP SUMMARY ---');
console.log('Total Presets: ' + stats.total);
if (fix) {
  console.log('Files Fixed: ' + stats.fixed);
  console.log('Files Deleted: ' + stats.deleted);
  console.log('Remaining: ' + (stats.total - stats.deleted));
} else {
  console.log('Run with --fix to apply changes.');
}