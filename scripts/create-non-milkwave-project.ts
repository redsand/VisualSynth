import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const PRESETS_DIR = path.join(repoRoot, 'assets', 'presets');
const OUTPUT_DIR = repoRoot;
const MAX_SCENES_PER_FILE = 250;

interface LayerConfig {
  id: string;
  name: string;
  role?: string;
  enabled: boolean;
  opacity: number;
  blendMode: string;
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  params?: Record<string, any>;
  generatorId?: string;
  assetId?: string;
}

interface SceneConfig {
  id: string;
  scene_id: string;
  name: string;
  intent?: string;
  duration?: number;
  transition_in?: {
    durationMs: number;
    curve: string;
  };
  transition_out?: {
    durationMs: number;
    curve: string;
  };
  trigger?: {
    type: string;
  };
  assigned_layers?: {
    core: string[];
    support: string[];
    atmosphere: string[];
  };
  layers: LayerConfig[];
  look?: any;
  _shaderData?: any;
}

interface PresetData {
  version: number;
  metadata?: {
    name?: string;
    importedFrom?: string;
    milkwave?: any;
    [key: string]: any;
  };
  scenes?: SceneConfig[];
  layers?: LayerConfig[];
  name?: string;
  assets?: any[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function isMilkwavePreset(presetPath: string, data: PresetData): boolean {
  if (presetPath.toLowerCase().includes('milkwave')) {
    return true;
  }
  
  if (data.metadata?.importedFrom === 'Milkwave') {
    return true;
  }
  
  if (data.metadata?.milkwave) {
    return true;
  }
  
  const scenes = data.scenes || [];
  for (const scene of scenes) {
    for (const layer of scene.layers || []) {
      if (layer.id === 'layer-milkwave' || 
          layer.name === 'Milkwave' ||
          layer.generatorId === 'gen-milkwave') {
        return true;
      }
    }
  }
  
  return false;
}

function getNonMilkwavePresets(): { path: string; data: PresetData }[] {
  const files = fs.readdirSync(PRESETS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' } as any));
  
  const nonMilkwave: { path: string; data: PresetData }[] = [];
  
  for (const fileName of files) {
    const filePath = path.join(PRESETS_DIR, fileName);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data: PresetData = JSON.parse(content);
      
      if (!isMilkwavePreset(filePath, data)) {
        nonMilkwave.push({ path: filePath, data });
      }
    } catch (err) {
      console.error(`Error reading ${filePath}:`, err);
    }
  }
  
  return nonMilkwave;
}

function extractSceneFromPreset(preset: PresetData, presetPath: string, sceneIndex: number): SceneConfig | null {
  const scenes = preset.scenes || [];
  
  if (scenes.length === 0 && preset.layers) {
    const fileName = path.basename(presetPath, '.json');
    const sceneId = `non-milkwave-scene-${String(sceneIndex + 1).padStart(4, '0')}`;
    return {
      id: sceneId,
      scene_id: sceneId,
      name: preset.metadata?.name || preset.name || fileName,
      intent: 'ambient',
      duration: 0,
      transition_in: {
        durationMs: 600,
        curve: 'easeInOut'
      },
      transition_out: {
        durationMs: 600,
        curve: 'easeInOut'
      },
      trigger: {
        type: 'manual'
      },
      layers: preset.layers
    };
  }
  
  if (scenes.length > 0) {
    const baseScene = clone(scenes[0]);
    const sceneId = `non-milkwave-scene-${String(sceneIndex + 1).padStart(4, '0')}`;
    baseScene.id = sceneId;
    baseScene.scene_id = sceneId;
    
    const fileName = path.basename(presetPath, '.json');
    const presetName = preset.metadata?.name || preset.name || fileName;
    baseScene.name = presetName;
    
    return baseScene;
  }
  
  return null;
}

function createProject(scenes: SceneConfig[], bankNumber: number): any {
  const now = new Date().toISOString();
  
  return {
    version: 6,
    name: `Non-Milkwave Bank ${bankNumber} (${scenes.length} scenes)`,
    createdAt: now,
    updatedAt: now,
    output: {
      enabled: false,
      fullscreen: false,
      scale: 1
    },
    stylePresets: [],
    activeStylePresetId: "style-neutral",
    palettes: [
      {
        id: "heat",
        name: "Heat",
        colors: ["#000000", "#ff0000", "#ff7f00", "#ffff00", "#ffffff"]
      },
      {
        id: "ocean",
        name: "Ocean",
        colors: ["#000000", "#0000ff", "#007fff", "#00ffff", "#ffffff"]
      },
      {
        id: "forest",
        name: "Forest",
        colors: ["#000000", "#004000", "#008000", "#00c000", "#ffffff"]
      },
      {
        id: "synthwave",
        name: "Synthwave",
        colors: ["#000000", "#ff00ff", "#00ffff", "#ff0080", "#ffffff"]
      }
    ],
    activePaletteId: "heat",
    scenes: scenes,
    modMatrix: [],
    midiMappings: [],
    activeSceneId: scenes[0]?.id || "",
    activeModeId: "mode-cosmic",
    activeEngineId: "engine-radial-core",
    colorChemistry: ["analog", "balanced"],
    roleWeights: {
      core: 1,
      support: 1,
      atmosphere: 1
    },
    tempoSync: {
      bpm: 120,
      source: "auto"
    },
    customShaderBlocks: []
  };
}

function main(): void {
  console.log('Finding all non-milkwave presets...');
  const nonMilkwavePresets = getNonMilkwavePresets();
  console.log(`Found ${nonMilkwavePresets.length} non-milkwave presets`);
  
  const allScenes: SceneConfig[] = [];
  let sceneIndex = 0;
  
  for (const { path: presetPath, data: preset } of nonMilkwavePresets) {
    const scene = extractSceneFromPreset(preset, presetPath, sceneIndex);
    if (scene) {
      allScenes.push(scene);
      sceneIndex++;
    }
  }
  
  console.log(`Extracted ${allScenes.length} scenes`);
  
  const bankCount = Math.ceil(allScenes.length / MAX_SCENES_PER_FILE);
  console.log(`Creating ${bankCount} project file(s)...`);
  
  for (let bankIndex = 0; bankIndex < bankCount; bankIndex++) {
    const start = bankIndex * MAX_SCENES_PER_FILE;
    const end = Math.min(start + MAX_SCENES_PER_FILE, allScenes.length);
    const bankScenes = allScenes.slice(start, end);
    
    const project = createProject(bankScenes, bankIndex + 1);
    const outputPath = path.join(OUTPUT_DIR, `non-milkwave-bank-${String(bankIndex + 1).padStart(2, '0')}.project.json`);
    
    fs.writeFileSync(outputPath, JSON.stringify(project, null, 2) + '\n', 'utf-8');
    console.log(`Created ${outputPath} with ${bankScenes.length} scenes`);
  }
  
  console.log('Done!');
}

main();
