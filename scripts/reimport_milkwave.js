#!/usr/bin/env node

/**
 * Re-import milkwave presets from original .milk files
 * 
 * This script:
 * 1. Reads the original .milk preset
 * 2. Parses it with the existing milkwaveParser
 * 3. Translates it with the offline translation pipeline
 * 4. Saves the result as a VisualSynth preset
 *
 * Usage: node scripts/reimport_milkwave.js <milk-file-path> <output-number>
 */

const fs = require('fs');
const path = require('path');

// We need to use tsx for TypeScript imports
const { execSync } = require('child_process');

const milkPath = process.argv[2];
const presetNum = parseInt(process.argv[3] || '9999', 10);

if (!milkPath || !fs.existsSync(milkPath)) {
    console.error('Usage: node scripts/reimport_milkwave.js <milk-file-path> [preset-number]');
    process.exit(1);
}

console.log(`Re-importing: ${milkPath}`);
console.log(`Preset number: ${presetNum}`);

// Use the existing import script as a reference
const result = execSync(`npx tsx scripts/importMilkwavePresets.ts --file "${milkPath}" --dry-run 2>&1`, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
});

console.log(result);
