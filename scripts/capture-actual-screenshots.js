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

// Screenshot scenarios with actual configurations
const scenarios = {
  'ui-modes': [
    { id: 'initial-launch-screen', name: 'Initial Launch Screen', mode: 'performance', wait: 5000 },
    { id: 'performance-mode', name: 'Performance Mode', mode: 'performance', preset: 'preset-01-cosmic.json', wait: 3000 },
    { id: 'scene-mode', name: 'Scene Mode', mode: 'scene', preset: 'preset-11-visualsynth-dna-feedback.json', wait: 3000 },
    { id: 'design-mode', name: 'Design Mode', mode: 'design', preset: 'preset-83-sdf-geometry-101.json', wait: 3000 },
    { id: 'matrix-mode', name: 'Matrix Mode', mode: 'matrix', preset: 'preset-46-glyph-language.json', wait: 3000 },
    { id: 'system-mode', name: 'System Mode', mode: 'system', preset: 'preset-88-hyper-plasma.json', wait: 3000 }
  ],
  'generators': [
    { id: 'generator-plasma', name: 'Shader Plasma', preset: 'preset-01-cosmic.json', wait: 5000 },
    { id: 'generator-spectrum', name: 'Spectrum Bars', preset: 'preset-02-spectrum.json', wait: 5000 },
    { id: 'generator-origami', name: 'Origami Fold', preset: 'preset-108-origami-storm.json', wait: 5000 },
    { id: 'generator-glyph', name: 'Glyph Language', preset: 'preset-107-glyph-matrix.json', wait: 5000 },
    { id: 'generator-crystal', name: 'Crystal Harmonics', preset: 'preset-47-crystal-harmonics.json', wait: 5000 },
    { id: 'generator-ink', name: 'Ink Flow', preset: 'preset-48-ink-flow.json', wait: 5000 },
    { id: 'generator-topo', name: 'Topo Terrain', preset: 'preset-106-topo-zoom.json', wait: 5000 },
    { id: 'generator-weather', name: 'Audio Weather', preset: 'preset-109-weather-hurricane.json', wait: 5000 },
    { id: 'generator-portal', name: 'Wormhole Portal', preset: 'preset-51-wormhole-portals.json', wait: 5000 },
    { id: 'generator-oscillo', name: 'Sacred Oscilloscope', preset: 'preset-52-sacred-oscilloscope.json', wait: 5000 },
    { id: 'generator-particles', name: 'Particle Field', preset: 'preset-38-particle-swarm.json', wait: 5000 }
  ],
  'effects': [
    { id: 'effect-bloom', name: 'Bloom', preset: 'preset-12-visualsynth-dna-bloom.json', wait: 5000 },
    { id: 'effect-blur', name: 'Blur', preset: 'preset-63-soft-spectrum.json', wait: 5000 },
    { id: 'effect-chroma', name: 'Chromatic Aberration', preset: 'preset-23-solar-rift.json', wait: 5000 },
    { id: 'effect-posterize', name: 'Posterize', preset: 'preset-41-posterize-strobe.json', wait: 5000 },
    { id: 'effect-kaleidoscope', name: 'Kaleidoscope', preset: 'preset-40-kaleido-trails.json', wait: 5000 },
    { id: 'effect-feedback', name: 'Feedback', preset: 'preset-42-feedback-veil.json', wait: 5000 }
  ],
  'sdf': [
    { id: 'sdf-shapes-simple', name: 'Simple SDF', preset: 'preset-83-sdf-geometry-101.json', wait: 5000 },
    { id: 'sdf-scene-advanced', name: 'Advanced SDF', preset: 'preset-100-sdf-monolith.json', wait: 5000 }
  ],
  'visualizers': [
    { id: 'visualizer-spectrum', name: 'Spectrum', preset: 'preset-02-spectrum.json', wait: 5000 },
    { id: 'visualizer-waveform', name: 'Waveform', preset: 'preset-52-sacred-oscilloscope.json', wait: 5000 },
    { id: 'visualizer-oscilloscope', name: 'Oscilloscope', preset: 'preset-52-sacred-oscilloscope.json', wait: 5000 }
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
    { id: 'audio-response', name: 'Audio Response', preset: 'preset-01-cosmic.json', wait: 5000 },
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
 * Set the UI mode
 */
async function setMode(page, mode) {
  await page.evaluate((m) => {
    if (window.__visualSynthCaptureApi) {
      window.__visualSynthCaptureApi.setMode(m);
    } else {
      // Fallback: try to find and click the mode button
      const modeButton = document.querySelector(`button[data-mode="${m}"]`);
      if (modeButton) {
        modeButton.click();
      } else {
        console.log(`Mode button not found for: ${m}`);
      }
    }
  }, mode);
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

      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return false;

      // Read a few pixels to check if they're not all black
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return false;

      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // Check center 100x100 area for non-black pixels
      const startX = Math.floor(width / 2) - 50;
      const startY = Math.floor(height / 2) - 50;

      for (let y = startY; y < startY + 100; y++) {
        for (let x = startX; x < startX + 100; x++) {
          const idx = (y * width + x) * 4;
          // Check if any RGB channel has a value > 10 (not pure black)
          if (pixels[idx] > 10 || pixels[idx + 1] > 10 || pixels[idx + 2] > 10) {
            return true;
          }
        }
      }
      return false;
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
    await window.__visualSynthCaptureApi.applyProject(projectData);

    // Enable the main layers to ensure content is visible
    const plasmaToggle = document.getElementById('perf-toggle-plasma');
    if (plasmaToggle && !plasmaToggle.checked) {
      plasmaToggle.checked = true;
      plasmaToggle.dispatchEvent(new Event('change'));
    }

    const spectrumToggle = document.getElementById('perf-toggle-spectrum');
    if (spectrumToggle && !spectrumToggle.checked) {
      spectrumToggle.checked = true;
      spectrumToggle.dispatchEvent(new Event('change'));
    }

    return true;
  }, project);

  console.log(`    ✓ Loaded preset: ${project.name}`);
  return true;
}

