// Build a show project from audited candidates: ONLY scenes that pass every
// check on the shipping engine, de-duplicated by how they actually look.
//
// Inputs:
//   --candidates=<project.json>   scenes to choose from (each with _shaderData)
//   --audit=<a.json,b.json,...>   scripts/audit-flashing-v2.ts --late=N results
//   --meta=<meta.json>            { [sceneName]: { source, reactive } } (optional)
//   --template=<project.json>     the user's project: palettes, overlays, assets,
//                                 output, MIDI are kept from it
//   --out=<file>  [--max=64] [--prefer=<source file basename>]
//
// Pass criteria (all required):
//   - no crash; MilkDrop warp/comp compiled (or not requested)
//   - photosensitivity: <= 3 flashes/s (projected to 60 fps), WCAG general+red
//   - visible early AND late (mean luma 20..215): not black, not blown out
//   - moving early AND late (motion >= 0.5): not static, does not freeze
//   - music-reactive code (bass/mid/treb/vol in per-frame/shader/wave/shape)
// Duplicates: two scenes whose early AND late fingerprints (per-cell mean
// colour on a 24x16 grid) differ by < DUP_DISTANCE are the same look; the
// better-scoring one is kept. Obviously-altered variants differ and both stay.
import fs from 'fs';
import path from 'path';

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? null;
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const proj = (f: string) => { const p = read(f); return p.project ?? p; };

const DUP_DISTANCE = 14;          // mean |Δ| per colour channel (0-255)
const MAX_FLASHES = 3;
// Tunables (defaults = strictest). Calibrated 2026-11-20 against a 298-scene
// audit: strict passed only 10; a show used --min-luma=14 --min-motion=0.25
// --flash-rule=area --shader=render (31 passed).
const LUMA = [Number(opt('min-luma') ?? 20), 225];
const MIN_MOTION = Number(opt('min-motion') ?? 0.5);
// strict: any region > 3 flashes/s. area: full frame or a quadrant > 3/s, or
// any patch (~4% of screen) at >= 8/s — still protective, ignores sparkle.
const FLASH_RULE = opt('flash-rule') ?? 'strict';
// strict: warp/comp must compile as authored. render: a fallback/degraded
// pass that still renders is acceptable (visual checks still apply).
const SHADER_RULE = opt('shader') ?? 'strict';

const candidates = proj(opt('candidates')!);
const template = proj(opt('template')!);
const meta: Record<string, { source?: string; reactive?: boolean }> = opt('meta') ? read(opt('meta')!) : {};
const audit = (opt('audit') ?? '').split(',').filter(Boolean).flatMap((f) => (fs.existsSync(f) ? read(f) : []));
const prefer = opt('prefer');
const max = Number(opt('max') ?? 64);

interface Row {
  name: string; crashed?: boolean; perSec60: number; meanLuma: number; motion: number;
  lateLuma: number | null; lateMotion: number | null;
  compile?: { warp: string | null; comp: string | null } | null;
  fp?: { mean: number[]; std: number[] }; lateFp?: { mean: number[]; std: number[] } | null;
}
const byName = new Map<string, Row>();
for (const r of audit as Row[]) byName.set(r.name, r);

const ok = (s: string | null | undefined) => !s || s === 'success' || s === 'not_requested';
const MIN_STRUCTURE = Number(opt('min-structure') ?? 11);
const structureOf = (fp?: { mean: number[] } | null) => {
  if (!fp?.mean?.length) return 0;
  const lum: number[] = [];
  for (let i = 0; i < fp.mean.length; i += 3) lum.push((fp.mean[i] + fp.mean[i + 1] + fp.mean[i + 2]) / 3);
  const m = lum.reduce((a, b) => a + b, 0) / lum.length;
  return Math.sqrt(lum.reduce((a, b) => a + (b - m) ** 2, 0) / lum.length);
};
const reasons = (r: Row | undefined, name: string): string[] => {
  if (!r) return ['not audited'];
  const out: string[] = [];
  if (r.crashed) out.push('crash');
  const shaderBad = (s: string | null | undefined) => (SHADER_RULE === 'render' ? s === 'failed' : !ok(s));
  if (shaderBad(r.compile?.warp) || shaderBad(r.compile?.comp)) out.push(`shader ${r.compile?.warp}/${r.compile?.comp}`);
  const region = (r as any).region ?? '';
  const bigArea = region === 'full' || region.startsWith('q-');
  const flashing = FLASH_RULE === 'area'
    ? (bigArea && r.perSec60 > MAX_FLASHES) || r.perSec60 >= 8
    : r.perSec60 > MAX_FLASHES;
  if (flashing) out.push(`flashing ${r.perSec60}/s`);
  const late = r.lateLuma ?? r.meanLuma;
  if (r.meanLuma < LUMA[0] || late < LUMA[0]) out.push('black');
  if (r.meanLuma > LUMA[1] || late > LUMA[1]) out.push('blown out');
  if (r.motion < MIN_MOTION || (r.lateMotion ?? r.motion) < MIN_MOTION) out.push(r.motion >= MIN_MOTION ? 'freezes' : 'static');
  if (meta[name] && meta[name].reactive === false) out.push('not music-reactive');
  // Structure: spatial variation of the coarse image. Flat fills, near-black
  // frames and blurry blobs score < MIN_STRUCTURE (calibrated by eye on a
  // contact sheet, 2026-11-20: every scene rejected as flat/empty/blob was
  // < 13, every scene kept was >= 11). Applied to the weaker of early/late.
  const structure = Math.min(structureOf(r.fp), r.lateFp ? structureOf(r.lateFp) : Infinity);
  if (structure < MIN_STRUCTURE) out.push(`flat (structure ${structure.toFixed(1)})`);
  return out;
};
const score = (r: Row, name: string) => {
  const motion = Math.min(6, Math.min(r.motion, r.lateMotion ?? r.motion));
  const fp = r.fp?.mean ?? [];
  let spread = 0;
  if (fp.length) { const m = fp.reduce((a, b) => a + b, 0) / fp.length; spread = Math.sqrt(fp.reduce((a, b) => a + (b - m) ** 2, 0) / fp.length); }
  const brightness = 1 - Math.min(1, Math.abs(((r.lateLuma ?? r.meanLuma) - 95) / 95));
  return motion * 0.5 + Math.min(80, spread) / 20 + brightness + (prefer && meta[name]?.source === prefer ? 1.5 : 0);
};
const fpDistance = (a?: number[], b?: number[]) => {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / a.length;
};

