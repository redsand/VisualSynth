import { describe, expect, it } from 'vitest';
import { formatSafeModeReasons } from '../src/shared/safeMode';

describe('safe mode formatting', () => {
  it('formats empty reasons', () => {
    expect(formatSafeModeReasons([])).toBe('Safe mode: OK');
  });

  it('formats multiple reasons', () => {
    expect(formatSafeModeReasons(['Audio', 'WebGL'])).toBe('Safe mode: Audio, WebGL');
  });
});
