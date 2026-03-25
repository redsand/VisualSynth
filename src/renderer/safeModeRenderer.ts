type SafeModeRenderer = {
  render: () => void;
  clearHistory: () => void;
  setLayerAsset: () => Promise<void>;
  setPalette: () => void;
  setPlasmaShaderSource: (_source: string | null) => { ok: boolean };
  getLastShaderError: () => null;
  getGeneratorDiagnostics: () => never[];
  getMissingUniforms: () => never[];
  recompileForGenerators: () => boolean;
  precompileVariant: () => void;
  setCustomShaderBlocks: () => void;
  updateMilkDropShaders: () => void;
  getMilkDropCompileReport: () => null;
  getMilkDropNativeRuntimeReport: () => null;
  getProgramCacheSize: () => number;
  trimProgramCache: (_maxSize: number) => number;
  getResourceCounts: () => { textures: number; framebuffers: number; buffers: number; programs: number; shaders: number };
  captureFrameBrightness: () => { avgBrightness: number; nonBlackRatio: number };
  pruneUnusedAssets: (_activeAssetIds: Set<string>) => void;
  dispose: () => void;
  hasPendingProgram: () => boolean;
  asyncCompilationAvailable: () => boolean;
  getCurrentProgramGenerators: () => string[];
  getPendingProgramGenerators: () => string[] | null;
  getCurrentShaderVariantKey: () => string | null;
  getPendingShaderVariantKey: () => string | null;
  getLastRenderSnapshot: () => {
    timestampMs: number;
    drawCallCount: number;
    currentProgramKind: 'none';
    passNames: string[];
    framebufferAllocated: boolean;
    framebufferRebound: boolean;
    uniformsApplied: boolean;
    finalCompositeAttached: boolean;
    shaderVariantKey: string | null;
    pendingShaderVariantKey: string | null;
    currentProgramGenerators: string[];
    pendingProgramGenerators: string[] | null;
  };
  isContextLost: () => boolean;
};

export const createSafeModeRenderer = (canvas: HTMLCanvasElement, message = 'Safe mode: WebGL2 unavailable'): SafeModeRenderer => ({
  render: () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0b111b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffd0d0';
    ctx.font = '16px Segoe UI, sans-serif';
    ctx.fillText(message, 24, 32);
  },
  clearHistory: () => {},
  setLayerAsset: async () => undefined,
  setPalette: () => {},
  setPlasmaShaderSource: (_source: string | null) => ({ ok: false }),
  getLastShaderError: () => null,
  getGeneratorDiagnostics: () => [] as never[],
  getMissingUniforms: () => [] as never[],
  recompileForGenerators: () => false,
  precompileVariant: () => {},
  setCustomShaderBlocks: () => {},
  updateMilkDropShaders: () => {},
  getMilkDropCompileReport: () => null,
  getMilkDropNativeRuntimeReport: () => null,
  getProgramCacheSize: () => 0,
  trimProgramCache: (_maxSize: number) => 0,
  getResourceCounts: () => ({ textures: 0, framebuffers: 0, buffers: 0, programs: 0, shaders: 0 }),
  captureFrameBrightness: () => ({ avgBrightness: 0, nonBlackRatio: 0 }),
  pruneUnusedAssets: (_activeAssetIds: Set<string>) => {},
  dispose: () => {},
  hasPendingProgram: () => false,
  asyncCompilationAvailable: () => false,
  getCurrentProgramGenerators: () => [],
  getPendingProgramGenerators: () => null,
  getCurrentShaderVariantKey: () => null,
  getPendingShaderVariantKey: () => null,
  getLastRenderSnapshot: () => ({
    timestampMs: 0,
    drawCallCount: 0,
    currentProgramKind: 'none',
    passNames: [],
    framebufferAllocated: false,
    framebufferRebound: false,
    uniformsApplied: false,
    finalCompositeAttached: false,
    shaderVariantKey: null,
    pendingShaderVariantKey: null,
    currentProgramGenerators: [],
    pendingProgramGenerators: null
  }),
  isContextLost: () => false,
});
