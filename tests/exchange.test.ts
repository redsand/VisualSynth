import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { applyExchangePayload, createMacrosExchange, createSceneExchange } from '../src/shared/exchange';

describe('exchange payloads', () => {
  it('exports and imports a scene', () => {
    const payload = createSceneExchange(DEFAULT_PROJECT, DEFAULT_PROJECT.activeSceneId);
    const next = applyExchangePayload(DEFAULT_PROJECT, payload);
    expect(next.scenes.length).toBe(DEFAULT_PROJECT.scenes.length + 1);
  });

  it('exports and imports macros', () => {
    const payload = createMacrosExchange(DEFAULT_PROJECT);
    const next = applyExchangePayload(DEFAULT_PROJECT, payload);
    expect(next.macros.length).toBe(DEFAULT_PROJECT.macros.length);
  });
});
