import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { projectSchema } from '../src/shared/projectSchema';
import { deserializeProject } from '../src/shared/serialization';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');
const templatesDir = path.resolve(__dirname, '..', 'assets', 'templates');

describe('preset library', () => {
  const presetFiles = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json'));

  it('contains at least 10 presets', () => {
    expect(presetFiles.length).toBeGreaterThanOrEqual(10);
  });

  // Test each preset individually for better error reporting
  presetFiles.forEach((file) => {
    it(`preset "${file}" should be valid and functional`, () => {
      const payload = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
      const data = JSON.parse(payload);
      
      // 1. Schema Validation
      const parsed = projectSchema.safeParse(data);
      if (!parsed.success) {
        console.error(`Validation failed for ${file}:`, JSON.stringify(parsed.error.format(), null, 2));
      }
      expect(parsed.success, `Schema validation failed for ${file}`).toBe(true);

      if (parsed.success) {
        const project = parsed.data;
        
        // 2. Structural Integrity
        expect(project.scenes.length, `${file} has no scenes`).toBeGreaterThan(0);
        
        const sceneIds = project.scenes.map(s => s.id);
        expect(sceneIds, `${file} has activeSceneId "${project.activeSceneId}" which does not exist`).toContain(project.activeSceneId);

        // 3. Functional Deserialization (smoke test)
        try {
          const functionalProject = deserializeProject(payload);
          expect(functionalProject).toBeDefined();
          expect(functionalProject.version).toBeGreaterThanOrEqual(2);
        } catch (err) {
          throw new Error(`Deserialization failed for ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });
  });

  it('includes VisualSynth DNA presets', () => {
    const names = presetFiles.map((file) => {
      const payload = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
      return JSON.parse(payload).name as string;
    });
    const dnaPresets = names.filter((name) => name && name.includes('VisualSynth DNA'));
    expect(dnaPresets.length).toBeGreaterThanOrEqual(3);
  });
});

describe('template library', () => {
  const templateFiles = fs.readdirSync(templatesDir).filter((file) => file.endsWith('.json'));

  it('contains template projects', () => {
    expect(templateFiles.length).toBeGreaterThanOrEqual(3);
  });

  templateFiles.forEach((file) => {
    it(`template "${file}" should be valid and functional`, () => {
      const payload = fs.readFileSync(path.join(templatesDir, file), 'utf-8');
      
      // 1. Schema Validation
      const parsed = projectSchema.safeParse(JSON.parse(payload));
      expect(parsed.success, `Schema validation failed for template ${file}`).toBe(true);

      if (parsed.success) {
        const project = parsed.data;
        expect(project.scenes.length).toBeGreaterThan(0);
        
        // 2. Functional Deserialization
        const functionalProject = deserializeProject(payload);
        expect(functionalProject).toBeDefined();
      }
    });
  });
});
