// Build the "Unique 100" showcase project — 100 brand-new scenes that appear
// in NO existing show project (showcase-performance.project-sues.json above
// all: the user's live show — hard requirement — plus every other showcase
// on disk, by name and by preset path).
//
// Candidate pool = the two ground-truth sources the quality-showcase pipeline
// proved out (see scripts/build-quality-showcase.ts and the batch reports):
//   1. reverified batch reports — ffmpeg-signalstats visibility passers
//      (visible, not blown out, certified safe)
//   2. --screened=<dir> — audit-project.ts results over the --screen-out
//      project this script emits for presets with no ground truth yet
//
// Selection for exactly TARGET_SCENE_COUNT scenes with diversity preserved:
//   gems (distinct-author presets)   — quality floor, one per family
//   mashups                           — each name once
//   starfields (01/02_MW_NEW* series) — per-subfamily cap so the show isn't
//                                       wall-to-wall letter variants
// then interleaved so the rotation alternates visual families.
//
// Usage:
//   ts-node --transpile-only scripts/build-unique-showcase.ts --screen-out=<file>
//   ts-node --transpile-only scripts/build-unique-showcase.ts --screened=<audit dir>
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
import { projectSchema } from '../src/shared/projectSchema';

const ROOT = path.resolve(__dirname, '..');
const PRESET_DIR = path.join(ROOT, 'assets/presets');
const REPORT_DIR = path.join(ROOT, 'milkwave-test-results/reports');
const BASE_PROJECT = path.join(ROOT, 'showcase-performance.project-sues.json');
const OUT_PATH = path.join(ROOT, 'showcase-unique-100.project.json');

// Every project on disk the user can already load — the new scenes must not
// be found in ANY of them.
const EXISTING_PROJECTS = [
  'showcase-performance.project-sues.json',
  'showcase-performance.project.json',
  'showcase-quality-tonight.project.json',
  'tonight-safe.project.json',
  'visualsynth-showcase.project.json'
];

const TARGET_SCENE_COUNT = 100;
// Calibrated 2026-11-06 against the post-fix audit (milkwave-test-results/
// postfix-audit): comp gamma shifted every brightness score down, so the
// pre-gamma 0.35 floor rejected scenes that now represent the good tail of
// the 123-passer pool. 0.20 keeps genuinely flat scenes out.
const GEM_QUALITY_FLOOR = 0.20;
const MASHUP_QUOTA = 45;
const STARFIELD_FAMILY_CAP = 4;
// Enough breadth to fill 100 scenes after the ~55% historical pass rate and
// name-variant dedupe, without auditing all 400 unscreened presets.
const SCREEN_POOL_SIZE = 160;

// Excluded from shows: `mashup-(282)` and `02_mw_new01f_u` trip the
// "Poor frame cadence" guard consistently (inherited list); `mashup-(290)`
// and `02_mw_new02c4` trip it in the diagnostics cycle on the post-fix
// engine (verify-quality-showcase 2026-11-06: sustained dwell exposes them
// even though they pass the screenshot ground-truth audit).
const EXCLUDED_PRESETS = ['mashup-(282)', '02_mw_new01f_u', 'mashup-(290)', '02_mw_new02c4'];

// ── candidate collection + scoring (same scale as build-quality-showcase) ──

interface Candidate {
  presetPath: string;
  name: string;
  score: number;
  family: string;
  group: 'gem' | 'mashup' | 'starfield';
}

const classify = (name: string): Pick<Candidate, 'family' | 'group'> => {
  const starfieldMatch = /^(0\d)_MW_NEW(\d+)/i.exec(name.replace(/[\s_]+/g, '_'));
  if (starfieldMatch) {
    // subfamily = series prefix + number + variant letter, e.g. 02-new03U
    const variantLetter = /[A-Za-z]/.exec(name.slice(starfieldMatch[0].length))?.[0] ?? '';
    return {
      family: `${starfieldMatch[1]}-new${starfieldMatch[2]}${variantLetter.toUpperCase()}`,
      group: 'starfield'
    };
  }
  if (name.toUpperCase().startsWith('MASHUP')) return { family: 'mashup', group: 'mashup' };
  // gems: strip parenthesized credits, collapse dups like '[dylan] LED'
  return {
    family: name.replace(/\(.*?\)/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12),
    group: 'gem'
  };
};

