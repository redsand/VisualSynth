/**
 * generate-non-milkwave-showcase.ts
 *
 * Scans assets/presets, excludes all Milkwave presets, then builds a single
 * demo project (Non-Milkwave Showcase) organised into named categories based
 * on the scores/metadata embedded in each preset.
 *
 * Usage:
 *   npx ts-node scripts/generate-non-milkwave-showcase.ts
 *   npm run showcase:generate
 *
 * Output:
 *   assets/generated/non-milkwave-showcase.project.json
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const PRESETS_DIR = path.join(REPO_ROOT, 'assets', 'presets');
const OUTPUT_DIR = path.join(REPO_ROOT, 'assets', 'generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'non-milkwave-showcase.project.json');

// Files to skip — metadata/audit reports that happen to be JSON
const SKIP_FILES = new Set([
  'archive_list.json',
  'coreClubPack.json',
  'core_club_pack.json',
  'presetArchive.json',
  'presetVariants.json',
  'variant_mapping.json',
  'milkwave_audit_report.json',
  'milkwave_certification_report.json',
]);

// Category display order (used both for grouping and scene-name prefix)
const CATEGORY_ORDER = [
  'drop',
  'build',
  'groove',
  'breakdown',
  'transition',
  'utility',
  'ambient',
] as const;

type Category = typeof CATEGORY_ORDER[number];

// ---------------------------------------------------------------------------
// Minimal types (mirrors project.ts / projectSchema.ts)
// ---------------------------------------------------------------------------

interface TransitionConfig { durationMs: number; curve: string; }
interface TriggerConfig { type: string; }
interface LayerRoles { core: string[]; support: string[]; atmosphere: string[]; }

interface LayerConfig {
  id: string;
  name: string;
  role?: string;
  enabled: boolean;
  opacity: number;
  blendMode: string;
  transform: { x: number; y: number; scale: number; rotation: number };
  params?: Record<string, unknown>;
  generatorId?: string;
  assetId?: string;
}

interface SourceScene {
  id?: string;
  scene_id?: string;
  name?: string;
  intent?: string;
  duration?: number;
  transition_in?: TransitionConfig;
  transition_out?: TransitionConfig;
  trigger?: TriggerConfig;
  assigned_layers?: LayerRoles;
  layers?: LayerConfig[];
  look?: unknown;
}

interface PresetScores {
  opener?: number;
  build?: number;
  drop?: number;
  breakdown?: number;
  transition?: number;
  utility?: number;
  crowdReadability?: number;
  perceivedDepth3D?: number;
  [key: string]: number | undefined;
}

interface PresetMetadata {
  name?: string;
  importedFrom?: string;
  milkwave?: unknown;
  role?: string;
  scores?: PresetScores;
  visualFamily?: string;
  intendedMusicStyle?: string;
  visualIntentTags?: string[];
  tag?: string;
  [key: string]: unknown;
}

interface PresetData {
  version?: number;
  metadata?: PresetMetadata;
  name?: string;
  scenes?: SourceScene[];
  layers?: LayerConfig[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Milkwave detection
// ---------------------------------------------------------------------------

function isMilkwave(filePath: string, data: PresetData): boolean {
  if (filePath.toLowerCase().includes('milkwave')) return true;
  if (data.metadata?.importedFrom === 'Milkwave') return true;
  if (data.metadata?.milkwave) return true;
  for (const scene of data.scenes ?? []) {
    for (const layer of scene.layers ?? []) {
      if (
        layer.id === 'layer-milkwave' ||
        layer.name === 'Milkwave' ||
        layer.generatorId === 'gen-milkwave'
      ) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Category assignment
// ---------------------------------------------------------------------------

function assignCategory(meta: PresetMetadata | undefined): Category {
  if (!meta) return 'ambient';

  // 1. Honour explicit metadata.role if it maps directly
  const role = meta.role?.toLowerCase();
  if (role === 'drop') return 'drop';
  if (role === 'build') return 'build';
  if (role === 'groove') return 'groove';
  if (role === 'breakdown') return 'breakdown';
  if (role === 'transition') return 'transition';
  if (role === 'utility') return 'utility';

  const scores = meta.scores;
  if (scores) {
    // 2. Find the score key with the highest value
    const candidates: [Category, number][] = [
      ['drop',       scores.drop       ?? 0],
      ['build',      scores.build      ?? 0],
      ['breakdown',  scores.breakdown  ?? 0],
      ['transition', scores.transition ?? 0],
      ['utility',    scores.utility    ?? 0],
    ];
    const best = candidates.reduce((a, b) => (b[1] > a[1] ? b : a));
    // Only claim a category if the winning score is meaningfully higher (≥7)
    if (best[1] >= 7) return best[0];
    // High opener score → groove
    if ((scores.opener ?? 0) >= 7) return 'groove';
  }

  // 3. Music style hints
  const style = (meta.intendedMusicStyle ?? '').toLowerCase();
  if (style.includes('techno') || style.includes('house') || style.includes('dance')) return 'groove';
  if (style.includes('ambient') || style.includes('chill')) return 'ambient';

  return 'ambient';
}

/** Lower is better within its category (high score = front) */
function categorySortKey(meta: PresetMetadata | undefined, cat: Category): number {
  const scores = meta?.scores;
  if (!scores) return 0;
  const scoreMap: Record<Category, number> = {
    drop:       scores.drop       ?? 0,
    build:      scores.build      ?? 0,
    groove:     scores.opener     ?? 0,
    breakdown:  scores.breakdown  ?? 0,
    transition: scores.transition ?? 0,
    utility:    scores.utility    ?? 0,
    ambient:    scores.opener     ?? 0,
  };
  return -(scoreMap[cat] ?? 0);   // negate so that sort ascending = highest score first
}

