import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';
import puppeteer from 'puppeteer';
import {
  FOCUSED_MILKWAVE_PRESETS,
  TARGET_MILKWAVE_PRESET_ID
} from '../src/shared/milkwaveTargetPreset';

const PRESETS_DIR = path.resolve(__dirname, '../assets/presets');
const AUDIT_RUNNER_SRC = path.resolve(__dirname, '../src/renderer/milkwaveAuditRunner.ts');
const OUTPUT_DIR = path.resolve(__dirname, '../assets/presets');
const REPORT_JSON = path.join(OUTPUT_DIR, 'milkwave_audit_report.json');
const REPORT_MD = path.join(OUTPUT_DIR, 'milkwave_audit_report.md');

const parseArgs = () => {
  const args = process.argv.slice(2);
  let presetId: string | null = null;
  let presetIds: string[] | null = null;
  let limit = 100;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--preset') {
      const value = args[i + 1];
      if (!value) {
        throw new Error('Missing value for --preset');
      }
      presetId = value === 'target' ? TARGET_MILKWAVE_PRESET_ID : value;
      i += 1;
      continue;
    }
    if (arg === '--focus') {
      presetIds = FOCUSED_MILKWAVE_PRESETS.map((preset) => preset.id);
      continue;
    }
    if (arg === '--limit') {
      const value = Number(args[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Invalid value for --limit');
      }
      limit = Math.floor(value);
      i += 1;
      continue;
    }
    if (arg === '--all') {
      limit = Number.MAX_SAFE_INTEGER;
    }
  }

  return { presetId, presetIds, limit };
};

