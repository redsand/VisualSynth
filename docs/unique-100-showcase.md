# Unique 100 — Fresh Scenes (showcase-unique-100.project.json)

Built 2026-11-06 by `scripts/build-unique-showcase.ts`. A brand-new show
project of **100 scenes none of which appear in any existing project** — in
particular `showcase-performance.project-sues.json` (the live show), the
hard requirement. Verified on the built file: zero scene-name overlap with
sues, zero presetPath overlap with every existing showcase, no
cadence-stalling presets (`mashup-(282)`, `02_mw_new01f_u` are excluded by
the builder).

## Where the scenes come from

Every scene passed the **ground-truth visibility bar** (the certification
chain: screenshots + ffmpeg signalstats — visible, not blown out, no
safe-mode stalls, no shader errors) in one of:

1. The reverified batch reports (`milkwave-test-results/reports/batch-*-report-reverified.json`)
2. This session's screening audits of the previously-unscreened library:
   `milkwave-test-results/unique-100-screen{,-b2,-b3}/results-shard*.json`

Screening completed 2026-11-06 covers **the entire certified-safe library**
(404 presets newly audited this session: 73 clean, 18.1% — the unscreened
tail is dominated by BLACK / BLOWN / safe-mode presets, exactly what
screening exists to filter). Future shows can draw straight from this ground
truth without re-auditing.

## Quality & diversity

- Quality score = 0.40·midBrightness + 0.35·contrastSpread + 0.25·motion
  (same scale as the quality-showcase builder). Selected scores run
  **0.255..0.855** — the weak tail (score ~0.01 near-flat scenes in the
  pool) was deliberately rejected.
- Mix: **11 gems** (distinct-author presets above the quality floor),
  **35 mashups** (each name once), **54 starfields** (per-subfamily caps so
  letter variants don't stack).
- Scenes interleave groups so the auto-advance rotation alternates visual
  families.
- Each scene was imported through the REAL path (migratePreset →
  validatePreset → applyPresetV6), carries `presetPath` provenance, and the
  project passes `projectSchema`.

## How to rebuild / grow

```bash
# full rebuild from the existing ground truth
npx ts-node --transpile-only scripts/build-unique-showcase.ts --build \
  --screened=milkwave-test-results/unique-100-screen:/tmp/vs-screen-unique.json \
  --screened=milkwave-test-results/unique-100-screen-b2:/tmp/vs-screen-unique-b2.json \
  --screened=milkwave-test-results/unique-100-screen-b3:/tmp/vs-screen-unique-b3.json

# screen NEW presets (after importing new certified-safe presets)
npx ts-node --transpile-only scripts/build-unique-showcase.ts --screen-out=<file> --family-cap=999
npx ts-node --transpile-only scripts/audit-project.ts --project=<file> --out=<dir> --no-output [--shard=i/n]
```

Verification: `scripts/verify-quality-showcase.ts --project=<file>`
(diagnostics cycle — no shader errors, no safe-mode, warp+comp compiled) and
`scripts/rotation-check-quality-showcase.ts --project=<file>` (drives every
scene-pair transition twice and reads the TransitionTracer).

## This build's verification results (2026-11-06)

- **Diagnostics cycle: 100/100 scenes clean** — no shader errors, no
  safe-mode fallbacks, warp+comp compiled everywhere, no console errors.
- **Rotation sweep (200 transitions + 2 from apply): 2 deterministic pairs
  flag a brief entry black — `02_MW_new03B2 → X-spiral tiles (2)` and
  `02_MW_new03K3 → disco mix (FireOptics)...`** — 3–5 frames (~60–80ms),
  tracer suspicion `framebufferAllocated` (first-activation FBO allocation).
  Both target scenes render clean sustained (their per-scene ground truth
  and the diagnostics cycle pass), and the live slideshow transitions are
  crossfaded, which covers a sub-100ms blink. Accepted as known minor
  behavior; a renderer-level warm-up (pre-allocating scene FBOs on project
  apply) would remove it if it ever matters in practice.

## Tooling hardening from this build

- `audit-project.ts` now has a **60s per-scene watchdog**: hang-capable
  presets (two found this session) peg the renderer main thread at 100%
  CPU forever, and a harness built on `page.evaluate` deadlocks with no
  timeout. Hung scenes are recorded `main: 'HUNG'` (hard fail) and the
  browser is killed/relaunched so the shard completes.
- The builder's screened-candidate bar now rejects safe-mode rows
  (poor-frame-cadence guard), matching the audit's own pass criteria.
