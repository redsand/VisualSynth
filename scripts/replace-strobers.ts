// Replace strobing (photosensitivity-risk) scenes in show projects with
// flash-clean scenes from the verified preset pool.
//
// Two phases, because replacements must themselves be flash-screened:
//
//   1. pool:  ts-node --transpile-only scripts/replace-strobers.ts pool \
//               --targets=<a.json,b.json> --out=<pool.project.json> [--size=60]
//      Writes a project of verified candidates (reverified batch reports:
//      visible, not blown out, certification safe) that appear in NO target
//      project, no showcase project, and not on the exclusion list.
//      → run scripts/audit-flashing-v2.ts --project=<pool> --json=<pool-flash.json>
//
//   2. apply: ts-node --transpile-only scripts/replace-strobers.ts apply \
//               --targets=<a.json,b.json> --pool=<pool.project.json> \
//               --pool-flash=<pool-flash.json> --strobers=<name,name,...>
//      Replaces each strober (by scene name) with a flash-clean pool scene of
//      the same visual group where possible, KEEPING the scene id (so
//      rotation lists / triggers that reference it stay valid). Every target
//      is backed up to <file>.bak-<timestamp> before it is rewritten.
import fs from 'fs';
import path from 'path';
import { migratePreset, validatePreset, applyPresetV6 } from '../src/shared/presetMigration';
import {
  DEFAULT_PROJECT,
  DEFAULT_SCENE_TRANSITION,
  DEFAULT_SCENE_TRIGGER,
  SceneConfig,
  SceneLook,
  VisualSynthProject
} from '../src/shared/project';
import { cloneLayerConfig } from '../src/shared/layers';

const ROOT = path.resolve(__dirname, '..');
const PRESET_DIR = path.join(ROOT, 'assets/presets');
const REPORT_DIR = path.join(ROOT, 'milkwave-test-results/reports');
// Never source replacements from the user's own live show (hard rule) or the
// show the targets were built from (its removed scenes are the strobers).
// Other showcase projects ARE allowed as a source.
const SHOWCASE_PROJECTS = [
  'showcase-performance.project-sues.json',
  'showcase-unique-100.project.json'
].map((f) => path.join(ROOT, f));
// Known photosensitivity / broken presets (see build-unique-showcase.ts).
const EXCLUDED_PRESETS = [
  'mashup-(282)', '02_mw_new01f_u', 'mashup-(290)', '02_mw_new02c4',
  'julian-tiles-remake---adamfx---gothic-daisy-outta-', '01_mw_new34.json',
  'mashup-(269)', 'acid-wiring-(rewiredfx)ft-adamfx---hexcollie---arm'
];
// A replacement must be well under the WCAG line, not just under it.
const MAX_CLEAN_FLASHES_PER_SEC = 2;

const arg = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const cloneValue = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const readProject = (file: string): { wrapper: any; project: VisualSynthProject } => {
  const wrapper = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { wrapper, project: wrapper.project ?? wrapper };
};
type Group = 'gem' | 'mashup' | 'starfield';
const groupOf = (name: string): Group =>
  /^(0\d)[\s_]+MW[\s_]+NEW/i.test(name) ? 'starfield' : name.toUpperCase().startsWith('MASHUP') ? 'mashup' : 'gem';
const nameKey = (n: string) => n.trim().toUpperCase().replace(/\s+\d+$/, '').replace(/\s+/g, ' ');

interface Candidate { presetPath: string; name: string; score: number; group: Group }

const collectCandidates = (): Candidate[] => {
  const out = new Map<string, Candidate>();
  for (const file of fs.readdirSync(REPORT_DIR).filter((f) => /^batch-\d+-report-reverified\.json$/.test(f))) {
    const report = JSON.parse(fs.readFileSync(path.join(REPORT_DIR, file), 'utf8'));
    for (const result of report.results ?? []) {
      const rv = result.reverify ?? {};
      if (!rv.visible || rv.blownOut) continue;
      const presetPath = path.join(PRESET_DIR, path.basename(result.presetFile));
      const base = path.basename(presetPath).toLowerCase();
      if (!fs.existsSync(presetPath) || EXCLUDED_PRESETS.some((ex) => base.includes(ex))) continue;
      let preset: any;
      try { preset = JSON.parse(fs.readFileSync(presetPath, 'utf8')); } catch { continue; }
      if (preset?.metadata?.certification !== 'safe') continue;
      const shots = (result.shotStats ?? []) as Array<{ ymin: number; ymax: number; yavg: number }>;
      if (shots.length < 2) continue;
      const brightness = shots.reduce((s, x) => s + x.yavg, 0) / shots.length;
      const spread = shots.reduce((s, x) => s + (x.ymax - x.ymin) / 255, 0) / shots.length;
      const score = 0.55 * (1 - Math.min(1, Math.abs(brightness - 115) / 115)) + 0.45 * spread;
      const name = preset.metadata.name || path.basename(presetPath, '.json');
      const prev = out.get(presetPath);
      if (!prev || score > prev.score) out.set(presetPath, { presetPath, name, score, group: groupOf(name) });
    }
  }
  return [...out.values()];
};

