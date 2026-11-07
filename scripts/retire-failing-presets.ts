// Retire failing certified presets: flips presets whose LATEST ground-truth
// audit fails (BLACK / BLOWN / safe-mode / shader errors / HUNG) from
// certification 'safe' to 'degraded', with provenance in metadata.milkwave.
// After this, "certified safe" means "verified to render end-to-end on the
// current engine" — the quality bar for every future show.
//
// The audit data is the single argument: a dir of results-shard*.json rows
// (audit-project.ts output). Scenes in show projects are NOT special-cased —
// they were all re-audited in the same run (--all screen), so failures fail
// on merit.
//
// Usage: ts-node --transpile-only scripts/retire-failing-presets.ts --audit=<dir> [--dry-run]
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const PRESET_DIR = path.join(ROOT, 'assets/presets');

const arg = (name: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) throw new Error(`--${name}= required`);
  return hit.slice(name.length + 3);
};
const AUDIT_DIR = path.isAbsolute(arg('audit')) ? arg('audit') : path.join(ROOT, arg('audit'));
const DRY_RUN = process.argv.includes('--dry-run');

interface Row {
  name: string;
  activated: boolean;
  main: string;
  shaderError?: string | null;
  safeMode?: unknown;
  compileProblems?: string[];
}

const loadRows = (): Row[] => {
  const rows: Row[] = [];
  for (const f of fs.readdirSync(AUDIT_DIR).filter((x) => /^results-shard\d+of\d+\.json$/.test(x))) {
    rows.push(...JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, f), 'utf8')).rows);
  }
  return rows;
};

const main = () => {
  const rows = loadRows();
  console.log(`audit rows: ${rows.length}`);

  // Row name -> preset file via the audit's project snapshot is unavailable
  // here, but the screen project carries presetPath per scene name; resolve
  // failures through the screen project passed alongside.
  const screenProjectFile = process.argv.find((a) => a.startsWith('--screen-project='));
  if (!screenProjectFile) throw new Error('--screen-project=<file> required (maps scene names to preset files)');
  const screenProject = JSON.parse(fs.readFileSync(screenProjectFile.slice('--screen-project='.length), 'utf8'));
  const pathByName = new Map<string, string>(
    (screenProject.scenes ?? []).map((s: any) => [s.name, s.presetPath])
  );

  let flipped = 0;
  let kept = 0;
  let missing = 0;
  const byReason: Record<string, number> = {};
  for (const row of rows) {
    const presetPath = pathByName.get(row.name);
    if (!presetPath) { missing += 1; continue; }
    const fail =
      !row.activated ||
      row.main !== 'ok' ||
      Boolean(row.shaderError) ||
      Boolean(row.safeMode) ||
      Boolean(row.compileProblems?.length);
    if (!fail) { kept += 1; continue; }

    const reason =
      !row.activated ? 'not-activated' :
      row.main === 'HUNG' ? 'hung-renderer' :
      row.main === 'BLACK' ? 'render-black' :
      row.main === 'BLOWN' ? 'render-blown-white' :
      row.safeMode ? 'safe-mode-stall' :
      row.compileProblems?.length ? `compile:${row.compileProblems.join(',')}` :
      'shader-error';
    byReason[reason] = (byReason[reason] ?? 0) + 1;

    if (DRY_RUN) { flipped += 1; continue; }
    const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
    if (preset?.metadata?.certification !== 'safe') continue; // already retired
    preset.metadata.certification = 'degraded';
    if (!preset.metadata.milkwave) preset.metadata.milkwave = {};
    preset.metadata.milkwave.certificationStatus = 'degraded-usable';
    preset.metadata.milkwave.certificationSource = 'postfix-audit-2026-11-06';
    preset.metadata.milkwave.lastCertifiedAt = new Date().toISOString();
    preset.metadata.milkwave.reasons = [
      ...(Array.isArray(preset.metadata.milkwave.reasons) ? preset.metadata.milkwave.reasons : []),
      { key: 'postfix-audit', message: reason, severity: 'degrade' as const }
    ].slice(-3);
    fs.writeFileSync(presetPath, JSON.stringify(preset));
    flipped += 1;
  }

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}retired: ${flipped}, kept safe: ${kept}, unresolved: ${missing}`);
  console.log('failure reasons:', byReason);
};
main();
