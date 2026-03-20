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

interface MilkFileEntry {
  file: string;
  folder: string;
  filePath: string;
}

/** Recursively walk a directory and collect all .milk file entries. */
const walkMilkFiles = (dir: string, baseDir: string): MilkFileEntry[] => {
  const results: MilkFileEntry[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMilkFiles(fullPath, baseDir));
    } else if (entry.name.toLowerCase().endsWith('.milk')) {
      const relDir = path.relative(baseDir, dir).replace(/\\/g, '/');
      results.push({ file: entry.name, folder: relDir, filePath: fullPath });
    }
  }
  return results.sort((a, b) => `${a.folder}/${a.file}`.localeCompare(`${b.folder}/${b.file}`));
};

const args = process.argv.slice(2);
const folderArgIndex = args.indexOf('--folder');
const limitArgIndex = args.indexOf('--limit');
const jsonFlag = args.includes('--json');
const folderFilter = folderArgIndex >= 0 ? args[folderArgIndex + 1] : undefined;
const limit = limitArgIndex >= 0 ? Number(args[limitArgIndex + 1]) : Number.POSITIVE_INFINITY;

const searchRoot = folderFilter
  ? path.join(MILKWAVE_PATH, folderFilter)
  : MILKWAVE_PATH;
const allEntries = walkMilkFiles(searchRoot, MILKWAVE_PATH);

const rows: AuditRow[] = [];
let processed = 0;

for (const entry of allEntries) {
  if (processed >= limit) break;

  try {
    const content = fs.readFileSync(entry.filePath, 'utf-8');
    const parsed = parseMilkFile(content, entry.file, entry.folder);
    if (!parsed) {
      rows.push({
        file: entry.file,
        folder: entry.folder,
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
      file: entry.file,
      folder: entry.folder,
      tier: report.tier,
      featureSummary: report.featureSummary,
      reasons: report.reasons
    });
  } catch (error) {
    rows.push({
      file: entry.file,
      folder: entry.folder,
      tier: 'unsupported',
      featureSummary: [],
      reasons: [error instanceof Error ? error.message : String(error)]
    });
  }
  processed++;
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

const uniqueFolders = [...new Set(rows.map((r) => r.folder))].sort();

const report = {
  scanned: rows.length,
  folders: uniqueFolders,
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
