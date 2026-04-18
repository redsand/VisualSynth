export type UiMode = 'performance' | 'live' | 'scene' | 'mixer' | 'mapping' | 'design' | 'system';

export const getModeVisibility = (mode: UiMode) => ({
  performance: mode === 'performance',
  live: mode === 'live',
  scene: mode === 'scene',
  mixer: mode === 'mixer',
  mapping: mode === 'mapping',
  design: mode === 'design',
  system: mode === 'system'
});