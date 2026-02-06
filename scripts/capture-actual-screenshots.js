#!/usr/bin/env node

/**
 * VisualSynth Automated Screenshot Capture System
 *
 * This script launches VisualSynth in headless mode and captures
 * actual screenshots of the application with specific presets and configurations.
 *
 * Usage:
 *   node scripts/capture-actual-screenshots.js [options]
 *
 * Options:
 *   --all              Capture all screenshots (docs + presets)
 *   --category <name>  Capture screenshots for a category
 *   --preset <name>    Capture specific preset
 *   --output <dir>     Output directory (default: docs/screenshots)
 *   --headless         Run in headless mode
 *   --list             List available scenarios
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../docs/screenshots');
const PRESET_SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'presets');

// VisualSynth paths
const DIST_DIR = path.join(__dirname, '../dist');
const PRESETS_DIR = path.join(__dirname, '../assets/presets');

const getGeneratorScenarios = () => {
  if (!fs.existsSync(PRESETS_DIR)) return [];
  return fs.readdirSync(PRESETS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      const id = path.basename(file, '.json');
      return {
        id: `generator-${id}`,
        name: `Preset ${id}`,
        preset: file,
        wait: 5000
      };
    });
};

// Screenshot scenarios with actual configurations
const scenarios = {
  'ui-modes': [
    { id: 'initial-launch-screen', name: 'Initial Launch Screen', mode: 'performance', wait: 5000 },
    { id: 'performance-mode', name: 'Performance Mode', mode: 'performance', preset: 'preset-001-cosmic.json', wait: 3000 },
    { id: 'scene-mode', name: 'Scene Mode', mode: 'scene', preset: 'preset-011-sdf-rain.json', wait: 3000 },
    { id: 'design-mode', name: 'Design Mode', mode: 'design', preset: 'preset-102-sdf-geometry-101.json', wait: 3000 },
    { id: 'matrix-mode', name: 'Matrix Mode', mode: 'matrix', preset: 'preset-070-glyph-language.json', wait: 3000 },
    { id: 'system-mode', name: 'System Mode', mode: 'system', preset: 'preset-105-hyper-plasma.json', wait: 3000 }
  ],
  'generators': getGeneratorScenarios(),
  'effects': [
    { id: 'effect-bloom', name: 'Bloom', preset: 'preset-023-visualsynth-dna-bloom.json', wait: 5000 },
    { id: 'effect-blur', name: 'Blur', preset: 'preset-087-soft-spectrum.json', wait: 5000 },
    { id: 'effect-chroma', name: 'Chromatic Aberration', preset: 'preset-013-glyph-matrix.json', wait: 5000 },
    { id: 'effect-posterize', name: 'Posterize', preset: 'preset-065-posterize-strobe.json', wait: 5000 },
    { id: 'effect-kaleidoscope', name: 'Kaleidoscope', preset: 'preset-064-kaleido-trails.json', wait: 5000 },
    { id: 'effect-feedback', name: 'Feedback', preset: 'preset-128-feedback-loop.json', wait: 5000 }
  ],
  'sdf': [
    { id: 'sdf-shapes-simple', name: 'Simple SDF', preset: 'preset-102-sdf-geometry-101.json', wait: 5000 },
    { id: 'sdf-scene-advanced', name: 'Advanced SDF', preset: 'preset-100-whirlpool.json', wait: 5000 }
  ],
  'visualizers': [
    { id: 'visualizer-spectrum', name: 'Spectrum', preset: 'preset-002-spectrum.json', wait: 5000 },
    { id: 'visualizer-waveform', name: 'Waveform', preset: 'preset-076-sacred-oscilloscope.json', wait: 5000 },
    { id: 'visualizer-oscilloscope', name: 'Oscilloscope', preset: 'preset-076-sacred-oscilloscope.json', wait: 5000 }
  ],
  'ui-components': [
    { id: 'preset-browser', name: 'Preset Browser', mode: 'performance', wait: 3000 },
    { id: 'macros-panel', name: 'Macros Panel', mode: 'performance', wait: 3000 },
    { id: 'mod-matrix-add', name: 'Mod Matrix', mode: 'matrix', wait: 3000 },
    { id: 'pad-grid', name: 'Pad Grid', mode: 'performance', wait: 3000 },
    { id: 'midi-selection', name: 'MIDI Selection', mode: 'system', wait: 3000 },
    { id: 'midi-mapping', name: 'MIDI Mapping', mode: 'matrix', wait: 3000 }
  ],
  'features': [
    { id: 'audio-response', name: 'Audio Response', preset: 'preset-001-cosmic.json', wait: 5000 },
    { id: 'shape-burst-verify', name: 'Shape Burst', preset: 'preset-999-shape-burst-verify.json', action: 'burst-star', wait: 2000 },
    { id: 'output-window', name: 'Output Window', mode: 'system', wait: 3000 },
    { id: 'output-fullscreen', name: 'Fullscreen Output', mode: 'system', wait: 3000 },
    { id: 'recording-status', name: 'Recording', mode: 'performance', wait: 3000 },
    { id: 'diagnostics-fps', name: 'FPS Diagnostics', mode: 'system', wait: 3000 }
  ]
};

/**
 * Wait for a specified time
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Capture a screenshot of the canvas
 */
