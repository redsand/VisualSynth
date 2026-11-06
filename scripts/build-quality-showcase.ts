// Build the "most quality scenes" performance project.
//
// Selects the highest-quality scenes from the certified library using the
// ffmpeg signalstats ground truth in the reverified batch reports (the only
// visibility measure that doesn't under-detect — see the batch reports in
// milkwave-test-results/reports/batch-*-report-reverified.json), then imports
// each selected preset through the app's REAL import path
// (migratePreset → validatePreset → applyPresetV6 → the same scene assembly
// addSceneFromSourceProject performs in src/renderer/index.ts), applies
// slideshow auto-advance defaults, and assembles a v6 project modeled on the
// user's real show project (overlays, palettes, tempo carried over).
//
// Quality score per candidate (all from signalstats over 3 settled frames):
//   0.40 · midBrightness   — mean yavg proximity to 115 (visible, not searing)
//   0.35 · contrastSpread  — mean (ymax - ymin) / 255
//   0.25 · motion          — mean |Δyavg| between consecutive frames (capped)
// Family dedupe keeps the set visually diverse: near-identical letter/digit
// variants of the 01_MW / 02_MW starfield series collapse to one per
// subfamily, and Mashup (N) (distinct author mashups) gets a fixed quota.
//
// Usage: ts-node --transpile-only scripts/build-quality-showcase.ts
//
// Growing an existing show without discarding hand edits:
//   --screen-out=<file>   write a project of the certified-safe presets that
//                         have NO reverified screenshot stats, to screen with
//                         scripts/audit-project.ts --no-output
//   --append=<N> --screened=<audit dir> --screen-project=<screen file>
//                         merge the audit's per-scene luma stats into the
//                         candidate pool, then append the N best new scenes
//                         to the existing OUT_PATH (presets already in the
//                         show, or in --reject=<a,b,..> preset basenames, are
//                         skipped; family dedupe is seeded from the show)
import fs from 'fs';
import path from 'path';
import {
  migratePreset,
  validatePreset,
  applyPresetV6
} from '../src/shared/presetMigration';
import {
  DEFAULT_PROJECT,
  DEFAULT_SCENE_TRANSITION,
  DEFAULT_SCENE_TRIGGER,
  SceneConfig,
  SceneLook,
  VisualSynthProject
} from '../src/shared/project';
import { cloneLayerConfig } from '../src/shared/layers';
import { applySlideshowDefaults } from '../src/shared/slideshow';
import { projectSchema } from '../src/shared/projectSchema';

const ROOT = path.resolve(__dirname, '..');
const PRESET_DIR = path.join(ROOT, 'assets/presets');
const BASE_PROJECT = path.join(ROOT, 'showcase-performance.project-sues.json');
const REPORT_GLOB = 'milkwave-test-results/reports/batch-*-report-reverified.json';
const OUT_PATH = path.join(ROOT, 'showcase-quality-tonight.project.json');

const TARGET_SCENE_COUNT = 32;
const MASHUP_QUOTA = 10;
const STARFIELD_QUOTA = 13; // across 01_MW_* and 02_MW_* subfamilies, 1 each

// Verified-quality by screenshot stats, but tripped the renderer's
// "Poor frame cadence" safe-mode guard consistently in the dist verification
// (scripts/verify-quality-showcase.ts, even with a 4s settle) — excluded so
// the show never lands on a shader that stalls frames.
const EXCLUDED_PRESETS = ['mashup-(282)', '02_mw_new01f_u'];

// ── candidate collection + scoring ──────────────────────────────────────────

interface Candidate {
  presetPath: string;
  name: string;
  score: number;
  brightness: number; // mean yavg
  spread: number;
  motion: number;
  family: string; // dedupe key
  group: 'gem' | 'mashup' | 'starfield';
}

