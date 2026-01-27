#!/usr/bin/env node

/**
 * VisualSynth Screenshot Generator
 *
 * This script generates placeholder screenshots for documentation.
 * It creates colored PNG images with labels for each screenshot type.
 *
 * Usage:
 *   node scripts/generate-screenshots.js [options]
 *
 * Options:
 *   --all              Generate all documentation screenshots
 *   --category <name>  Generate screenshots for a category
 *   --output <dir>     Output directory (default: docs/screenshots)
 *   --list             List all screenshot categories
 *   --clean            Clean existing screenshots
 */

const fs = require('fs');
const path = require('path');

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../docs/screenshots');

// Screenshot categories with descriptions
const categories = {
  'ui-modes': {
    name: 'UI Modes',
    description: 'Screenshots of the five UI modes',
    screenshots: [
      { id: 'initial-launch-screen', name: 'Initial Launch Screen', color: '#1a1a2e', label: 'VisualSynth - Initial Launch' },
      { id: 'performance-mode', name: 'Performance Mode', color: '#16213e', label: 'Performance Mode' },
      { id: 'scene-mode', name: 'Scene Mode', color: '#0f3460', label: 'Scene Mode' },
      { id: 'design-mode', name: 'Design Mode', color: '#533483', label: 'Design Mode' },
      { id: 'matrix-mode', name: 'Matrix Mode', color: '#e94560', label: 'Matrix Mode' },
      { id: 'system-mode', name: 'System Mode', color: '#0f3460', label: 'System Mode' }
    ]
  },
  'generators': {
    name: 'Visual Generators',
    description: 'Screenshots of each visual generator',
    screenshots: [
      { id: 'generator-plasma', name: 'Shader Plasma', color: '#ff6b6b', label: 'Shader Plasma' },
      { id: 'generator-spectrum', name: 'Spectrum Bars', color: '#4ecdc4', label: 'Spectrum Bars' },
      { id: 'generator-origami', name: 'Origami Fold', color: '#ffe66d', label: 'Origami Fold' },
      { id: 'generator-glyph', name: 'Glyph Language', color: '#95e1d3', label: 'Glyph Language' },
      { id: 'generator-crystal', name: 'Crystal Harmonics', color: '#f38181', label: 'Crystal Harmonics' },
      { id: 'generator-ink', name: 'Ink Flow', color: '#aa96da', label: 'Ink Flow' },
      { id: 'generator-topo', name: 'Topo Terrain', color: '#fcbad3', label: 'Topo Terrain' },
      { id: 'generator-weather', name: 'Audio Weather', color: '#a8d8ea', label: 'Audio Weather' },
      { id: 'generator-portal', name: 'Wormhole Portal', color: '#aa96da', label: 'Wormhole Portal' },
      { id: 'generator-oscillo', name: 'Sacred Oscilloscope', color: '#fcbad3', label: 'Sacred Oscilloscope' },
      { id: 'generator-particles', name: 'Particle Field', color: '#fff2cc', label: 'Particle Field' }
    ]
  },
  'effects': {
    name: 'Effects',
    description: 'Screenshots of each effect',
    screenshots: [
      { id: 'effect-bloom', name: 'Bloom', color: '#ffd93d', label: 'Bloom Effect' },
      { id: 'effect-blur', name: 'Blur', color: '#6c757d', label: 'Blur Effect' },
      { id: 'effect-chroma', name: 'Chromatic Aberration', color: '#ff6b6b', label: 'Chroma Effect' },
      { id: 'effect-posterize', name: 'Posterize', color: '#4ecdc4', label: 'Posterize Effect' },
      { id: 'effect-kaleidoscope', name: 'Kaleidoscope', color: '#ffe66d', label: 'Kaleidoscope Effect' },
      { id: 'effect-feedback', name: 'Feedback', color: '#95e1d3', label: 'Feedback Effect' }
    ]
  },
  'sdf': {
    name: 'SDF Shapes',
    description: 'Screenshots of SDF shape generators',
    screenshots: [
      { id: 'sdf-shapes-simple', name: 'Simple SDF', color: '#ff6b6b', label: 'Simple SDF Shapes' },
      { id: 'sdf-scene-advanced', name: 'Advanced SDF', color: '#4ecdc4', label: 'Advanced SDF Scene' }
    ]
  },
  'visualizers': {
    name: 'Visualizers',
    description: 'Screenshots of visualizer overlays',
    screenshots: [
      { id: 'visualizer-spectrum', name: 'Spectrum', color: '#4ecdc4', label: 'Spectrum Visualizer' },
      { id: 'visualizer-waveform', name: 'Waveform', color: '#95e1d3', label: 'Waveform Visualizer' },
      { id: 'visualizer-oscilloscope', name: 'Oscilloscope', color: '#fcbad3', label: 'Oscilloscope Visualizer' }
    ]
  },
  'ui-components': {
    name: 'UI Components',
    description: 'Screenshots of UI components',
    screenshots: [
      { id: 'preset-browser', name: 'Preset Browser', color: '#16213e', label: 'Preset Browser' },
      { id: 'macros-panel', name: 'Macros Panel', color: '#0f3460', label: 'Macros Panel' },
      { id: 'mod-matrix-add', name: 'Mod Matrix', color: '#533483', label: 'Mod Matrix' },
      { id: 'pad-grid', name: 'Pad Grid', color: '#e94560', label: 'Pad Grid' },
      { id: 'midi-selection', name: 'MIDI Selection', color: '#0f3460', label: 'MIDI Device Selection' },
      { id: 'midi-mapping', name: 'MIDI Mapping', color: '#533483', label: 'MIDI Mapping' }
    ]
  },
  'features': {
    name: 'Features',
    description: 'Screenshots demonstrating key features',
    screenshots: [
      { id: 'audio-response', name: 'Audio Response', color: '#ff6b6b', label: 'Audio Response' },
      { id: 'output-window', name: 'Output Window', color: '#16213e', label: 'Output Window' },
      { id: 'output-fullscreen', name: 'Fullscreen Output', color: '#0f3460', label: 'Fullscreen Output' },
      { id: 'recording-status', name: 'Recording', color: '#e94560', label: 'Recording Status' },
      { id: 'diagnostics-fps', name: 'FPS Diagnostics', color: '#4ecdc4', label: 'FPS Diagnostics' }
    ]
  }
};

