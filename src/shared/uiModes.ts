export type UiMode = 'performance' | 'scene' | 'design' | 'matrix' | 'system';

export const getModeVisibility = (mode: UiMode) => ({
  performance: mode === 'performance',
  scene: mode === 'scene',
  design: mode === 'design',
  matrix: mode === 'matrix',
  system: mode === 'system'
});