const scoreFromShots = (shots: Array<{ ymin: number; ymax: number; yavg: number }>): number => {
  const brightness = shots.reduce((s, x) => s + x.yavg, 0) / shots.length;
  const spread = shots.reduce((s, x) => s + (x.ymax - x.ymin) / 255, 0) / shots.length;
  let motionSum = 0;
  for (let i = 1; i < shots.length; i += 1) motionSum += Math.abs(shots[i].yavg - shots[i - 1].yavg);
  const motion = Math.min(1, motionSum / (shots.length - 1) / 30);
  const midBrightness = 1 - Math.min(1, Math.abs(brightness - 115) / 115);
  return 0.4 * midBrightness + 0.35 * spread + 0.25 * motion;
};

const loadPreset = (presetPath: string): any | null => {
  try {
    const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
    return preset?.metadata ? preset : null;
  } catch {
    return null;
  }
};

const makeCandidate = (presetPath: string, shots: Array<{ ymin: number; ymax: number; yavg: number }>): Candidate | null => {
  const base = path.basename(presetPath);
  if (EXCLUDED_PRESETS.some((ex) => base.includes(ex))) return null;
  const preset = loadPreset(presetPath);
  if (!preset) return null;
  if (preset.metadata.certification !== 'safe') return null;
  const name = preset.metadata.name || path.basename(presetPath, '.json');
  if (shots.length < 2) return null;
  return { presetPath, name, score: scoreFromShots(shots), ...classify(name) };
};

