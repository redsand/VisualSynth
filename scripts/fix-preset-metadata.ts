/**
 * Fix presets missing required v6 metadata fields
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const presetsDir = path.resolve(__dirname, '../assets/presets');

// Required v6 metadata fields with defaults
// Note: These are VISUAL MODE IDs (mode-pulse, mode-cyber, etc.), not UI modes (performance, scene, design)
// For Pulse Heart preset, we use mode-pulse which correctly applies the industrial palette
const DEFAULTS = {
  activeModeId: 'mode-pulse', // Use mode-pulse instead of mode-performance (UI mode, not visual mode)
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

    // Fix incorrect mode-performance (UI mode, not visual mode)
    // For Pulse Heart preset, use mode-pulse which correctly uses the industrial palette
    if (metadata.activeModeId === 'mode-performance') {
      // mode-performance is a UI mode, not a visual mode
      // Replace with appropriate visual mode based on preset content
      const presetName = preset.name || '';
      if (presetName.toLowerCase().includes('pulse') || presetName.toLowerCase().includes('strobe')) {
        metadata.activeModeId = 'mode-pulse'; // Pulse mode uses industrial palette
      } else {
        // Default to cosmic for other presets with wrong mode
        metadata.activeModeId = 'mode-cosmic';
      }
      fixed = true;
    }

    // Add missing required fields
    if (!metadata.activeModeId) {
      metadata.activeModeId = 'mode-cosmic';
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