// Verify the exact presets:list code path: main.ts reads each JSON and calls
// buildPresetIndexEntry — replicate that here over assets/presets and tally
// the certification the browser Showable filter / needs-fix badge will see.
import fs from 'fs';
import path from 'path';
import { buildPresetIndexEntry } from '../src/shared/presetIndex';

const dir = path.resolve(__dirname, '../assets/presets');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const tally: Record<string, number> = {};
let showable = 0;
let needsFix = 0;
const archivedSample: string[] = [];
for (const file of files) {
  const p = path.join(dir, file);
  let entry;
  try {
    entry = buildPresetIndexEntry(p, JSON.parse(fs.readFileSync(p, 'utf-8')));
  } catch {
    continue;
  }
  const c = entry.certification ?? 'none';
  tally[c] = (tally[c] ?? 0) + 1;
  if (c === 'safe' || c === 'degraded') showable++;
  if (c === 'archived' || c === 'unstable') {
    needsFix++;
    if (archivedSample.length < 3) archivedSample.push(`${file} (${entry.name})`);
  }
}
console.log(JSON.stringify({ total: files.length, certification: tally, showable, needsFix, archivedSample }, null, 1));
