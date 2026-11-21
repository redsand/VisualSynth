// Turn default pad presets into scenes inside a show project, so they can be
// audited and merged alongside MilkDrop scenes. Each preset is applied the
// app's way (migratePreset + applyPresetV6) onto the show; its active scene
// is kept, and the preset's project-level look (effects, palettes, style,
// macros, mod matrix) moves into scene.look so it travels with the scene.
//
// Usage: ts-node --transpile-only scripts/presets-to-show-scenes.ts \
//          --show=<show.json> --list=<preset basenames, one per line> --out=<candidates.json>
import fs from 'fs';
import path from 'path';
import { migratePreset, applyPresetV6 } from '../src/shared/presetMigration';

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? null;
const show = JSON.parse(fs.readFileSync(opt('show')!, 'utf8'));
const files = fs.readFileSync(opt('list')!, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);

const scenes: any[] = [];
for (const file of files) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join('assets/presets', file), 'utf8'));
    const migrated: any = migratePreset(raw);
    const project = applyPresetV6(migrated.preset, JSON.parse(JSON.stringify(show))).project;
    const scene = project.scenes.find((s: any) => s.id === project.activeSceneId) ?? project.scenes[0];
    if (!scene) continue;
    const look = { ...(scene.look ?? {}) };
    for (const key of ['effects', 'particles', 'sdf', 'visualizer', 'stylePresets', 'activeStylePresetId', 'palettes', 'activePaletteId', 'macros', 'modMatrix']) {
      if (look[key] === undefined && project[key] !== undefined) look[key] = project[key];
    }
    scenes.push({ ...scene, name: raw.name ?? raw.metadata?.name ?? scene.name, look, presetPath: file });
  } catch (e) {
    console.warn(`skip ${file}: ${String(e).slice(0, 120)}`);
  }
}
scenes.forEach((s, i) => { s.id = s.scene_id = `scene-${i + 1}`; });
const out = { ...show, scenes, activeSceneId: scenes[0]?.id, livePads: scenes.slice(0, 16).map((s) => s.id) };
fs.writeFileSync(opt('out')!, JSON.stringify(out, null, 2));
console.log(`${scenes.length} scenes from ${files.length} presets -> ${opt('out')}`);
