#!/usr/bin/env node

/**
 * VisualSynth Visual Screenshot Generator
 *
 * This script generates colored PNG images for documentation placeholders.
 *
 * Usage:
 *   node scripts/generate-visual-screenshots.js [options]
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
const crypto = require('crypto');

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../docs/screenshots');

// Screenshot categories with descriptions and visual specs
const categories = {
  'ui-modes': {
    name: 'UI Modes',
    description: 'Screenshots of the five UI modes',
    screenshots: [
      { id: 'initial-launch-screen', name: 'Initial Launch Screen', color: '#1a1a2e' },
      { id: 'performance-mode', name: 'Performance Mode', color: '#16213e' },
      { id: 'scene-mode', name: 'Scene Mode', color: '#0f3460' },
      { id: 'design-mode', name: 'Design Mode', color: '#533483' },
      { id: 'matrix-mode', name: 'Matrix Mode', color: '#e94560' },
      { id: 'system-mode', name: 'System Mode', color: '#0f3460' }
    ]
  },
  'generators': {
    name: 'Visual Generators',
    description: 'Screenshots of each visual generator',
    screenshots: [
      { id: 'generator-plasma', name: 'Shader Plasma', color: '#ff6b6b' },
      { id: 'generator-spectrum', name: 'Spectrum Bars', color: '#4ecdc4' },
      { id: 'generator-origami', name: 'Origami Fold', color: '#ffe66d' },
      { id: 'generator-glyph', name: 'Glyph Language', color: '#95e1d3' },
      { id: 'generator-crystal', name: 'Crystal Harmonics', color: '#f38181' },
      { id: 'generator-ink', name: 'Ink Flow', color: '#aa96da' },
      { id: 'generator-topo', name: 'Topo Terrain', color: '#fcbad3' },
      { id: 'generator-weather', name: 'Audio Weather', color: '#a8d8ea' },
      { id: 'generator-portal', name: 'Wormhole Portal', color: '#aa96da' },
      { id: 'generator-oscillo', name: 'Sacred Oscilloscope', color: '#fcbad3' },
      { id: 'generator-particles', name: 'Particle Field', color: '#fff2cc' }
    ]
  },
  'effects': {
    name: 'Effects',
    description: 'Screenshots of each effect',
    screenshots: [
      { id: 'effect-bloom', name: 'Bloom', color: '#ffd93d' },
      { id: 'effect-blur', name: 'Blur', color: '#6c757d' },
      { id: 'effect-chroma', name: 'Chromatic Aberration', color: '#ff6b6b' },
      { id: 'effect-posterize', name: 'Posterize', color: '#4ecdc4' },
      { id: 'effect-kaleidoscope', name: 'Kaleidoscope', color: '#ffe66d' },
      { id: 'effect-feedback', name: 'Feedback', color: '#95e1d3' }
    ]
  },
  'sdf': {
    name: 'SDF Shapes',
    description: 'Screenshots of SDF shape generators',
    screenshots: [
      { id: 'sdf-shapes-simple', name: 'Simple SDF', color: '#ff6b6b' },
      { id: 'sdf-scene-advanced', name: 'Advanced SDF', color: '#4ecdc4' }
    ]
  },
  'visualizers': {
    name: 'Visualizers',
    description: 'Screenshots of visualizer overlays',
    screenshots: [
      { id: 'visualizer-spectrum', name: 'Spectrum', color: '#4ecdc4' },
      { id: 'visualizer-waveform', name: 'Waveform', color: '#95e1d3' },
      { id: 'visualizer-oscilloscope', name: 'Oscilloscope', color: '#fcbad3' }
    ]
  },
  'ui-components': {
    name: 'UI Components',
    description: 'Screenshots of UI components',
    screenshots: [
      { id: 'preset-browser', name: 'Preset Browser', color: '#16213e' },
      { id: 'macros-panel', name: 'Macros Panel', color: '#0f3460' },
      { id: 'mod-matrix-add', name: 'Mod Matrix', color: '#533483' },
      { id: 'pad-grid', name: 'Pad Grid', color: '#e94560' },
      { id: 'midi-selection', name: 'MIDI Selection', color: '#0f3460' },
      { id: 'midi-mapping', name: 'MIDI Mapping', color: '#533483' }
    ]
  },
  'features': {
    name: 'Features',
    description: 'Screenshots demonstrating key features',
    screenshots: [
      { id: 'audio-response', name: 'Audio Response', color: '#ff6b6b' },
      { id: 'output-window', name: 'Output Window', color: '#16213e' },
      { id: 'output-fullscreen', name: 'Fullscreen Output', color: '#0f3460' },
      { id: 'recording-status', name: 'Recording', color: '#e94560' },
      { id: 'diagnostics-fps', name: 'FPS Diagnostics', color: '#4ecdc4' }
    ]
  }
};

/**
 * Create a simple colored PNG
 * This creates a valid PNG file with a solid color
 * Using a 64x64 pixel image to stay within limits
 */
