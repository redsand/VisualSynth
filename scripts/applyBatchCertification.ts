import fs from 'fs';
import path from 'path';

// Derive preset certification from REAL-APP batch-tester status.
//
// Why this exists (and why it does not read milkywave_audit_report.json):
// the in-page "audit runner" (src/renderer/milkwaveAuditRunner.ts) renders each
// preset into a shared 256x256 offscreen canvas driven by a synthetic
// RenderState. For shape/wave-driven presets (empty custom warp/comp) that path
// consistently produces a black frame even when the real app renders the same
// preset vividly — e.g. preset-1030 "tumbling-cubes-gedit" screenshots as a
// bright orange wave field through the app (batch 9100: working, brightness
// 154.9) while the audit reports brightness 0.0. So the audit's
// visibleActivity/classification is NOT a trustworthy "is this showable" signal
// for that class, and certifying from it would badge working presets as broken.
//
// scripts/milkwave-batch-test.js drives the ACTUAL app (dist/renderer) with a
// real WebGL pipeline and screenshots the result, so its per-preset status is
// the ground truth for "renders something visible". This script maps that
// status onto the same certification vocabulary scripts/certifyMilkwavePresets.ts
// writes, so src/shared/presetIndex.ts (metadata.certification → browser "needs
// fix" badge / Showable filter) sees the real result.
//
//   working                          -> safe      / certified-safe
//   fallback, safe_mode              -> degraded  / degraded-usable
//   black_output, runtime_error      -> archived  / broken-archive   ("needs fix")
//
// Only presets that appear in some batch report are touched; everything else is
// left exactly as the audit-based certification left it.

const PRESETS_DIR = path.resolve(__dirname, '../assets/presets');
const REPORTS_DIR = path.resolve(__dirname, '../milkwave-test-results/reports');

// --report <file> (repeatable): certify from explicit report files instead of
// scanning REPORTS_DIR. Files are applied in argv order, so the LAST --report
// wins per preset. Used with scripts/reverify-batch-screenshots.js output
// (screenshot-derived statuses), which supersedes the tester's in-page
// readPixels classification.
const explicitReports = (): string[] => {
  const files: string[] = [];
  for (let i = 0; i < process.argv.length - 1; i++) {
    if (process.argv[i] === '--report') files.push(path.resolve(process.argv[i + 1]));
    if (process.argv[i] === '--report-list') {
      const listFile = process.argv[i + 1];
      const lines = fs.readFileSync(listFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
      for (const l of lines) files.push(path.resolve(l));
    }
  }
  return files;
};

type BatchStatus = 'working' | 'fallback' | 'black_output' | 'runtime_error' | 'safe_mode';

interface BatchResult {
  presetId?: string;
  presetFile?: string;
  status?: string;
}

const STATUS_TO_CERTIFICATION: Record<BatchStatus, { certification: string; certificationStatus: string }> = {
  working: { certification: 'safe', certificationStatus: 'certified-safe' },
  fallback: { certification: 'degraded', certificationStatus: 'degraded-usable' },
  safe_mode: { certification: 'degraded', certificationStatus: 'degraded-usable' },
  black_output: { certification: 'archived', certificationStatus: 'broken-archive' },
  runtime_error: { certification: 'archived', certificationStatus: 'broken-archive' }
};

// Higher batch number = more recent observation; it wins.
const batchNumber = (file: string): number => {
  const m = /^batch-(\d+)-report\.json$/.exec(file);
  return m ? Number(m[1]) : -1;
};

const collectLatestStatuses = (): Map<string, BatchStatus> => {
  const explicit = explicitReports();
  const reportFiles = explicit.length
    ? explicit // argv order -> later overwrites earlier
    : fs
        .readdirSync(REPORTS_DIR)
        .filter((f) => /^batch-\d+-report\.json$/.test(f))
        .sort((a, b) => batchNumber(a) - batchNumber(b)); // ascending -> later overwrites earlier
  if (!explicit.length && !fs.existsSync(REPORTS_DIR)) {
    throw new Error(`No reports directory at ${REPORTS_DIR}.`);
  }

  const latest = new Map<string, BatchStatus>();
  for (const reportFile of reportFiles) {
    let report: { results?: BatchResult[] };
    try {
      report = JSON.parse(
        fs.readFileSync(explicit.length ? reportFile : path.join(REPORTS_DIR, reportFile), 'utf-8')
      );
    } catch (e) {
      console.warn(`Skipping unreadable report ${reportFile}: ${e}`);
      continue;
    }
    for (const r of report.results ?? []) {
      const id = (r.presetId ?? r.presetFile?.replace(/\.json$/, '')) || null;
      const status = r.status as BatchStatus | undefined;
      if (id && status && status in STATUS_TO_CERTIFICATION) {
        latest.set(id, status);
      }
    }
  }
  return latest;
};

const main = () => {
  const dryRun = process.argv.includes('--dry-run');
  const statuses = collectLatestStatuses();

  const tally: Record<string, number> = {};
  let written = 0;
  let missing = 0;

  for (const [id, status] of statuses) {
    const { certification, certificationStatus } = STATUS_TO_CERTIFICATION[status];
    tally[certification] = (tally[certification] ?? 0) + 1;

    const presetPath = path.join(PRESETS_DIR, `${id}.json`);
    if (!fs.existsSync(presetPath)) {
      missing++;
      continue;
    }
    if (dryRun) continue;

    const content = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
    content.metadata = content.metadata ?? {};
    content.metadata.milkwave = {
      ...(content.metadata.milkwave ?? {}),
      certificationStatus,
      lastCertifiedAt: new Date().toISOString(),
      certificationSource: 'batch-tester'
    };
    content.metadata.certification = certification;
    fs.writeFileSync(presetPath, JSON.stringify(content, null, 2));
    written++;
  }

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Batch-derived certification over ${statuses.size} observed presets ` +
      `(${written} written, ${missing} preset files missing).`
  );
  console.log('By certification:', JSON.stringify(tally));
};

main();
