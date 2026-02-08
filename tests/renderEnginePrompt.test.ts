import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Codex render engine prompt', () => {
  const promptPath = resolve(process.cwd(), 'docs/CODEX_RENDER_ENGINE_PROMPT.md');
  const prompt = readFileSync(promptPath, 'utf8');

  it('documents the known render engine gaps', () => {
    expect(prompt).toContain('Render contract drift risk');
    expect(prompt).toContain('Overgrown render contract');
    expect(prompt).toContain('Missing renderer loop unit tests');
    expect(prompt).toContain('Missing performance guardrails');
  });

  it('requires tests as part of the codex workflow', () => {
    expect(prompt).toContain('Every change must include tests that prove the behavior.');
    expect(prompt).toContain('Unit tests for extracted helper(s) with deterministic timestamp inputs.');
    expect(prompt).toContain('Unit test verifying output payload mapping for critical fields.');
  });

  it('defines explicit acceptance criteria for phase delivery', () => {
    expect(prompt).toContain('Acceptance criteria:');
    expect(prompt).toContain('Typed, centralized output payload builder exists and is tested.');
    expect(prompt).toContain('No breaking changes to public project schema.');
  });
});
