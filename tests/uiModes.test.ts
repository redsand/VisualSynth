import { describe, expect, it } from 'vitest';
import { getModeVisibility } from '../src/shared/uiModes';

describe('ui mode visibility', () => {
  it('shows only performance panes in performance mode', () => {
    const vis = getModeVisibility('performance');
    expect(vis).toEqual({ performance: true, scene: false, design: false, system: false });
  });

  it('shows only scene panes in scene mode', () => {
    const vis = getModeVisibility('scene');
    expect(vis).toEqual({ performance: false, scene: true, design: false, system: false });
  });

  it('shows only design panes in design mode', () => {
    const vis = getModeVisibility('design');
    expect(vis).toEqual({ performance: false, scene: false, design: true, system: false });
  });

  it('shows only system panes in system mode', () => {
    const vis = getModeVisibility('system');
    expect(vis).toEqual({ performance: false, scene: false, design: false, system: true });
  });
});
