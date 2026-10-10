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
  // Exclude metadata/manifest files that aren't presets
  const metadataFiles = new Set([
    'archive_list.json',
    'coreClubPack.json',
    'core_club_pack.json',
    'milkwave_audit_report.json',
    'milkwave_certification_report.json',
    'presetArchive.json',
    'presetVariants.json',
    'variant_mapping.json'
  ]);
  const presetFiles = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json') && !metadataFiles.has(file));

  it('contains at least 10 presets', () => {
    expect(presetFiles.length).toBeGreaterThanOrEqual(10);
  });

  // Loop inside a single it rather than one it per preset: registering 7k+
  // individual tests wedges vitest 1.x's threads pool (see vitest.config.ts).
  // Failure localization is preserved by collecting file + reason per offender
  // and failing once with the full list.
  it(
    `all ${presetFiles.length} presets should be valid and functional`,
    () => {
      const failures: string[] = [];

      const checkPreset = (file: string): void => {
        const payload = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
        const data = JSON.parse(payload);
        const presetVersion = data.version || 2;

        let validatedData: any;
        let isValid = false;

        const schemaForVersion =
          presetVersion === 6 ? presetV6Schema
          : presetVersion === 5 ? presetV5Schema
          : presetVersion === 4 ? presetV4Schema
          : presetVersion === 3 ? presetV3Schema
          : projectSchema;
        const parsed = schemaForVersion.safeParse(data);
        if (!parsed.success) {
          failures.push(
            `${file}: schema validation failed — ${JSON.stringify(parsed.error.format())}`
          );
          return;
        }
        validatedData = parsed.data;
        isValid = true;

        if (!isValid) return;

        if (presetVersion === 6) {
          const { project: convertedProject } = applyPresetV6(validatedData, DEFAULT_PROJECT);

          if (convertedProject.scenes.length === 0) {
            failures.push(`${file} has no scenes`);
            return;
          }

          const sceneIds = convertedProject.scenes.map((s: any) => s.id);
          if (!sceneIds.includes(convertedProject.activeSceneId)) {
            failures.push(`${file} has activeSceneId "${convertedProject.activeSceneId}" which does not exist`);
          }
        } else if (presetVersion === 5) {
          const { project: convertedProject } = applyPresetV5(validatedData, DEFAULT_PROJECT);

          if (convertedProject.scenes.length === 0) {
            failures.push(`${file} has no scenes`);
            return;
          }

          const sceneIds = convertedProject.scenes.map((s: any) => s.id);
          if (!sceneIds.includes(convertedProject.activeSceneId)) {
            failures.push(`${file} has activeSceneId "${convertedProject.activeSceneId}" which does not exist`);
          }
        } else if (presetVersion === 4) {
          const { project: convertedProject } = applyPresetV4(validatedData, DEFAULT_PROJECT);

          if (convertedProject.scenes.length === 0) {
            failures.push(`${file} has no scenes`);
            return;
          }

          const sceneIds = convertedProject.scenes.map((s: any) => s.id);
          if (!sceneIds.includes(convertedProject.activeSceneId)) {
            failures.push(`${file} has activeSceneId "${convertedProject.activeSceneId}" which does not exist`);
          }
          if (!validatedData.metadata.intendedMusicStyle) {
            failures.push(`${file} metadata.intendedMusicStyle missing`);
          }
          if (!Array.isArray(validatedData.metadata.visualIntentTags)) {
            failures.push(`${file} metadata.visualIntentTags missing`);
          }
          if (validatedData.metadata.defaultTransition === undefined) {
            failures.push(`${file} metadata.defaultTransition missing`);
          }
        } else if (presetVersion === 3) {
          const { project: convertedProject } = applyPresetV3(validatedData, DEFAULT_PROJECT);

          if (convertedProject.scenes.length === 0) {
            failures.push(`${file} has no scenes`);
            return;
          }

          const sceneIds = convertedProject.scenes.map((s: { id: string }) => s.id);
          if (!sceneIds.includes(convertedProject.activeSceneId)) {
            failures.push(`${file} has activeSceneId "${convertedProject.activeSceneId}" which does not exist`);
          }
        } else {
          const project = validatedData;

          if (project.scenes.length === 0) {
            failures.push(`${file} has no scenes`);
            return;
          }

          const sceneIds = project.scenes.map((s: { id: string }) => s.id);
          if (!sceneIds.includes(project.activeSceneId)) {
            failures.push(`${file} has activeSceneId "${project.activeSceneId}" which does not exist`);
          }

          // Functional Deserialization (smoke test)
          try {
            const functionalProject = deserializeProject(payload);
            if (!functionalProject || functionalProject.version < 2) {
              failures.push(`${file}: deserialization produced an invalid project`);
            }
          } catch (err) {
            failures.push(`${file}: deserialization failed — ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      };

      presetFiles.forEach((file, index) => {
        if (index % 500 === 0) {
          process.stderr.write(`[presets] ${index}/${presetFiles.length}\n`);
        }
        try {
          checkPreset(file);
        } catch (err) {
          failures.push(`${file}: threw — ${err instanceof Error ? err.message : String(err)}`);
        }
      });

      expect(failures).toEqual([]);
    },
    { timeout: 600_000 }
  );

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