const collectReverifiedCandidates = (): Candidate[] => {
  const candidates: Candidate[] = [];
  const files = fs.readdirSync(REPORT_DIR).filter((f) => /^batch-\d+-report-reverified\.json$/.test(f));
  for (const file of files) {
    const report = JSON.parse(fs.readFileSync(path.join(REPORT_DIR, file), 'utf8'));
    for (const result of report.results) {
      const rv = result.reverify ?? {};
      if (!rv.visible || rv.blownOut) continue;
      const presetPath = path.join(PRESET_DIR, path.basename(result.presetFile));
      if (!fs.existsSync(presetPath)) continue;
      const shots = result.shotStats as Array<{ ymin: number; ymax: number; yavg: number }>;
      if (!Array.isArray(shots)) continue;
      const candidate = makeCandidate(presetPath, shots);
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
};

const collectScreenedCandidates = (auditDir: string, screenProjectFile: string): Candidate[] => {
  const screenProject = JSON.parse(fs.readFileSync(screenProjectFile, 'utf8'));
  const pathBySceneName = new Map<string, string>(
    (screenProject.scenes ?? []).map((s: any) => [s.name, s.presetPath])
  );
  const candidates: Candidate[] = [];
  for (const f of fs.readdirSync(auditDir).filter((x) => /^results-shard\d+of\d+\.json$/.test(x))) {
    const { rows } = JSON.parse(fs.readFileSync(path.join(auditDir, f), 'utf8'));
    for (const row of rows) {
      // Same bar as the audit's own pass criteria: safe-mode rows (poor
      // frame cadence guard) are rejected even though the frames looked
      // visible — a scene that stalls frames must not reach a show.
      if (!row.activated || row.main !== 'ok' || row.shaderError || row.safeMode || row.compileProblems?.length) continue;
      const presetPath = pathBySceneName.get(row.name);
      if (!presetPath) continue;
      const shots = String(row.mainStats).split(' ').filter(Boolean).map((t: string) => {
        const [ymin, ymax, yavg] = t.split('/').map(Number);
        return { ymin, ymax, yavg };
      });
      const candidate = makeCandidate(presetPath, shots);
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
};

const dedupeByPath = (candidates: Candidate[]): Candidate[] => {
  const byPath = new Map<string, Candidate>();
  for (const c of candidates) {
    const existing = byPath.get(c.presetPath);
    if (!existing || c.score > existing.score) byPath.set(c.presetPath, c);
  }
  return [...byPath.values()];
};

// ── exclusions: anything a user can already see in an existing project ────

interface Exclusions { paths: Set<string>; names: Set<string> }

const collectExclusions = (): Exclusions => {
  const paths = new Set<string>();
  const names = new Set<string>();
  for (const file of EXISTING_PROJECTS) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const project = JSON.parse(fs.readFileSync(full, 'utf8'));
    for (const scene of project.scenes ?? []) {
      names.add(scene.name?.trim().toUpperCase() ?? '');
      const presetPath = scene.presetPath;
      if (presetPath) paths.add(path.basename(presetPath));
    }
  }
  // NOTE: the output file (OUT_PATH) is deliberately NOT self-excluded — a
  // full build replaces it wholesale; excluding it would poison rebuilds
  // with the previous build's own scenes.
  return { paths, names };
};

// ── selection ───────────────────────────────────────────────────────────────

const selectScenes = (candidates: Candidate[], exclusions: Exclusions): Candidate[] => {
  const nameKey = (name: string) => name.toUpperCase().replace(/\s+/g, ' ');
  const excluded = (c: Candidate) =>
    exclusions.paths.has(path.basename(c.presetPath)) || exclusions.names.has(nameKey(c.name));

  const usable = dedupeByPath(candidates.filter((c) => !excluded(c)));
  // Up to two preset FILES per name (best-score first): name-duplicate files
  // are different visuals (independent author mashups, starfield variants)
  // that a strict name-dedupe throws away. The scene-name allocator suffixes
  // the second ("Mashup (28) 2") so scenes stay uniquely named.
  const NAME_FILES_CAP = 2;
  const perName = new Map<string, number>();
  const pool: Candidate[] = [];
  for (const c of [...usable].sort((a, b) => b.score - a.score)) {
    const key = nameKey(c.name);
    const seen = perName.get(key) ?? 0;
    if (seen >= NAME_FILES_CAP) continue;
    perName.set(key, seen + 1);
    pool.push(c);
  }
  pool.sort((a, b) => b.score - a.score);

  const perFamily = new Map<string, number>();
  const selected: Candidate[] = [];
  const count = (group: Candidate['group']) => selected.filter((s) => s.group === group).length;
  const take = (c: Candidate) => {
    selected.push(c);
    perFamily.set(c.family, (perFamily.get(c.family) ?? 0) + 1);
  };

  // Pass 1 — diversity-first: gems (quality floor), mashups (quota),
  // starfields (per-subfamily cap).
  for (const c of pool) {
    if (c.group === 'gem' && c.score >= GEM_QUALITY_FLOOR && (perFamily.get(c.family) ?? 0) === 0) take(c);
  }
  for (const c of pool) {
    if (c.group === 'mashup' && count('mashup') < MASHUP_QUOTA) take(c);
  }
  for (const c of pool) {
    if (c.group === 'starfield' && (perFamily.get(c.family) ?? 0) < STARFIELD_FAMILY_CAP && count('starfield') < 50) take(c);
  }
  // Pass 2 — top up to the target from what's left, still respecting caps.
  for (const c of pool) {
    if (selected.length >= TARGET_SCENE_COUNT) break;
    if (selected.includes(c)) continue;
    if (c.group === 'mashup' && count('mashup') >= MASHUP_QUOTA + 5) continue;
    if (c.group === 'starfield' && (perFamily.get(c.family) ?? 0) >= STARFIELD_FAMILY_CAP + 2) continue;
    if (c.group === 'gem' && c.score < GEM_QUALITY_FLOOR * 0.8) continue;
    take(c);
  }

  const groups = {
    gem: count('gem'),
    mashup: count('mashup'),
    starfield: count('starfield')
  };
  console.log(
    `pool ${pool.length} unique-name candidates -> selected ${selected.length} ` +
    `(gems=${groups.gem}, mashups=${groups.mashup}, starfields=${groups.starfield}); ` +
    `score range ${selected.at(-1)?.score.toFixed(3)}..${selected[0]?.score.toFixed(3)}`
  );
  return interleaveGroups(selected).slice(0, TARGET_SCENE_COUNT);
};

// Interleave the groups (best-score first within each) so the auto-advance
// rotation alternates visual families.
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

// ── scene assembly (mirrors addSceneFromSourceProject in index.ts) ────────

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

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

  // NO applySlideshowDefaults: this project's scenes keep the presets' own
  // manual triggers. The quality-showcase builder baked `trigger: {type:'time'}`
  // + 16s durations into every scene (pre-show auto-advance), and copying
  // that here made the whole project auto-run its slideshow the moment it
  // loaded — the user decides when the slideshow runs (Live-mode roster
  // applies the auto-advance defaults at add-time instead).
  return scene;
};

const migratedPaletteId = (migratedPreset: any): string | undefined =>
  migratedPreset.activePaletteId ||
  migratedPreset.project?.activePaletteId ||
  migratedPreset.project?.scenes?.[0]?.look?.activePaletteId ||
  undefined;

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

// ── the screen project: unscreened certified-safe presets with no ground
// truth, unique names, spread across families ──────────────────────────────

const reportedPresetPaths = (): Set<string> => {
  const paths = new Set<string>();
  for (const f of fs.readdirSync(REPORT_DIR).filter((x) => /^batch-\d+-report-reverified\.json$/.test(x))) {
    for (const result of JSON.parse(fs.readFileSync(path.join(REPORT_DIR, f), 'utf8')).results) {
      paths.add(path.basename(result.presetFile));
    }
  }
  return paths;
};

const writeScreenProject = (outFile: string, opts: { familyCap: number; excludeProjects: string[]; poolSize: number; all?: boolean }): void => {
  const base: VisualSynthProject = JSON.parse(fs.readFileSync(BASE_PROJECT, 'utf8'));
  const template = makeTemplate(base);
  const exclusions = collectExclusions();
  const reported = reportedPresetPaths();
  // Presets already screened by an earlier batch — their ground truth exists
  // (or they failed); re-auditing costs 15s each for zero new information.
  for (const prev of opts.excludeProjects) {
    if (!fs.existsSync(prev)) continue;
    for (const s of JSON.parse(fs.readFileSync(prev, 'utf8')).scenes ?? []) {
      if (s.presetPath) exclusions.paths.add(path.basename(s.presetPath));
    }
  }
  // --all: fresh ground truth for the ENTIRE certified-safe library. Used when
  // the renderer changed materially (EEL built-in reset, comp gamma): prior
  // verdicts/scores are stale — BLACKs may have been collapsed-warp victims
  // that now render, and every brightness score predates the gamma change.
  if (opts.all) {
    reported.clear();
    exclusions.paths.clear();
    exclusions.names.clear();
  }

  // unique names only; spread the pool across families (the audit is the
  // expensive step — variant letter-siblings of one subfamily are low-value
  // duplicates when other families are unscreened)
  const byName = new Map<string, string>();
  const familyCount = new Map<string, number>();
  const poolPaths: Array<{ presetPath: string; family: string; group: string }> = [];
  for (const file of fs.readdirSync(PRESET_DIR).filter((x) => x.endsWith('.json')).sort()) {
    const presetPath = path.join(PRESET_DIR, file);
    const preset = loadPreset(presetPath);
    if (!preset || preset.metadata.certification !== 'safe') continue;
    if (EXCLUDED_PRESETS.some((ex) => file.includes(ex))) continue;
    if (reported.has(file) || exclusions.paths.has(file)) continue;
    const name = preset.metadata.name || file.replace(/\.json$/, '');
    const { family, group } = classify(name);
    if (!opts.all && byName.has(name.toUpperCase().replace(/\s+/g, ' '))) continue;
    if (!opts.all && familyCount.get(family) >= opts.familyCap) continue; // breadth over depth per family
    byName.set(name.toUpperCase().replace(/\s+/g, ' '), name);
    familyCount.set(family, (familyCount.get(family) ?? 0) + 1);
    poolPaths.push({ presetPath, family, group });
  }
  console.log(`screen pool: ${poolPaths.length} unique-name unscreened certified-safe presets`);

  // Validate imports BEFORE auditing so the audit never dwells 14s on a
  // preset that can't assemble at build time anyway.
  const valid: Array<{ presetPath: string; name: string }> = [];
  for (const p of poolPaths) {
    const preset = loadPreset(p.presetPath);
    const name = preset.metadata.name || path.basename(p.presetPath, '.json');
    if (assembleScene({ presetPath: p.presetPath, name }, `probe-${valid.length}`, template, () => name)) {
      valid.push({ presetPath: p.presetPath, name });
    }
    if (valid.length >= opts.poolSize) break;
  }
  console.log(`${valid.length} presets import cleanly -> auditing ${Math.min(valid.length, SCREEN_POOL_SIZE)}`);

  const allocate = makeNameAllocator([]);
  const scenes: SceneConfig[] = [];
  for (const v of valid.slice(0, opts.poolSize)) {
    const scene = assembleScene(v, `screen-${scenes.length + 1}`, template, allocate);
    if (scene) scenes.push(scene);
  }
  const screen = {
    ...cloneValue(base),
    name: 'Unique-100 screening candidates',
    scenes,
    activeSceneId: scenes[0]?.id ?? ''
  };
  fs.writeFileSync(outFile, JSON.stringify(screen));
  console.log(`wrote ${scenes.length} scenes -> ${outFile}`);
};

// ── the build ──────────────────────────────────────────────────────────────

const buildShowProject = (auditDirs: Array<{ dir: string; screenProject: string }>, freshOnly = false): void => {
  const base: VisualSynthProject = JSON.parse(fs.readFileSync(BASE_PROJECT, 'utf8'));
  const template = makeTemplate(base);
  const exclusions = collectExclusions();

  // --fresh-only: skip the reverified batch reports — their verdicts and
  // quality scores predate renderer fixes (EEL built-in reset, comp gamma)
  // and the brightness scale changed under gamma. Use only audits run on
  // the current engine.
  const candidates = dedupeByPath([
    ...(freshOnly ? [] : collectReverifiedCandidates()),
    ...auditDirs.flatMap(({ dir, screenProject }) => collectScreenedCandidates(dir, screenProject))
  ]);
  console.log(`${candidates.length} ground-truth-passing candidates (${freshOnly ? 'fresh only' : 'reverified + screened'})`);

  const selection = selectScenes(candidates, exclusions);
  if (selection.length < TARGET_SCENE_COUNT) {
    throw new Error(
      `only ${selection.length}/${TARGET_SCENE_COUNT} unique scenes available — ` +
      `audit more presets via --screen-out and scripts/audit-project.ts`
    );
  }

  const show: VisualSynthProject = {
    ...cloneValue(base),
    name: 'Unique 100 — Fresh Scenes',
    createdAt: base.createdAt,
    updatedAt: new Date().toISOString(),
    scenes: [],
    activeSceneId: ''
  };

  const usedNames = new Set<string>();
  for (const project of EXISTING_PROJECTS) {
    const full = path.join(ROOT, project);
    if (fs.existsSync(full)) {
      for (const s of JSON.parse(fs.readFileSync(full, 'utf8')).scenes ?? []) {
        usedNames.add(s.name);
      }
    }
  }
  const allocate = makeNameAllocator([...usedNames]);

  let failures = 0;
  selection.forEach((candidate, index) => {
    const scene = assembleScene(candidate, `scene-${index + 1}`, template, allocate);
    if (scene) show.scenes.push(scene);
    else failures += 1;
  });
  if (failures > 0) throw new Error(`${failures} selected presets failed to import`);
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
      `${String(i + 1).padStart(3)}. ${scene.name} (score ${selection[i].score.toFixed(3)}, ${shader})`
    );
  });
};

