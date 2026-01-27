# VisualSynth Screenshot Generation Guide

This guide explains how to generate screenshots for documentation and visual verification.

---

## Table of Contents
1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Generating Screenshots](#generating-screenshots)
4. [Screenshot Categories](#screenshot-categories)
5. [Automated Testing](#automated-testing)
6. [Manual Screenshot Capture](#manual-screenshot-capture)
7. [Customizing Screenshots](#customizing-screenshots)
8. [Troubleshooting](#troubleshooting)

---

## Overview

VisualSynth includes three methods for generating screenshots:

1. **Placeholder Generator** - Creates simple colored PNG images for documentation placeholders
2. **Automated Capture** - Captures actual screenshots from the running application
3. **Test Suite** - Generates screenshots as part of the testing process

---

## Quick Start

### Generate All Placeholder Screenshots

```bash
npm run screenshots:all
```

This generates all documentation screenshots in the `docs/screenshots/` directory.

### Generate Screenshots for a Specific Category

```bash
npm run screenshots:ui-modes      # UI mode screenshots
npm run screenshots:generators    # Visual generator screenshots
npm run screenshots:effects       # Effect screenshots
```

### List Available Categories

```bash
npm run screenshots:list
```

### Clean Existing Screenshots

```bash
npm run screenshots:clean
```

---

## Generating Screenshots

### Method 1: Placeholder Generator (Recommended for Initial Documentation)

The placeholder generator creates simple colored PNG images with labels. This is useful for:

- Initial documentation layout
- Testing screenshot infrastructure
- Creating placeholder images before capturing real ones

**Generate all:**
```bash
npm run screenshots:all
```

**Generate specific category:**
```bash
node scripts/generate-screenshots.js --category generators
```

**Custom output directory:**
```bash
node scripts/generate-screenshots.js --all --output ./my-screenshots
```

### Method 2: Automated Capture (Real Screenshots)

The automated capture script runs VisualSynth and captures actual screenshots:

```bash
# This requires the app to be built first
npm run build
node scripts/capture-screenshots.js --preset preset-01-cosmic
```

**Options:**
- `--preset <name>` - Capture specific preset
- `--mode <mode>` - Set mode before capturing (performance|scene|design|matrix|system)
- `--wait <ms>` - Wait time before capture (default: 2000ms)
- `--width <px>` - Canvas width (default: 1280)
- `--height <px>` - Canvas height (default: 720)
- `--output <dir>` - Output directory (default: docs/screenshots)
- `--headless` - Run in headless mode (no UI)

**Examples:**
```bash
# Capture preset with full UI
node scripts/capture-screenshots.js --preset preset-01-cosmic

# Capture in system mode
node scripts/capture-screenshots.js --preset preset-01-cosmic --mode system

# Capture with custom dimensions
node scripts/capture-screenshots.js --preset preset-01-cosmic --width 1920 --height 1080

# List available scenarios
node scripts/capture-screenshots.js --list

# Capture all documentation scenarios
node scripts/capture-screenshots.js --all
```

### Method 3: Test Suite

Run the screenshot test suite:

```bash
npm run screenshots:test
```

This verifies that the screenshot infrastructure works correctly and generates mock screenshots.

---

## Screenshot Categories

### UI Modes

Screenshots of the five UI modes in VisualSynth:

| ID | Name | Description |
|----|------|-------------|
| `initial-launch-screen` | Initial Launch | Full application window with default UI layout |
| `performance-mode` | Performance Mode | Scene strip, pad grid, macros |
| `scene-mode` | Scene Mode | Layer list, generator library |
| `design-mode` | Design Mode | Effects, particles, SDF shapes |
| `matrix-mode` | Matrix Mode | Mod matrix, MIDI mapping, LFOs |
| `system-mode` | System Mode | Device selection, diagnostics |

### Visual Generators

Screenshots of each visual generator layer:

| ID | Name | Description |
|----|------|-------------|
| `generator-plasma` | Shader Plasma | Fluid organic patterns |
| `generator-spectrum` | Spectrum Bars | Audio spectrum bars |
| `generator-origami` | Origami Fold | Geometric fold patterns |
| `generator-glyph` | Glyph Language | Procedural symbols |
| `generator-crystal` | Crystal Harmonics | Crystal/glass formations |
| `generator-ink` | Ink Flow | Brush-stroke effects |
| `generator-topo` | Topo Terrain | Topographic terrain |
| `generator-weather` | Audio Weather | Weather effects |
| `generator-portal` | Wormhole Portal | Portal distortions |
| `generator-oscillo` | Sacred Oscilloscope | Circular oscilloscope |
| `generator-particles` | Particle Field | GPU particle system |

### Effects

Screenshots of each effect:

| ID | Name | Description |
|----|------|-------------|
| `effect-bloom` | Bloom | Glowing highlights |
| `effect-blur` | Blur | Soft blur effect |
| `effect-chroma` | Chromatic Aberration | RGB color splitting |
| `effect-posterize` | Posterize | Color reduction |
| `effect-kaleidoscope` | Kaleidoscope | Mirrored patterns |
| `effect-feedback` | Feedback | Trail/echo effects |

### SDF Shapes

Screenshots of SDF shape generators:

| ID | Name | Description |
|----|------|-------------|
| `sdf-shapes-simple` | Simple SDF | Basic SDF shapes |
| `sdf-scene-advanced` | Advanced SDF | Complex SDF scenes |

### Visualizers

Screenshots of visualizer overlays:

| ID | Name | Description |
|----|------|-------------|
| `visualizer-spectrum` | Spectrum | Spectrum overlay |
| `visualizer-waveform` | Waveform | Waveform overlay |
| `visualizer-oscilloscope` | Oscilloscope | Circular oscilloscope |

### UI Components

Screenshots of UI components:

| ID | Name | Description |
|----|------|-------------|
| `preset-browser` | Preset Browser | Preset list and browser |
| `macros-panel` | Macros Panel | 8 macro controls |
| `mod-matrix-add` | Mod Matrix | Modulation matrix |
| `pad-grid` | Pad Grid | 8x8 pad grid |
| `midi-selection` | MIDI Selection | MIDI device dropdown |
| `midi-mapping` | MIDI Mapping | MIDI mapping list |

---

## Automated Testing

### Screenshot Test Suite

The screenshot test suite verifies the screenshot infrastructure:

```bash
npm run screenshots:test
```

This includes tests for:

- Mock WebGL2 canvas creation
- Screenshot helper functions
- Placeholder screenshot generation
- File I/O operations

### Writing New Screenshot Tests

To add new screenshot tests, edit `tests/screenshot.test.ts`:

```typescript
it('should capture my-new-feature', () => {
  const data = screenshotHelper.generateMockScreenshot('my-new-feature', 1280, 720);
  screenshotHelper.saveScreenshot('my-new-feature', data);

  expect(screenshotHelper.verifyScreenshot('my-new-feature')).toBe(true);
});
```

---

## Manual Screenshot Capture

### Using Built-in Screenshot Function

1. Launch VisualSynth
2. Navigate to the desired screen/preset
3. Press `P` or click the "Screenshot" button
4. Select save location

### Using Output Window

1. Open output window (`System` → `Output` → `Open Output`)
2. Set up your visuals
3. Use screenshot function or external screen capture tool

### Recommended Screen Capture Tools

**Windows:**
- Built-in: `Win + Shift + S` (Snipping Tool)
- Greenshot: https://getgreenshot.org/
- ShareX: https://getsharex.com/

**macOS:**
- Built-in: `Cmd + Shift + 4` (Selection), `Cmd + Shift + 5` (Screenshot tool)
- CleanShot X: https://cleanshot.com/

**Linux:**
- Built-in: `Shift + Print Screen` (varies by DE)
- Flameshot: https://flameshot.org/
- Shutter: https://shutter-project.org/

---

## Customizing Screenshots

### Modifying Placeholder Colors

Edit `scripts/generate-screenshots.js` to change colors:

```javascript
{
  id: 'generator-plasma',
  name: 'Shader Plasma',
  color: '#ff6b6b',  // Change this color
  label: 'Shader Plasma'
}
```

### Adding New Screenshots

Add to the appropriate category in `scripts/generate-screenshots.js`:

```javascript
screenshots: [
  {
    id: 'my-new-screenshot',
    name: 'My New Feature',
    color: '#ff6b6b',
    label: 'My New Feature'
  }
]
```

### Adding New Categories

Add a new category object to the categories object:

```javascript
const categories = {
  // ... existing categories
  'my-new-category': {
    name: 'My New Category',
    description: 'Description of my category',
    screenshots: [
      // your screenshots
    ]
  }
};
```

---

## Troubleshooting

### Screenshots Not Generated

**Issue**: No screenshots appear in `docs/screenshots/`

**Solutions**:
1. Check if the directory exists: `ls docs/screenshots`
2. Run with `--list` to verify category names
3. Check file permissions on the output directory
4. Try running: `node scripts/generate-screenshots.js --all`

### Invalid PNG Files

**Issue**: Generated PNG files are invalid or corrupted

**Solutions**:
1. Ensure the script has write permissions
2. Check disk space
3. Try a different output directory
4. Verify Node.js version (requires Node.js 16+)

### Test Failures

**Issue**: `npm run screenshots:test` fails

**Solutions**:
1. Run `npm install` to ensure dependencies are installed
2. Clean test cache: `rm -rf node_modules/.vitest`
3. Run tests with verbose output: `npm test -- screenshot.test.ts --reporter=verbose`

### Automated Capture Issues

**Issue**: `node scripts/capture-screenshots.js` doesn't work

**Solutions**:
1. Build the app first: `npm run build`
2. Check that `dist/renderer/index.html` exists
3. Ensure preload script is compiled: `ls dist/main/preload.js`
4. Try with `--headless` flag

---

## Output Directory Structure

After generating screenshots, your `docs/screenshots/` directory should look like:

```
docs/screenshots/
├── initial-launch-screen.png
├── performance-mode.png
├── scene-mode.png
├── design-mode.png
├── matrix-mode.png
├── system-mode.png
├── generator-plasma.png
├── generator-spectrum.png
├── generator-origami.png
├── generator-glyph.png
├── generator-crystal.png
├── generator-ink.png
├── generator-topo.png
├── generator-weather.png
├── generator-portal.png
├── generator-oscillo.png
├── generator-particles.png
├── effect-bloom.png
├── effect-blur.png
├── effect-chroma.png
├── effect-posterize.png
├── effect-kaleidoscope.png
├── effect-feedback.png
├── sdf-shapes-simple.png
├── sdf-scene-advanced.png
├── visualizer-spectrum.png
├── visualizer-waveform.png
├── visualizer-oscilloscope.png
├── preset-browser.png
├── macros-panel.png
├── mod-matrix-add.png
├── pad-grid.png
├── midi-selection.png
└── midi-mapping.png
```

---

## Integration with Documentation

### Updating Visual Verification Guide

After generating screenshots, update `docs/VISUAL_VERIFICATION_GUIDE.md` to reference the actual images:

```markdown
### 4.1 Shader Plasma Layer

**What to see**:
- Load preset "Cosmic Plasma"
- Fluid, organic color patterns
- Colors shift smoothly over time

**Screenshot**:
`![Shader Plasma](../screenshots/generator-plasma.png)`

**Verification**:
- [ ] Plasma patterns are smooth
- [ ] Colors are vibrant
- [ ] Movement is continuous
```

### Auto-Generating Documentation

You can create a script to automatically update documentation with screenshots:

```bash
# Generate screenshots
npm run screenshots:all

# Then run a documentation update script
# (you would need to create this script)
node scripts/update-doc-screenshots.js
```

---

## Best Practices

1. **Generate screenshots before release**: Update documentation with each release
2. **Use consistent naming**: Follow the naming convention in `scripts/generate-screenshots.js`
3. **Commit screenshots to git**: Include them in the repository for consistent documentation
4. **Update verification guide**: Keep screenshots in sync with `VISUAL_VERIFICATION_GUIDE.md`
5. **Test screenshot generation**: Run `npm run screenshots:test` before committing changes

---

## Related Documentation

- [User Guide](USER_GUIDE.md) - Main user documentation
- [Visual Verification Guide](VISUAL_VERIFICATION_GUIDE.md) - Feature verification with screenshots
- [Quick Reference](QUICK_REFERENCE.md) - Keyboard shortcuts and quick lookup

---

**Version**: 2.0
**Last Updated**: 2026-01-27