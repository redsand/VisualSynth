#!/usr/bin/env node
/**
 * Build 5 curated projects from 100% native-supported MilkDrop presets.
 * 
 * All presets in assets/presets/milkwave-verified/native-supported/ are verified:
 * - supportTier: "native-supported"
 * - No custom warp/comp shaders (no compile failures possible)
 * - No fallbacks, no degradation, no errors
 * - Backend: "milkwave-direct-v2" (direct wave/shape rendering)
 * 
 * Each project has 10 presets, organized by visual theme.
 */

const fs = require('fs');
const path = require('path');

const PRESETS_DIR = path.join(__dirname, '../assets/presets/milkwave-verified/native-supported');
const OUTPUT_DIR = path.join(__dirname, '../verified-projects');

// All 412 native-supported preset filenames
const ALL_NATIVE = fs.readdirSync(PRESETS_DIR).filter(f => f.endsWith('.json')).sort();

console.log(`Found ${ALL_NATIVE.length} native-supported presets`);

/**
 * Load a preset JSON and extract the scene config
 */
function loadPresetScene(filename) {
  const filePath = path.join(PRESETS_DIR, filename);
  const preset = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Extract the MilkDrop scene
  const scene = preset.scenes?.[0];
  if (!scene) return null;
  
  // Clean up the scene for project embedding
  const cleanScene = {
    ...scene,
    id: `scene-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    scene_id: scene.scene_id || 'scene-1',
    name: preset.metadata.name || filename.replace(/^preset-\d+-milkwave-/, '').replace(/\.json$/, ''),
    intent: scene.intent || 'ambient',
    duration: scene.duration || 0,
    transition_in: scene.transition_in || { durationMs: 800, curve: 'easeInOut' },
    transition_out: scene.transition_out || { durationMs: 800, curve: 'easeInOut' },
    trigger: scene.trigger || { type: 'manual' },
  };
  
  return { scene, cleanScene, preset };
}

/**
 * Build a project JSON with the given scenes
 */
function buildProject(name, description, scenes, intent = 'ambient') {
  const now = new Date().toISOString();
  return {
    version: 6,
    metadata: {
      version: 6,
      name,
      description,
      author: 'VisualSynth Verified',
      createdAt: now,
      updatedAt: now,
      category: 'Verified',
      intendedMusicStyle: 'Various',
      visualIntentTags: ['verified', 'native-supported', 'no-fallbacks'],
      colorChemistry: ['analog', 'balanced'],
      defaultTransition: { durationMs: 800, curve: 'easeInOut' }
    },
    scenes: scenes.map((s, i) => ({
      ...s.cleanScene,
      id: `scene-verified-${i + 1}`,
      scene_id: `scene-verified-${i + 1}`,
    })),
    overlays: [],
    layers: [],
    lfos: [],
    envelopes: [],
    sampleHolds: [],
    modMatrix: [],
    midiMappings: [],
    sdf: { enabled: false, shape: 'circle', scale: 0.5, edge: 0.1, glow: 0, rotation: 0, fill: 0 },
    effects: [{ enabled: true, bloom: 0.15, blur: 0, chroma: 0, posterize: 0, kaleidoscope: 0, feedback: 0.1, persistence: 0 }],
    particles: { enabled: false, density: 0.5, speed: 0.5, size: 0.5, glow: 0.3 },
    visualizer: { enabled: false, mode: 'off', opacity: 0.8, macroEnabled: false, macroId: 0 },
    activeSceneId: 'scene-verified-1',
    activeStylePresetId: null,
    palettes: [],
    macros: [],
    stylePresets: [],
    assets: [],
    customShaderBlocks: [],
    nowPlaying: {
      enabled: false,
      provider: 'shazam',
      clipDurationMs: 12000,
      pollIntervalMs: 15000,
      cooldownMs: 30000,
      titleOverlayId: null,
      artworkOverlayId: null,
      autoCreateOverlays: false,
      market: ''
    }
  };
}

// Curated selections by visual theme
// Each preset name contains hints about its visual style
const THEMES = {
  'geometric': {
    name: 'Verified: Geometric',
    description: '10 native-supported presets featuring geometric patterns, grids, and structured forms. Zero fallbacks, zero compile errors.',
    keywords: ['cube', 'grid', 'hex', 'spiral', 'tunnel', 'fractal', 'kaleid', 'symmetr', 'mandala', 'poly'],
  },
  'organic': {
    name: 'Verified: Organic Flow',
    description: '10 native-supported presets with flowing, organic, nature-inspired visuals. Zero fallbacks, zero compile errors.',
    keywords: ['flow', 'wave', 'fluid', 'blob', 'plasma', 'aurora', 'cloud', 'smoke', 'water', 'ripple', 'swirl', 'nebula'],
  },
  'beat-reactive': {
    name: 'Verified: Beat Reactive',
    description: '10 native-supported presets with strong audio reactivity. Bass detectors, frequency-responsive patterns. Zero fallbacks.',
    keywords: ['bass', 'beat', 'audio', 'spectrum', 'freq', 'volume', 'mod', 'detector', 'amplif', 'pulse'],
  },
  'abstract': {
    name: 'Verified: Abstract',
    description: '10 native-supported presets with abstract, surreal, and experimental visuals. Zero fallbacks, zero compile errors.',
    keywords: ['mashup', 'surreal', 'abstract', 'dream', 'psychedel', 'trippy', 'void', 'dimension', 'chaos', 'warp'],
  },
  'classic': {
    name: 'Verified: Classic MilkDrop',
    description: '10 native-supported presets that showcase the best of classic MilkDrop aesthetics. Zero fallbacks, zero compile errors.',
    keywords: ['shard', 'soul', 'anuera', 'drug', 'tumbling', 'potato', 'armand', 'geiss', 'martin', 'classic'],
  },
};

// Match presets to themes
function matchPresets(theme, allPresets) {
  const matched = [];
  const used = new Set();
  
  // First pass: keyword matching
  for (const presetFile of allPresets) {
    const lower = presetFile.toLowerCase();
    for (const keyword of theme.keywords) {
      if (lower.includes(keyword) && !used.has(presetFile)) {
        matched.push(presetFile);
        used.add(presetFile);
        break;
      }
    }
    if (matched.length >= 10) break;
  }
  
  // Second pass: fill remaining with unused presets
  if (matched.length < 10) {
    for (const presetFile of allPresets) {
      if (!used.has(presetFile) && matched.length < 10) {
        matched.push(presetFile);
        used.add(presetFile);
      }
    }
  }
  
  return matched.slice(0, 10);
}

// Build all projects
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const projects = [];

for (const [themeKey, theme] of Object.entries(THEMES)) {
  console.log(`\nBuilding project: ${theme.name}`);
  
  const matchedFiles = matchPresets(theme, ALL_NATIVE);
  console.log(`  Matched ${matchedFiles.length} presets`);
  
  const scenes = [];
  for (const filename of matchedFiles) {
    const result = loadPresetScene(filename);
    if (result) {
      scenes.push(result);
      console.log(`    ✓ ${result.preset.metadata.name || filename}`);
    } else {
      console.log(`    ✗ Failed to load ${filename}`);
    }
  }
  
  if (scenes.length === 0) {
    console.log(`  WARNING: No scenes loaded for ${themeKey}`);
    continue;
  }
  
  const project = buildProject(theme.name, theme.description, scenes);
  const outputPath = path.join(OUTPUT_DIR, `${themeKey}.project.json`);
  fs.writeFileSync(outputPath, JSON.stringify(project, null, 2));
  console.log(`  → Saved to ${outputPath} (${scenes.length} scenes)`);
  
  projects.push({ theme: themeKey, name: theme.name, scenes: scenes.length, file: outputPath });
}

// Summary
console.log('\n========================================');
console.log('VERIFIED PROJECTS SUMMARY');
console.log('========================================');
for (const p of projects) {
  console.log(`  ${p.name}: ${p.scenes} scenes → ${path.basename(p.file)}`);
}
console.log(`\nAll presets used are "native-supported" with:`);
console.log(`  - No custom warp/comp shaders (no compile risk)`);
console.log(`  - Backend: milkwave-direct-v2`);
console.log(`  - Zero fallbacks, zero degradation`);
console.log(`  - Zero GLSL compile errors`);
