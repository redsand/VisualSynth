export const buildUniformLookup = (uniformNames: Iterable<string>): Set<string> => {
  const lookup = new Set<string>();
  for (const name of uniformNames) {
    lookup.add(name);
    if (name.endsWith('[0]')) {
      lookup.add(name.slice(0, -3));
    }
  }
  return lookup;
};

export const collectActiveUniformLookup = (
  gl: Pick<WebGL2RenderingContext, 'getProgramParameter' | 'getActiveUniform' | 'ACTIVE_UNIFORMS'>,
  program: WebGLProgram
): Set<string> => {
  const activeCount = Number(gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) ?? 0);
  const uniformNames: string[] = [];
  for (let index = 0; index < activeCount; index += 1) {
    const active = gl.getActiveUniform(program, index);
    if (active?.name) {
      uniformNames.push(active.name);
    }
  }
  return buildUniformLookup(uniformNames);
};

export const hasUniform = (lookup: Set<string>, uniformName: string): boolean => lookup.has(uniformName);
