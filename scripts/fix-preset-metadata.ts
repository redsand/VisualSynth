/**
 * Fix presets missing required v6 metadata fields
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const presetsDir = path.resolve(__dirname, '../assets/presets');

// Required v6 metadata fields with defaults
const DEFAULTS = {
  activeModeId: 'mode-performance',
  visualIntentTags: ['visual', 'immersive'],
  colorChemistry: ['balanced'],
  defaultTransition: {
    durationMs: 600,
    curve: 'easeInOut'
  }
};

function fixPreset(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const preset = JSON.parse(content);

    // Only fix v6 presets
    if (preset.version !== 6) {
      return false;
    }

    let fixed = false;
    const metadata = preset.metadata || {};

    // Add missing required fields
    if (!metadata.activeModeId) {
      metadata.activeModeId = DEFAULTS.activeModeId;
      fixed = true;
    }
    if (!metadata.visualIntentTags) {
      metadata.visualIntentTags = DEFAULTS.visualIntentTags;
      fixed = true;
    }
    if (!metadata.colorChemistry) {
      metadata.colorChemistry = DEFAULTS.colorChemistry;
      fixed = true;
    }
    if (!metadata.defaultTransition) {
      metadata.defaultTransition = DEFAULTS.defaultTransition;
      fixed = true;
    }

    if (fixed) {
      preset.metadata = metadata;
      fs.writeFileSync(filePath, JSON.stringify(preset, null, 2));
      console.log(`Fixed: ${path.basename(filePath)}`);
      return true;
    }

    return false;
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
    return false;
  }
}

// Find all preset files
const files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.json'));

console.log(`Checking ${files.length} presets for missing metadata fields...`);

let fixed = 0;
for (const file of files) {
  const filePath = path.join(presetsDir, file);
  if (fixPreset(filePath)) {
    fixed++;
  }
}

console.log(`\nFixed ${fixed} presets.`);