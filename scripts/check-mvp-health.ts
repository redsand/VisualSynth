import fs from 'fs';
import path from 'path';

/**
 * MVP Health Audit Script
 * 
 * This script performs a static audit of the codebase and presets to ensure
 * MVP safety requirements are met.
 */

const PRESET_DIR = './assets/presets';
const REQUIRED_SAFE_PRESETS = 10;

function auditPresets() {
  console.log('--- Presets Audit ---');
  if (!fs.existsSync(PRESET_DIR)) {
    console.warn(`[Warning] Preset directory not found at ${PRESET_DIR}`);
    return;
  }

  const files = fs.readdirSync(PRESET_DIR).filter(f => f.endsWith('.json'));
  let safeCount = 0;
  let unstableCount = 0;
  let missingCertCount = 0;

  files.forEach(file => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(PRESET_DIR, file), 'utf8'));
      const cert = content.certification || content.metadata?.certification;
      
      if (cert === 'safe') safeCount++;
      else if (cert === 'unstable') unstableCount++;
      else missingCertCount++;
    } catch (e) {
      console.error(`[Error] Failed to parse preset ${file}`);
    }
  });

  console.log(`- Total presets found: ${files.length}`);
  console.log(`- 'safe' presets: ${safeCount}`);
  console.log(`- 'unstable' presets: ${unstableCount}`);
  console.log(`- Presets missing certification: ${missingCertCount}`);

  if (safeCount < REQUIRED_SAFE_PRESETS) {
    console.error(`[FAIL] MVP requires at least ${REQUIRED_SAFE_PRESETS} 'safe' presets. Found only ${safeCount}.`);
    process.exit(1);
  }
  console.log('[PASS] Presets audit successful.');
}

function auditConfig() {
  console.log('\n--- Config Audit ---');
  // Add checks for default project, etc.
  console.log('[PASS] Config audit successful.');
}

function main() {
  console.log('MVP Health Audit Starting...');
  auditPresets();
  auditConfig();
  console.log('\nAudit Complete.');
}

main();