const collectCandidates = (): Candidate[] => {
  const reportFiles = fs
    .readdirSync(path.join(ROOT, 'milkwave-test-results/reports'))
    .filter((f) => /^batch-\d+-report-reverified\.json$/.test(f))
    .map((f) => path.join(ROOT, 'milkwave-test-results/reports', f));
  if (reportFiles.length === 0) throw new Error('no reverified reports found');

  const candidates: Candidate[] = [];
  for (const reportFile of reportFiles) {
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    for (const result of report.results) {
      const rv = result.reverify ?? {};
      // ground-truth visibility gate: seen in screenshots AND not blown out
      if (!rv.visible || rv.blownOut) continue;
      const shots = result.shotStats as Array<{ ymin: number; ymax: number; yavg: number }>;
      if (!Array.isArray(shots) || shots.length < 2) continue;

      const presetPath = path.join(PRESET_DIR, path.basename(result.presetFile));
      if (!fs.existsSync(presetPath)) continue;
      if (EXCLUDED_PRESETS.some((ex) => path.basename(presetPath).includes(ex))) continue;
      let preset: any;
      try {
        preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
      } catch {
        continue;
      }
      // certification gate: only certified-safe scenes make the show
      if (preset?.metadata?.certification !== 'safe') continue;
      candidates.push(makeCandidate(presetPath, preset, shots, result.presetId));
    }
  }
  return dedupeByPath(candidates);
};

// The same preset can appear in several reports — keep the best score.
const dedupeByPath = (candidates: Candidate[]): Candidate[] => {
  const byPath = new Map<string, Candidate>();
  for (const c of candidates) {
    const existing = byPath.get(c.presetPath);
    if (!existing || c.score > existing.score) byPath.set(c.presetPath, c);
  }
  return [...byPath.values()];
};

const makeCandidate = (
  presetPath: string,
  preset: any,
  shots: Array<{ ymin: number; ymax: number; yavg: number }>,
  fallbackName: string
): Candidate => {
  const brightness = shots.reduce((s, x) => s + x.yavg, 0) / shots.length;
  const spread =
    shots.reduce((s, x) => s + (x.ymax - x.ymin) / 255, 0) / shots.length;
  let motionSum = 0;
  for (let i = 1; i < shots.length; i += 1) {
    motionSum += Math.abs(shots[i].yavg - shots[i - 1].yavg);
  }
  const motion = Math.min(1, motionSum / (shots.length - 1) / 30);

  const midBrightness = 1 - Math.min(1, Math.abs(brightness - 115) / 115);
  const score = 0.4 * midBrightness + 0.35 * spread + 0.25 * motion;

  const name: string = preset.metadata?.name || fallbackName;
  return { presetPath, name, score, brightness, spread, motion, ...classify(name) };
};

const classify = (name: string): Pick<Candidate, 'family' | 'group'> => {
  const starfieldMatch = /^(0\d)_MW_NEW(\d+)/i.exec(name.replace(/[\s_]+/g, '_'));
  if (starfieldMatch) {
    // subfamily = series prefix + number + variant letter, e.g. 02-new03U
    // (new03U1a..e collapse together; new03T3c/T3d collapse, etc.)
    const variantLetter = /[A-Za-z]/.exec(name.slice(starfieldMatch[0].length))?.[0] ?? '';
    return { family: `${starfieldMatch[1]}-new${starfieldMatch[2]}${variantLetter.toUpperCase()}`, group: 'starfield' };
  }
  if (name.toUpperCase().startsWith('MASHUP')) return { family: 'mashup', group: 'mashup' };
  // gems: strip parenthesized credits, collapse dups like '[dylan] LED'
  return { family: name.replace(/\(.*?\)/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12), group: 'gem' };
};

// Candidates from an audit-project.ts run over a --screen-out project: the
// same visibility gate (main verdict ok = visible, not blown) plus clean
// diagnostics, scored from the audit's own signalstats samples.
const collectScreenedCandidates = (auditDir: string, screenProject: any): Candidate[] => {
  const pathBySceneName = new Map<string, string>(
    screenProject.scenes.map((s: any) => [s.name, s.presetPath])
  );
  const candidates: Candidate[] = [];
  for (const f of fs.readdirSync(auditDir).filter((x) => /^results-shard\d+of\d+\.json$/.test(x))) {
    const { rows } = JSON.parse(fs.readFileSync(path.join(auditDir, f), 'utf8'));
    for (const row of rows) {
      if (!row.activated || row.main !== 'ok' || row.shaderError || row.compileProblems?.length) continue;
      const presetPath = pathBySceneName.get(row.name);
      if (!presetPath) continue;
      const shots = String(row.mainStats).split(' ').filter(Boolean).map((t: string) => {
        const [ymin, ymax, yavg] = t.split('/').map(Number);
        return { ymin, ymax, yavg };
      });
      if (shots.length < 2) continue;
      const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
      candidates.push(makeCandidate(presetPath, preset, shots, row.name));
    }
  }
  return dedupeByPath(candidates);
};

