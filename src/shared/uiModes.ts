export type UiMode = 'performance' | 'scene' | 'design' | 'system';

export type ModeVisibility = {
  performance: boolean;
  scene: boolean;
  design: boolean;
  system: boolean;
};

export const getModeVisibility = (mode: UiMode): ModeVisibility => ({
  performance: mode === 'performance',
  scene: mode === 'scene',
  design: mode === 'design',
  system: mode === 'system'
});