/**
 * Create a simple colored PNG image
 * This creates a minimal valid PNG file with a solid color and text overlay
 */
function createSimplePNG(width, height, color, label) {
  // Create a minimal PNG with solid color background
  // PNG signature
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  // Parse hex color to RGB
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  // Create simple image data (1x1 pixel for minimal PNG)
  // In a real implementation, you'd use a library like 'canvas' or 'sharp'
  // For now, we create a minimal valid PNG

  const ihdr = createIHDRChunk(width, height);
  const idat = createIDATChunk([r, g, b, 255]); // RGBA pixel
  const iend = createIENDChunk();

  const chunks = [ihdr, idat, iend];
  let pngData = Buffer.from(pngSignature);

  chunks.forEach((chunk) => {
    pngData = Buffer.concat([pngData, chunk]);
  });

  return pngData;
}

/**
 * Create IHDR chunk (image header)
 */
function createIHDRChunk(width, height) {
  const widthBytes = Buffer.alloc(4);
  widthBytes.writeUInt32BE(width, 0);

  const heightBytes = Buffer.alloc(4);
  heightBytes.writeUInt32BE(height, 0);

  const data = Buffer.concat([
    widthBytes,
    heightBytes,
    Buffer.from([8, 2, 0, 0, 0]) // bitDepth=8, colorType=2 (RGB), others=0
  ]);

  return createChunk('IHDR', data);
}

/**
 * Create IDAT chunk (image data)
 */
