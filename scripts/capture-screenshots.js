#!/usr/bin/env node

/**
 * VisualSynth Screenshot Capture Script
 *
 * This script automates the capture of screenshots for documentation.
 * It can capture screenshots from specific presets, modes, or test scenarios.
 *
 * Usage:
 *   node scripts/capture-screenshots.js [options]
 *
 * Options:
 *   --preset <name>        Capture screenshots of specific preset
 *   --mode <mode>          Set mode before capturing (performance|scene|design|matrix|system)
 *   --wait <ms>            Wait time before capture (default: 2000ms)
 *   --width <px>           Canvas width (default: 1280)
 *   --height <px>          Canvas height (default: 720)
 *   --output <dir>         Output directory (default: docs/screenshots)
 *   --list                 List available screenshot scenarios
 *   --all                  Capture all documentation screenshots
 *   --headless             Run in headless mode (no UI)
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  preset: null,
  mode: null,
  wait: 2000,
  width: 1280,
  height: 720,
  output: path.join(__dirname, '../docs/screenshots'),
  list: false,
  all: false,
  headless: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--preset':
      options.preset = args[++i];
      break;
    case '--mode':
      options.mode = args[++i];
      break;
    case '--wait':
      options.wait = parseInt(args[++i], 10);
      break;
    case '--width':
      options.width = parseInt(args[++i], 10);
      break;
    case '--height':
      options.height = parseInt(args[++i], 10);
      break;
    case '--output':
      options.output = args[++i];
      break;
    case '--list':
      options.list = true;
      break;
    case '--all':
      options.all = true;
      break;
    case '--headless':
      options.headless = true;
      break;
  }
}

// Screenshot scenarios for documentation
const scenarios = [
  // Application Launch
  {
    id: 'initial-launch-screen',
    name: 'Initial Launch Screen',
    description: 'Full application window with default UI layout',
    preset: 'preset-01-cosmic',
    mode: 'performance',
    wait: 2000,
    width: 1440,
    height: 900
  },
  // Mode Screenshots
  {
    id: 'performance-mode',
    name: 'Performance Mode',
    description: 'Performance mode full UI with scene strip and pad grid',
    preset: 'preset-01-cosmic',
    mode: 'performance',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'scene-mode',
    name: 'Scene Mode',
    description: 'Scene mode UI with layer list',
    preset: 'preset-01-cosmic',
    mode: 'scene',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'design-mode',
    name: 'Design Mode',
    description: 'Design mode UI with effects controls',
    preset: 'preset-01-cosmic',
    mode: 'design',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'matrix-mode',
    name: 'Matrix Mode',
    description: 'Matrix mode with modulators',
    preset: 'preset-01-cosmic',
    mode: 'matrix',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'system-mode',
    name: 'System Mode',
    description: 'System mode with diagnostics',
    preset: 'preset-01-cosmic',
    mode: 'system',
    wait: 1500,
    width: 1440,
    height: 900
  },
  // Generator Screenshots
  {
    id: 'generator-plasma',
    name: 'Shader Plasma Generator',
    description: 'Colorful fluid plasma patterns',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'generator-spectrum',
    name: 'Spectrum Bars Generator',
    description: 'Vertical spectrum bars',
    preset: 'preset-02-spectrum',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'generator-origami',
    name: 'Origami Fold Generator',
    description: 'Geometric origami fold patterns',
    preset: 'preset-108-origami-storm',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'generator-glyph',
    name: 'Glyph Language Generator',
    description: 'Procedural symbols',
    preset: 'preset-107-glyph-matrix',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'generator-crystal',
    name: 'Crystal Harmonics Generator',
    description: 'Crystal/glass formations',
    preset: 'preset-47-crystal-harmonics',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'generator-ink',
    name: 'Ink Flow Generator',
    description: 'Brush-stroke style lines',
    preset: 'preset-48-ink-flow',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'generator-topo',
    name: 'Topo Terrain Generator',
    description: 'Topographic terrain',
    preset: 'preset-106-topo-zoom',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'generator-weather',
    name: 'Audio Weather Generator',
    description: 'Weather effects (rain/snow)',
    preset: 'preset-109-weather-hurricane',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'generator-portal',
    name: 'Wormhole Portal Generator',
    description: 'Portal/wormhole distortion',
    preset: 'preset-51-wormhole-portals',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'generator-oscillo',
    name: 'Sacred Oscilloscope Generator',
    description: 'Circular oscilloscope',
    preset: 'preset-52-sacred-oscilloscope',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'generator-particles',
    name: 'Particle Field Generator',
    description: 'GPU particle system',
    preset: 'preset-38-particle-swarm',
    wait: 2000,
    width: 1280,
    height: 720
  },
  // Effect Screenshots
  {
    id: 'effect-bloom',
    name: 'Bloom Effect',
    description: 'Bloom glow effect',
    preset: 'preset-12-visualsynth-dna-bloom',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'effect-blur',
    name: 'Blur Effect',
    description: 'Blurred visual',
    preset: 'preset-63-soft-spectrum',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'effect-chroma',
    name: 'Chromatic Aberration Effect',
    description: 'RGB color splitting',
    preset: 'preset-23-solar-rift',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'effect-posterize',
    name: 'Posterize Effect',
    description: 'Posterized/banded colors',
    preset: 'preset-41-posterize-strobe',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'effect-kaleidoscope',
    name: 'Kaleidoscope Effect',
    description: 'Kaleidoscope mirror effect',
    preset: 'preset-40-kaleido-trails',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'effect-feedback',
    name: 'Feedback Effect',
    description: 'Trail/echo effect',
    preset: 'preset-42-feedback-veil',
    wait: 2000,
    width: 1280,
    height: 720
  },
  // SDF Screenshots
  {
    id: 'sdf-shapes-simple',
    name: 'Simple SDF Shapes',
    description: 'Clean SDF circle/box/triangle',
    preset: 'preset-83-sdf-geometry-101',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'sdf-scene-advanced',
    name: 'Advanced SDF Scene',
    description: 'Complex SDF scene with lighting',
    preset: 'preset-100-sdf-monolith',
    wait: 2000,
    width: 1280,
    height: 720
  },
  // Visualizer Screenshots
  {
    id: 'visualizer-spectrum',
    name: 'Spectrum Visualizer',
    description: 'Spectrum overlay on main visual',
    preset: 'preset-02-spectrum',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'visualizer-waveform',
    name: 'Waveform Visualizer',
    description: 'Waveform line overlay',
    preset: 'preset-52-sacred-oscilloscope',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'visualizer-oscilloscope',
    name: 'Oscilloscope Visualizer',
    description: 'Circular oscilloscope overlay',
    preset: 'preset-52-sacred-oscilloscope',
    wait: 2000,
    width: 1280,
    height: 720
  },
  // UI Component Screenshots
  {
    id: 'preset-browser',
    name: 'Preset Browser',
    description: 'Preset browser with preset list',
    preset: 'preset-01-cosmic',
    mode: 'performance',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'macros-panel',
    name: 'Macros Panel',
    description: '8 macro sliders with labels',
    preset: 'preset-01-cosmic',
    mode: 'performance',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'mod-matrix-add',
    name: 'Mod Matrix - Add Mod',
    description: 'New modulation row in matrix',
    preset: 'preset-01-cosmic',
    mode: 'matrix',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'pad-grid',
    name: 'Pad Grid',
    description: '8x8 pad grid with bank buttons',
    preset: 'preset-01-cosmic',
    mode: 'performance',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'bank-switching',
    name: 'Bank Switching',
    description: 'Different bank selected',
    preset: 'preset-01-cosmic',
    mode: 'performance',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'midi-selection',
    name: 'MIDI Device Selection',
    description: 'MIDI device dropdown',
    preset: 'preset-01-cosmic',
    mode: 'system',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'midi-mapping',
    name: 'MIDI Mapping',
    description: 'MIDI mapping list',
    preset: 'preset-01-cosmic',
    mode: 'matrix',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'output-window',
    name: 'Output Window',
    description: 'Separate output window',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'output-fullscreen',
    name: 'Output Fullscreen',
    description: 'Fullscreen output',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'add-blank-scene',
    name: 'Add Blank Scene',
    description: 'New scene in scene strip',
    preset: 'preset-01-cosmic',
    mode: 'performance',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'scene-switch',
    name: 'Scene Switch',
    description: 'Different scene visuals',
    preset: 'preset-02-spectrum',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'quantization-hud',
    name: 'Quantization HUD',
    description: 'Countdown overlay',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'add-layer',
    name: 'Add Layer',
    description: 'New layer in layer list',
    preset: 'preset-01-cosmic',
    mode: 'scene',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'remove-layer',
    name: 'Remove Layer',
    description: 'Layer removed, visuals changed',
    preset: 'preset-01-cosmic',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'blend-modes',
    name: 'Blend Modes',
    description: 'Different blend mode appearance',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'palette-selection',
    name: 'Palette Selection',
    description: 'Different color palette',
    preset: 'preset-04-vivid',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'style-presets',
    name: 'Style Presets',
    description: 'Different style preset appearance',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'lfo-modulation',
    name: 'LFO Modulation',
    description: 'Parameter oscillating smoothly',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'audio-modulation',
    name: 'Audio Modulation',
    description: 'Parameter responding to music',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'pad-actions',
    name: 'Pad Actions',
    description: 'Pad triggering effect',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'midi-learn',
    name: 'MIDI Learn',
    description: 'Parameter mapped after MIDI move',
    preset: 'preset-01-cosmic',
    mode: 'matrix',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'fps-stability',
    name: 'FPS Stability',
    description: 'Health strip showing good FPS',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1440,
    height: 900
  },
  {
    id: 'diagnostics-fps',
    name: 'Diagnostics - FPS',
    description: 'Diagnostics showing FPS value',
    preset: 'preset-01-cosmic',
    mode: 'system',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'diagnostics-latency',
    name: 'Diagnostics - Latency',
    description: 'Latency values in diagnostics',
    preset: 'preset-01-cosmic',
    mode: 'system',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'diagnostics-webgl',
    name: 'Diagnostics - WebGL',
    description: 'WebGL information',
    preset: 'preset-01-cosmic',
    mode: 'system',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'save-project',
    name: 'Save Project',
    description: 'Save dialog or confirmation',
    preset: 'preset-01-cosmic',
    mode: 'system',
    wait: 1500,
    width: 1440,
    height: 900
  },
  {
    id: 'load-project',
    name: 'Load Project',
    description: 'Project loaded with correct visuals',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1280,
    height: 720
  },
  {
    id: 'macro-mapping',
    name: 'Macro Mapping',
    description: 'Visual changing with macro movement',
    preset: 'preset-01-cosmic',
    wait: 2000,
    width: 1280,
    height: 720
  }
];

// List scenarios
if (options.list) {
  console.log('Available screenshot scenarios:');
  console.log('');
  scenarios.forEach((s, i) => {
    console.log(`${i + 1}. ${s.name} (${s.id})`);
    console.log(`   ${s.description}`);
    console.log(`   Preset: ${s.preset}${s.mode ? `, Mode: ${s.mode}` : ''}`);
    console.log('');
  });
  process.exit(0);
}

// Create output directory
fs.mkdirSync(options.output, { recursive: true });

let mainWindow = null;
let captureCount = 0;
let screenshotData = null;

// IPC handler to receive screenshot data from renderer
ipcMain.handle('screenshot:capture-automated', async (_event, data, filePath) => {
  screenshotData = data;
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(data));
    console.log(`✓ Captured: ${filePath}`);
    return { success: true, filePath };
  } catch (error) {
    console.error(`✗ Failed to capture: ${filePath}`, error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  // Determine which scenarios to capture
  let scenariosToCapture = [];

  if (options.all) {
    scenariosToCapture = scenarios;
  } else if (options.preset) {
    const presetScenarios = scenarios.filter(s => s.preset === options.preset);
    if (presetScenarios.length === 0) {
      console.error(`No scenarios found for preset: ${options.preset}`);
      process.exit(1);
    }
    scenariosToCapture = presetScenarios;
  } else {
    // Default to basic set
    scenariosToCapture = scenarios.slice(0, 10);
  }

  console.log(`VisualSynth Screenshot Capture`);
  console.log(``);
  console.log(`Scenarios to capture: ${scenariosToCapture.length}`);
  console.log(`Output directory: ${options.output}`);
  console.log(``);

  // Load custom preset loader script into the renderer
  const rendererScript = `
    <script>
      (function() {
        const originalOnLoad = window.onload;
        window.onload = async function() {
          if (originalOnLoad) await originalOnLoad.call(this);

          // Wait for app to initialize
          await new Promise(resolve => setTimeout(resolve, 1000));

          ${options.mode ? `window.dispatchEvent(new CustomEvent('set-mode', { detail: '${options.mode}' }));` : ''}

          ${options.preset ? `
          // Load preset
          try {
            const presetPath = await window.visualSynth.listPresets().then(presets => {
              return presets.find(p => p.path.includes('${options.preset}'))?.path;
            });
            if (presetPath) {
              const result = await window.visualSynth.loadPreset(presetPath);
              if (result.project) {
                // Apply preset to current scene
                const presetScene = result.project.scenes[0];
                if (presetScene && window.applyPresetScene) {
                  await window.applyPresetScene(presetScene);
                }
              }
            }
          } catch (e) {
            console.error('Failed to load preset:', e);
          }
          ` : ''}

          // Capture screenshot after wait time
          await new Promise(resolve => setTimeout(resolve, ${options.wait}));

          // Capture canvas
          const canvas = document.getElementById('gl-canvas');
          if (canvas) {
            const dataUrl = canvas.toDataURL('image/png');
            const base64Data = dataUrl.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const filePath = '${options.output}/${options.preset || 'screenshot'}.png';
            await window.visualSynth.captureAutomatedScreenshot(bytes, filePath);
          }
        };
      })();
    </script>
  `;

  // Inject the capture script into the index.html
  const indexPath = path.join(__dirname, '../src/renderer/index.html');
  let htmlContent = fs.readFileSync(indexPath, 'utf-8');
  if (!htmlContent.includes('screenshot-capture-inject')) {
    htmlContent = htmlContent.replace(
      '</body>',
      '<div id="screenshot-capture-inject"></div></body>'
    );
  }

  mainWindow = new BrowserWindow({
    width: options.width,
    height: options.height,
    show: options.headless,
    backgroundColor: '#0b0f18',
    webPreferences: {
      preload: path.join(__dirname, '../dist/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const rendererPath = path.join(__dirname, '../dist/renderer/index.html');
  await mainWindow.loadFile(rendererPath);

  // Inject capture script
  await mainWindow.webContents.executeJavaScript(`
    (function() {
      const script = document.createElement('script');
      script.textContent = \`${rendererScript.replace(/`/g, '\\`').replace(/\$\{/g, '${')}\`;
      document.head.appendChild(script);
    })();
  `);

  if (!options.headless) {
    mainWindow.show();
  }

  // Wait for capture to complete
  setTimeout(() => {
    console.log('');
    console.log(`Capture complete!`);
    console.log(`Screenshots saved to: ${options.output}`);
    app.quit();
  }, options.wait + 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});