const assembleScene = (candidate: Candidate, id: string, template: VisualSynthProject, name: string): SceneConfig | null => {
  const migration = migratePreset(JSON.parse(fs.readFileSync(candidate.presetPath, 'utf8')));
  if (!migration.success || !validatePreset(migration.preset).valid) return null;
  const sourceProject = applyPresetV6(migration.preset, template).project;
  const src = sourceProject.scenes.find((s: any) => s.id === sourceProject.activeSceneId) ?? sourceProject.scenes[0];
  if (!src) return null;
  const sl = src.look;
  const look: SceneLook = {
    effects: cloneValue(sl?.effects ?? sourceProject.effects ?? {}),
    particles: cloneValue(sl?.particles ?? sourceProject.particles ?? {}),
    sdf: cloneValue(sl?.sdf ?? sourceProject.sdf ?? {}),
    visualizer: cloneValue(sl?.visualizer ?? sourceProject.visualizer ?? {}),
    stylePresets: cloneValue(sl?.stylePresets ?? sourceProject.stylePresets ?? []),
    activeStylePresetId: cloneValue(sl?.activeStylePresetId ?? sourceProject.activeStylePresetId ?? ''),
    palettes: cloneValue(sl?.palettes ?? sourceProject.palettes ?? []),
    activePaletteId:
      (migration.preset as any).activePaletteId ?? sl?.activePaletteId ?? sourceProject.activePaletteId,
    macros: cloneValue(sl?.macros ?? sourceProject.macros ?? []),
    modMatrix: cloneValue(sl?.modMatrix ?? sourceProject.modMatrix ?? [])
  };
  return {
    id,
    scene_id: id,
    name,
    intent: src.intent ?? 'ambient',
    duration: typeof src.duration === 'number' ? src.duration : 0,
    transition_in: { ...DEFAULT_SCENE_TRANSITION, ...(src.transition_in ?? {}) },
    transition_out: { ...DEFAULT_SCENE_TRANSITION, ...(src.transition_out ?? {}) },
    // Manual trigger: never let a replacement auto-advance the show.
    trigger: { ...DEFAULT_SCENE_TRIGGER, ...(src.trigger ?? {}) },
    assigned_layers: {
      core: src.assigned_layers?.core ?? [],
      support: src.assigned_layers?.support ?? [],
      atmosphere: src.assigned_layers?.atmosphere ?? []
    },
    certification: src.certification ? cloneValue(src.certification) : undefined,
    tags: src.tags ? [...src.tags] : undefined,
    layers: src.layers.map(cloneLayerConfig),
    look,
    _shaderData: src._shaderData ? cloneValue(src._shaderData) : undefined,
    presetPath: candidate.presetPath
  } as SceneConfig;
};

const makeTemplate = (base: VisualSynthProject): VisualSynthProject => ({
  ...cloneValue(DEFAULT_PROJECT),
  effects: base.effects, particles: base.particles, sdf: base.sdf, visualizer: base.visualizer,
  stylePresets: base.stylePresets, activeStylePresetId: base.activeStylePresetId,
  palettes: base.palettes, activePaletteId: base.activePaletteId, macros: base.macros, modMatrix: base.modMatrix
});

const taken = (targets: string[]) => {
  const paths = new Set<string>();
  const names = new Set<string>();
  for (const file of [...targets, ...SHOWCASE_PROJECTS]) {
    if (!fs.existsSync(file)) continue;
    for (const s of readProject(file).project.scenes ?? []) {
      if (s.presetPath) paths.add(path.basename(s.presetPath));
      if (s.name) names.add(nameKey(s.name));
    }
  }
  return { paths, names };
};

const targets = (arg('targets') ?? '').split(',').filter(Boolean);
if (targets.length === 0) throw new Error('--targets= required');
const mode = process.argv[2];

