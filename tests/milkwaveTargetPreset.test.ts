import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { presetV6Schema } from '../src/shared/presetMigration';
import {
  FOCUSED_MILKWAVE_PRESETS,
  TARGET_MILKWAVE_PRESET_FILE,
  TARGET_MILKWAVE_PRESET_ID,
  TARGET_MILKWAVE_PRESET_NAME
} from '../src/shared/milkwaveTargetPreset';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');
const auditReportPath = path.join(presetsDir, 'milkwave_audit_report.json');

describe('Milkwave focused preset suite', () => {
  it('tracks exactly twenty focused presets', () => {
    expect(FOCUSED_MILKWAVE_PRESETS).toHaveLength(20);
  });

  it('only includes fully-native proof presets', () => {
    for (const preset of FOCUSED_MILKWAVE_PRESETS) {
      expect(preset.expectedAuditClassification).toBe('native-supported');
      expect(preset.expectedFallbackUsed).toBe(false);
    }
  });

  describe.each(FOCUSED_MILKWAVE_PRESETS)('$id', (focusedPreset) => {
    const presetPath = path.join(presetsDir, focusedPreset.file);
    const preset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));

    it('exists and matches the expected preset identity', () => {
      expect(fs.existsSync(presetPath)).toBe(true);
      expect(path.basename(presetPath, '.json')).toBe(focusedPreset.id);
      expect(preset.metadata?.name).toBe(focusedPreset.name);
      expect(preset.metadata?.importedFrom).toBe('Milkwave');
    });

    it('passes preset schema validation', () => {
      const result = presetV6Schema.safeParse(preset);
      expect(result.success).toBe(true);
    });

    it('is present in the runtime audit with the expected instrumentation status', () => {
      expect(fs.existsSync(auditReportPath)).toBe(true);
      const auditReport = JSON.parse(fs.readFileSync(auditReportPath, 'utf-8'));
      const auditEntry = auditReport.results.find((entry: { id: string }) => entry.id === focusedPreset.id);
      expect(auditEntry).toBeDefined();
      expect(auditEntry.classification).toBe(focusedPreset.expectedAuditClassification);
      expect(auditEntry.fallbackUsed).toBe(focusedPreset.expectedFallbackUsed);
      expect(auditEntry.warpCompiled).toBe(true);
      expect(auditEntry.compCompiled).toBe(true);
      expect(auditEntry.errors).toEqual([]);
      expect(auditEntry.shapesRendered + auditEntry.wavesRendered).toBeGreaterThan(0);
      expect(auditEntry.proof.proven).toBe(true);
      expect(auditEntry.proof.fallbackReached).toBe(false);
      expect(auditEntry.proof.visibleActivity).toBe(true);
      expect(auditEntry.proof.stepCount).toBe(auditEntry.proof.steps.length);
      expect(auditEntry.proof.passedStepCount).toBe(auditEntry.proof.stepCount);
    });
  });
});

describe('Milkwave primary target preset', () => {
  const presetPath = path.join(presetsDir, TARGET_MILKWAVE_PRESET_FILE);
  const preset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));

  it('exists and matches the expected preset identity', () => {
    expect(fs.existsSync(presetPath)).toBe(true);
    expect(path.basename(presetPath, '.json')).toBe(TARGET_MILKWAVE_PRESET_ID);
    expect(preset.metadata?.name).toBe(TARGET_MILKWAVE_PRESET_NAME);
    expect(preset.metadata?.importedFrom).toBe('Milkwave');
  });

  it('passes preset schema validation', () => {
    const result = presetV6Schema.safeParse(preset);
    expect(result.success).toBe(true);
  });

  it('is a native-supported Milkwave preset without custom warp/comp shaders', () => {
    expect(preset.metadata?.milkwave?.supportTier).toBe('native-supported');
    expect(preset._shaderData?.warp ?? '').toBe('');
    expect(preset._shaderData?.comp ?? '').toBe('');
    expect((preset._shaderData?.waves?.length ?? 0) + (preset._shaderData?.shapes?.length ?? 0)).toBeGreaterThan(0);
  });

  it('is tracked in the runtime audit as a no-fallback baseline candidate', () => {
    expect(fs.existsSync(auditReportPath)).toBe(true);
    const auditReport = JSON.parse(fs.readFileSync(auditReportPath, 'utf-8'));
    const targetResult = auditReport.results.find((entry: { id: string }) => entry.id === TARGET_MILKWAVE_PRESET_ID);
    expect(targetResult).toBeDefined();
    expect(targetResult.classification).toBe('native-supported');
    expect(targetResult.warpCompiled).toBe(true);
    expect(targetResult.compCompiled).toBe(true);
    expect(targetResult.fallbackUsed).toBe(false);
    expect(targetResult.errors).toEqual([]);
    expect(targetResult.shapesRendered + targetResult.wavesRendered).toBeGreaterThan(0);
  });
});