function createIDATChunk(pixels) {
  // In a real implementation, this would be compressed
  // For minimal PNG, we use uncompressed deflate
  const data = Buffer.from([0x78, 0x01, ...pixels, 0x00, 0x00, 0xff, 0xff, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  return createChunk('IDAT', data);
}

/**
 * Create IEND chunk (end of file)
 */
function createIENDChunk() {
  return createChunk('IEND', Buffer.alloc(0));
}

/**
 * Create a PNG chunk
 */
function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');

  const crc = calculateCRC(Buffer.concat([typeBuffer, data]));

  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * Calculate CRC32 for PNG chunks
 */
function calculateCRC(data) {
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return crcBuffer;
}

/**
 * Generate all screenshots for a category
 */
function generateCategoryScreenshots(categoryName) {
  const category = categories[categoryName];

  if (!category) {
    console.error(`Unknown category: ${categoryName}`);
    console.log(`Available categories: ${Object.keys(categories).join(', ')}`);
    return;
  }

  console.log(`Generating screenshots for: ${category.name}`);
  console.log(`  ${category.description}`);
  console.log('');

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  category.screenshots.forEach((screenshot, index) => {
    const width = 1280;
    const height = 720;
    const pngData = createSimplePNG(width, height, screenshot.color, screenshot.label);
    const filePath = path.join(OUTPUT_DIR, `${screenshot.id}.png`);

    fs.writeFileSync(filePath, pngData);
    console.log(`  [${index + 1}/${category.screenshots.length}] ✓ ${screenshot.name} -> ${screenshot.id}.png`);
  });
}

/**
 * Generate all screenshots
 */
function generateAllScreenshots() {
  console.log('VisualSynth Screenshot Generator');
  console.log('');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('');

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let totalScreenshots = 0;

  Object.entries(categories).forEach(([catId, category]) => {
    console.log(`Generating ${category.name}...`);
    category.screenshots.forEach((screenshot) => {
      const width = 1280;
      const height = 720;
      const pngData = createSimplePNG(width, height, screenshot.color, screenshot.label);
      const filePath = path.join(OUTPUT_DIR, `${screenshot.id}.png`);

      fs.writeFileSync(filePath, pngData);
      totalScreenshots++;
    });
    console.log(`  ✓ Generated ${category.screenshots.length} screenshots`);
    console.log('');
  });

  console.log(`Total: ${totalScreenshots} screenshots generated`);
}

/**
 * List all categories
 */
function listCategories() {
  console.log('Available screenshot categories:');
  console.log('');

  Object.entries(categories).forEach(([id, category]) => {
    console.log(`${id}:`);
    console.log(`  Name: ${category.name}`);
    console.log(`  Description: ${category.description}`);
    console.log(`  Screenshots: ${category.screenshots.length}`);
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

  if (pngFiles.length === 0) {
    console.log('No screenshots to clean');
    return;
  }

  console.log(`Cleaning ${pngFiles.length} screenshot(s)...`);
  pngFiles.forEach((file) => {
    const filePath = path.join(OUTPUT_DIR, file);
    fs.unlinkSync(filePath);
    console.log(`  ✓ Deleted ${file}`);
  });
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    category: null,
    output: OUTPUT_DIR,
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
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--list':
      case '-l':
        options.list = true;
        break;
      case '--clean':
        options.clean = true;
        break;
      case '--help':
      case '-h':
        console.log('VisualSynth Screenshot Generator');
        console.log('');
        console.log('Usage: node scripts/generate-screenshots.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  --all              Generate all documentation screenshots');
        console.log('  --category <name>  Generate screenshots for a category');
        console.log('  --output <dir>     Output directory (default: docs/screenshots)');
        console.log('  --list             List all screenshot categories');
        console.log('  --clean            Clean existing screenshots');
        console.log('  --help             Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  node scripts/generate-screenshots.js --all');
        console.log('  node scripts/generate-screenshots.js --category generators');
        console.log('  node scripts/generate-screenshots.js --list');
        process.exit(0);
    }
  }

  return options;
}

/**
 * Main function
 */
function main() {
  const options = parseArgs();

  // Update output directory if specified
  if (options.output !== OUTPUT_DIR) {
    fs.mkdirSync(options.output, { recursive: true });
  }

  if (options.list) {
    listCategories();
    return;
  }

  if (options.clean) {
    cleanScreenshots();
    return;
  }

  if (options.all) {
    generateAllScreenshots();
  } else if (options.category) {
    generateCategoryScreenshots(options.category);
  } else {
    // Default: generate all
    generateAllScreenshots();
  }
}

// Run main function
main();