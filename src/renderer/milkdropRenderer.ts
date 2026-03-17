import type { RenderState } from './renderState';

export interface MilkDropShaderData {
  warp: string;
  comp: string;
  perFrameCode: string[];
  perFrameInitCode: string[];
  originalParameters: Record<string, number | boolean>;
}

export interface MilkDropRendererOptions {
  canvas: HTMLCanvasElement;
  onError?: (error: string, type: 'vertex' | 'fragment' | 'link') => void;
}

export interface MilkDropVariables {
  time: number;
  frame: number;
  fps: number;
  bass: number;
  mid: number;
  treb: number;
  bass_att: number;
  mid_att: number;
  treb_att: number;
  [key: string]: number;
}

const createMilkDropVertexShader = (gl: WebGL2RenderingContext): WebGLShader | null => {
  const source = `#version 300 es
precision highp float;

in vec2 position;
out vec2 vUv;
out vec2 vUvOriginal;
out float vRadius;
out float vAngle;

void main() {
  vUv = position * 0.5 + 0.5;
  vUvOriginal = vUv;
  vec2 centered = position;
  vRadius = length(centered);
  vAngle = atan(centered.y, centered.x);
  gl_Position = vec4(position, 0.0, 1.0);
}`;
  const shader = gl.createShader(gl.VERTEX_SHADER);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return null;
  }
  return shader;
};

const createMilkDropFragmentShader = (gl: WebGL2RenderingContext, source: string): WebGLShader | null => {
  const shader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    console.error('[MilkDrop] Fragment shader compile error:', info);
    return null;
  }
  return shader;
};

const createProgram = (gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null => {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    console.error('[MilkDrop] Program link error:', info);
    return null;
  }
  return program;
};

const createFramebuffer = (gl: WebGL2RenderingContext, width: number, height: number): { fbo: WebGLFramebuffer; texture: WebGLTexture } | null => {
  const fbo = gl.createFramebuffer();
  const texture = gl.createTexture();
  if (!fbo || !texture) return null;
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    console.error('[MilkDrop] Framebuffer incomplete');
    return null;
  }
  
  return { fbo, texture };
};

const createBlurTexture = (gl: WebGL2RenderingContext, width: number, height: number, downsample: number): WebGLTexture => {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, Math.max(1, Math.floor(width / downsample)), Math.max(1, Math.floor(height / downsample)), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
};

const BLUR_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const BLUR_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uDirection;
uniform vec2 uResolution;
out vec4 fragColor;

