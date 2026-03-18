const fs = require('fs');
const path = require('path');

const presetsDir = path.join(__dirname, '..', 'assets', 'presets');

const expectedLayerIds = [
  'gen-analog-oscillo',
  'gen-arcade-invaders',
  'gen-ascii-stream',
  'gen-audio-dna',
  'gen-aura-portal',
  'gen-aurora-chord',
  'gen-bio-luminescent-forest',
  'gen-blood-moon-rise',
  'gen-boss-health',
  'gen-bubble-pop',
  'gen-candlelight-vigil',
  'gen-caustic-liquid',
  'gen-cellular-growth',
  'gen-chiptune-wave',
  'gen-circuit-board',
  'gen-circuit-conduit',
  'gen-cosmic-nebula',
  'gen-crimson-veil',
  'gen-crypt-shadows',
  'gen-crystal-growth',
  'gen-crystalline',
  'gen-data-shards',
  'gen-data-stream',
  'gen-digital-rain-v2',
  'gen-dungeon-tiles',
  'gen-8bit-grid',
  'gen-electric-arc',
  'gen-eternal-darkness',
  'gen-fluid-swirl',
  'gen-fractal-tunnel',
  'gen-freq-terrain',
  'gen-gargoyles-awake',
  'gen-geo-wireframe',
  'gen-glitch-scanline',
  'gen-glow-worms',
  'gen-gothic-cobwebs',
  'gen-gothic-rose',
  'gen-grid-tunnel',
  'gen-hex-cell',
  'gen-hypercube',
  'gen-infinite-wormhole',
  'gen-laser-beam',
  'gen-laser-starfield',
  'gen-lava-flow',
  'gen-lightning',
  'gen-liquid-metal',
  'gen-lorenz-attractor',
  'gen-magnetic-field',
  'gen-mandala-spinner',
  'gen-milkwave',
  'gen-mirror-maze',
  'gen-moire-pattern',
  'gen-morphing-geometry',
  'gen-mycelium-growth',
  'gen-nebula-cloud',
  'gen-neon-cityscape',
  'gen-neural-net',
  'gen-particle-vortex',
  'gen-pixel-dust',
  'gen-pixel-rain',
  'gen-plasma-ball',
  'gen-power-up-pulse',
  'gen-prism-shards',
  'gen-pulsing-ribbons',
  'gen-pyro-burst',
  'gen-retro-starfield',
  'gen-retro-wave',
  'gen-ribbon-tunnel',
  'gen-score-counter',
  'gen-sdf-scene',
  'gen-shape-burst',
  'gen-shimmer-veil',
  'gen-signal-noise',
  'gen-sonic-rain',
  'gen-sound-wave-3d',
  'gen-speaker-cone',
  'gen-spectral-apparition',
  'gen-strobe',
  'gen-techno-grid',
  'gen-urban-rhythm',
  'gen-vhs-glitch',
  'gen-victorian-crypt',
  'gen-visual-feedback',
  'gen-warp-drive',
  'gen-starburst-galaxy',
];

function fixLayerId(id) {
  if (!id) return id;
  if (id.startsWith('layer-gen-') && id.endsWith('-1')) {
    const newId = id.replace(/^layer-gen-/, 'gen-').replace(/-1$/, '');
    for (const expected of expectedLayerIds) {
      if (newId === expected || newId.replace(/-/g, '') === expected.replace(/-/g, '')) {
        return expected;
      }
    }
    return newId;
  }
  return id;
}

function fixPreset(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    console.log(`Skipping ${filePath} - invalid JSON`);
    return;
  }
  let modified = false;
  if (json.scenes) {
    for (const scene of json.scenes) {
      if (scene.layers) {
        for (const layer of scene.layers) {
          const oldId = layer.id;
          const newId = fixLayerId(oldId);
          if (oldId !== newId) {
            console.log(`  ${path.basename(filePath)}: ${oldId} -> ${newId}`);
            layer.id = newId;
            modified = true;
          }
        }
      }
    }
  }
  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
    return 1;
  }
  return 0;
}

let fixedCount = 0;
const files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.json'));
for (const file of files) {
  const result = fixPreset(path.join(presetsDir, file));
  if (result) fixedCount++;
}
console.log(`\nFixed ${fixedCount} presets.`);
