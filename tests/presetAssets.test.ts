import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_PROJECT } from '../src/shared/project';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');

describe('preset asset references', () => {
  const presetFiles = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json'));
  const defaultAssetIds = new Set(DEFAULT_PROJECT.assets.map((asset) => asset.id));

  it(
    `all ${presetFiles.length} presets reference only known assets`,
    () => {
      // Loop inside a single it rather than one it per file: registering 7k+
      // individual tests wedges vitest 1.x's threads pool (see vitest.config.ts).
      // Failure localization is preserved by collecting file + asset id per
      // offender and failing once with the full list.
      const failures: string[] = [];
      presetFiles.forEach((file, index) => {
        if (index % 500 === 0) {
          process.stderr.write(`[presetAssets] ${index}/${presetFiles.length}\n`);
        }
        const payload = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
        const data = JSON.parse(payload);

        const assetIds = new Set<string>([
          ...defaultAssetIds,
          ...((data.assets ?? []).map((asset: any) => asset.id))
        ]);
        const layers = (data.scenes ?? []).flatMap((scene: any) => scene.layers ?? []);

        layers.forEach((layer: any) => {
          if (!layer.assetId) return;
          if (!assetIds.has(layer.assetId)) {
            failures.push(`${file} references missing asset ${layer.assetId}`);
          }
        });
      });
      expect(failures).toEqual([]);
    },
    { timeout: 120_000 }
  );
});