if (mode === 'pool') {
  const out = arg('out');
  if (!out) throw new Error('--out= required');
  const size = Number(arg('size') ?? 60);
  const used = taken(targets);
  const pool = collectCandidates()
    .filter((c) => !used.paths.has(path.basename(c.presetPath)) && !used.names.has(nameKey(c.name)))
    .sort((a, b) => b.score - a.score);
  // Fill past the verified reports with UNSCREENED certified-safe presets —
  // the flash audit v2 run on the pool also rejects black/static/broken ones.
  if (pool.length < size) {
    const have = new Set(pool.map((c) => c.presetPath));
    const all = fs.readdirSync(PRESET_DIR).filter((f) => f.endsWith('.json') && f.includes('milkwave'));
    // Deterministic stride through the library (not just the alphabetical head).
    const files = all.filter((_, i) => i % 37 === 0).concat(all.filter((_, i) => i % 37 !== 0));
    for (const f of files) {
      if (pool.length >= size * 3) break;
      const presetPath = path.join(PRESET_DIR, f);
      if (have.has(presetPath) || used.paths.has(f) || EXCLUDED_PRESETS.some((ex) => f.toLowerCase().includes(ex))) continue;
      let preset: any;
      try { preset = JSON.parse(fs.readFileSync(presetPath, 'utf8')); } catch { continue; }
      // Uncertified presets are allowed here (only 121 of ~7k are certified
      // 'safe' and most are already in shows): the v2 audit over the pool
      // screens flashing, visibility, motion and shader compile. Known-bad
      // certifications (degraded / archived) stay out.
      const cert = preset?.metadata?.certification;
      if (!preset?.metadata || cert === 'degraded' || cert === 'archived') continue;
      const name = preset.metadata.name || path.basename(f, '.json');
      if (used.names.has(nameKey(name))) continue;
      pool.push({ presetPath, name, score: 0, group: groupOf(name) });
    }
  }
  // one per name, groups balanced toward what's being replaced (mashups/starfields)
  const seen = new Set<string>();
  const picked: Candidate[] = [];
  for (const c of pool) {
    if (seen.has(nameKey(c.name))) continue;
    seen.add(nameKey(c.name));
    picked.push(c);
    if (picked.length >= size) break;
  }
  const template = makeTemplate(readProject(targets[0]).project);
  const scenes = picked
    .map((c, i) => assembleScene(c, `pool-${i + 1}`, template, c.name))
    .filter((s): s is SceneConfig => Boolean(s));
  const project = { ...template, scenes, activeSceneId: scenes[0]?.id };
  fs.writeFileSync(out, JSON.stringify(project));
  const byGroup = scenes.reduce<Record<string, number>>((m, s) => ((m[groupOf(s.name)] = (m[groupOf(s.name)] ?? 0) + 1), m), {});
  console.log(`pool: ${scenes.length} candidate scenes (${JSON.stringify(byGroup)}) → ${out}`);
} else if (mode === 'apply') {
  const poolFile = arg('pool');
  const flashFile = arg('pool-flash');
  const strobers = new Set((arg('strobers') ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  if (!poolFile || !flashFile || strobers.size === 0) throw new Error('--pool=, --pool-flash=, --strobers= required');
  const pool = readProject(poolFile).project.scenes;
  const flash = JSON.parse(fs.readFileSync(flashFile, 'utf8')) as Array<{
    name: string; perSec60: number; meanLuma?: number; motion?: number; compile?: { warp: string | null; comp: string | null } | null;
  }>;
  // Clean = no strobing AND visible AND moving AND shaders compiled (a
  // safe-mode/black/static scene is no replacement for a strober).
  const okStatus = (s: string | null | undefined) => !s || s === 'success' || s === 'not_requested';
  const clean = new Set(flash.filter((f) =>
    f.perSec60 <= MAX_CLEAN_FLASHES_PER_SEC &&
    (f.meanLuma ?? 50) >= 18 && (f.meanLuma ?? 50) <= 225 &&
    (f.motion ?? 1) >= 0.4 &&
    okStatus(f.compile?.warp) && okStatus(f.compile?.comp)
  ).map((f) => f.name));
  const cleanPool = pool.filter((s: SceneConfig) => clean.has(s.name));
  console.log(`clean replacements available: ${cleanPool.length}/${pool.length}`);
  // Same replacement for the same strober name in every target (consistent shows).
  const assignment = new Map<string, SceneConfig>();
  const used = new Set<string>();
  for (const name of strobers) {
    const want = groupOf(name);
    const pick = cleanPool.find((s: SceneConfig) => !used.has(s.name) && groupOf(s.name) === want)
      ?? cleanPool.find((s: SceneConfig) => !used.has(s.name));
    if (!pick) { console.warn(`NO clean replacement left for ${name}`); continue; }
    used.add(pick.name);
    assignment.set(name, pick);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const file of targets) {
    const { wrapper, project } = readProject(file);
    let replaced = 0;
    project.scenes = project.scenes.map((scene) => {
      const replacement = assignment.get(scene.name);
      if (!replacement) return scene;
      replaced += 1;
      return { ...cloneValue(replacement), id: scene.id, scene_id: scene.scene_id ?? scene.id };
    });
    if (replaced === 0) { console.log(`${path.basename(file)}: no strobers present`); continue; }
    fs.copyFileSync(file, `${file}.bak-${stamp}`);
    fs.writeFileSync(file, JSON.stringify(wrapper.project ? { ...wrapper, project } : project, null, wrapper.project ? undefined : 2));
    console.log(`${path.basename(file)}: replaced ${replaced} scene(s); backup ${path.basename(file)}.bak-${stamp}`);
  }
  for (const [from, to] of assignment) console.log(`  ${from}  →  ${to.name}`);
} else {
  throw new Error('mode must be pool | apply');
}