async function runAudit() {
  console.log('--- Milkwave Runtime Audit ---');
  const { presetId, presetIds, limit } = parseArgs();

  // 1. Identify Milkwave presets
  const files = fs.readdirSync(PRESETS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const milkwavePresets: any[] = [];
  let count = 0;

  for (const file of files) {
    if (presetIds && !presetIds.includes(file.replace('.json', ''))) {
      continue;
    }
    if (presetId && file !== `${presetId}.json`) {
      continue;
    }
    if (!presetId && count >= limit) break;
    const filePath = path.join(PRESETS_DIR, file);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (content._shaderData && content.metadata?.importedFrom === 'Milkwave') {
        milkwavePresets.push({
          id: file.replace('.json', ''),
          name: content.metadata.name,
          shaderData: content._shaderData,
          expectedSupport: content.metadata.milkwave?.supportTier || 'unknown'
        });
        count++;
      }
    } catch (e) {
      console.warn(`Failed to parse ${file}: ${e}`);
    }
  }

  if (presetId && milkwavePresets.length === 0) {
    throw new Error(`Target preset not found: ${presetId}`);
  }
  if (presetIds && milkwavePresets.length !== presetIds.length) {
    const foundIds = new Set(milkwavePresets.map((preset) => preset.id));
    const missing = presetIds.filter((id) => !foundIds.has(id));
    throw new Error(`Focused preset(s) not found: ${missing.join(', ')}`);
  }

  if (presetId) {
    console.log(`Auditing single preset: ${presetId}`);
  } else if (presetIds) {
    console.log(`Auditing focused preset suite (${presetIds.length} presets)`);
  } else {
    console.log(`Auditing first ${Math.min(limit, milkwavePresets.length)} presets`);
  }
  console.log(`Found ${milkwavePresets.length} Milkwave presets to audit.`);

  // 2. Bundle Audit Runner
  console.log('Bundling audit runner...');
  const bundle = await esbuild.build({
    entryPoints: [AUDIT_RUNNER_SRC],
    bundle: true,
    write: false,
    platform: 'browser',
    target: 'chrome120',
    loader: { '.glsl': 'text' },
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });

  const bundleCode = bundle.outputFiles[0].text;

  // 3. Launch Puppeteer
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=vulkan'] // Try to get hardware GL if possible, or software
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Error] ${msg.text()}`);
    } else {
      console.log(`[Browser] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err: any) => {
    console.log(`[Browser PageError] ${err.toString()}`);
  });

  // Inject bundle
  await page.evaluate(bundleCode);

  // 4. Execute Audit
  console.log('Executing audit in browser context...');
  // We chunk the presets to avoid huge IPC payloads or memory pressure
  const chunkSize = 100;
  const allResults = [];

  for (let i = 0; i < milkwavePresets.length; i += chunkSize) {
    const chunk = milkwavePresets.slice(i, i + chunkSize);
    console.log(`Auditing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(milkwavePresets.length / chunkSize)}...`);
    
    const chunkResults = await page.evaluate(async (presets) => {
      // @ts-ignore
      return await window.runMilkwaveAudit(presets);
    }, chunk);
    
    allResults.push(...chunkResults);
  }

  await browser.close();

  // 5. Generate Report
  console.log('Generating reports...');
  
  const report = {
    timestamp: new Date().toISOString(),
    totalPresets: allResults.length,
    results: allResults.map(r => {
      const preset = milkwavePresets.find(p => p.id === r.id);
      return {
        ...r,
        expectedSupport: preset?.expectedSupport
      };
    })
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  // Markdown Summary
  const nativeFailed = report.results.filter(r => r.expectedSupport === 'native-supported' && r.classification !== 'native-supported');
  const totalFailed = report.results.filter(r => r.classification === 'runtime-failed').length;

  let md = `# Milkwave Runtime Audit Report\n\n`;
  md += `**Date**: ${report.timestamp}\n`;
  md += `**Total Presets Audited**: ${report.totalPresets}\n`;
  md += `**Runtime Failed**: ${totalFailed}\n`;
  md += `**Native-Supported Regression**: ${nativeFailed.length}\n\n`;

  md += `## Classification Summary\n\n`;
  const summary: Record<string, number> = {
    'native-supported': 0,
    'supported-with-degradation': 0,
    'fallback-only': 0,
    'runtime-failed': 0
  };
  report.results.forEach(r => summary[r.classification]++);
  
  md += `| Classification | Count |\n`;
  md += `| :--- | :--- |\n`;
  md += `| Native Supported | ${summary['native-supported']} |\n`;
  md += `| Supported with Degradation | ${summary['supported-with-degradation']} |\n`;
  md += `| Fallback Only | ${summary['fallback-only']} |\n`;
  md += `| Runtime Failed | ${summary['runtime-failed']} |\n\n`;

  if (nativeFailed.length > 0) {
    md += `## Native Support Regressions ⚠️\n\n`;
    md += `These presets are marked \`native-supported\` but failed to compile or render natively.\n\n`;
    md += `| ID | Name | Classification | Errors |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    nativeFailed.forEach(r => {
      md += `| ${r.id} | ${r.name} | ${r.classification} | ${r.errors.join('; ')} |\n`;
    });
    md += `\n`;
  }

  md += `## Detailed Results\n\n`;
  md += `| ID | Name | Support | Warp | Comp | Fallback | Shapes | Waves |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  
  report.results.forEach(r => {
    md += `| ${r.id} | ${r.name} | ${r.classification} | ${r.warpCompiled ? '✅' : '❌'} | ${r.compCompiled ? '✅' : '❌'} | ${r.fallbackUsed ? '⚠️' : '✅'} | ${r.shapesRendered} | ${r.wavesRendered} |\n`;
  });

  fs.writeFileSync(REPORT_MD, md);

  console.log(`Audit complete. Results written to ${REPORT_JSON} and ${REPORT_MD}`);

  // 6. CI Failure Check
  if (nativeFailed.length > 0) {
    console.error(`ERROR: ${nativeFailed.length} presets marked as native-supported failed runtime audit.`);
    process.exit(1);
  }

  if (totalFailed > (milkwavePresets.length * 0.1)) { // Allow 10% failure for now as baseline? No, task says "fail CI if presets marked native-supported actually fail"
    // Task specifically said native-supported failure should fail CI.
  }
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
