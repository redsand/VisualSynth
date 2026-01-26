export interface RenderState {
  timeMs: number;
  rms: number;
  peak: number;
  strobe: number;
  plasmaEnabled: boolean;
  spectrumEnabled: boolean;
  spectrum: Float32Array;
}

export const resizeCanvasToDisplaySize = (canvas: HTMLCanvasElement) => {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
};

export const createGLRenderer = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    throw new Error('WebGL2 required');
  }

  const vertexShaderSrc = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

  const fragmentShaderSrc = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uRms;
uniform float uPeak;
uniform float uStrobe;
uniform float uPlasmaEnabled;
uniform float uSpectrumEnabled;
uniform float uSpectrum[64];

in vec2 vUv;
out vec4 outColor;

float plasma(vec2 uv, float t) {
  float v = sin(uv.x * 8.0 + t) + sin(uv.y * 6.0 - t * 1.1);
  v += sin((uv.x + uv.y) * 4.0 + t * 0.7);
  return v * 0.5 + 0.5;
}

void main() {
  vec2 uv = vUv;
  vec3 color = vec3(0.02, 0.04, 0.08);
  if (uPlasmaEnabled > 0.5) {
    float p = plasma(uv, uTime);
    color += vec3(0.1 + p * 0.4, 0.2 + p * 0.5, 0.3 + p * 0.6);
  }

  if (uSpectrumEnabled > 0.5) {
    float band = floor(uv.x * 64.0);
    int index = int(clamp(band, 0.0, 63.0));
    float amp = uSpectrum[index];
    float bar = step(uv.y, amp);
    color += vec3(0.1, 0.6, 1.0) * bar * 0.8;
  }

  float flash = uStrobe * 1.5;
  color += vec3(flash);
  color += vec3(uPeak * 0.2, uRms * 0.5, uRms * 0.8);

  outColor = vec4(color, 1.0);
}`;

  const compileShader = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Shader creation failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile error');
    }
    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSrc);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSrc);

  const program = gl.createProgram();
  if (!program) throw new Error('Program creation failed');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Program link error');
  }

  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) throw new Error('Buffer creation failed');

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const vertices = new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1
  ]);

  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, 'position');

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const timeLocation = gl.getUniformLocation(program, 'uTime');
  const rmsLocation = gl.getUniformLocation(program, 'uRms');
  const peakLocation = gl.getUniformLocation(program, 'uPeak');
  const strobeLocation = gl.getUniformLocation(program, 'uStrobe');
  const plasmaLocation = gl.getUniformLocation(program, 'uPlasmaEnabled');
  const spectrumLocation = gl.getUniformLocation(program, 'uSpectrumEnabled');
  const spectrumArrayLocation = gl.getUniformLocation(program, 'uSpectrum');

  return {
    render: (state: RenderState) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.02, 0.03, 0.06, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      if (timeLocation) gl.uniform1f(timeLocation, state.timeMs * 0.001);
      if (rmsLocation) gl.uniform1f(rmsLocation, state.rms);
      if (peakLocation) gl.uniform1f(peakLocation, state.peak);
      if (strobeLocation) gl.uniform1f(strobeLocation, state.strobe);
      if (plasmaLocation) gl.uniform1f(plasmaLocation, state.plasmaEnabled ? 1 : 0);
      if (spectrumLocation) gl.uniform1f(spectrumLocation, state.spectrumEnabled ? 1 : 0);
      if (spectrumArrayLocation) {
        gl.uniform1fv(spectrumArrayLocation, state.spectrum);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
};