// ── selection with family dedupe ────────────────────────────────────────────

const GEM_QUALITY_FLOOR = 0.35;

const selectScenes = (candidates: Candidate[]): Candidate[] => {
  const byScore = [...candidates].sort((a, b) => b.score - a.score);
  const selected: Candidate[] = [];
  const perFamily = new Map<string, number>();
  const usedNames = new Set<string>();
  const nameKey = (name: string) => name.toUpperCase().replace(/\s+/g, ' ');

  const take = (c: Candidate) => {
    selected.push(c);
    perFamily.set(c.family, (perFamily.get(c.family) ?? 0) + 1);
    usedNames.add(nameKey(c.name));
  };

  // gems: distinct author presets above the quality floor
  for (const c of byScore) {
    if (c.group === 'gem' && c.score >= GEM_QUALITY_FLOOR && (perFamily.get(c.family) ?? 0) === 0) {
      take(c);
    }
  }
  for (const c of byScore) {
    if (
      c.group === 'mashup' &&
      selected.filter((s) => s.group === 'mashup').length < MASHUP_QUOTA &&
      !usedNames.has(nameKey(c.name))
    ) {
      take(c);
    }
  }
  for (const c of byScore) {
    const starfields = selected.filter((s) => s.group === 'starfield').length;
    if (
      c.group === 'starfield' &&
      starfields < STARFIELD_QUOTA &&
      (perFamily.get(c.family) ?? 0) === 0
    ) {
      take(c);
    }
  }
  // top up to the target from anything left, respecting every dedupe rule
  for (const c of byScore) {
    if (selected.length >= TARGET_SCENE_COUNT) break;
    if (selected.includes(c)) continue;
    if (c.group === 'starfield' && (perFamily.get(c.family) ?? 0) > 0) continue;
    if (c.group === 'mashup' && (usedNames.has(nameKey(c.name)) || selected.filter((s) => s.group === 'mashup').length >= MASHUP_QUOTA + 2)) continue;
    if (c.group === 'gem' && ((perFamily.get(c.family) ?? 0) > 0 || c.score < GEM_QUALITY_FLOOR)) continue;
    take(c);
  }
  return interleaveGroups(selected).slice(0, TARGET_SCENE_COUNT);
};

// Interleave the three groups (best-score first within each) so the
// auto-advance rotation alternates visual families instead of running
// ten mashups back-to-back.
const interleaveGroups = (selected: Candidate[]): Candidate[] => {
  const queues: Record<Candidate['group'], Candidate[]> = { gem: [], mashup: [], starfield: [] };
  for (const c of selected) queues[c.group].push(c);
  const order: Candidate[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const group of ['gem', 'mashup', 'starfield'] as const) {
      const next = queues[group].shift();
      if (next) {
        order.push(next);
        added = true;
      }
    }
  }
  return order;
};

// ── scene assembly (mirrors addSceneFromSourceProject in index.ts) ─────────

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

