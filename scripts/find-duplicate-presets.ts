import * as fs from 'fs';
import * as path from 'path';

interface LayerConfig {
  id: string;
  name: string;
  role: string;
  enabled: boolean;
  opacity: number;
  blendMode: string;
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  assetId?: string;
  generatorId?: string;
  params?: Record<string, any>;
  effects?: any[];
  sdfScene?: any;
}

interface SceneConfig {
  id: string;
  scene_id?: string;
  name: string;
  intent?: string;
  duration?: number;
  layers: LayerConfig[];
  look?: any;
  _shaderData?: any;
}

interface VisualSynthProject {
  name: string;
  scenes: SceneConfig[];
  stylePresets?: any[];
}

function normalizeValue(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Math.round(v * 1000) / 1000;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(normalizeValue);
  if (typeof v === 'object') {
    const sorted: Record<string, any> = {};
    for (const key of Object.keys(v).sort()) {
      sorted[key] = normalizeValue(v[key]);
    }
    return sorted;
  }
  return v;
}

function createLayerFingerprint(layer: LayerConfig): string {
  const normalized = {
    name: layer.name,
    role: layer.role,
    enabled: layer.enabled,
    opacity: Math.round(layer.opacity * 100) / 100,
    blendMode: layer.blendMode,
    transform: normalizeValue(layer.transform),
    generatorId: layer.generatorId,
    params: normalizeValue(layer.params),
  };
  return JSON.stringify(normalized);
}

function createSceneFingerprint(scene: SceneConfig): string {
  const layerFingerprints = scene.layers
    .filter(l => l.enabled)
    .map(createLayerFingerprint)
    .sort();
  
  const lookFingerprint = normalizeValue(scene.look);
  const shaderDataFingerprint = scene._shaderData ? {
    warp: scene._shaderData.warp?.slice(0, 200),
    comp: scene._shaderData.comp?.slice(0, 200),
  } : null;
  
  return JSON.stringify({
    layers: layerFingerprints,
    look: lookFingerprint,
    shaderData: shaderDataFingerprint,
    intent: scene.intent,
  });
}

function findProjectFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'release') {
        findProjectFiles(fullPath, files);
      }
    } else if (entry.name.endsWith('.project.json')) {
      if (!entry.name.includes('confirmed-manual-test')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function findDuplicatePresets() {
  const projectFiles = findProjectFiles('.');
  
  console.log(`Found ${projectFiles.length} project files\n`);
  
  const allScenes: Array<{
    file: string;
    sceneIndex: number;
    sceneName: string;
    fingerprint: string;
  }> = [];
  
  for (const file of projectFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const project: VisualSynthProject = JSON.parse(content);
      
      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        const fingerprint = createSceneFingerprint(scene);
        allScenes.push({
          file,
          sceneIndex: i,
          sceneName: scene.name,
          fingerprint,
        });
      }
    } catch (err) {
      console.error(`Error reading ${file}: ${err}`);
    }
  }
  
  console.log(`Total scenes: ${allScenes.length}\n`);
  
  const fingerprintGroups = new Map<string, typeof allScenes>();
  for (const scene of allScenes) {
    const existing = fingerprintGroups.get(scene.fingerprint) || [];
    existing.push(scene);
    fingerprintGroups.set(scene.fingerprint, existing);
  }
  
  const duplicates: Array<{ fingerprint: string; scenes: typeof allScenes }> = [];
  for (const [fingerprint, scenes] of fingerprintGroups) {
    if (scenes.length > 1) {
      duplicates.push({ fingerprint, scenes });
    }
  }
  
  if (duplicates.length === 0) {
    console.log('No duplicate scenes found!');
    return;
  }
  
  console.log(`Found ${duplicates.length} groups of duplicate scenes:\n`);
  
  for (let i = 0; i < duplicates.length; i++) {
    const { scenes } = duplicates[i];
    console.log(`=== Duplicate Group ${i + 1} (${scenes.length} scenes) ===`);
    
    for (const scene of scenes) {
      console.log(`  - ${scene.file}`);
      console.log(`    Scene ${scene.sceneIndex}: "${scene.sceneName}"`);
    }
    console.log('');
  }
  
  console.log('\n--- Summary ---');
  console.log(`Total duplicate groups: ${duplicates.length}`);
  console.log(`Total redundant scenes: ${duplicates.reduce((sum, d) => sum + d.scenes.length - 1, 0)}`);
}

findDuplicatePresets();
