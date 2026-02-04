import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { projectSchema } from '../src/shared/projectSchema';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { deserializeProject } from '../src/shared/serialization';
import {
  presetV3Schema,
  presetV4Schema,
  presetV5Schema,
  presetV6Schema,
  applyPresetV3,
  applyPresetV4,
  applyPresetV5,
  applyPresetV6
} from '../src/shared/presetMigration';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');
const templatesDir = path.resolve(__dirname, '..', 'assets', 'templates');

describe('preset library', () => {
  const presetFiles = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json'));

  it('contains at least 10 presets', () => {
    expect(presetFiles.length).toBeGreaterThanOrEqual(10);
  });

  // Test each preset individually for better error reporting
  presetFiles.forEach((file) => {
    it(`preset "${file}" should be valid and functional`, async () => {
      const payload = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
      const data = JSON.parse(payload);
      const presetVersion = data.version || 2;

      let validatedData: any;
      let isValid = false;

      if (presetVersion === 6) {
        const parsed = presetV6Schema.safeParse(data);
        if (!parsed.success) {
          console.error(`Validation failed for ${file}:`, JSON.stringify(parsed.error.format(), null, 2));
        }
        expect(parsed.success, `Schema validation failed for ${file}`).toBe(true);
        if (parsed.success) {
          validatedData = parsed.data;
          isValid = true;
        }
      } else if (presetVersion === 5) {
        const parsed = presetV5Schema.safeParse(data);
        if (!parsed.success) {
          console.error(`Validation failed for ${file}:`, JSON.stringify(parsed.error.format(), null, 2));
        }
        expect(parsed.success, `Schema validation failed for ${file}`).toBe(true);
        if (parsed.success) {
          validatedData = parsed.data;
          isValid = true;
        }
      } else if (presetVersion === 4) {
        const parsed = presetV4Schema.safeParse(data);
        if (!parsed.success) {
          console.error(`Validation failed for ${file}:`, JSON.stringify(parsed.error.format(), null, 2));
        }
        expect(parsed.success, `Schema validation failed for ${file}`).toBe(true);
        if (parsed.success) {
          validatedData = parsed.data;
          isValid = true;
        }
      } else if (presetVersion === 3) {
        const parsed = presetV3Schema.safeParse(data);
        if (!parsed.success) {
          console.error(`Validation failed for ${file}:`, JSON.stringify(parsed.error.format(), null, 2));
        }
        expect(parsed.success, `Schema validation failed for ${file}`).toBe(true);
        if (parsed.success) {
          validatedData = parsed.data;
          isValid = true;
        }
      } else {
        // Validate v2 preset against projectSchema
        const parsed = projectSchema.safeParse(data);
        if (!parsed.success) {
          console.error(`Validation failed for ${file}:`, JSON.stringify(parsed.error.format(), null, 2));
        }
        expect(parsed.success, `Schema validation failed for ${file}`).toBe(true);
        if (parsed.success) {
          validatedData = parsed.data;
          isValid = true;
        }
      }

      if (isValid) {
        if (presetVersion === 6) {
          const { project: convertedProject } = applyPresetV6(validatedData, DEFAULT_PROJECT);

          expect(convertedProject.scenes.length, `${file} has no scenes`).toBeGreaterThan(0);

          const sceneIds = convertedProject.scenes.map((s: any) => s.id);
          expect(sceneIds, `${file} has activeSceneId "${convertedProject.activeSceneId}" which does not exist`).toContain(convertedProject.activeSceneId);
        } else if (presetVersion === 5) {
          const { project: convertedProject } = applyPresetV5(validatedData, DEFAULT_PROJECT);

          expect(convertedProject.scenes.length, `${file} has no scenes`).toBeGreaterThan(0);

          const sceneIds = convertedProject.scenes.map((s: any) => s.id);
          expect(sceneIds, `${file} has activeSceneId "${convertedProject.activeSceneId}" which does not exist`).toContain(convertedProject.activeSceneId);
        } else if (presetVersion === 4) {
          const { project: convertedProject } = applyPresetV4(validatedData, DEFAULT_PROJECT);

          expect(convertedProject.scenes.length, `${file} has no scenes`).toBeGreaterThan(0);

          const sceneIds = convertedProject.scenes.map((s: any) => s.id);
          expect(sceneIds, `${file} has activeSceneId "${convertedProject.activeSceneId}" which does not exist`).toContain(convertedProject.activeSceneId);

          expect(validatedData.metadata.intendedMusicStyle).toBeTruthy();
          expect(Array.isArray(validatedData.metadata.visualIntentTags)).toBe(true);
          expect(validatedData.metadata.defaultTransition).toBeDefined();
        } else if (presetVersion === 3) {
          const { project: convertedProject } = applyPresetV3(validatedData, DEFAULT_PROJECT);

          expect(convertedProject.scenes.length, `${file} has no scenes`).toBeGreaterThan(0);

          const sceneIds = convertedProject.scenes.map(s => s.id);
          expect(sceneIds, `${file} has activeSceneId "${convertedProject.activeSceneId}" which does not exist`).toContain(convertedProject.activeSceneId);
        } else {
          const project = validatedData;

          // Structural Integrity
          expect(project.scenes.length, `${file} has no scenes`).toBeGreaterThan(0);

          const sceneIds = project.scenes.map(s => s.id);
          expect(sceneIds, `${file} has activeSceneId "${project.activeSceneId}" which does not exist`).toContain(project.activeSceneId);

          // Functional Deserialization (smoke test)
          try {
            const functionalProject = deserializeProject(payload);
            expect(functionalProject).toBeDefined();
            expect(functionalProject.version).toBeGreaterThanOrEqual(2);
          } catch (err) {
            throw new Error(`Deserialization failed for ${file}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    });
  });

  it('includes VisualSynth DNA presets', () => {
    const names = presetFiles.map((file) => {
      const payload = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
      const data = JSON.parse(payload);
      // v3 presets have name in metadata, v2 presets have name at root
      return data.metadata?.name || data.name as string;
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
