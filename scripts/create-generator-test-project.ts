import * as fs from 'fs';
import * as path from 'path';

const GENERATORS_TO_TEST = [
  { id: 'layer-plasma', name: 'Shader Plasma' },
  { id: 'gen-particles', name: 'Particles' },
  { id: 'layer-portal', name: 'Portal' },
  { id: 'layer-spectrum', name: 'Spectrum Bars' },
  { id: 'gen-cellular-growth', name: 'Cellular Growth' },
  { id: 'gen-bio-luminescent-forest', name: 'Biolumin' },
  { id: 'gen-crystalline', name: 'Crystalline' },
  { id: 'gen-audio-dna', name: 'Audio DNA' },
  { id: 'gen-liquid-metal', name: 'Liquid Metal' },
  { id: 'gen-neon-cityscape', name: 'Neon Cityscape' },
  { id: 'gen-cosmic-nebula', name: 'Cosmic Nebula' },
  { id: 'gen-sonic-rain', name: 'Sonic Rain' },
  { id: 'gen-morphing-geometry', name: 'Morphing Geometry' },
  { id: 'gen-urban-rhythm', name: 'Urban Rhythm' },
  { id: 'gen-crimson-veil', name: 'Crimson Veil' },
  { id: 'gen-victorian-crypt', name: 'Victorian Crypt' },
  { id: 'gen-spectral-apparition', name: 'Spectral Apparition' },
  { id: 'gen-gothic-cobwebs', name: 'Gothic Cobwebs' },
  { id: 'gen-blood-moon-rise', name: 'Blood Moon Rise' },
  { id: 'gen-candlelight-vigil', name: 'Candlelight Vigil' },
  { id: 'gen-gargoyles-awake', name: 'Gargoyles Awake' },
  { id: 'gen-crypt-shadows', name: 'Crypt Shadows' },
  { id: 'gen-gothic-rose', name: 'Gothic Rose' },
  { id: 'gen-eternal-darkness', name: 'Eternal Darkness' },
  { id: 'gen-pixel-dust', name: 'Pixel Dust' },
  { id: 'gen-retro-starfield', name: 'Retro Starfield' },
  { id: 'gen-8bit-grid', name: '8-Bit Grid' },
  { id: 'gen-arcade-invaders', name: 'Arcade Invaders' },
  { id: 'gen-power-up-pulse', name: 'Power-Up Pulse' },
  { id: 'gen-dungeon-tiles', name: 'Dungeon Tiles' },
  { id: 'gen-chiptune-wave', name: 'Chiptune Wave' },
  { id: 'gen-score-counter', name: 'Score Counter' },
  { id: 'gen-pixel-rain', name: 'Pixel Rain' },
  { id: 'gen-boss-health', name: 'Boss Health' },
  { id: 'layer-weather', name: 'Audio Weather' },
];

const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'generator-test.project.json');

function createLayer(generatorId: string, name: string, index: number) {
  return {
    id: `layer-${index}`,
    name: name,
    generatorId: generatorId,
    role: 'support',
    enabled: true,
    opacity: 1,
    blendMode: 'screen',
    transform: {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0
    },
    params: {
      enabled: true,
      opacity: 1,
      blendMode: 'screen'
    }
  };
}

function createScene(generatorId: string, name: string, index: number) {
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
      core: [],
      support: [`layer-${index}`],
      atmosphere: []
    },
    layers: [createLayer(generatorId, name, index)]
  };
}

function main() {
  const now = new Date().toISOString();
  
  const project: any = {
    version: 6,
    name: `Generator Test (${GENERATORS_TO_TEST.length} generators)`,
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
    scenes: GENERATORS_TO_TEST.map((g, i) => createScene(g.id, g.name, i + 1)),
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
    customShaderBlocks: []
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(project, null, 2) + '\n', 'utf-8');
  console.log(`Created ${outputPath} with ${project.scenes.length} test scenes`);
  
  console.log('\nGenerators to test:');
  GENERATORS_TO_TEST.forEach((g, i) => {
    console.log(`  ${i + 1}. ${g.name} (${g.id})`);
  });
}

main();
