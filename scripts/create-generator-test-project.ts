import * as fs from 'fs';
import * as path from 'path';

const GENERATORS_TO_TEST = [
  { id: 'layer-plasma', name: 'Shader Plasma', role: 'core' },
  { id: 'layer-portal', name: 'Portal', role: 'support' },
  { id: 'layer-spectrum', name: 'Spectrum Bars', role: 'support' },
  { id: 'layer-oscillo', name: 'Sacred Oscilloscope', role: 'support' },
  { id: 'layer-weather', name: 'Audio Weather', role: 'atmosphere' },
  { id: 'gen-cellular-growth', name: 'Cellular Growth', role: 'support' },
  { id: 'gen-bio-luminescent-forest', name: 'Biolumin', role: 'support' },
  { id: 'gen-crystalline', name: 'Crystalline', role: 'support' },
  { id: 'gen-audio-dna', name: 'Audio DNA', role: 'support' },
  { id: 'gen-liquid-metal', name: 'Liquid Metal', role: 'support' },
  { id: 'gen-neon-cityscape', name: 'Neon Cityscape', role: 'support' },
  { id: 'gen-cosmic-nebula', name: 'Cosmic Nebula', role: 'support' },
  { id: 'gen-sonic-rain', name: 'Sonic Rain', role: 'support' },
  { id: 'gen-morphing-geometry', name: 'Morphing Geometry', role: 'support' },
  { id: 'gen-urban-rhythm', name: 'Urban Rhythm', role: 'support' },
  { id: 'gen-crimson-veil', name: 'Crimson Veil', role: 'support' },
  { id: 'gen-victorian-crypt', name: 'Victorian Crypt', role: 'support' },
  { id: 'gen-spectral-apparition', name: 'Spectral Apparition', role: 'support' },
  { id: 'gen-gothic-cobwebs', name: 'Gothic Cobwebs', role: 'support' },
  { id: 'gen-blood-moon-rise', name: 'Blood Moon Rise', role: 'support' },
  { id: 'gen-candlelight-vigil', name: 'Candlelight Vigil', role: 'support' },
  { id: 'gen-gargoyles-awake', name: 'Gargoyles Awake', role: 'support' },
  { id: 'gen-crypt-shadows', name: 'Crypt Shadows', role: 'support' },
  { id: 'gen-gothic-rose', name: 'Gothic Rose', role: 'support' },
  { id: 'gen-eternal-darkness', name: 'Eternal Darkness', role: 'support' },
  { id: 'gen-pixel-dust', name: 'Pixel Dust', role: 'support' },
  { id: 'gen-retro-starfield', name: 'Retro Starfield', role: 'support' },
  { id: 'gen-8bit-grid', name: '8-Bit Grid', role: 'support' },
  { id: 'gen-arcade-invaders', name: 'Arcade Invaders', role: 'support' },
  { id: 'gen-power-up-pulse', name: 'Power-Up Pulse', role: 'support' },
  { id: 'gen-dungeon-tiles', name: 'Dungeon Tiles', role: 'support' },
  { id: 'gen-chiptune-wave', name: 'Chiptune Wave', role: 'support' },
  { id: 'gen-score-counter', name: 'Score Counter', role: 'support' },
  { id: 'gen-pixel-rain', name: 'Pixel Rain', role: 'support' },
  { id: 'gen-boss-health', name: 'Boss Health', role: 'support' },
  { id: 'gen-asset-vortex', name: 'Asset Vortex', role: 'support', supportsAsset: true },
  { id: 'gen-asset-slices', name: 'Asset Slices', role: 'support', supportsAsset: true },
  { id: 'gen-asset-polar', name: 'Asset Polar Warp', role: 'support', supportsAsset: true },
  { id: 'gen-asset-mosaic', name: 'Asset Mosaic', role: 'support', supportsAsset: true },
  { id: 'gen-asset-ripple', name: 'Asset Ripples', role: 'support', supportsAsset: true },
  { id: 'gen-asset-scatter', name: 'Asset Scatter', role: 'support', supportsAsset: true },
  { id: 'gen-asset-echo', name: 'Asset Echo Ghosts', role: 'support', supportsAsset: true },
];

const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'generator-test.project.json');

function createLayer(generatorId: string, name: string, role: string) {
  return {
    id: generatorId,
    name: name,
    role: role,
    enabled: true,
    opacity: 0.85,
    blendMode: 'screen',
    transform: {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0
    }
  };
}

function createScene(generatorId: string, name: string, role: string, index: number) {
  const sceneId = `test-scene-${String(index).padStart(3, '0')}`;
  return {
    id: sceneId,
    scene_id: sceneId,
    name: `${index}. ${name}`,
    intent: 'test',
    duration: 0,
    transition_in: {
      durationMs: 300,
      curve: 'easeInOut'
    },
    transition_out: {
      durationMs: 300,
      curve: 'easeInOut'
    },
    trigger: {
      type: 'manual'
    },
    assigned_layers: {
      core: role === 'core' ? [generatorId] : [],
      support: role === 'support' ? [generatorId] : [],
      atmosphere: role === 'atmosphere' ? [generatorId] : []
    },
    layers: [createLayer(generatorId, name, role)]
  };
}

function main() {
  const now = new Date().toISOString();
  
  const project: any = {
    version: 6,
    name: `Generator Test (${GENERATORS_TO_TEST.length} generators + particles)`,
    createdAt: now,
    updatedAt: now,
    output: {
      enabled: false,
      fullscreen: false,
      scale: 1
    },
    stylePresets: [],
    activeStylePresetId: 'style-neutral',
    palettes: [
      {
        id: 'heat',
        name: 'Heat',
        colors: ['#000000', '#ff0000', '#ff7f00', '#ffff00', '#ffffff']
      },
      {
        id: 'ocean',
        name: 'Ocean',
        colors: ['#000000', '#0000ff', '#007fff', '#00ffff', '#ffffff']
      },
      {
        id: 'synthwave',
        name: 'Synthwave',
        colors: ['#000000', '#ff00ff', '#00ffff', '#ff0080', '#ffffff']
      }
    ],
    activePaletteId: 'synthwave',
    scenes: GENERATORS_TO_TEST.map((g, i) => createScene(g.id, g.name, g.role, i + 1)),
    modMatrix: [],
    midiMappings: [],
    activeSceneId: 'test-scene-001',
    activeModeId: 'mode-cosmic',
    activeEngineId: 'engine-radial-core',
    colorChemistry: ['analog', 'balanced'],
    roleWeights: {
      core: 1,
      support: 1,
      atmosphere: 1
    },
    tempoSync: {
      bpm: 120,
      source: 'auto'
    },
    customShaderBlocks: [],
    particles: {
      enabled: true,
      density: 0.5,
      speed: 0.5,
      size: 0.5,
      glow: 0.7,
      turbulence: 0.3,
      audioLift: 0.5
    }
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(project, null, 2) + '\n', 'utf-8');
  console.log(`Created ${outputPath} with ${project.scenes.length} test scenes`);
  
  console.log('\nGenerators to test:');
  GENERATORS_TO_TEST.forEach((g, i) => {
    console.log(`  ${i + 1}. ${g.name} (${g.id}) [${g.role}]`);
  });
  console.log('\n  + Global Particles System (enabled by default)');
}

main();
