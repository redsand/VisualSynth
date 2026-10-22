#!/usr/bin/env node
// Re-verify a milkwave batch report using the captured screenshots as ground truth.
//
// Why: the tester's in-page visibility check (sampleCanvasPixels) reads 9 pixels
// via gl.readPixels outside the WebGL present loop, which returns black for the
// default framebuffer even while the composited page shows real content
// (proven batch 9221: "fallback" presets screenshot at YAVG≈25 YMAX=235 while
// every sampled pixel reads 0,0,0). page.screenshot captures what the audience
// actually sees, and every batch run already saves those PNGs.
//
// For each result in the given report this script measures per-shot luma stats
// (ffmpeg signalstats) and reclassifies:
//
//   visible      = any shot with YMAX >= 48 and (YMAX - YMIN) >= 16
//                  (non-uniform and not near-black; a uniform frame — YMIN==YMAX
//                  at 16 or 235 — is the safe-mode/placeholder pattern, not content)
//   native       = warp and comp both compiled with status 'success'
//   safeMode     = diagnostics.safeModeReasons non-empty
//
//   !visible                                -> black_output  (archived)
//   visible && native && !safeMode          -> working       (safe)
//   visible && (!native || safeMode)         -> fallback      (degraded)
//
// Results keep the same { results: [...] } shape as a batch report (the
// certification bridge can consume the output via --report), plus per-preset
// shotStats and the original tester status for auditability. Presets whose
// screenshots are unreadable keep their original status.
//
// Usage:
//   node scripts/reverify-batch-screenshots.js --report <batch-report.json> [--out <file>] [--concurrency 8]

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const readArg = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};

const REPORT = readArg('--report');
const OUT = readArg('--out'); // default: alongside the report, *-reverified.json
const CONCURRENCY = Number(readArg('--concurrency', '8')) || 8;

const VISIBLE_YMAX = 48; // peak luma below this = effectively black
const VISIBLE_RANGE = 16; // YMAX-YMIN below this = uniform placeholder frame
const BLOWN_YAVG = 200; // average luma above this = saturated-white runaway frame
// The feedback loop writes comp output into the main texture, so additive
// comp shaders (starfield presets adding stars+roam terms every frame)
// compound and saturate to white. A mostly-white frame (YAVG>=200) is an
// unusable blown-out render even though its spread passes the visible test.

if (!REPORT || !fs.existsSync(REPORT)) {
  console.error(`usage: node scripts/reverify-batch-screenshots.js --report <batch-report.json>`);
  process.exit(1);
}

const shotStats = (file) =>
  new Promise((resolve) => {
    execFile(
      'ffmpeg',
      ['-hide_banner', '-i', file, '-vf', 'signalstats,metadata=print', '-f', 'null', '-'],
      (err, _stdout, stderr) => {
        const out = String(stderr || '');
        const grab = (key) => {
          const m = out.match(new RegExp(`lavfi\\.signalstats\\.${key}=([0-9.]+)`));
          return m ? Number(m[1]) : null;
        };
        const ymin = grab('YMIN');
        const ymax = grab('YMAX');
        const yavg = grab('YAVG');
        resolve(ymin === null || ymax === null ? null : { ymin, ymax, yavg });
      }
    );
  });

// Small promise pool so ~1000 ffmpeg calls don't fork-bomb the machine.
const pool = async (tasks, worker) => {
  const results = new Array(tasks.length);
  let next = 0;
  const run = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await worker(tasks[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, run));
  return results;
};

const main = async () => {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  const results = report.results || [];
  console.log(`re-verifying ${results.length} results from ${path.basename(REPORT)} (concurrency ${CONCURRENCY})`);

  // Flatten (result, shot) pairs, gather stats, then group back.
  const jobs = [];
  for (const [ri, r] of results.entries()) {
    for (const [si, s] of (r.screenshots || []).entries()) {
      jobs.push({ ri, si, file: s.path });
    }
  }
  const stats = await pool(jobs, async (j) => {
    if (!j.file || !fs.existsSync(j.file)) return { ...j, stat: null };
    return { ...j, stat: await shotStats(j.file) };
  });

  const perResult = new Map();
  for (const j of stats) {
    if (!perResult.has(j.ri)) perResult.set(j.ri, []);
    perResult.get(j.ri).push(j);
  }

  const tally = {};
  const reclassified = [];
  for (const [ri, r] of results.entries()) {
    const shotStatsList = (perResult.get(ri) || [])
      .map((j) => ({ file: path.basename(j.file || ''), ...(j.stat || {}) }))
      .filter((s) => s.ymax !== undefined);

    const compile = r.diagnostics?.milkdropCompileReport || {};
    const warpStatus = compile.warp?.status ?? 'none';
    const compStatus = compile.comp?.status ?? 'none';
    const safeMode = (r.diagnostics?.safeModeReasons || []).length > 0;

    const visible = shotStatsList.some((s) => s.ymax >= VISIBLE_YMAX && s.ymax - s.ymin >= VISIBLE_RANGE);
    const blownOut = shotStatsList.some((s) => s.yavg !== undefined && s.yavg >= BLOWN_YAVG);
    const native = warpStatus === 'success' && compStatus === 'success';

    let corrected;
    if (shotStatsList.length === 0) corrected = r.status; // no readable shots — trust the tester
    else if (!visible) corrected = 'black_output';
    else if (blownOut) corrected = 'blown_output';
    else if (native && !safeMode) corrected = 'working';
    else corrected = 'fallback';

    if (corrected !== r.status) reclassified.push(`${r.presetId}: ${r.status} -> ${corrected}`);
    tally[corrected] = (tally[corrected] || 0) + 1;

    r.originalStatus = r.status;
    r.status = corrected;
    r.shotStats = shotStatsList;
    r.reverify = { visible, blownOut, native, safeMode, warpStatus, compStatus };
  }

  const out = OUT || REPORT.replace(/\.json$/, '-reverified.json');
  const payload = {
    provenance: `screenshot re-verification of ${path.basename(REPORT)} via ffmpeg signalstats`,
    generatedNote: 'statuses here are derived from captured screenshots + milkdropCompileReport; see scripts/reverify-batch-screenshots.js',
    results,
  };
  fs.writeFileSync(out, JSON.stringify(payload, null, 1));
  console.log(`wrote ${out}`);
  console.log('corrected status tally:', JSON.stringify(tally));
  console.log(`reclassified ${reclassified.length}/${results.length} presets`);
  reclassified.forEach((l) => console.log('  ' + l));
};

main();