void main() {
  vec2 texelSize = 1.0 / uResolution;
  vec4 result = vec4(0.0);
  float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  
  result += texture(uSource, vUv) * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = uDirection * texelSize * float(i);
    result += texture(uSource, vUv + offset) * weights[i];
    result += texture(uSource, vUv - offset) * weights[i];
  }
  
  fragColor = result;
}`;

export const createMilkDropRenderer = (options: MilkDropRendererOptions) => {
  const { canvas, onError } = options;
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  if (!gl) {
    throw new Error('[MilkDrop] WebGL2 required');
  }

  let warpProgram: WebGLProgram | null = null;
  let compProgram: WebGLProgram | null = null;
  let blurProgram: WebGLProgram | null = null;
  
  let mainFbo: { fbo: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  let warpFbo: { fbo: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  let blur1Fbo: { fbo: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  let blur2Fbo: { fbo: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  let blur3Fbo: { fbo: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  
  let noiseTexture: WebGLTexture | null = null;
  let lastWidth = 0;
  let lastHeight = 0;
  
  const variables: MilkDropVariables = {
    time: 0,
    frame: 0,
    fps: 60,
    bass: 0,
    mid: 0,
    treb: 0,
    bass_att: 0,
    mid_att: 0,
    treb_att: 0,
  };
  
  const qVars: number[] = new Array(32).fill(0);
  const customVars: Record<string, number> = {};
  
  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) throw new Error('[MilkDrop] Buffer creation failed');
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  const initBlurProgram = () => {
    const vs = createMilkDropFragmentShader(gl, BLUR_VERTEX_SHADER);
    const fs = createMilkDropFragmentShader(gl, BLUR_FRAGMENT_SHADER);
    if (!vs || !fs) return;
    blurProgram = createProgram(gl, vs, fs);
  };
  initBlurProgram();

  const generateNoiseTexture = (width: number, height: number): WebGLTexture => {
    const texture = gl.createTexture()!;
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return texture;
  };

  const ensureFramebuffers = (width: number, height: number) => {
    if (width === lastWidth && height === lastHeight && mainFbo) return;
    
    mainFbo = createFramebuffer(gl, width, height);
    warpFbo = createFramebuffer(gl, width, height);
    blur1Fbo = createFramebuffer(gl, Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)));
    blur2Fbo = createFramebuffer(gl, Math.max(1, Math.floor(width / 4)), Math.max(1, Math.floor(height / 4)));
    blur3Fbo = createFramebuffer(gl, Math.max(1, Math.floor(width / 8)), Math.max(1, Math.floor(height / 8)));
    noiseTexture = generateNoiseTexture(256, 256);
    
    lastWidth = width;
    lastHeight = height;
  };

  const compileShaders = (shaderData: MilkDropShaderData): boolean => {
    const vs = createMilkDropVertexShader(gl);
    if (!vs) {
      onError?.('Failed to compile vertex shader', 'vertex');
      return false;
    }

    const warpFs = createMilkDropFragmentShader(gl, shaderData.warp);
    if (warpFs) {
      warpProgram = createProgram(gl, vs, warpFs);
      if (!warpProgram) {
        onError?.('Failed to link warp program', 'link');
      } else {
        console.log('[MilkDrop] Warp shader compiled successfully');
      }
    } else {
      console.error('[MilkDrop] Failed to compile warp fragment shader');
      return false;
    }

    const compFs = createMilkDropFragmentShader(gl, shaderData.comp);
    if (compFs) {
      compProgram = createProgram(gl, vs, compFs);
      if (!compProgram) {
        onError?.('Failed to link comp program', 'link');
      } else {
        console.log('[MilkDrop] Comp shader compiled successfully');
      }
    } else {
      console.error('[MilkDrop] Failed to compile comp fragment shader');
      return false;
    }

    console.log('[MilkDrop] Shaders compiled:', {
      warp: !!warpProgram,
      comp: !!compProgram
    });
    return warpProgram !== null || compProgram !== null;
  };

  const executePerFrameCode = (code: string[], state: RenderState) => {
    const bass = state.spectrum?.[0] ?? state.rms ?? 0;
    const mid = state.spectrum?.[Math.floor((state.spectrum?.length ?? 0) / 2)] ?? state.rms ?? 0;
    const treb = state.spectrum?.[(state.spectrum?.length ?? 1) - 1] ?? state.rms ?? 0;
    
    const ctx: Record<string, any> = {
      time: state.timeMs / 1000,
      frame: variables.frame,
      fps: 60,
      bass,
      mid,
      treb,
      bass_att: bass * 0.9 + variables.bass * 0.1,
      mid_att: mid * 0.9 + variables.mid * 0.1,
      treb_att: treb * 0.9 + variables.treb * 0.1,
      rms: state.rms,
      ...qVars.reduce((acc, v, i) => { acc[`q${i + 1}`] = v; return acc; }, {} as Record<string, number>),
      ...customVars,
      above: (a: number, b: number) => a > b ? 1 : 0,
      below: (a: number, b: number) => a < b ? 1 : 0,
      equal: (a: number, b: number) => a === b ? 1 : 0,
      if_milk: (cond: number, a: number, b: number) => cond ? a : b,
      max: Math.max,
      min: Math.min,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      abs: Math.abs,
      sqrt: Math.sqrt,
      pow: Math.pow,
      log: Math.log,
      exp: Math.exp,
      floor: Math.floor,
      ceil: Math.ceil,
      sign: Math.sign,
      rand: (max: number) => Math.random() * max,
      bor: (a: number, b: number) => (a || b) ? 1 : 0,
      bnot: (a: number) => a ? 0 : 1,
      sqr: (a: number) => a * a,
    };

    try {
      for (const line of code) {
        if (!line.trim()) continue;
        const wrappedCode = `
          ${Object.keys(ctx).map(k => `const ${k} = arguments[0].${k};`).join('\n')}
          ${line};
          return { ${Object.keys(ctx).join(', ')} };
        `;
        const result = new Function('arguments', wrappedCode)(ctx);
        if (result) {
          Object.assign(ctx, result);
          for (let i = 0; i < 32; i++) {
            qVars[i] = ctx[`q${i + 1}`] ?? qVars[i];
          }
          Object.assign(customVars, result);
        }
      }
    } catch (e) {
      console.warn('[MilkDrop] Per-frame code error:', e);
    }

    variables.time = ctx.time;
    variables.frame = ctx.frame;
    variables.bass = ctx.bass;
    variables.mid = ctx.mid;
    variables.treb = ctx.treb;
    variables.bass_att = ctx.bass_att;
    variables.mid_att = ctx.mid_att;
    variables.treb_att = ctx.treb_att;
  };

  const applyBlurPass = (sourceTexture: WebGLTexture, targetFbo: WebGLFramebuffer | null, width: number, height: number, horizontal: boolean) => {
    if (!blurProgram) return;
    
    gl.useProgram(blurProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
    gl.viewport(0, 0, width, height);
    
    const sourceLoc = gl.getUniformLocation(blurProgram, 'uSource');
    const dirLoc = gl.getUniformLocation(blurProgram, 'uDirection');
    const resLoc = gl.getUniformLocation(blurProgram, 'uResolution');
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.uniform1i(sourceLoc, 0);
    gl.uniform2f(dirLoc, horizontal ? 1 : 0, horizontal ? 0 : 1);
    gl.uniform2f(resLoc, width, height);
    
    const posLoc = gl.getAttribLocation(blurProgram, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const render = (state: RenderState, shaderData: MilkDropShaderData | null, outputToScreen: boolean = true): boolean => {
    const width = canvas.width;
    const height = canvas.height;
    
    ensureFramebuffers(width, height);
    
    if (!shaderData || (!warpProgram && !compProgram)) {
      if (!shaderData) {
        console.warn('[MilkDrop] No shader data provided, skipping render');
      }
      if (!warpProgram && !compProgram) {
        console.warn('[MilkDrop] No shaders compiled, skipping render');
      }
      return false;
    }

    executePerFrameCode(shaderData.perFrameCode, state);

    gl.bindFramebuffer(gl.FRAMEBUFFER, warpFbo?.fbo ?? null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (warpProgram) {
      console.log('[MilkDrop] Executing warp shader pass');
      gl.useProgram(warpProgram);
      setUniforms(warpProgram, state, width, height);
      
      const posLoc = gl.getAttribLocation(warpProgram, 'position');
      gl.enableVertexAttribArray(posLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else {
      console.warn('[MilkDrop] Warp shader not available, skipping warp pass');
    }

    if (blurProgram && warpFbo) {
      const tempFbo = createFramebuffer(gl, Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)));
      if (tempFbo) {
        console.log('[MilkDrop] Applying blur passes:', {
          hasBlur1Fbo: !!blur1Fbo,
          hasBlur2Fbo: !!blur2Fbo,
          hasBlur3Fbo: !!blur3Fbo
        });
        applyBlurPass(warpFbo.texture, tempFbo.fbo, Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)), true);
        applyBlurPass(tempFbo.texture, blur1Fbo?.fbo ?? null, Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)), false);
        gl.deleteFramebuffer(tempFbo.fbo);
        gl.deleteTexture(tempFbo.texture);
      }
    } else {
      console.warn('[MilkDrop] Blur pass skipped:', {
        hasBlurProgram: !!blurProgram,
        hasWarpFbo: !!warpFbo
      });
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, outputToScreen ? null : mainFbo?.fbo ?? null);
    gl.viewport(0, 0, width, height);

    if (compProgram) {
      gl.useProgram(compProgram);
      setUniforms(compProgram, state, width, height);
      
      if (warpFbo) {
        const mainLoc = gl.getUniformLocation(compProgram, 'sampler_main');
        if (mainLoc) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, warpFbo.texture);
          gl.uniform1i(mainLoc, 0);
        }
      }
      
      if (blur1Fbo) {
        const blur1Loc = gl.getUniformLocation(compProgram, 'sampler_blur1');
        if (blur1Loc) {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, blur1Fbo.texture);
          gl.uniform1i(blur1Loc, 1);
        }
      }
      if (blur2Fbo) {
        const blur2Loc = gl.getUniformLocation(compProgram, 'sampler_blur2');
        if (blur2Loc) {
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, blur2Fbo.texture);
          gl.uniform1i(blur2Loc, 2);
        }
      }
      if (blur3Fbo) {
        const blur3Loc = gl.getUniformLocation(compProgram, 'sampler_blur3');
        if (blur3Loc) {
          gl.activeTexture(gl.TEXTURE3);
          gl.bindTexture(gl.TEXTURE_2D, blur3Fbo.texture);
          gl.uniform1i(blur3Loc, 3);
        }
      }
      if (noiseTexture) {
        const noiseLoc = gl.getUniformLocation(compProgram, 'sampler_noise_lq');
        if (noiseLoc) {
          gl.activeTexture(gl.TEXTURE4);
          gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
          gl.uniform1i(noiseLoc, 4);
        }
      }
      
      const posLoc = gl.getAttribLocation(compProgram, 'position');
      gl.enableVertexAttribArray(posLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    variables.frame++;
    return true;
  };

  const setUniforms = (program: WebGLProgram, state: RenderState, width: number, height: number) => {
    const getLocation = (name: string) => gl.getUniformLocation(program, name);
    
    gl.uniform1f(getLocation('uTime'), variables.time);
    gl.uniform1f(getLocation('uFrame'), variables.frame);
    gl.uniform1f(getLocation('uFps'), 60);
    gl.uniform1f(getLocation('uRms'), state.rms);
    
    gl.uniform1f(getLocation('audioLow'), variables.bass);
    gl.uniform1f(getLocation('audioLowSmooth'), variables.bass_att);
    gl.uniform1f(getLocation('audioMid'), variables.mid);
    gl.uniform1f(getLocation('audioMidSmooth'), variables.mid_att);
    gl.uniform1f(getLocation('audioHigh'), variables.treb);
    gl.uniform1f(getLocation('audioHighSmooth'), variables.treb_att);
    
    gl.uniform1f(getLocation('uAspectX'), width / height);
    gl.uniform1f(getLocation('uAspectY'), 1.0);
    gl.uniform2f(getLocation('uAspect'), width / height, 1.0);
    gl.uniform2f(getLocation('uTexSize'), width, height);
    
    gl.uniform2f(getLocation('uRandomPreset'), Math.random(), Math.random());
    gl.uniform2f(getLocation('uRandomFrame'), Math.random(), Math.random());
    
    for (let i = 0; i < 32; i++) {
      const qLoc = getLocation(`q${i + 1}`);
      if (qLoc) gl.uniform1f(qLoc, qVars[i]);
    }
  };

  const getMainTexture = (): WebGLTexture | null => {
    return mainFbo?.texture ?? null;
  };

  const clear = () => {
    if (warpProgram) gl.deleteProgram(warpProgram);
    if (compProgram) gl.deleteProgram(compProgram);
    warpProgram = null;
    compProgram = null;
  };

  return {
    compileShaders,
    render,
    getMainTexture,
    clear,
    getVariables: () => ({ ...variables }),
    getQVars: () => [...qVars],
  };
};

export type MilkDropRenderer = ReturnType<typeof createMilkDropRenderer>;
