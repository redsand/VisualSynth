import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const bootstrapPath = path.join(repoRoot, 'src', 'renderer', 'bootstrap.ts');

describe('bootstrap entrypoint wiring', () => {
  it('self-starts exactly once when bundled as renderer entrypoint', () => {
    const source = fs.readFileSync(bootstrapPath, 'utf-8');
    expect(source).toContain('window.__visualSynthBootstrapStarted');
    expect(source).toContain('const startBootstrapEntrypoint = () => {');
    expect(source).toContain('void bootstrap().catch((error) => {');
    expect(source).toContain('startBootstrapEntrypoint();');
  });
});