/**
 * Run a single scenario
 */
async function runScenario(browser, scenario, options) {
  const { id, name, mode, preset, wait } = scenario;

  console.log(`\n  Capturing: ${name}`);
  console.log(`    ${mode ? 'Mode: ' + mode : 'No mode change'}`);
  console.log(`    ${preset ? 'Preset: ' + preset : 'No preset change'}`);
  console.log(`    Wait: ${wait}ms`);

  const page = await browser.newPage();

  try {
    // Set viewport size for consistent screenshots
    await page.setViewport({ width: 1280, height: 720 });

    // Stub WebMIDI API to avoid permission prompts
    await page.evaluateOnNewDocument(() => {
      window.navigator.requestMIDIAccess = async () => {
        // Return a mock MIDIAccess object
        return {
          inputs: new Map(),
          outputs: new Map(),
          onstatechange: null,
          sysexEnabled: false
        };
      };

      // Stub getUserMedia to avoid microphone permission prompts
      if (window.navigator.mediaDevices) {
        window.navigator.mediaDevices.getUserMedia = async () => {
          // Create a mock stream with silent audio
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const bufferSize = 2 * audioContext.sampleRate;
          const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = 0; // Silence
          }
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.start();

          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          return destination.stream;
        };

        // Also stub enumerateDevices
        window.navigator.mediaDevices.enumerateDevices = async () => {
          return [
            { deviceId: 'default', kind: 'audioinput', label: 'Mock Microphone' }
          ];
        };
      }
    });

    // Load VisualSynth
    const indexPath = path.join(DIST_DIR, 'renderer/index.html');

    // Capture console messages during page load
    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      console.log(`    [Browser Console] ${msg.type()}: ${msg.text()}`);
    });

    await page.goto(`file://${indexPath.replace(/\\/g, '/')}`);

    // Wait for the app to initialize - wait for init completion message
    console.log('  Waiting for app initialization...');

    // Wait for init to complete with polling
    let initComplete = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (!initComplete && attempts < maxAttempts) {
      await sleep(1000);
      attempts++;

      initComplete = await page.evaluate(() => {
        return window.__visualSynthInitialized || false;
      });

      if (initComplete) {
        console.log('  ✓ App initialized after ' + attempts + ' seconds');
        break;
      }
    }

    if (!initComplete) {
      console.log('  ⚠ Init did not complete within ' + maxAttempts + ' seconds');
    }

    // Additional wait to ensure render loop is running
    await sleep(2000);

    // Debug: check if JavaScript loaded
    const jsLoaded = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      const scriptSources = scripts.map(s => s.src || s.textContent?.substring(0, 100) || 'inline');
      return {
        scriptCount: scripts.length,
        scriptSources: scriptSources
      };
    });
    console.log(`    JS loaded: ${JSON.stringify(jsLoaded)}`);

    // Check if there are any global variables from the app
    const globals = await page.evaluate(() => {
      return {
        hasRenderer: typeof window.renderer !== 'undefined',
        hasInit: typeof window.__visualSynthInitialized !== 'undefined',
        hasCaptureApi: typeof window.__visualSynthCaptureApi !== 'undefined'
      };
    });
    console.log(`    Global vars: ${JSON.stringify(globals)}`);

    // Check if canvas exists and is rendering
    const canvasReady = await page.evaluate(() => {
      const canvas = document.getElementById('gl-canvas');
      if (!canvas) return false;
      // Check if WebGL context is active
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return false;
      // Check if any render state is set up
      return gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null;
    });

    if (!canvasReady) {
      console.log('  ⚠ Canvas may not be fully initialized');
    }

    // Comprehensive debugging - scenes, layers, mode, render state
    const debugInfo = await page.evaluate(() => {
      const result = {};

      // Get scenes info from debug object
      if (typeof window.__visualSynthDebug !== 'undefined') {
        const debug = window.__visualSynthDebug;
        const currentProject = debug.currentProject;
        result.scenes = project.scenes?.map(s => ({
          id: s.id,
          name: s.name,
          layerCount: s.layers?.length || 0,
          layers: s.layers?.map(l => ({
            id: l.id,
            name: l.name,
            enabled: l.enabled,
            opacity: l.opacity
          }))
        })) || [];
        result.activeSceneId = project.activeSceneId;
        result.activeScene = project.scenes?.find(s => s.id === project.activeSceneId)?.name || 'unknown';
      }

      // Get current mode
      result.currentMode = window.currentMode || 'unknown';

      // Get UI state
      const modeButtons = document.querySelectorAll('.mode-btn');
      result.modeButtons = Array.from(modeButtons).map(btn => ({
        text: btn.textContent?.trim(),
        active: btn.classList.contains('active')
      }));

      // Get toggle states
      const plasmaToggle = document.getElementById('perf-toggle-plasma');
      const spectrumToggle = document.getElementById('perf-toggle-spectrum');
      result.toggles = {
        plasma: plasmaToggle ? plasmaToggle.checked : null,
        spectrum: spectrumToggle ? spectrumToggle.checked : null
      };

      // Get WebGL state
      const canvas = document.getElementById('gl-canvas');
      if (canvas) {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
          const program = gl.getParameter(gl.CURRENT_PROGRAM);
          result.webgl = {
            hasProgram: program !== null,
            viewport: gl.getParameter(gl.VIEWPORT),
            canvasSize: [canvas.width, canvas.height]
          };
        }
      }

      return result;
    });

    console.log(`    [DEBUG] Scenes: ${debugInfo.scenes?.map(s => s.name).join(', ') || 'none'}`);
    console.log(`    [DEBUG] Active scene: ${debugInfo.activeScene || 'none'} (${debugInfo.activeSceneId})`);
    console.log(`    [DEBUG] Current mode: ${debugInfo.currentMode}`);
    console.log(`    [DEBUG] Active mode button: ${debugInfo.modeButtons?.find(b => b.active)?.text || 'none'}`);
    console.log(`    [DEBUG] Toggles - Plasma: ${debugInfo.toggles?.plasma}, Spectrum: ${debugInfo.toggles?.spectrum}`);

    // Show layers in active scene
    const activeScene = debugInfo.scenes?.find(s => s.id === debugInfo.activeSceneId);
    if (activeScene && activeScene.layers) {
      const enabledLayers = activeScene.layers.filter(l => l.enabled);
      console.log(`    [DEBUG] Layers in active scene: ${activeScene.layers.map(l => l.name).join(', ')}`);
      console.log(`    [DEBUG] Enabled layers: ${enabledLayers.map(l => l.name).join(', ')}`);
    }

    // Set mode if specified
    if (mode) {
      await setMode(page, mode);
      await sleep(1000);
    }

    // Load preset if specified
    if (preset) {
      await loadPreset(page, preset);
      await sleep(2000);
    }

    // Wait for canvas to have actual content
    await waitForCanvasContent(page, 10000);

    // Debug: check console for errors
    const consoleErrors = await page.evaluate(() => {
      const errors = [];
      // Capture any console.error calls
      const originalError = console.error;
      console.error = (...args) => {
        errors.push(args.join(' '));
        originalError.apply(console, args);
      };
      return errors;
    });
    if (consoleErrors.length > 0) {
      console.log(`    Console errors: ${consoleErrors.join('; ')}`);
    }

    // Debug: check render state
    const renderDebug = await page.evaluate(() => {
      const canvas = document.getElementById('gl-canvas');
      if (!canvas) return 'Canvas not found';

      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return 'WebGL context not found - using 2D fallback';

      // Check if any uniform is set
      const program = gl.getParameter(gl.CURRENT_PROGRAM);
      if (!program) return 'No program bound - render loop may not be running';

      // Check a few uniform values
      const loc = gl.getUniformLocation(program, 'uTime');
      const time = loc ? gl.getUniform(program, loc) : null;

      const locEnabled = gl.getUniformLocation(program, 'uPlasmaEnabled');
      const enabled = locEnabled ? gl.getUniform(program, locEnabled) : null;

      const locOpacity = gl.getUniformLocation(program, 'uPlasmaOpacity');
      const opacity = locOpacity ? gl.getUniform(program, locOpacity) : null;

      return `Time: ${time}, Enabled: ${enabled}, Opacity: ${opacity}`;
    });

    console.log(`    Renderer debug: ${renderDebug}`);

    // Check if the renderer is the WebGL or fallback version
    const rendererType = await page.evaluate(() => {
      // Check for WebGL context
      const canvas = document.getElementById('gl-canvas');
      if (!canvas) return 'Canvas not found';
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return 'No WebGL context (2D fallback)';

      // Check if canvas has 2D context instead (fallback renderer)
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Check if the 2D context is actually being used
        const imageData = ctx.getImageData(0, 0, 1, 1);
        // If we got here, the 2D context exists, which means WebGL failed
        return 'Using 2D fallback (WebGL init failed)';
      }

      // WebGL context exists
      return 'WebGL context exists (may not be rendering)';
    });
    console.log(`    Renderer: ${rendererType}`);

    // Check if render loop is running by monitoring frame count
    const frameCheck = await page.evaluate(() => {
      // Add a frame counter to track render calls
      if (!window.__renderFrameCount) {
        window.__renderFrameCount = 0;
        // Hook into the render function if we can access it
      }
      return window.__renderFrameCount;
    });
    console.log(`    Render frames: ${frameCheck}`);

    // Check the renderer variable
    const rendererCheck = await page.evaluate(() => {
      // We can't directly access the renderer variable from the page,
      // but we can infer if it's working by checking the canvas content
      const canvas = document.getElementById('gl-canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return 'No GL context';

      // Check if the framebuffer is bound
      const fb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      const viewport = gl.getParameter(gl.VIEWPORT);

      return `FB: ${fb}, Viewport: [${viewport.join(', ')}]`;
    });
    console.log(`    WebGL state: ${rendererCheck}`);

    // Additional wait for rendering to stabilize
    await sleep(wait);

    // Capture screenshot
    const filePath = path.join(options.output, `${id}.png`);
    await captureCanvas(page, filePath);

  } catch (error) {
    console.log(`    ✗ Error: ${error.message}`);
  } finally {
    await page.close();
  }
}

