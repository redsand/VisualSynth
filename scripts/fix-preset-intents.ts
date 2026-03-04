/**
 * Fix invalid intent values in presets
 * Valid intent values: 'calm', 'pulse', 'build', 'chaos', 'ambient'
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const presetsDir = path.resolve(__dirname, '../assets/presets');

const intentMapping: Record<string, string> = {
  'dark': 'ambient',
  'retro': 'ambient',
  'spooky': 'chaos',
  'intense': 'pulse',
  'calm': 'calm',
  'pulse': 'pulse',
  'build': 'build',
  'chaos': 'chaos',
  'ambient': 'ambient'
};

const validIntents = ['calm', 'pulse', 'build', 'chaos', 'ambient'];

function fixPreset(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const preset = JSON.parse(content);

    let fixed = false;

    // Fix scene intents
    if (preset.scenes && Array.isArray(preset.scenes)) {
      for (const scene of preset.scenes) {
        if (scene.intent && !validIntents.includes(scene.intent)) {
          const newIntent = intentMapping[scene.intent] || 'ambient';
          console.log(`  Fixing intent: "${scene.intent}" -> "${newIntent}" in ${path.basename(filePath)}`);
          scene.intent = newIntent;
          fixed = true;
        }
      }
    }

    if (fixed) {
      fs.writeFileSync(filePath, JSON.stringify(preset, null, 2));
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

console.log(`Checking ${files.length} presets for invalid intent values...`);

let fixed = 0;
for (const file of files) {
  const filePath = path.join(presetsDir, file);
  if (fixPreset(filePath)) {
    fixed++;
  }
}

console.log(`\nFixed ${fixed} presets.`);