// ── args ────────────────────────────────────────────────────────────────────

const argValue = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const makeNameAllocator = (taken: string[]) => {
  const usedNames = new Set(taken);
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

const screenOut = argValue('screen-out');
// --screened=<audit dir>:<screen project file> — repeatable; the screen
// project maps audit rows back to the preset files they came from.
const screenedArgs = process.argv
  .filter((a) => a.startsWith('--screened='))
  .map((a) => a.slice('--screened='.length))
  .map((v) => {
    const [dir, screenProject] = v.split(':');
    if (!dir || !screenProject) {
      console.error('--screened=<audit dir>:<screen project file>');
      process.exit(1);
    }
    return { dir, screenProject };
  });

if (screenOut) {
  const capArg = argValue('family-cap');
  const excludeArg = argValue('exclude-project');
  const sizeArg = argValue('pool-size');
  writeScreenProject(screenOut, {
    familyCap: capArg ? Number(capArg) : 4,
    excludeProjects: excludeArg ? excludeArg.split(',') : [],
    poolSize: sizeArg ? Number(sizeArg) : SCREEN_POOL_SIZE,
    all: process.argv.includes('--all')
  });
} else if (screenedArgs.length > 0 || process.argv.includes('--build')) {
  buildShowProject(screenedArgs, process.argv.includes('--fresh-only'));
} else {
  console.error('Usage: --screen-out=<file>  |  --build [--screened=<audit dir>:<screen project file> ...]');
  process.exit(1);
}
