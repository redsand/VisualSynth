import * as fs from 'fs';
import * as path from 'path';

interface LayerConfig {
  id: string;
  name: string;
  role?: string;
  enabled: boolean;
  opacity: number;
  blendMode: string;
  transform: { x: number; y: number; scale: number; rotation: number };
  params?: Record<string, any>;
  generatorId?: string;
}

interface SceneConfig {
  id: string;
  scene_id?: string;
  name: string;
  intent?: string;
  duration?: number;
  transition_in?: { durationMs: number; curve: string };
  transition_out?: { durationMs: number; curve: string };
  trigger?: { type: string };
  assigned_layers?: { core: string[]; support: string[]; atmosphere: string[] };
  layers: LayerConfig[];
  look?: any;
}

interface Preset {
  version: number;
  name: string;
  scenes: SceneConfig[];
  activeSceneId: string;
  [key: string]: any;
}

const presetDir = path.resolve(__dirname, '../assets/presets');
const presetFiles = fs.readdirSync(presetDir)
  .filter(f => f.startsWith('preset-') && f.endsWith('.json') && !f.includes('milkwave'))
  .sort((a, b) => {
    const numA = parseInt(a.match(/preset-(\d+)/)?.[1] || '9999');
    const numB = parseInt(b.match(/preset-(\d+)/)?.[1] || '9999');
    return numA - numB;
  });

console.log(`Found ${presetFiles.length} non-milkwave presets`);

const scenes: SceneConfig[] = [];
let sceneIndex = 0;

for (const file of presetFiles) {
  const filePath = path.join(presetDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const preset: Preset = JSON.parse(content);
    const presetName = preset.name || file.replace('preset-', '').replace('.json', '');
    
    // Get the first scene from the preset
    const sourceScene = preset.scenes?.[0];
    if (!sourceScene) {
      console.log(`Skipping ${file} - no scenes`);
      continue;
    }

    const sceneId = `showcase-${String(sceneIndex).padStart(3, '0')}`;
    
    const scene: SceneConfig = {
      id: sceneId,
      scene_id: sceneId,
      name: presetName,
      intent: sourceScene.intent || 'ambient',
      duration: 0,
      transition_in: { durationMs: 600, curve: 'easeInOut' },
      transition_out: { durationMs: 600, curve: 'easeInOut' },
      trigger: { type: 'manual' },
      assigned_layers: sourceScene.assigned_layers || { core: [], support: [], atmosphere: [] },
      layers: sourceScene.layers || [],
      look: sourceScene.look
    };

    scenes.push(scene);
    sceneIndex++;
  } catch (err) {
    console.log(`Error parsing ${file}: ${err}`);
  }
}

const project = {
  version: 6,
  name: 'VisualSynth Showcase',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  activeSceneId: 'showcase-000',
  scenes,
  roleWeights: { core: 1, support: 1, atmosphere: 1 },
  tempoSync: { bpm: 120, source: 'manual' },
  modulations: [],
  macros: [],
  modMatrix: [],
  midiMappings: [],
  sdf: { enabled: false, shape: 'circle', scale: 0.5, edge: 0.05, glow: 0.1, rotation: 0, fill: 0 },
  assets: [],
  plugins: [],
  lfos: [],
  envelopes: [],
  sampleHold: [],
  activeEngineId: 'engine-default',
  activeModeId: 'mode-performance',
  activePaletteId: 'synthwave',
  palettes: [],
  colorChemistry: ['analog', 'balanced'],
  output: {
    enabled: false,
    fullscreen: false,
    scale: 1
  }
};

const outputPath = path.resolve(__dirname, '../visualsynth-showcase.project.json');
fs.writeFileSync(outputPath, JSON.stringify(project, null, 2));
console.log(`\nCreated showcase project with ${scenes.length} scenes`);
console.log(`Output: ${outputPath}`);