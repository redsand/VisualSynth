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
  getGeneratorDiagnostics: () => [],
  getMissingUniforms: () => [],
  recompileForGenerators: () => false,
  precompileVariant: () => {},
  setCustomShaderBlocks: () => {},
  updateMilkDropShaders: () => {},
  getMilkDropCompileReport: () => null,
  getMilkDropNativeRuntimeReport: () => null,
  isContextLost: () => false,
});
