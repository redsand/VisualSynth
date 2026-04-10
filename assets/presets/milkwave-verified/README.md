# Milkwave Verified Presets — Native Supported

**412 presets** verified as 100% working with zero fallbacks, zero shader errors, and zero degradation.

## Sources

| Source | Presets | Criteria |
|---|---|---|
| Batch tests (74 batches, presets 1019–1789) | 403 | Status: `working`, fallback: 0, errors: 0, compile_failed: 0 |
| Audit report (presets 1000–1099) | 9 additional | Classification: `native-supported`, not in batch range |

**Not included**: 72 presets classified as `supported-with-degradation` (fall back to default comp shader) and 15 classified as `runtime-failed` (fail to link entirely).

## Test Results Summary

- **733 presets** tested across 74 batches
- **403 working** (~55% pass rate)
- **330 failed** (shader errors, black output, or fallback used)

Detailed batch reports: `../../milkwave-test-results/reports/batch-XXXX-report.json`
Audit report: `../../assets/presets/milkwave_audit_report.json`

## How to Test

1. Load a preset from this folder in VisualSynth
2. Verify output renders on the preview canvas within 1–2 seconds
3. No black frames, no fallback banner, no console errors
