# Unique 100 — Fresh Scenes (showcase-unique-100.project.json)

Built 2026-11-06 by `scripts/build-unique-showcase.ts`. A brand-new show
project of **100 scenes none of which appear in any existing project** — in
particular `showcase-performance.project-sues.json` (the live show), the
hard requirement. Verified on the built file: zero scene-name overlap with
sues, zero presetPath overlap with every existing showcase, no
cadence-stalling presets (`mashup-(282)`, `02_mw_new01f_u` are excluded by
the builder).

## Where the scenes come from

**Rebuilt 2026-11-06 (post-fix) from fresh ground truth.** The original
selection was scored before two renderer changes (the milkwave EEL built-in
reset and the comp-stage gamma) — brightness scores moved under gamma and
some former failures rendered differently. The entire certified-safe library
(490 presets) was re-audited on the fixed engine
(`milkwave-test-results/postfix-audit/`), plus a solo re-audit of the
safe-mode failure class (frame-cadence trips are contention-sensitive under
parallel shards — `safemode-solo-check2/` and `safemode-solo-rest/` restored
the presets that pass solo). The show is built `--fresh-only` from that
evidence.

**Library retirement, same day:** presets that fail the post-fix audit
(BLACK / BLOWN / safe-mode / shader errors / HUNG) were flipped from
`certified safe` to `degraded` with provenance in
`metadata.milkwave.reasons` (`scripts/retire-failing-presets.ts`; solo
passes restored by `scripts/restore-solo-passes.ts`). Certified-safe now
means "verified to render end-to-end on the current engine": the post-fix
pool is 127 passers (123 from the full audit + 4 solo restorations) out of
490 previously-certified.

Every scene passed the ground-truth bar (visible, not blown, no safe-mode
stalls, no shader errors) on the current engine, imported through the REAL
path (migratePreset → validatePreset → applyPresetV6), carries
`presetPath` provenance, and the project passes `projectSchema`. Scenes
keep MANUAL triggers — no auto-advance on load.

## Quality & diversity

- Quality score = 0.40·midBrightness + 0.35·contrastSpread + 0.25·motion
  (same scale as the quality-showcase builder). Post-fix scores run
  **0.173..0.799** — the gem floor was recalibrated to 0.20 for the
  post-gamma score distribution (the pre-gamma 0.35 floor rejected the
  good tail of the 127-passer pool).
- Mix: **8 gems** (distinct-author presets), **48 mashups** (each name
  once), **44 starfields** (per-subfamily caps so letter variants don't
  stack).
- Scenes interleave groups so the auto-advance rotation alternates visual
  families.

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

## This build's verification results (2026-11-06, post-fix rebuild)

- **Diagnostics cycle: 100/100 scenes clean** — no shader errors, no
  safe-mode fallbacks, warp+comp compiled everywhere, no console errors.
  (The first rebuild pass exposed two cadence-stallers — Mashup (290),
  02_MW_new02C4 — which were excluded and re-degraded; the final build
  cycles clean.)
- **Rotation sweep (200 transitions): 4 scene pairs flag a brief entry
  black** — `Mashup (360)→01_MW_new16j_U`, `02_MW_new03C3→X-spiral tiles (2)`,
  `02_MW_new02A1→Hexcollie…`, `02_MW_new03K3→acid wiring…` — the
  first-activation framebuffer-allocation class (same as the 2 pairs in
  the pre-fix build; all four target scenes render clean sustained and
  pass the diagnostics cycle). The live slideshow transitions are
  crossfaded, which covers a sub-100ms entry blink. Accepted as known
  behavior; a renderer-level warm-up (pre-allocating scene framebuffers
  on project apply) would remove it if it ever matters in practice.

## Tooling hardening from this build

- `audit-project.ts` now has a **60s per-scene watchdog**: hang-capable
  presets (two found this session) peg the renderer main thread at 100%
  CPU forever, and a harness built on `page.evaluate` deadlocks with no
  timeout. Hung scenes are recorded `main: 'HUNG'` (hard fail) and the
  browser is killed/relaunched so the shard completes.
- The builder's screened-candidate bar now rejects safe-mode rows
  (poor-frame-cadence guard), matching the audit's own pass criteria.
