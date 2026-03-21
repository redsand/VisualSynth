export interface MilkwaveSamplerResources {
  previousFrameTexture?: WebGLTexture | null;
  warpTexture?: WebGLTexture | null;
  blur1Texture?: WebGLTexture | null;
  blur2Texture?: WebGLTexture | null;
  blur3Texture?: WebGLTexture | null;
  noiseTexture?: WebGLTexture | null;
  noiseVolLqTexture?: WebGLTexture | null;
  noiseVolHqTexture?: WebGLTexture | null;
}

type SamplerGL = Pick<
  WebGL2RenderingContext,
  | 'TEXTURE0'
  | 'TEXTURE_2D'
  | 'TEXTURE_3D'
  | 'activeTexture'
  | 'bindTexture'
  | 'uniform1i'
>;

export const bindMilkwaveSamplers = ({
  gl,
  loc,
  resources,
  phase
}: {
  gl: SamplerGL;
  loc: (name: string) => WebGLUniformLocation | null;
  resources: MilkwaveSamplerResources;
  phase: 'warp' | 'comp';
}) => {
  const mainTexture = phase === 'warp' ? resources.previousFrameTexture : resources.warpTexture;
  const samplerMain = loc('sampler_main');
  if (samplerMain && mainTexture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mainTexture);
    gl.uniform1i(samplerMain, 0);
  }

  const bind2d = (uniformName: string, texture: WebGLTexture | null | undefined, unit: number) => {
    const target = loc(uniformName);
    if (!target || !texture) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(target, unit);
  };

  const bind3d = (uniformName: string, texture: WebGLTexture | null | undefined, unit: number) => {
    const target = loc(uniformName);
    if (!target || !texture) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.uniform1i(target, unit);
  };

  bind2d('sampler_blur1', resources.blur1Texture, 1);
  bind2d('sampler_blur2', resources.blur2Texture, 2);
  bind2d('sampler_blur3', resources.blur3Texture, 3);
  bind2d('sampler_noise_lq', resources.noiseTexture, 4);
  bind2d('sampler_noise_mq', resources.noiseTexture, 4);
  bind2d('sampler_noise_hq', resources.noiseTexture, 4);
  
  bind3d('sampler_noisevol_lq', resources.noiseVolLqTexture, 5);
  bind3d('sampler_noisevol_hq', resources.noiseVolHqTexture, 6);
};