// Imports one preset through the real path and assembles its scene exactly
// as addSceneFromSourceProject does; null (with a warning) if it fails.
const assembleScene = (
  candidate: { presetPath: string; name: string },
  id: string,
  template: VisualSynthProject,
  getUniqueSceneName: (baseName: string) => string
): SceneConfig | null => {
  const raw = JSON.parse(fs.readFileSync(candidate.presetPath, 'utf8'));
  const migration = migratePreset(raw);
  if (!migration.success) {
    console.warn(`SKIP ${candidate.name}: migration failed (${migration.errors.join(', ')})`);
    return null;
  }
  const validation = validatePreset(migration.preset);
  if (!validation.valid) {
    console.warn(`SKIP ${candidate.name}: validation failed (${validation.errors.join(', ')})`);
    return null;
  }
  const applied = applyPresetV6(migration.preset, template);
  const sourceProject = applied.project;
  const sourceScene =
    sourceProject.scenes.find((s: any) => s.id === sourceProject.activeSceneId) ??
    sourceProject.scenes[0];
  if (!sourceScene) {
    console.warn(`SKIP ${candidate.name}: preset has no scenes`);
    return null;
  }

  // Same look assembly as addSceneFromSourceProject: scene look is
  // authoritative, falling back to the (template-derived) project fields.
  const sceneLook = sourceScene.look;
  const look: SceneLook = {
    effects: cloneValue(sceneLook?.effects ?? sourceProject.effects ?? {}),
    particles: cloneValue(sceneLook?.particles ?? sourceProject.particles ?? {}),
    sdf: cloneValue(sceneLook?.sdf ?? sourceProject.sdf ?? {}),
    visualizer: cloneValue(sceneLook?.visualizer ?? sourceProject.visualizer ?? {}),
    stylePresets: cloneValue(sceneLook?.stylePresets ?? sourceProject.stylePresets ?? []),
    activeStylePresetId: cloneValue(
      sceneLook?.activeStylePresetId ?? sourceProject.activeStylePresetId ?? ''
    ),
    palettes: cloneValue(sceneLook?.palettes ?? sourceProject.palettes ?? []),
    activePaletteId:
      migratedPaletteId(migration.preset) ??
      sceneLook?.activePaletteId ??
      sourceProject.activePaletteId,
    macros: cloneValue(sceneLook?.macros ?? sourceProject.macros ?? []),
    modMatrix: cloneValue(sceneLook?.modMatrix ?? sourceProject.modMatrix ?? [])
  };

  
  const scene: SceneConfig = {
    id,
    scene_id: id,
    name: getUniqueSceneName(candidate.name),
    intent: sourceScene.intent ?? 'ambient',
    duration: typeof sourceScene.duration === 'number' ? sourceScene.duration : 0,
    transition_in: { ...DEFAULT_SCENE_TRANSITION, ...(sourceScene.transition_in ?? {}) },
    transition_out: { ...DEFAULT_SCENE_TRANSITION, ...(sourceScene.transition_out ?? {}) },
    trigger: { ...DEFAULT_SCENE_TRIGGER, ...(sourceScene.trigger ?? {}) },
    assigned_layers: {
      core: sourceScene.assigned_layers?.core ?? [],
      support: sourceScene.assigned_layers?.support ?? [],
      atmosphere: sourceScene.assigned_layers?.atmosphere ?? []
    },
    certification: sourceScene.certification ? cloneValue(sourceScene.certification) : undefined,
    depthScore: sourceScene.depthScore,
    complexity: sourceScene.complexity,
    tags: sourceScene.tags ? [...sourceScene.tags] : undefined,
    layers: sourceScene.layers.map(cloneLayerConfig),
    look,
    _shaderData: sourceScene._shaderData ? cloneValue(sourceScene._shaderData) : undefined,
    presetPath: candidate.presetPath
  };

  return applySlideshowDefaults(scene);
};

// Template handed to applyPresetV6 as `currentProject` — mirrors what the
// renderer passes live: the show project's global fields become the fallback
// look for scenes that ship without their own look.
const makeTemplate = (base: VisualSynthProject): VisualSynthProject => ({
  ...cloneValue(DEFAULT_PROJECT),
  effects: base.effects,
  particles: base.particles,
  sdf: base.sdf,
  visualizer: base.visualizer,
  stylePresets: base.stylePresets,
  activeStylePresetId: base.activeStylePresetId,
  palettes: base.palettes,
  activePaletteId: base.activePaletteId,
  macros: base.macros,
  modMatrix: base.modMatrix
});

