import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { projectSchema } from '../src/shared/projectSchema';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');

describe('preset library', () => {
  it('contains at least 10 presets', () => {
    const files = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it('validates all preset JSON files', () => {
    const files = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json'));
    const names = new Set<string>();
    for (const file of files) {
      const payload = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
      const parsed = projectSchema.safeParse(JSON.parse(payload));
      expect(parsed.success).toBe(true);
      if (!parsed.success) continue;
      expect(parsed.data.scenes.length).toBeGreaterThan(0);
      names.add(parsed.data.name);
    }
    expect(names.size).toBe(files.length);
  });
});
