import { describe, expect, it } from 'vitest';
import { getModeVisibility } from '../src/shared/uiModes';

describe('ui mode visibility', () => {
  it('shows only performance panes in performance mode', () => {
    const vis = getModeVisibility('performance');
    expect(vis).toEqual({ performance: true, live: false, scene: false, mixer: false, mapping: false, design: false, system: false });
  });

  it('shows only scene panes in scene mode', () => {
    const vis = getModeVisibility('scene');
    expect(vis).toEqual({ performance: false, live: false, scene: true, mixer: false, mapping: false, design: false, system: false });
  });

  it('shows only design panes in design mode', () => {
    const vis = getModeVisibility('design');
    expect(vis).toEqual({ performance: false, live: false, scene: false, mixer: false, mapping: false, design: true, system: false });
  });

  it('shows only system panes in system mode', () => {
    const vis = getModeVisibility('system');
    expect(vis).toEqual({ performance: false, live: false, scene: false, mixer: false, mapping: false, design: false, system: true });
  });

  it('shows only live panes in live mode', () => {
    const vis = getModeVisibility('live');
    expect(vis).toEqual({ performance: false, live: true, scene: false, mixer: false, mapping: false, design: false, system: false });
  });
});