const buildShowProject = (): void => {
  const base: VisualSynthProject = JSON.parse(fs.readFileSync(BASE_PROJECT, 'utf8'));
  const template = makeTemplate(base);

  const candidates = collectCandidates();
  console.log(`${candidates.length} verified-quality candidates`);
  const selection = selectScenes(candidates);
  const groups = {
    gem: selection.filter((s) => s.group === 'gem').length,
    mashup: selection.filter((s) => s.group === 'mashup').length,
    starfield: selection.filter((s) => s.group === 'starfield').length
  };
  console.log(
    `selected ${selection.length} scenes (gems=${groups.gem}, mashups=${groups.mashup}, starfields=${groups.starfield})`
  );

  const show: VisualSynthProject = {
    ...cloneValue(base),
    name: 'Quality Showcase — Tonight',
    createdAt: base.createdAt,
    updatedAt: new Date().toISOString(),
    scenes: [],
    activeSceneId: ''
  };

  const usedNames = new Set<string>();
  const getUniqueSceneName = (baseName: string) => {
    let name = baseName;
    let counter = 2;
    while (usedNames.has(name)) {
      name = `${baseName} ${counter}`;
      counter += 1;
    }
    usedNames.add(name);
    return name;
  };

  let failures = 0;
  selection.forEach((candidate, index) => {
    const scene = assembleScene(candidate, `scene-${index + 1}`, template, getUniqueSceneName);
    if (scene) show.scenes.push(scene);
    else failures += 1;
  });

  if (failures > 0) throw new Error(`${failures} selected presets failed to import`);
  if (show.scenes.length === 0) throw new Error('no scenes assembled');
  show.activeSceneId = show.scenes[0].id;

  const parsed = projectSchema.safeParse(show);
  if (!parsed.success) {
    throw new Error(`assembled project fails schema: ${JSON.stringify(parsed.error.issues.slice(0, 5))}`);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(show, null, 2));
  console.log(`\nwrote ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(1)} MB)`);
  show.scenes.forEach((scene, i) => {
    const shader = scene._shaderData
      ? `warp=${scene._shaderData.warp ? 'y' : '-'} comp=${scene._shaderData.comp ? 'y' : '-'}`
      : 'no-shaderdata';
    console.log(
      `${String(i + 1).padStart(2)}. ${scene.name} (score ${selection[i].score.toFixed(3)}, ${shader})`
    );
  });
};

// Only lock a palette in the scene look if the preset JSON explicitly
// specified one (mirrors presetExplicitPaletteId in addSceneFromPreset).
const migratedPaletteId = (migratedPreset: any): string | undefined =>
  migratedPreset.activePaletteId ||
  migratedPreset.project?.activePaletteId ||
  migratedPreset.project?.scenes?.[0]?.look?.activePaletteId ||
  undefined;

// ── growing an existing show ────────────────────────────────────────────────

const argValue = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const makeNameAllocator = (taken: string[]) => {
  const usedNames = new Set<string>(taken);
  return (baseName: string) => {
    let name = baseName;
    let counter = 2;
    while (usedNames.has(name)) {
      name = `${baseName} ${counter}`;
      counter += 1;
    }
    usedNames.add(name);
    return name;
  };
};

// Every preset any reverified report has judged, pass or fail — those already
// have ground truth and are not re-screened.
const reportedPresetPaths = (): Set<string> => {
  const dir = path.join(ROOT, 'milkwave-test-results/reports');
  const paths = new Set<string>();
  for (const f of fs.readdirSync(dir).filter((x) => /^batch-\d+-report-reverified\.json$/.test(x))) {
    for (const result of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).results) {
      paths.add(path.join(PRESET_DIR, path.basename(result.presetFile)));
    }
  }
  return paths;
};

const writeScreenProject = (outFile: string): void => {
  const base: VisualSynthProject = JSON.parse(fs.readFileSync(BASE_PROJECT, 'utf8'));
  const template = makeTemplate(base);
  const show: VisualSynthProject = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
  const skip = new Set<string>([...reportedPresetPaths(), ...show.scenes.map((s: any) => s.presetPath)]);
  const allocate = makeNameAllocator([]);
  const scenes: SceneConfig[] = [];
  for (const file of fs.readdirSync(PRESET_DIR).filter((x) => x.endsWith('.json')).sort()) {
    const presetPath = path.join(PRESET_DIR, file);
    if (skip.has(presetPath) || EXCLUDED_PRESETS.some((ex) => file.includes(ex))) continue;
    let preset: any;
    try {
      preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
    } catch {
      continue;
    }
    if (preset?.metadata?.certification !== 'safe') continue;
    const scene = assembleScene(
      { presetPath, name: preset.metadata?.name || file.replace(/\.json$/, '') },
      `screen-${scenes.length + 1}`,
      template,
      allocate
    );
    if (scene) scenes.push(scene);
  }
  const screen = { ...cloneValue(base), name: 'Screening candidates', scenes, activeSceneId: scenes[0]?.id ?? '' };
  fs.writeFileSync(outFile, JSON.stringify(screen));
  console.log(`wrote ${scenes.length} unscreened certified-safe scenes -> ${outFile}`);
};

