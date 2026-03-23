import fs from 'fs';
import path from 'path';

const PRESETS_DIR = path.resolve(__dirname, '../assets/presets');
const REPORT_JSON = path.join(PRESETS_DIR, 'milkwave_audit_report.json');

function applyAudit() {
  if (!fs.existsSync(REPORT_JSON)) {
    console.error('Audit report not found. Run auditMilkwave.ts first.');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf-8'));
  console.log(`Applying audit results for ${report.results.length} presets...`);

  let updatedCount = 0;
  for (const result of report.results) {
    const presetPath = path.join(PRESETS_DIR, `${result.id}.json`);
    if (!fs.existsSync(presetPath)) {
      console.warn(`Preset file not found: ${presetPath}`);
      continue;
    }

    try {
      const preset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
      if (!preset.metadata || preset.metadata.importedFrom !== 'Milkwave') {
        continue;
      }

      if (!preset.metadata.milkwave) {
        preset.metadata.milkwave = {};
      }

      const mw = preset.metadata.milkwave;
      mw.runtimeSupportTier = result.classification;
      mw.lastAuditAt = report.timestamp;
      mw.auditWarnings = result.warnings || [];
      mw.auditErrors = result.errors || [];
      mw.shapesRendered = result.shapesRendered;
      mw.wavesRendered = result.wavesRendered;
      
      // Update deprecated supportTier for compatibility
      mw.supportTier = result.classification;

      fs.writeFileSync(presetPath, JSON.stringify(preset, null, 2));
      updatedCount++;
    } catch (e) {
      console.error(`Failed to update ${result.id}: ${e}`);
    }
  }

  console.log(`Successfully updated ${updatedCount} presets with audit metadata.`);
}

applyAudit();
