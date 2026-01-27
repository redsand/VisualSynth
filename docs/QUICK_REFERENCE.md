# VisualSynth - Quick Reference

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Pause/Resume playback |
| `F` | Toggle fullscreen (output window) |
| `R` | Toggle recording |
| `P` | Take screenshot |
| `Ctrl+S` | Save project |
| `Ctrl+O` | Open project |
| `1` | Switch to Performance mode |
| `2` | Switch to Scene mode |
| `3` | Switch to Design mode |
| `4` | Switch to Matrix mode |
| `5` | Switch to System mode |
| `A/B/C/D` | Switch pad bank |

---

## UI Modes

| Mode | Purpose | Key Features |
|------|---------|--------------|
| **Performance** | Live performance | Scene strip, 64-pad grid, macros, preset playlist |
| **Scene** | Layer management | Layer list, generator library, style presets, capture |
| **Design** | Global effects | Effects, particles, SDF shapes, assets, shader editor |
| **Matrix** | Modulation | Mod matrix, MIDI mapping, LFOs, envelopes |
| **System** | Configuration | Audio/MIDI devices, project I/O, diagnostics, output |

---

## Visual Generators

### Layer Generators

| ID | Name | Description |
|----|------|-------------|
| `layer-plasma` | Shader Plasma | Fluid organic patterns |
| `layer-spectrum` | Spectrum Bars | Audio spectrum bars |
| `layer-origami` | Origami Fold | Geometric fold patterns |
| `layer-glyph` | Glyph Language | Procedural symbols |
| `layer-crystal` | Crystal Harmonics | Crystal/glass formations |
| `layer-inkflow` | Ink Flow | Brush-stroke effects |
| `layer-topo` | Topo Terrain | Topographic terrain |
| `layer-weather` | Audio Weather | Weather effects |
| `layer-portal` | Wormhole Portal | Portal distortions |
| `layer-oscillo` | Sacred Oscilloscope | Circular oscilloscope |

### Additional Generators

| ID | Name | Description |
|----|------|-------------|
| `gen-particles` | Particle Field | GPU particle system |
| `gen-sdf` | SDF Shapes (Simple) | Basic SDF shapes |
| `gen-sdf-scene` | SDF Scene (Advanced) | Complex SDF scenes |

---

## Effects

| Effect | What It Does | Good For |
|--------|--------------|----------|
| **Bloom** | Glowing highlights | Neon, dreamy looks |
| **Blur** | Softens image | Depth of field |
| **Chroma** | Color fringing | Glitch effects |
| **Posterize** | Reduces colors | Retro/8-bit |
| **Kaleidoscope** | Mirrors image | Mandala patterns |
| **Feedback** | Previous frame trails | Echo, trails |
| **Persistence** | Trail decay rate | Trail length control |

---

## Modulation Sources

| Source | Type | Use For |
|--------|------|---------|
| `audio.rms` | Audio level | Overall volume reactivity |
| `audio.peak` | Peak detection | Beat hits, accents |
| `audio.low/mid/high` | Frequency bands | Bass/mid/treble response |
| `audio.onset` | Beat detection | Synced effects |
| `lfo-1/2` | LFO | Continuous oscillation |
| `env-1/2` | Envelope | Percussive responses |
| `sh-1/2` | Sample & Hold | Random, stepped changes |

---

## Preset Categories

| Category | Presets | Style |
|----------|---------|-------|
| **Essentials** | 01-10 | Basic, versatile |
| **VisualSynth DNA** | 11-29 | Signature looks |
| **Generators** | 30-44 | Single generator demos |
| **SDF Shapes** | 100-109 | SDF-based presets |
| **Advanced** | Various | Complex scenes |

---

## Pad Actions (Default Bank A)

| Pads | Action | Effect |
|------|--------|--------|
| 0-31 | Toggle Plasma | Enable/disable plasma layer |
| 32-63 | Strobe | Flash white |

**Custom Actions** (via Pad Mapping in Design mode):
- `origami-mountain/valley/collapse/explode`
- `gravity-spawn-fixed/audio`
- `glyph-stack/orbit/explode/sentence`
- `crystal-seed/grow/fracture/melt`
- `ink-fine/dry/neon`
- `topo-quake/landslide/plate`
- `weather-storm/fog/calm/hurricane`
- `portal-spawn/collapse/transition`
- `oscillo-capture/freeze/rotate`
- `macro-1` through `macro-8`

---

## MIDI Message Types

| Type | Description | Common Uses |
|------|-------------|-------------|
| **Note** | Note on/off | Triggers, toggles |
| **CC** | Continuous Controller | Knobs, faders |
| **Aftertouch** | Pressure after note | Expression |
| **Pitchbend** | Pitch bend wheel | Pitch effects |

---

## Layer Blend Modes

| Mode | Result |
|------|--------|
| **Normal** | Standard blending |
| **Add** | Lightens (good for additive) |
| **Multiply** | Darkens (good for shadows) |
| **Screen** | Lightens like photographic screen |
| **Overlay** | Combines multiply and screen |
| **Difference** | Shows difference between layers |

---

## Quantization Options

| Option | Timing | Best For |
|--------|--------|----------|
| **1/4** | Quarter note | Fast changes |
| **1/2** | Half note | Medium changes |
| **1 Bar** | Full bar | Smooth transitions |

---

## Output Resolution Scales

| Scale | Resolution | Use When |
|-------|------------|----------|
| **100%** | 1280x720 | Best quality |
| **75%** | 960x540 | Good quality/performance |
| **50%** | 640x360 | Better performance |
| **25%** | 320x180 | Maximum performance |

---

## Recording Formats

| Format | Extension | Quality | File Size |
|--------|-----------|---------|-----------|
| **WebM** | `.webm` | Good | Smaller |
| **MP4** | `.mp4` | Best | Larger (requires ffmpeg) |

---

## FPS Options

| FPS | Quality | Performance | Best For |
|-----|---------|-------------|----------|
| **24** | Cinematic | Best | Recording video |
| **30** | Good | Good | General use |
| **60** | Best | Lower | Real-time monitoring |

---

## Common Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| No audio response | Check audio input device |
| Low FPS | Lower output resolution, disable effects |
| Black screen | Enable layers, check effect opacity |
| MIDI not working | Enable MIDI in System mode |
| Recording fails | Check folder permissions, try WebM |

---

## File Locations

| File Type | Location |
|-----------|----------|
| Projects | User-selected or app data |
| Presets | `assets/presets/` |
| Templates | `assets/templates/` |
| Screenshots | User-selected |
| Recordings | User-selected |

---

## Performance Tips

1. Use **50%** output scale if FPS drops below 30
2. **Disable bloom** for better performance
3. **Reduce particle density** if GPU-limited
4. **Close background apps** to free resources
5. Use **ASIO drivers** on Windows for lower latency
6. **Monitor FPS** in the health strip

---

## Getting Started Checklist

- [ ] Launch VisualSynth
- [ ] Select audio input device
- [ ] Enable MIDI (if using controller)
- [ ] Load a preset (try "Cosmic Plasma")
- [ ] Play some music
- [ ] Verify visuals respond
- [ ] Try adjusting macros
- [ ] Switch between scenes
- [ ] Try pad controls
- [ ] Save your project

---

## Documentation Links

- **Full User Guide**: `docs/USER_GUIDE.md`
- **Visual Verification**: `docs/VISUAL_VERIFICATION_GUIDE.md`
- **FX System**: `docs/FX_SYSTEM.md`
- **UX Design**: `docs/UX_REIMAGINE.md`

---

**Version**: 2.0
**Last Updated**: 2026-01-27