function hashBytes(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function createColoredPNG(color, seed = '') {
  // Parse hex color to RGB
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const hash = hashBytes(seed || color);

  // Create 64x64 pixel image with the color
  const width = 64;
  const height = 64;
  const pixels = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Create a subtle gradient
      const gradient = (y / height) * 0.3;
      const pr = Math.floor(r * (1 - gradient) + (r * 0.7) * gradient);
      const pg = Math.floor(g * (1 - gradient) + (g * 0.7) * gradient);
      const pb = Math.floor(b * (1 - gradient) + (b * 0.7) * gradient);

      // Add a deterministic pattern based on the seed hash for uniqueness.
      const hashIndex = (x + y * width) % hash.length;
      const mod = hash[hashIndex] / 255;
      const stripe = ((x + y + hash[0]) % 11) / 11;
      const mix = 0.2 + 0.6 * mod + 0.2 * stripe;
      const mixClamp = Math.max(0, Math.min(1, mix));

      const rr = Math.floor(pr * (1 - mixClamp) + (hash[(hashIndex + 1) % hash.length]) * mixClamp);
      const gg = Math.floor(pg * (1 - mixClamp) + (hash[(hashIndex + 5) % hash.length]) * mixClamp);
      const bb = Math.floor(pb * (1 - mixClamp) + (hash[(hashIndex + 9) % hash.length]) * mixClamp);

      pixels.push(rr, gg, bb, 255); // RGB + Alpha
    }
  }

  // Encode the hash into the first row to guarantee uniqueness.
  for (let i = 0; i < 16; i++) {
    const base = i * 4;
    pixels[base] = hash[(i * 3) % hash.length];
    pixels[base + 1] = hash[(i * 3 + 1) % hash.length];
    pixels[base + 2] = hash[(i * 3 + 2) % hash.length];
    pixels[base + 3] = 255;
  }

  return createPNGFromPixels(width, height, pixels);
}

/**
 * Create PNG from pixel data
 */
function createPNGFromPixels(width, height, pixels) {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  const ihdr = createIHDRChunk(width, height, 8, 6); // 8-bit, RGBA
  const idat = createIDATChunk(width, height, pixels);
  const iend = createIENDChunk();

  return Buffer.concat([Buffer.from(pngSignature), ihdr, idat, iend]);
}

/**
 * Create IHDR chunk (image header)
 */
function createIHDRChunk(width, height, bitDepth, colorType) {
  const widthBytes = Buffer.alloc(4);
  widthBytes.writeUInt32BE(width, 0);

  const heightBytes = Buffer.alloc(4);
  heightBytes.writeUInt32BE(height, 0);

  const data = Buffer.concat([
    widthBytes,
    heightBytes,
    Buffer.from([bitDepth, colorType, 0, 0, 0]) // compression=0, filter=0, interlace=0
  ]);

  return createChunk('IHDR', data);
}

/**
 * Create IDAT chunk (image data with simple deflate)
 */
function createIDATChunk(width, height, pixels) {
  // Each row needs a filter byte (0 = none)
  const pixelData = [];

  for (let y = 0; y < height; y++) {
    pixelData.push(0); // Filter type: none
    const rowStart = y * width * 4;
    for (let x = 0; x < width * 4; x++) {
      pixelData.push(pixels[rowStart + x]);
    }
  }

  // Simple deflate header: CMF=8, FLG=0
  const zlibHeader = [0x78, 0x01];

  // Add uncompressed block header: BFINAL=1, BTYPE=0 (no compression)
  const blockHeader = [0x01];

  // Add LEN and NLEN (little endian)
  const len = pixelData.length;
  const nlen = len ^ 0xffff;
  const lenBytes = Buffer.alloc(4);
  lenBytes.writeUInt16LE(len, 0);
  lenBytes.writeUInt16LE(nlen, 2);

  // Finalize deflate: adler-32 checksum (use simple value)
  const adler = [0x00, 0x00, 0xff, 0xff];

  const data = Buffer.concat([
    Buffer.from(zlibHeader),
    Buffer.from(blockHeader),
    lenBytes,
    Buffer.from(pixelData),
    Buffer.from(adler)
  ]);

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
function generateCategoryScreenshots(categoryName, outputDir = OUTPUT_DIR) {
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
  fs.mkdirSync(outputDir, { recursive: true });

  category.screenshots.forEach((screenshot, index) => {
    const pngData = createColoredPNG(screenshot.color, screenshot.id);
    const filePath = path.join(outputDir, `${screenshot.id}.png`);

    fs.writeFileSync(filePath, pngData);
    console.log(`  [${index + 1}/${category.screenshots.length}] ✓ ${screenshot.name} -> ${screenshot.id}.png`);
  });
}

/**
 * Generate all screenshots
 */
function generateAllScreenshots(outputDir = OUTPUT_DIR) {
  console.log('VisualSynth Visual Screenshot Generator');
  console.log('');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('');

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  let totalScreenshots = 0;

  Object.entries(categories).forEach(([catId, category]) => {
    console.log(`Generating ${category.name}...`);
    category.screenshots.forEach((screenshot) => {
      const pngData = createColoredPNG(screenshot.color, screenshot.id);
      const filePath = path.join(outputDir, `${screenshot.id}.png`);

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
        console.log('VisualSynth Visual Screenshot Generator');
        console.log('');
        console.log('Usage: node scripts/generate-visual-screenshots.js [options]');
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
        console.log('  node scripts/generate-visual-screenshots.js --all');
        console.log('  node scripts/generate-visual-screenshots.js --category generators');
        console.log('  node scripts/generate-visual-screenshots.js --list');
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
    generateCategoryScreenshots(options.category, options.output);
  } else {
    // Default: generate all
    generateAllScreenshots(options.output);
  }
}

// Run main function
main();
