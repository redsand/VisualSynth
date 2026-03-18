import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_PROJECT } from '../src/shared/project';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');

describe('preset asset references', () => {
  const presetFiles = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json'));
  const defaultAssetIds = new Set(DEFAULT_PROJECT.assets.map((asset) => asset.id));

  presetFiles.forEach((file) => {
    it(`preset "${file}" references only known assets`, () => {
      const payload = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
      const data = JSON.parse(payload);

      const assetIds = new Set<string>([
        ...defaultAssetIds,
        ...((data.assets ?? []).map((asset: any) => asset.id))
      ]);
      const layers = (data.scenes ?? []).flatMap((scene: any) => scene.layers ?? []);

      layers.forEach((layer: any) => {
        if (!layer.assetId) return;
        expect(assetIds.has(layer.assetId), `${file} references missing asset ${layer.assetId}`).toBe(true);
      });
    });
  });
});
