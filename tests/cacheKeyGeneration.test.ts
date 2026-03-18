import { describe, expect, it } from 'vitest';
import { shaderCacheKey } from '../src/renderer/render/shaderBuilder';

describe('shaderCacheKey Generation', () => {
  it('deterministically generates identical keys regardless of activeIds insertion order', () => {
    const ids1 = new Set(['gen-c', 'gen-a', 'gen-b']);
    const ids2 = new Set(['gen-b', 'gen-a', 'gen-c']);

    const key1 = shaderCacheKey(ids1, 'sdfMapBody1', 'plasmaSource1', 'customHash1');
    const key2 = shaderCacheKey(ids2, 'sdfMapBody1', 'plasmaSource1', 'customHash1');

    expect(key1).toEqual(key2);
  });

  it('generates different keys when variables differ', () => {
    const ids = new Set(['gen-a']);
    
    const baseKey = shaderCacheKey(ids, 'body1', 'plasma1', 'hash1');
    const diffBody = shaderCacheKey(ids, 'body2', 'plasma1', 'hash1');
    const diffPlasma = shaderCacheKey(ids, 'body1', 'plasma2', 'hash1');
    const diffHash = shaderCacheKey(ids, 'body1', 'plasma1', 'hash2');

    expect(baseKey).not.toEqual(diffBody);
    expect(baseKey).not.toEqual(diffPlasma);
    expect(baseKey).not.toEqual(diffHash);
  });
});
