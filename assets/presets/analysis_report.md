# Preset Analysis and Curated Core Club Pack Report

## Overview
Analyzed 205 non-milkwave presets in `assets/presets`. The analysis focused on deduplication, visual topology grouping, and DJ usefulness scoring.

## 1. Exact Duplicate Groups
Identified several groups of presets with identical scene and layer structures. These have been tagged for archiving or conversion to variants.

**Key Duplicate Groups:**
- **Essentials Group:** `preset-002-spectrum.json`, `preset-021-neon-skyline.json`, `preset-061-circuit-pulse.json`, `preset-062-particle-swarm.json`, `preset-087-soft-spectrum.json`, `preset-103-sdf-3d-torus.json`
- **Vivid/Ignite:** `preset-004-vivid.json`, `preset-006-ignite.json`
- **Midnight/Obsidian:** `preset-005-midnight.json`, `preset-058-obsidian-pulse.json`
- **DNA Feedback Chain:** `preset-016-visualsynth-dna-feedback.json`, `preset-025-neon-drift.json`, `preset-027-ember-pulse.json`, `preset-028-aurora-chord.json`, `preset-029-voltage-bloom.json`, `preset-037-glitch-datamosh.json`, `preset-059-visualsynth-dna-particles.json`, `preset-064-kaleido-trails.json`

## 2. Visual Topology Outliers (Strong Unique Presets)
Presets with unique combinations of generators and scene structures:
- `preset-001-cosmic.json` (Complex multi-scene plasma)
- `preset-070-glyph-language.json` (Pure generative glyphs)
- `preset-111-laser-beam.json` (Specialized EDM laser simulation)
- `preset-220-boss-health.json` (Game UI style visualizer)

## 3. DJ Usefulness Scoring System
Presets now include a `scores` object in their metadata:
- **Opener**: High for ambient/slow presets (e.g., Plasma).
- **Build**: High for presets with spectrum analyzers.
- **Drop**: High for pulsing, strobing, or high-energy presets.
- **Breakdown**: High for atmospheric, low-complexity visuals.
- **Perceived Depth/3D**: High for portal and topo-based generators.

## 4. Proposed "Core Club Pack" (40 Presets)
A curated selection of 40 presets tagged as `hero` and `isCoreClubPack: true`:
1. `preset-001-cosmic.json`
2. `preset-002-spectrum.json`
3. `preset-004-vivid.json`
4. `preset-005-midnight.json`
5. `preset-007-sdf-monolith.json`
6. `preset-008-sdf-pulse.json`
7. `preset-009-sdf-morph.json`
8. `preset-011-sdf-rain.json`
9. `preset-013-glyph-matrix.json`
10. `preset-014-origami-storm.json`
11. `preset-016-visualsynth-dna-feedback.json`
12. `preset-017-slow-plasma.json`
13. `preset-020-glitch-grid.json`
14. `preset-023-visualsynth-dna-bloom.json`
15. `preset-031-audio-geometry.json`
16. `preset-033-organic-fluid.json`
17. `preset-035-neon-wireframe.json`
18. `preset-037-glitch-datamosh.json`
19. `preset-039-particle-swarm.json`
20. `preset-041-typography-reveal.json`
21. `preset-045-radar-hud.json`
22. `preset-047-fractal-bloom.json`
23. `preset-049-vhs-scanline.json`
24. `preset-051-lunar-echo.json`
25. `preset-060-visualsynth-dna-sdf.json`
26. `preset-070-glyph-language.json`
27. `preset-071-crystal-harmonics.json`
28. `preset-073-topo-terrain.json`
29. `preset-075-wormhole-portals.json`
30. `preset-076-sacred-oscilloscope.json`
31. `preset-111-laser-beam.json`
32. `preset-112-strobe-flash.json`
33. `preset-113-shape-burst.json`
34. `preset-114-grid-tunnel.json`
35. `preset-126-bass-face.json`
36. `preset-130-laser-show.json`
37. `preset-132-pyro-stage.json`
38. `preset-164-starburst-galaxy.json`
39. `preset-184-pulse-heart.json`
40. `preset-220-boss-health.json`

## 5. Metadata and Tagging
- **Hero**: Part of the Core Club Pack or visually distinct.
- **Variant**: Near-duplicates with minor parameter changes.
- **Archive**: Exact duplicates or low-quality legacy presets.
- **Support**: High-quality presets that complement the hero set.
