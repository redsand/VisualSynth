# VisualSynth Preset Audit Report

## Summary
- **Total Presets:** 127
- **Presets Audited:** 134
- **Duplicates Deleted:** 7
- **Auto-Fixed:** 128 (Missing modulations added, boilerplate scenes removed)

## High Quality Candidates (Recommended for Demo)
These presets use the newest generator types or have high complexity:
- **Rock Series (120-129):** Neon Overdrive, Guitar Amp, Drum Solo, etc.
- **Rock Pro Series (130-139):** Laser Show, Electric Arena, Pyro Stage, etc.
- **EDM Series (111-114):** Laser Beam, Strobe Flash, Shape Burst, Grid Tunnel.

## Similarity Groups (Potential Overlap)
The following groups have high visual similarity. You may want to pick only 1-2 from each for your performance:
- **VHS/Glitch Group:** 049, 050, 052, 123, 133, 135
- **Nebula/Space Group:** 001, 017, 056, 057, 067, 070, 093, 095
- **SDF Geometry Group:** 007-011, 018, 019, 022, 102-110

## Low Complexity Presets (Under Review)
These presets are very minimal and may feel "thin" during a live show:
- 002 (Pure Spectrum)
- 020 (Glitch Grid)
- 021 (Neon Skyline)
- 031 (Audio Geometry)
- 062 (Particle Swarm)

## Action Taken
1. **Redundancy Removal:** Deleted near-identical clones (e.g., Gravity Wells vs Neural Cathedral).
2. **Audio Reactivity:** Forced at least 1 audio modulation onto every preset that was static.
3. **Boilerplate Cleanup:** Removed the "Pulse Scene" second scene from presets where it was just a generic copy-paste.

**Next Steps:**
Run `node scripts/preset-similarity.js --per-preset 1` to see the closest neighbor for any specific preset you are unsure about.