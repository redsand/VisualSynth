export interface VisualSynthFallbackApi {
  listPresets: () => Promise<never[]>;
  listTemplates: () => Promise<never[]>;
  getOutputConfig: () => Promise<{ enabled: boolean; fullscreen: boolean; scale: number }>;
  isOutputOpen: () => Promise<boolean>;
  isProlinkAvailable: () => Promise<boolean>;
  listNetworkInterfaces: () => Promise<never[]>;
  onNetworkBpm: (handler: (payload: unknown) => void) => void;
  onOutputClosed: (handler: () => void) => void;
  spoutIsAvailable: () => Promise<boolean>;
  ndiIsAvailable: () => Promise<boolean>;
}

const createFallbackApi = (): VisualSynthFallbackApi => ({
  listPresets: async () => [],
  listTemplates: async () => [],
  getOutputConfig: async () => ({ enabled: false, fullscreen: false, scale: 1 }),
  isOutputOpen: async () => false,
  isProlinkAvailable: async () => false,
  listNetworkInterfaces: async () => [],
  onNetworkBpm: () => {},
  onOutputClosed: () => {},
  spoutIsAvailable: async () => false,
  ndiIsAvailable: async () => false
});

export const ensureVisualSynthBridge = (
  target: Window & typeof globalThis,
  warn: (message: string) => void = console.warn
): void => {
  if ((target as any).visualSynth) return;
  warn('[Init] window.visualSynth not found, providing mock API');
  (target as any).visualSynth = createFallbackApi();
};