const appendToShow = (count: number, auditDir: string, screenFile: string, rejects: string[]): void => {
  const show: VisualSynthProject = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
  const base: VisualSynthProject = JSON.parse(fs.readFileSync(BASE_PROJECT, 'utf8'));
  const template = makeTemplate(base);
  const inShow = new Set<string>(show.scenes.map((s: any) => s.presetPath));
  const pool = dedupeByPath([
    ...collectCandidates(),
    ...collectScreenedCandidates(auditDir, JSON.parse(fs.readFileSync(screenFile, 'utf8')))
  ]).filter((c) => !inShow.has(c.presetPath) && !rejects.some((r) => path.basename(c.presetPath).includes(r)));
  console.log(`${pool.length} new candidates (reverified + screened)`);

  // uniqueness seeded from the show: one per gem family / starfield
  // subfamily, each mashup name once
  const nameKey = (name: string) => name.toUpperCase().replace(/\s+/g, ' ');
  const usedFamilies = new Set<string>();
  const usedMashups = new Set<string>();
  for (const scene of show.scenes) {
    const { family, group } = classify(scene.name);
    if (group === 'mashup') usedMashups.add(nameKey(scene.name));
    else usedFamilies.add(family);
  }
  const picked: Candidate[] = [];
  for (const c of [...pool].sort((a, b) => b.score - a.score)) {
    if (picked.length >= count) break;
    if (c.group === 'mashup') {
      if (usedMashups.has(nameKey(c.name))) continue;
      usedMashups.add(nameKey(c.name));
    } else {
      if (usedFamilies.has(c.family)) continue;
      if (c.group === 'gem' && c.score < GEM_QUALITY_FLOOR) continue;
      usedFamilies.add(c.family);
    }
    picked.push(c);
  }
  console.log(`picked ${picked.length}/${count} (score range ${picked.at(-1)?.score.toFixed(3)}..${picked[0]?.score.toFixed(3)})`);

  const nextId = Math.max(0, ...show.scenes.map((s) => Number(/^scene-(\d+)$/.exec(s.id)?.[1] ?? 0))) + 1;
  const allocate = makeNameAllocator(show.scenes.map((s) => s.name));
  let failures = 0;
  interleaveGroups(picked).forEach((candidate, i) => {
    const scene = assembleScene(candidate, `scene-${nextId + i}`, template, allocate);
    if (scene) show.scenes.push(scene);
    else failures += 1;
  });
  if (failures > 0) throw new Error(`${failures} picked presets failed to import`);
  show.updatedAt = new Date().toISOString();
  const parsed = projectSchema.safeParse(show);
  if (!parsed.success) {
    throw new Error(`appended project fails schema: ${JSON.stringify(parsed.error.issues.slice(0, 5))}`);
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(show, null, 2));
  console.log(`wrote ${OUT_PATH}: ${show.scenes.length} scenes (${(fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(1)} MB)`);
  picked.forEach((c) => console.log(`  + ${c.name} (${c.group}, score ${c.score.toFixed(3)})`));
};

const screenOut = argValue('screen-out');
const appendCount = argValue('append');
if (screenOut) {
  writeScreenProject(screenOut);
} else if (appendCount) {
  const auditDir = argValue('screened');
  const screenFile = argValue('screen-project');
  if (!auditDir || !screenFile) throw new Error('--append needs --screened=<audit dir> and --screen-project=<file>');
  appendToShow(Number(appendCount), auditDir, screenFile, (argValue('reject') ?? '').split(',').filter(Boolean));
} else {
  buildShowProject();
}