// ---------------------------------------------------------------------------
// Scene extraction
// ---------------------------------------------------------------------------

const DEFAULT_TRANSITION: TransitionConfig = { durationMs: 600, curve: 'easeInOut' };

function extractScene(
  preset: PresetData,
  filePath: string,
  sceneId: string,
  displayName: string,
): object | null {
  const sourceScenes = preset.scenes ?? [];

  let baseScene: SourceScene | null = null;
  if (sourceScenes.length > 0) {
    baseScene = JSON.parse(JSON.stringify(sourceScenes[0])) as SourceScene;
  } else if (preset.layers && preset.layers.length > 0) {
    baseScene = { layers: JSON.parse(JSON.stringify(preset.layers)) as LayerConfig[] };
  }

  if (!baseScene || !baseScene.layers || baseScene.layers.length === 0) {
    return null;
  }

  return {
    id: sceneId,
    scene_id: sceneId,
    name: displayName,
    intent: baseScene.intent ?? 'ambient',
    duration: baseScene.duration ?? 0,
    transition_in: baseScene.transition_in ?? DEFAULT_TRANSITION,
    transition_out: baseScene.transition_out ?? DEFAULT_TRANSITION,
    trigger: baseScene.trigger ?? { type: 'manual' },
    assigned_layers: baseScene.assigned_layers ?? { core: [], support: [], atmosphere: [] },
    layers: baseScene.layers,
    look: baseScene.look ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log('[Showcase] Scanning presets…');

  // Read + filter presets
  const allFiles = fs.readdirSync(PRESETS_DIR)
    .filter(f => f.endsWith('.json') && !SKIP_FILES.has(f))
    .sort((a, b) => {
      // Numeric-aware sort so preset-002 < preset-010
      const numA = parseInt(a.match(/\d+/)?.[0] ?? '9999', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] ?? '9999', 10);
      return numA !== numB ? numA - numB : a.localeCompare(b);
    });

  interface PresetEntry {
    filePath: string;
    baseName: string;
    data: PresetData;
    meta: PresetMetadata | undefined;
    category: Category;
    sortKey: number;
    presetNum: number;
  }

  const entries: PresetEntry[] = [];

  for (const fileName of allFiles) {
    const filePath = path.join(PRESETS_DIR, fileName);
    let data: PresetData;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PresetData;
    } catch (e) {
      console.warn(`  [skip] ${fileName} — JSON parse error`);
      continue;
    }
    if (isMilkwave(filePath, data)) continue;

    const meta = data.metadata;
    const presetNum = parseInt(fileName.match(/\d+/)?.[0] ?? '9999', 10);
    const category = assignCategory(meta);

    entries.push({
      filePath,
      baseName: fileName.replace(/\.json$/, ''),
      data,
      meta,
      category,
      sortKey: categorySortKey(meta, category),
      presetNum,
    });
  }

  console.log(`[Showcase] Found ${entries.length} non-Milkwave presets`);

  // Group by category, sort within each group (by score desc, then preset# asc)
  const grouped = new Map<Category, PresetEntry[]>();
  for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
  for (const entry of entries) grouped.get(entry.category)!.push(entry);

  for (const [cat, group] of grouped) {
    group.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.presetNum - b.presetNum;
    });
    console.log(`  [${cat}] ${group.length} scene(s)`);
  }

  // Build flat scene list
  const scenes: object[] = [];
  let seq = 0;

  for (const cat of CATEGORY_ORDER) {
    for (const entry of grouped.get(cat)!) {
      const rawName =
        entry.meta?.name ||
        entry.data.name ||
        entry.baseName.replace(/^preset-\d+-/, '').replace(/-/g, ' ');
      const presetName = rawName
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const displayName = `[${cat.charAt(0).toUpperCase() + cat.slice(1)}] ${presetName}`;
      const sceneId = `showcase-${String(seq + 1).padStart(4, '0')}`;

      const scene = extractScene(entry.data, entry.filePath, sceneId, displayName);
      if (scene) {
        scenes.push(scene);
        seq++;
      } else {
        console.warn(`  [skip] ${entry.baseName} — no extractable scene`);
      }
    }
  }

  console.log(`[Showcase] ${scenes.length} scenes total`);

  if (scenes.length === 0) {
    console.error('[Showcase] No scenes extracted — aborting');
    process.exit(1);
  }

  const firstSceneId = (scenes[0] as { id: string }).id;
  const now = new Date().toISOString();

  const project = {
    version: 6,
    name: 'Non-Milkwave Showcase',
    category: 'Generated',
    createdAt: now,
    updatedAt: now,
    output: {
      enabled: false,
      fullscreen: false,
      scale: 1,
    },
    stylePresets: [
      { id: 'style-neutral', name: 'Neutral',   settings: { contrast: 1,   saturation: 1,   paletteShift: 0    } },
      { id: 'style-surge',   name: 'Surge',     settings: { contrast: 1.2, saturation: 1.4, paletteShift: 0.08 } },
      { id: 'style-noir',    name: 'Noir',      settings: { contrast: 1.4, saturation: 0.7, paletteShift: -0.12 } },
    ],
    activeStylePresetId: 'style-neutral',
    palettes: [
      { id: 'heat',      name: 'Heat',      colors: ['#000000', '#ff0000', '#ff7f00', '#ffff00', '#ffffff'] },
      { id: 'ocean',     name: 'Ocean',     colors: ['#000000', '#0000ff', '#007fff', '#00ffff', '#ffffff'] },
      { id: 'forest',    name: 'Forest',    colors: ['#000000', '#004000', '#008000', '#00c000', '#ffffff'] },
      { id: 'synthwave', name: 'Synthwave', colors: ['#000000', '#ff00ff', '#00ffff', '#ff0080', '#ffffff'] },
    ],
    activePaletteId: 'heat',
    macros: [
      { id: 'macro-1', name: 'Energy',   value: 0.5, targets: [{ target: 'effects.bloom', amount: 0.6 }, { target: 'particles.glow', amount: 0.35 }, { target: 'effects.feedback', amount: 0.2 }] },
      { id: 'macro-2', name: 'Motion',   value: 0.5, targets: [{ target: 'particles.speed', amount: 0.4 }, { target: 'layer-plasma.speed', amount: 0.35 }] },
      { id: 'macro-3', name: 'Color',    value: 0.5, targets: [{ target: 'style.saturation', amount: 0.35 }, { target: 'effects.chroma', amount: 0.2 }] },
      { id: 'macro-4', name: 'Density',  value: 0.5, targets: [{ target: 'particles.density', amount: 0.5 }, { target: 'layer-spectrum.opacity', amount: 0.35 }] },
      { id: 'macro-5', name: 'Macro 5',  value: 0.5, targets: [] },
      { id: 'macro-6', name: 'Macro 6',  value: 0.5, targets: [] },
      { id: 'macro-7', name: 'Macro 7',  value: 0.5, targets: [] },
      { id: 'macro-8', name: 'Macro 8',  value: 0.5, targets: [] },
    ],
    effects: {
      enabled: true,
      bloom: 0.25,
      blur: 0.05,
      chroma: 0.15,
      posterize: 0.1,
      kaleidoscope: 0.2,
      feedback: 0.1,
      persistence: 0.25,
    },
    expressiveFx: {
      enabled: true,
      energyBloom:  { enabled: false, macro: 0.35, intentBinding: { enabled: false, intent: 'ambient', amount: 0.35 }, expert: { threshold: 0.55, accumulation: 0.65 } },
      radialGravity:{ enabled: false, macro: 0.3,  intentBinding: { enabled: false, intent: 'ambient', amount: 0.35 }, expert: { strength: 0.6, radius: 0.65, focusX: 0.5, focusY: 0.5 } },
      motionEcho:   { enabled: false, macro: 0.3,  intentBinding: { enabled: false, intent: 'ambient', amount: 0.35 }, expert: { decay: 0.6, warp: 0.35 } },
      spectralSmear:{ enabled: false, macro: 0.3,  intentBinding: { enabled: false, intent: 'ambient', amount: 0.35 }, expert: { offset: 0.4, mix: 0.6 } },
    },
    particles: {
      enabled: true,
      density: 0.5,
      speed: 0.5,
      size: 0.5,
      glow: 0.5,
    },
    sdf: {
      enabled: false,
      shape: 'circle',
      scale: 0.5,
      edge: 0.05,
      glow: 0.1,
      rotation: 0,
      fill: 0,
    },
    visualizer: {
      enabled: false,
      mode: 'spectrum',
      opacity: 0.8,
      macroEnabled: false,
      macroId: 0,
    },
    lfos: [],
    envelopes: [],
    sampleHold: [],
    padMappings: new Array(256).fill('none'),
    timelineMarkers: [],
    assets: [],
    plugins: [],
    scenes,
    modMatrix: [],
    midiMappings: [],
    activeSceneId: firstSceneId,
    activeModeId: 'mode-cosmic',
    activeEngineId: 'engine-radial-core',
    colorChemistry: ['analog', 'balanced'],
    roleWeights: { core: 1, support: 1, atmosphere: 1 },
    tempoSync: { bpm: 120, source: 'auto' },
    customShaderBlocks: [],
    _generated: {
      generatedAt: now,
      source: 'assets/presets (non-Milkwave)',
      script: 'scripts/generate-non-milkwave-showcase.ts',
      sceneCount: scenes.length,
    },
  };

  // Write output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(project, null, 2) + '\n', 'utf-8');
  console.log(`[Showcase] Written → ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);
  console.log(`[Showcase] Done — ${scenes.length} scenes across ${CATEGORY_ORDER.length} categories`);
}

main();
