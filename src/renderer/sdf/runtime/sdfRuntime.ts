import { SdfCompiledShader, SdfNodeInstance } from '../api';

export class SdfRuntime {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private uniformLocs: Map<string, WebGLUniformLocation> = new Map();
  private shaderSource: string = '';

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  public updateShader(compiled: SdfCompiledShader): boolean {
    if (this.shaderSource === compiled.fragmentSource && this.program) {
      return true; // No change
    }

    const vertSrc = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

    const prog = this.createProgram(vertSrc, compiled.fragmentSource);
    if (!prog) return false;

    if (this.program) this.gl.deleteProgram(this.program);
    this.program = prog;
    this.shaderSource = compiled.fragmentSource;

    // Cache uniforms
    this.uniformLocs.clear();
    const coreUniforms = ['uTime', 'uResolution'];
    for (const name of coreUniforms) {
      const loc = this.gl.getUniformLocation(prog, name);
      if (loc) this.uniformLocs.set(name, loc);
    }

    for (const u of compiled.uniforms) {
      const loc = this.gl.getUniformLocation(prog, u.name);
      if (loc) this.uniformLocs.set(u.name, loc);
    }

    return true;
  }

  public render(
    width: number,
    height: number,
    time: number,
    nodes: SdfNodeInstance[]
  ) {
    if (!this.program) return;
    const gl = this.gl;

    gl.useProgram(this.program);
    gl.viewport(0, 0, width, height);

    // Bind Core Uniforms
    const uTime = this.uniformLocs.get('uTime');
    if (uTime) gl.uniform1f(uTime, time);
    
    const uRes = this.uniformLocs.get('uResolution');
    if (uRes) gl.uniform2f(uRes, width, height);

    // Bind Node Parameters
    // We expect nodes to contain the current modulated values in 'params'
    for (const node of nodes) {
      for (const [key, val] of Object.entries(node.params)) {
        const uName = `u_${node.instanceId}_${key}`;
        const loc = this.uniformLocs.get(uName);
        if (loc) {
          if (typeof val === 'number') {
            gl.uniform1f(loc, val);
          } else if (Array.isArray(val)) {
            if (val.length === 2) gl.uniform2fv(loc, val);
            if (val.length === 3) gl.uniform3fv(loc, val);
            if (val.length === 4) gl.uniform4fv(loc, val);
          }
        }
      }
    }

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private createProgram(vert: string, frag: string): WebGLProgram | null {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vert);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('SDF VS Error:', gl.getShaderInfoLog(vs));
      return null;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, frag);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('SDF FS Error:', gl.getShaderInfoLog(fs));
      console.log(frag); // Log source for debugging
      return null;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('SDF Link Error:', gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }
}