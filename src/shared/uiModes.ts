export type UiMode = 'performance' | 'scene' | 'mixer' | 'mapping' | 'design' | 'system';

export const getModeVisibility = (mode: UiMode) => ({
  performance: mode === 'performance',
  scene: mode === 'scene',
  mixer: mode === 'mixer',
  mapping: mode === 'mapping',
  design: mode === 'design',
  system: mode === 'system'
});