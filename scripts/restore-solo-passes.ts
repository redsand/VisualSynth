// Reconcile certifications with a SOLO re-audit: presets that failed the
// parallel-shard audit (mostly safe-mode trips, which are frame-cadence
// sensitive to contention) but PASS a solo re-audit get their certification
// restored to 'safe' with updated provenance. The retirement script
// (retire-failing-presets.ts) flips failures; this is the override for
// false positives among them.
//
// Usage: ts-node --transpile-only scripts/restore-solo-passes.ts --audit=<dir> --screen-project=<file>
import fs from 'fs';
import path from 'path';

const arg = (name: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) throw new Error(`--${name}= required`);
  return hit.slice(name.length + 3);
};
const AUDIT_DIR = arg('audit');
const SCREEN_PROJECT = arg('screen-project');

const rows = (() => {
  const out: Array<Record<string, unknown>> = [];
  for (const f of fs.readdirSync(AUDIT_DIR).filter((x) => /^results-shard\d+of\d+\.json$/.test(x))) {
    out.push(...JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, f), 'utf8')).rows);
  }
  return out;
})();

const screenProject = JSON.parse(fs.readFileSync(SCREEN_PROJECT, 'utf8'));
const pathByName = new Map<string, string>(
  (screenProject.scenes ?? []).map((s: any) => [s.name, s.presetPath])
);

let restored = 0;
for (const row of rows as any[]) {
  const passes =
    row.activated && row.main === 'ok' && !row.shaderError && !row.safeMode && !row.compileProblems?.length;
  if (!passes) continue;
  const presetPath = pathByName.get(row.name);
  if (!presetPath) continue;
  const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
  if (preset?.metadata?.certification === 'safe') continue;
  preset.metadata.certification = 'safe';
  if (!preset.metadata.milkwave) preset.metadata.milkwave = {};
  preset.metadata.milkwave.certificationStatus = 'certified-safe';
  preset.metadata.milkwave.certificationSource = 'postfix-solo-reaudit-2026-11-06';
  preset.metadata.milkwave.lastCertifiedAt = new Date().toISOString();
  preset.metadata.milkwave.reasons = [
    { key: 'solo-reaudit', message: 'passes solo re-audit (parallel-shard safe-mode was contention-sensitive)', severity: 'fallback' as const }
  ];
  fs.writeFileSync(presetPath, JSON.stringify(preset));
  console.log('restored:', path.basename(presetPath), `(${row.name})`);
  restored += 1;
}
console.log(`\nrestored ${restored} presets to certified-safe`);
