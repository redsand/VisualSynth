import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');

describe('preset asset references', () => {
  const presetFiles = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json'));

  presetFiles.forEach((file) => {
    it(`preset "${file}" references only known assets`, () => {
      const payload = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
      const data = JSON.parse(payload);

      // Only v2 presets embed asset libraries. V3 presets are layer-only.
      if (data.version !== 2) {
        expect(true).toBe(true);
        return;
      }

      const assetIds = new Set<string>((data.assets ?? []).map((asset: any) => asset.id));
      const layers = (data.scenes ?? []).flatMap((scene: any) => scene.layers ?? []);

      layers.forEach((layer: any) => {
        if (!layer.assetId) return;
        expect(assetIds.has(layer.assetId), `${file} references missing asset ${layer.assetId}`).toBe(true);
      });
    });
  });
});
