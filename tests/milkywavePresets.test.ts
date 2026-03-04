import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { presetV6Schema } from '../src/shared/presetMigration';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');

describe('Milkwave Imported Presets', () => {
  // Find all milkywave preset files
  const milkywavePresets = fs.readdirSync(presetsDir)
    .filter(file => file.includes('-milkwave-') && file.endsWith('.json'))
    .sort();

  it('should have imported milkywave presets', () => {
    expect(milkywavePresets.length).toBeGreaterThan(0);
    console.log(`Found ${milkywavePresets.length} Milkwave presets`);
  });

  // Test a sample of presets (not all 6000+ for performance)
  const sampleSize = Math.min(50, milkywavePresets.length);
  const samplePresets = milkywavePresets.slice(0, sampleSize);

  describe.each(samplePresets.map((file, index) => ({ file, index })))(
    'preset $file',
    ({ file }) => {
      it('should be valid JSON with correct structure', () => {
        const content = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
        const preset = JSON.parse(content);

        expect(preset.version).toBe(6);
        expect(preset.metadata).toBeDefined();
        expect(preset.metadata.version).toBe(6);
        expect(preset.metadata.importedFrom).toBe('Milkwave');
        expect(preset.metadata.author).toBeDefined();
        expect(preset.metadata.source).toBeDefined();
        expect(preset.scenes).toBeDefined();
        expect(preset.scenes.length).toBeGreaterThan(0);
      });

      it('should pass v6 schema validation', () => {
        const content = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
        const preset = JSON.parse(content);

        const result = presetV6Schema.safeParse(preset);
        if (!result.success) {
          console.error(`Schema validation failed for ${file}:`, JSON.stringify(result.error.format(), null, 2));
        }
        expect(result.success).toBe(true);
      });

      it('should have valid category assignment', () => {
        const content = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
        const preset = JSON.parse(content);

        const validCategories = [
          'Space', 'Audio Reactive', 'Abstract', 'Organic', 'Geometry',
          'Atmosphere & Terrain', 'Particles', 'Immersion', 'Cinema',
          'DNA', 'Hydro & Pyro', 'Goth Generators', 'Imported'
        ];

        expect(validCategories).toContain(preset.metadata.category);
      });

      it('should have valid layer structure', () => {
        const content = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
        const preset = JSON.parse(content);

        const scene = preset.scenes[0];
        expect(scene.layers).toBeDefined();
        expect(scene.layers.length).toBeGreaterThan(0);

        // Check that milkywave layer exists
        const milkywaveLayer = scene.layers.find(
          (l: any) => l.id === 'layer-milkwave' || l.generatorId === 'gen-milkwave'
        );
        expect(milkywaveLayer).toBeDefined();
      });
    }
  );

  describe('category distribution', () => {
    it('should have presets distributed across categories', () => {
      const categoryCounts: Record<string, number> = {};

      for (const file of milkywavePresets) {
        const content = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
        const preset = JSON.parse(content);
        const category = preset.metadata.category || 'Uncategorized';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }

      console.log('Category distribution:', categoryCounts);

      // At minimum, we should have Audio Reactive presets (most common in MilkDrop)
      expect(categoryCounts['Audio Reactive']).toBeGreaterThan(0);

      // We should have a variety of categories
      const categoryCount = Object.keys(categoryCounts).length;
      expect(categoryCount).toBeGreaterThan(3);
    });
  });

  describe('author attribution', () => {
    it('should have author information for most presets', () => {
      let withAuthor = 0;
      let total = 0;

      for (const file of milkywavePresets) {
        const content = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
        const preset = JSON.parse(content);
        total++;
        if (preset.metadata.author && preset.metadata.author !== 'Unknown') {
          withAuthor++;
        }
      }

      const percentage = (withAuthor / total) * 100;
      console.log(`Presets with author: ${withAuthor}/${total} (${percentage.toFixed(1)}%)`);

      // At least 50% should have author attribution
      expect(withAuthor).toBeGreaterThan(total * 0.5);
    });
  });
});