import { describe, expect, it } from 'vitest';
import { bindMilkwaveSamplers } from '../src/renderer/milkwave/runtime/milkwaveSamplers';

describe('bindMilkwaveSamplers', () => {
  it('skips custom samplers that exceed the available texture unit count', () => {
    const calls: Array<{ fn: string; args: unknown[] }> = [];
    const gl = {
      TEXTURE0: 1000,
      MAX_COMBINED_TEXTURE_IMAGE_UNITS: 8,
      TEXTURE_2D: 3553,
      TEXTURE_3D: 32879,
      activeTexture: (...args: unknown[]) => calls.push({ fn: 'activeTexture', args }),
      bindTexture: (...args: unknown[]) => calls.push({ fn: 'bindTexture', args }),
      uniform1i: (...args: unknown[]) => calls.push({ fn: 'uniform1i', args }),
      getParameter: () => 8
    };
    const known = new Set([
      'sampler_main',
      'sampler_blur1',
      'sampler_blur2',
      'sampler_blur3',
      'sampler_noise_lq',
      'sampler_noise_mq',
      'sampler_noise_hq',
      'sampler_noisevol_lq',
      'sampler_noisevol_hq',
      'sampler_texture_0',
      'sampler_texture_1'
    ]);

    bindMilkwaveSamplers({
      gl: gl as unknown as Parameters<typeof bindMilkwaveSamplers>[0]['gl'],
      loc: (name) => (known.has(name) ? ({ name } as unknown as WebGLUniformLocation) : null),
      resources: {
        previousFrameTexture: {} as WebGLTexture,
        blur1Texture: {} as WebGLTexture,
        blur2Texture: {} as WebGLTexture,
        blur3Texture: {} as WebGLTexture,
        noiseTexture: {} as WebGLTexture,
        noiseVolLqTexture: {} as WebGLTexture,
        noiseVolHqTexture: {} as WebGLTexture,
        customTextures: [{} as WebGLTexture, {} as WebGLTexture]
      },
      phase: 'warp',
      maxTextureUnits: 8
    });

    const uniformNames = calls
      .filter((call) => call.fn === 'uniform1i')
      .map((call) => ((call.args[0] as { name: string }).name));

    expect(uniformNames).toContain('sampler_texture_0');
    expect(uniformNames).not.toContain('sampler_texture_1');
  });
});