/**
 * Generate all screenshots for a category
 */
async function generateCategoryScreenshots(categoryName, options) {
  const categoryScenarios = scenarios[categoryName];

  if (!categoryScenarios) {
    console.error(`Unknown category: ${categoryName}`);
    console.log(`Available categories: ${Object.keys(scenarios).join(', ')}`);
    return;
  }

  console.log(`\n=== Generating screenshots for: ${categoryName} ===`);
  console.log(`Output directory: ${options.output}`);

  // Create output directory
  fs.mkdirSync(options.output, { recursive: true });

  const browser = await puppeteer.launch({
    headless: options.headless !== false,
    executablePath: process.env.ELECTRON_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--no-user-gesture-required'
    ]
  });

  try {
    for (let i = 0; i < categoryScenarios.length; i++) {
      await runScenario(browser, categoryScenarios[i], options);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n✓ Generated ${categoryScenarios.length} screenshots`);
}

/**
 * Generate all screenshots
 */
async function generateAllScreenshots(options) {
  console.log(`\n=== VisualSynth Automated Screenshot Capture ===`);
  console.log(`Output directory: ${options.output}`);
  console.log(`Headless: ${options.headless ? 'Yes' : 'No'}`);

  // Create output directory
  fs.mkdirSync(options.output, { recursive: true });
  fs.mkdirSync(PRESET_SCREENSHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: options.headless !== false,
    executablePath: process.env.ELECTRON_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--no-user-gesture-required'
    ]
  });

  let totalScreenshots = 0;

  try {
    for (const [category, categoryScenarios] of Object.entries(scenarios)) {
      console.log(`\n--- ${category} ---`);

      for (let i = 0; i < categoryScenarios.length; i++) {
        console.log(`[${i + 1}/${categoryScenarios.length}]`);
        await runScenario(browser, categoryScenarios[i], options);
        totalScreenshots++;
      }
    }

    const presetFiles = getPresetFiles();
    if (presetFiles.length > 0) {
      console.log(`\n--- presets (${presetFiles.length}) ---`);
      for (let i = 0; i < presetFiles.length; i++) {
        const presetFile = presetFiles[i];
        const presetId = path.basename(presetFile, '.json');
        console.log(`[${i + 1}/${presetFiles.length}]`);
        await runScenario(
          browser,
          {
            id: presetId,
            name: `Preset ${presetId}`,
            mode: 'performance',
            preset: presetFile,
            wait: 5000
          },
          { ...options, output: PRESET_SCREENSHOT_DIR }
        );
        totalScreenshots++;
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n=== Complete ===`);
  console.log(`Total screenshots generated: ${totalScreenshots}`);
}

