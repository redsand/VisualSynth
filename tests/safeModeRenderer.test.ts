import { describe, expect, it, vi } from 'vitest';
import { createSafeModeRenderer } from '../src/renderer/safeModeRenderer';

describe('createSafeModeRenderer', () => {
  it('renders a safe-mode message and exposes no-op diagnostics hooks', async () => {
    const ctx = {
      fillStyle: '',
      font: '',
      fillRect: vi.fn(),
      fillText: vi.fn()
    };
    const canvas = {
      width: 640,
      height: 360,
      getContext: vi.fn(() => ctx)
    } as unknown as HTMLCanvasElement;

    const renderer = createSafeModeRenderer(canvas, 'Safe mode: Output WebGL2 unavailable');

    renderer.render();

    expect(canvas.getContext).toHaveBeenCalledWith('2d');
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 640, 360);
    expect(ctx.fillText).toHaveBeenCalledWith('Safe mode: Output WebGL2 unavailable', 24, 32);
    expect(renderer.getLastShaderError()).toBeNull();
    expect(renderer.getGeneratorDiagnostics()).toEqual([]);
    expect(renderer.getMissingUniforms()).toEqual([]);
    expect(renderer.recompileForGenerators()).toBe(false);
    await expect(renderer.setLayerAsset()).resolves.toBeUndefined();
    expect(renderer.setPlasmaShaderSource(null)).toEqual({ ok: false });
  });
});