async function captureCanvas(page, filePath) {
  // Get the canvas element
  const canvasExists = await page.evaluate(() => {
    return !!document.getElementById('gl-canvas');
  });

  if (!canvasExists) {
    console.log('  ⚠ Canvas not found, capturing full page instead');
    await page.screenshot({ path: filePath, fullPage: false });
    return;
  }

  // Capture the canvas toDataURL directly and save as file
  const dataUrl = await page.evaluate(async () => {
    const canvas = document.getElementById('gl-canvas');
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  });

  if (dataUrl) {
    const base64Data = dataUrl.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    console.log(`    ✓ Saved: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  } else {
    console.log('  ⚠ Could not capture canvas, capturing full page instead');
    await page.screenshot({ path: filePath, fullPage: false });
  }
}

/**
 * Get all preset filenames
 */
function getPresetFiles() {
  if (!fs.existsSync(PRESETS_DIR)) return [];
  return fs
    .readdirSync(PRESETS_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort();
}

/**
 * Wait for the canvas to have non-black content
 */
async function waitForCanvasContent(page, timeoutMs = 10000) {
  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    const hasContent = await page.evaluate(() => {
      const canvas = document.getElementById('gl-canvas');
      if (!canvas) return false;
      const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!ctx) return false;

      // Check if we can read pixels
      const pixels = new Uint8Array(4);
      ctx.readPixels(canvas.width / 2, canvas.height / 2, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
      
      // If any pixel is non-zero, we have content
      return pixels[0] > 0 || pixels[1] > 0 || pixels[2] > 0;
    });

    if (hasContent) {
      console.log(`    ✓ Canvas has content after ${attempts} attempts`);
      return true;
    }

    await sleep(500);
  }

  console.log(`  ⚠ Canvas still black after ${attempts} attempts and ${timeoutMs}ms`);
  return false;
}

/**
 * Load a preset by reading the file and injecting it into the page
 */
async function loadPreset(page, presetFileName) {
  const presetPath = path.join(PRESETS_DIR, presetFileName);

  if (!fs.existsSync(presetPath)) {
    console.log(`  ⚠ Preset file not found: ${presetPath}`);
    return false;
  }

  const presetData = fs.readFileSync(presetPath, 'utf8');
  const project = JSON.parse(presetData);

  // Use the new global API to apply the preset
  await page.evaluate(async (projectData) => {
    console.log('Loading preset:', projectData.name);

    // Check if the capture API is available
    if (!window.__visualSynthCaptureApi) {
      console.error('Capture API not available');
      return false;
    }

    // Apply the project using the capture API
    await window.__visualSynthCaptureApi.applyProject(projectData, { skipRecovery: true });

    return true;
  }, project);

  console.log(`    ✓ Loaded preset: ${project.name}`);
  return true;
}

/**
 * Change the UI mode
 */
async function setMode(page, mode) {
  await page.evaluate((targetMode) => {
    if (window.__visualSynthCaptureApi) {
      window.__visualSynthCaptureApi.setMode(targetMode);
      return true;
    }
    return false;
  }, mode);
  console.log(`    ✓ Set mode: ${mode}`);
}

/**
 * Run a single scenario
 */
async function runScenario(browser, scenario, options) {
  const { id, name, mode, preset, wait } = scenario;

  console.log(`\n  Capturing: ${name}`);
  if (mode) console.log(`    Mode: ${mode}`);
  if (preset) console.log(`    Preset: ${preset}`);
  console.log(`    Wait: ${wait}ms`);

  const page = await browser.newPage();

  try {
    // Set viewport size for consistent screenshots
    await page.setViewport({ width: 1280, height: 720 });

    // Stub APIs to avoid permission prompts
    await page.evaluateOnNewDocument(() => {
      window.navigator.requestMIDIAccess = async () => ({
        inputs: new Map(),
        outputs: new Map(),
        onstatechange: null,
        sysexEnabled: false
      });

      if (window.navigator.mediaDevices) {
        window.navigator.mediaDevices.getUserMedia = async () => {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const destination = audioContext.createMediaStreamDestination();
          return destination.stream;
        };
        window.navigator.mediaDevices.enumerateDevices = async () => [
          { deviceId: 'default', kind: 'audioinput', label: 'Mock Microphone' }
        ];
      }
    });

    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`    [Browser ${msg.type().toUpperCase()}] ${text}`);
        
        // If it's a shader error, the next log often contains the numbered source
        if (text.includes('Shader compile error') || text.includes('Shader source')) {
           fs.writeFileSync(path.join(process.cwd(), 'docs/last_shader_error.glsl'), text);
        }
      }
    });

    page.on('pageerror', err => console.log(`    [Browser CRASH] ${err.toString()}`));

    const indexPath = path.join(DIST_DIR, 'renderer/index.html');
    await page.goto(`file://${indexPath.replace(/\\/g, '/')}`);

    // Wait for app init
    let initialized = false;
    let attempts = 0;
    while (!initialized && attempts < 20) {
      await sleep(1000);
      initialized = await page.evaluate(() => window.__visualSynthInitialized || false);
      attempts++;
    }

    if (!initialized) {
      throw new Error('App failed to initialize in time');
    }

    // Load preset if specified
    if (preset) {
      await loadPreset(page, preset);
      await sleep(2000);
    }

    // Trigger action if specified
    if (scenario.action) {
      await page.evaluate((action) => {
        if (window.__visualSynthCaptureApi) {
          window.__visualSynthCaptureApi.triggerAction(action, 1.0);
        }
      }, scenario.action);
      console.log(`    ✓ Triggered action: ${scenario.action}`);
      await sleep(500); // Small wait for action to start
    }

    // Set mode if specified
    if (mode) {
      await setMode(page, mode);
      await sleep(1000);
    }

    // Wait for content and final stabilization
    await waitForCanvasContent(page, 10000);
    await sleep(wait);

    // Capture screenshot
    const filePath = path.join(options.output, `${id}.png`);
    await captureCanvas(page, filePath);

  } finally {
    await page.close();
  }
}

/**
 * Generate all screenshots for a category
 */
async function generateCategoryScreenshots(categoryName, options) {
  let categoryScenarios = (categoryName === 'generators') 
    ? getGeneratorScenarios() 
    : scenarios[categoryName];

  if (!categoryScenarios) {
    console.error(`Unknown category: ${categoryName}`);
    return;
  }

  console.log(`\n=== Generating screenshots for: ${categoryName} ===`);
  fs.mkdirSync(options.output, { recursive: true });

  const browser = await puppeteer.launch({
    headless: options.headless !== false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const scenario of categoryScenarios) {
      try {
        await runScenario(browser, scenario, options);
      } catch (err) {
        console.error(`    ✗ Scenario failed: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }
}

/**
 * Generate all screenshots
 */
async function generateAllScreenshots(options) {
  console.log(`\n=== VisualSynth Automated Screenshot Capture ===`);
  fs.mkdirSync(options.output, { recursive: true });
  fs.mkdirSync(PRESET_SCREENSHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: options.headless !== false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let totalScreenshots = 0;

  try {
    for (const category of Object.keys(scenarios)) {
      console.log(`\n--- ${category} ---`);
      const categoryScenarios = (category === 'generators') ? getGeneratorScenarios() : scenarios[category];

      for (const scenario of categoryScenarios) {
        try {
          await runScenario(browser, scenario, options);
          totalScreenshots++;
        } catch (err) {
          console.error(`    ✗ Scenario failed: ${err.message}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n=== Complete. Total: ${totalScreenshots} ===`);
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    category: null,
    preset: null,
    output: OUTPUT_DIR,
    headless: true,
    all: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--all': options.all = true; break;
      case '--category': options.category = args[++i]; break;
      case '--preset': options.preset = args[++i]; break;
      case '--headless': options.headless = true; break;
      case '--visible': options.headless = false; break;
    }
  }
  return options;
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: dist/ directory not found. Run npm run build first.');
    process.exit(1);
  }

  if (options.preset) {
    const browser = await puppeteer.launch({
      headless: options.headless !== false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
      await runScenario(browser, {
        id: path.basename(options.preset, '.json'),
        name: `Preset ${options.preset}`,
        preset: options.preset,
        wait: 5000
      }, options);
    } finally {
      await browser.close();
    }
  } else if (options.category) {
    await generateCategoryScreenshots(options.category, options);
  } else {
    await generateAllScreenshots(options);
  }
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});