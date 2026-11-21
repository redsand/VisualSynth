// Validate a project file against the app's own schema (what loading uses).
// Usage: ts-node --transpile-only scripts/validate-project.ts <file.json>
import fs from 'fs';
import { projectSchema } from '../src/shared/projectSchema';
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const project = raw.project ?? raw;
const r = projectSchema.safeParse(project);
if (r.success) {
  console.log(`VALID: ${project.name} — ${project.scenes.length} scenes, ${(project.livePads ?? []).filter(Boolean).length} live pads`);
} else {
  console.log(`INVALID: ${r.error.issues.length} issue(s)`);
  for (const i of r.error.issues.slice(0, 10)) console.log('  ', i.path.join('.'), '—', i.message);
  process.exit(1);
}