const passing: Array<{ scene: any; row: Row; score: number }> = [];
const rejected: Array<{ name: string; why: string[] }> = [];
for (const scene of candidates.scenes) {
  const row = byName.get(scene.name);
  const why = reasons(row, scene.name);
  if (why.length) rejected.push({ name: scene.name, why });
  else passing.push({ scene, row: row!, score: score(row!, scene.name) });
}
passing.sort((a, b) => b.score - a.score);

const chosen: typeof passing = [];
const duplicates: Array<{ name: string; of: string; distance: number }> = [];
for (const c of passing) {
  const dup = chosen.find((k) =>
    fpDistance(c.row.fp?.mean, k.row.fp?.mean) < DUP_DISTANCE &&
    fpDistance(c.row.lateFp?.mean ?? c.row.fp?.mean, k.row.lateFp?.mean ?? k.row.fp?.mean) < DUP_DISTANCE);
  if (dup) { duplicates.push({ name: c.scene.name, of: dup.scene.name, distance: +fpDistance(c.row.fp?.mean, dup.row.fp?.mean).toFixed(1) }); continue; }
  chosen.push(c);
  if (chosen.length >= max) break;
}

// Palette variety: every milkwave scene is recoloured by its palette, so one
// palette across the show makes every scene the same hue. Rotate the
// template's palettes across scenes (scene-scoped look), so consecutive
// scenes differ in colour; live palette picks still override per scene.
const palettes: any[] = template.palettes ?? [];
const scenes = chosen.map((c, i) => {
  const scene = { ...c.scene, id: `scene-${i + 1}`, scene_id: `scene-${i + 1}` };
  if (palettes.length > 1 && opt('palette-variety') !== 'off') {
    const palette = palettes[(i * 7) % palettes.length]; // stride 7: neighbours differ
    scene.look = { ...(scene.look ?? {}), palettes: JSON.parse(JSON.stringify(palettes)), activePaletteId: palette.id };
  }
  return scene;
});
const out = {
  ...template,
  name: opt('name') ?? `Verified Show ${new Date().toISOString().slice(0, 10)}`,
  scenes,
  activeSceneId: scenes[0]?.id,
  livePads: scenes.slice(0, 16).map((s) => s.id),
  midiMappings: template.midiMappings ?? []
};
fs.writeFileSync(opt('out')!, JSON.stringify(out, null, 2));
const report = { chosen: chosen.map((c) => ({ name: c.scene.name, score: +c.score.toFixed(2), motion: c.row.motion, lateMotion: c.row.lateMotion, luma: c.row.lateLuma, flashes: c.row.perSec60, source: meta[c.scene.name]?.source })), duplicates, rejected };
fs.writeFileSync(opt('out')!.replace(/\.json$/, '.report.json'), JSON.stringify(report, null, 2));
const reasonCounts: Record<string, number> = {};
for (const r of rejected) for (const w of r.why) { const k = w.replace(/ \d+\/s/, '').replace(/ \(.*\)$/, ''); reasonCounts[k] = (reasonCounts[k] ?? 0) + 1; }
console.log(`candidates ${candidates.scenes.length} | pass ${passing.length} | duplicates dropped ${duplicates.length} | in show ${scenes.length}`);
console.log('rejections:', JSON.stringify(reasonCounts));
console.log(`wrote ${opt('out')} (+ .report.json)`);
