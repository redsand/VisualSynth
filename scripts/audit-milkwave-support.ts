import fs from 'fs';
import path from 'path';
import { parseMilkFile } from '../src/shared/milkwaveParser';
import { buildMilkwaveIR } from '../src/shared/milkwaveIr';
import { classifyMilkwaveIR } from '../src/shared/milkwaveCapability';

const MILKWAVE_PATH = path.resolve(__dirname, '../../Milkwave/Visualizer/resources/presets');

interface AuditRow {
  file: string;
  folder: string;
  tier: string;
  featureSummary: string[];
  reasons: string[];
}

const args = process.argv.slice(2);
const folderArgIndex = args.indexOf('--folder');
const limitArgIndex = args.indexOf('--limit');
const jsonFlag = args.includes('--json');
const folderFilter = folderArgIndex >= 0 ? args[folderArgIndex + 1] : undefined;
const limit = limitArgIndex >= 0 ? Number(args[limitArgIndex + 1]) : Number.POSITIVE_INFINITY;

const folders = folderFilter
  ? [folderFilter]
  : fs.readdirSync(MILKWAVE_PATH, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

const rows: AuditRow[] = [];
let processed = 0;

for (const folder of folders) {
  const folderPath = path.join(MILKWAVE_PATH, folder);
  const files = fs.readdirSync(folderPath).filter((file) => file.toLowerCase().endsWith('.milk')).sort();

  for (const file of files) {
    if (processed >= limit) break;

    const filePath = path.join(folderPath, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseMilkFile(content, file, folder);
      if (!parsed) {
        rows.push({
          file,
          folder,
          tier: 'unsupported',
          featureSummary: [],
          reasons: ['Failed to parse .milk preset.']
        });
        processed++;
        continue;
      }

      const ir = buildMilkwaveIR(parsed);
      const report = classifyMilkwaveIR(ir);
      rows.push({
        file,
        folder,
        tier: report.tier,
        featureSummary: report.featureSummary,
        reasons: report.reasons
      });
    } catch (error) {
      rows.push({
        file,
        folder,
        tier: 'unsupported',
        featureSummary: [],
        reasons: [error instanceof Error ? error.message : String(error)]
      });
    }
    processed++;
  }

  if (processed >= limit) break;
}

const counts = rows.reduce<Record<string, number>>((acc, row) => {
  acc[row.tier] = (acc[row.tier] ?? 0) + 1;
  return acc;
}, {});

const blockerCounts = rows.reduce<Record<string, number>>((acc, row) => {
  row.reasons.forEach((reason) => {
    acc[reason] = (acc[reason] ?? 0) + 1;
  });
  return acc;
}, {});

const sortedBlockers = Object.entries(blockerCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .map(([reason, count]) => ({ reason, count }));

const report = {
  scanned: rows.length,
  folders,
  counts,
  topBlockers: sortedBlockers,
  sampleRows: rows.slice(0, 50)
};

if (jsonFlag) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('Milkwave Support Audit');
  console.log('======================');
  console.log(`Scanned: ${report.scanned}`);
  console.log('Counts:', report.counts);
  console.log('Top blockers:');
  report.topBlockers.forEach((entry) => {
    console.log(`- ${entry.count} x ${entry.reason}`);
  });
  console.log('Sample rows:');
  report.sampleRows.slice(0, 10).forEach((row) => {
    console.log(`- [${row.tier}] ${row.folder}/${row.file}`);
    if (row.reasons[0]) {
      console.log(`  ${row.reasons[0]}`);
    }
  });
}