/**
 * List all scenarios
 */
function listScenarios() {
  console.log('Available screenshot categories:');
  console.log('');

  Object.entries(scenarios).forEach(([category, categoryScenarios]) => {
    console.log(`${category}:`);
    categoryScenarios.forEach(scenario => {
      console.log(`  - ${scenario.name} (${scenario.id})`);
      console.log(`    Mode: ${scenario.mode || 'N/A'}, Preset: ${scenario.preset || 'N/A'}, Wait: ${scenario.wait}ms`);
    });
    console.log('');
  });
}

/**
 * Clean existing screenshots
 */
function cleanScreenshots() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log('No screenshots to clean');
    return;
  }

  const files = fs.readdirSync(OUTPUT_DIR);
  const pngFiles = files.filter((f) => f.endsWith('.png'));
  const presetFiles = fs.existsSync(PRESET_SCREENSHOT_DIR)
    ? fs.readdirSync(PRESET_SCREENSHOT_DIR).filter((f) => f.endsWith('.png'))
    : [];

  if (pngFiles.length === 0 && presetFiles.length === 0) {
    console.log('No screenshots to clean');
    return;
  }

  console.log(`Cleaning ${pngFiles.length + presetFiles.length} screenshot(s)...`);
  pngFiles.forEach((file) => {
    const filePath = path.join(OUTPUT_DIR, file);
    fs.unlinkSync(filePath);
    console.log(`  ✓ Deleted ${file}`);
  });
  presetFiles.forEach((file) => {
    const filePath = path.join(PRESET_SCREENSHOT_DIR, file);
    fs.unlinkSync(filePath);
    console.log(`  ✓ Deleted presets/${file}`);
  });
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
    list: false,
    all: false,
    clean: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--all':
        options.all = true;
        break;
      case '--category':
      case '-c':
        options.category = args[++i];
        break;
      case '--preset':
      case '-p':
        options.preset = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--list':
      case '-l':
        options.list = true;
        break;
      case '--headless':
        options.headless = args[++i] === 'true' || args[++i] === 'yes';
        break;
      case '--visible':
        options.headless = false;
        break;
      case '--clean':
        options.clean = true;
        break;
      case '--help':
      case '-h':
        console.log('VisualSynth Automated Screenshot Capture');
        console.log('');
        console.log('Usage: node scripts/capture-actual-screenshots.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  --all              Generate all screenshots (docs + presets)');
        console.log('  --category <name>  Generate screenshots for a category');
        console.log('  --preset <name>    Capture specific preset');
        console.log('  --output <dir>     Output directory (default: docs/screenshots)');
        console.log('  --headless         Run in headless mode (default)');
        console.log('  --visible          Run in visible mode (for debugging)');
        console.log('  --list             List all screenshot scenarios');
        console.log('  --clean            Clean existing screenshots');
        console.log('  --help             Show this help message');
        console.log('');
        console.log('Environment Variables:');
        console.log('  ELECTRON_PATH      Path to Electron executable');
        console.log('');
        console.log('Examples:');
        console.log('  node scripts/capture-actual-screenshots.js --all');
        console.log('  node scripts/capture-actual-screenshots.js --category generators');
        console.log('  node scripts/capture-actual-screenshots.js --preset preset-01-cosmic.json');
        console.log('  node scripts/capture-actual-screenshots.js --visible  # Watch it happen');
        console.log('');
        console.log('Requirements:');
        console.log('  1. Build the app first: npm run build');
        console.log('  2. Ensure dist/ directory exists');
        console.log('  3. Puppeteer installed: npm install --save-dev puppeteer');
        process.exit(0);
    }
  }

  return options;
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  // Check if dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: dist/ directory not found.');
    console.error('Please build the app first: npm run build');
    process.exit(1);
  }

  const indexPath = path.join(DIST_DIR, 'renderer/index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('Error: renderer/index.html not found in dist/');
    console.error('Please build the app first: npm run build');
    process.exit(1);
  }

  if (options.list) {
    listScenarios();
    return;
  }

  if (options.clean) {
    cleanScreenshots();
    return;
  }

  if (options.all) {
    await generateAllScreenshots(options);
  } else if (options.category) {
    await generateCategoryScreenshots(options.category, options);
  } else {
    // Default: generate all
    await generateAllScreenshots(options);
  }
}

// Run main function
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
