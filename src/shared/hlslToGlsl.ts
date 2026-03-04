/**
 * HLSL to GLSL Transpiler
 *
 * Converts MilkDrop HLSL shaders to VisualSynth GLSL format.
 */

export interface TranspilerOptions {
  /** Convert uniform names to VisualSynth conventions */
  mapUniforms?: boolean;
  /** Wrap shader in proper GLSL structure */
  wrapInShader?: boolean;
  /** Shader type: 'warp' or 'comp' */
  shaderType?: 'warp' | 'comp' | 'custom';
}

/**
 * HLSL to GLSL type conversions
 */
const TYPE_CONVERSIONS: Record<string, string> = {
  'float2': 'vec2',
  'float3': 'vec3',
  'float4': 'vec4',
  'float2x2': 'mat2',
  'float3x3': 'mat3',
  'float4x4': 'mat4',
  'int2': 'ivec2',
  'int3': 'ivec3',
  'int4': 'ivec4',
  'uint2': 'uvec2',
  'uint3': 'uvec3',
  'uint4': 'uvec4',
  'bool2': 'bvec2',
  'bool3': 'bvec3',
  'bool4': 'bvec4',
  'half': 'float',
  'half2': 'vec2',
  'half3': 'vec3',
  'half4': 'vec4',
  'fixed': 'float',
  'fixed2': 'vec2',
  'fixed3': 'vec3',
  'fixed4': 'vec4'
};

/**
 * HLSL to GLSL function conversions
 */
const FUNCTION_CONVERSIONS: Record<string, string> = {
  'tex2D': 'texture',
  'tex2Dlod': 'textureLod',
  'tex2Dgrad': 'textureGrad',
  'tex2Dproj': 'textureProj',
  'tex2Dbias': 'textureBias',
  'texCUBE': 'textureCube',
  'tex3D': 'texture3D',
  'lerp': 'mix',
  'saturate': 'clamp01',
  'frac': 'fract',
  'ddx': 'dFdx',
  'ddy': 'dFdy',
  'mul': 'multiply',
  'abs': 'abs',
  'acos': 'acos',
  'asin': 'asin',
  'atan': 'atan',
  'atan2': 'atan',
  'ceil': 'ceil',
  'clamp': 'clamp',
  'clip': 'discard',
  'cos': 'cos',
  'cosh': 'cosh',
  'cross': 'cross',
  'degrees': 'degrees',
  'distance': 'distance',
  'dot': 'dot',
  'exp': 'exp',
  'exp2': 'exp2',
  'floor': 'floor',
  'fmod': 'mod',
  'fwidth': 'fwidth',
  'isfinite': 'isfinite',
  'isinf': 'isinf',
  'isnan': 'isnan',
  'length': 'length',
  'log': 'log',
  'log10': 'log10',
  'log2': 'log2',
  'max': 'max',
  'min': 'min',
  'normalize': 'normalize',
  'pow': 'pow',
  'radians': 'radians',
  'reflect': 'reflect',
  'refract': 'refract',
  'round': 'round',
  'rsqrt': 'inversesqrt',
  'sin': 'sin',
  'sincos': 'sincos',
  'sinh': 'sinh',
  'smoothstep': 'smoothstep',
  'sqrt': 'sqrt',
  'step': 'step',
  'tan': 'tan',
  'tanh': 'tanh',
  'transpose': 'transpose',
  'trunc': 'trunc'
};

/**
 * MilkDrop to VisualSynth uniform name mappings
 */
const UNIFORM_MAPPINGS: Record<string, string> = {
  // Time
  'time': 'uTime',
  'frame': 'uFrame',
  'fps': 'uFps',

  // Audio - bass/mid/treble
  'bass': 'audioLow',
  'bass_att': 'audioLowSmooth',
  'mid': 'audioMid',
  'mid_att': 'audioMidSmooth',
  'treb': 'audioHigh',
  'treb_att': 'audioHighSmooth',
  'vol': 'uRms',

  // Screen dimensions
  'aspectx': 'uAspectX',
  'aspecty': 'uAspectY',
  'aspect': 'uAspect',

  // Render state
  'rad': 'vRadius',
  'ang': 'vAngle',
  'uv': 'vUv',
  'uv_orig': 'vUvOriginal',

  // Resolution
  'texsize': 'uTexSize',
  'u_texsize': 'uTexSize'
};

/**
 * Common MilkDrop shader constants and variables
 */
const MILKDROP_CONSTANTS: Record<string, string> = {
  'rand_preset': 'uRandomPreset',
  'rand_frame': 'uRandomFrame'
};

/**
 * Convert HLSL type to GLSL type
 */
export function convertType(hlslType: string): string {
  // Handle const/other prefixes
  const parts = hlslType.trim().split(/\s+/);
  const converted = parts.map(part => TYPE_CONVERSIONS[part] || part);
  return converted.join(' ');
}

/**
 * Convert HLSL function call to GLSL
 */
export function convertFunction(hlslFunc: string): string {
  return FUNCTION_CONVERSIONS[hlslFunc] || hlslFunc;
}

/**
 * Convert HLSL uniform name to VisualSynth uniform name
 */
export function convertUniform(name: string): string {
  // Check direct mapping
  if (UNIFORM_MAPPINGS[name]) {
    return UNIFORM_MAPPINGS[name];
  }

  // Check with u prefix (VisualSynth convention)
  const withUPrefix = 'u' + name.charAt(0).toUpperCase() + name.slice(1);
  if (MILKDROP_CONSTANTS[name]) {
    return MILKDROP_CONSTANTS[name];
  }

  return name;
}

/**
 * Process shader body - convert HLSL constructs to GLSL
 */
function processShaderBody(code: string): string {
  let result = code;

  // Remove backtick prefix (MilkDrop uses ` for code lines)
  result = result.replace(/^`/gm, '');

  // Convert types
  for (const [hlsl, glsl] of Object.entries(TYPE_CONVERSIONS)) {
    // Match type declarations: "float2 name" or "float2(name)"
    const typeRegex = new RegExp(`\\b${hlsl}\\b`, 'g');
    result = result.replace(typeRegex, glsl);
  }

  // Convert function calls
  for (const [hlsl, glsl] of Object.entries(FUNCTION_CONVERSIONS)) {
    // Match function calls: "funcName("
    const funcRegex = new RegExp(`\\b${hlsl}\\s*\\(`, 'g');
    result = result.replace(funcRegex, `${glsl}(`);
  }

  // Handle saturate() specially - needs clamp wrapper
  result = result.replace(/\bsaturate\s*\(\s*([^)]+)\s*\)/g, 'clamp($1, 0.0, 1.0)');

  // Convert uniforms
  for (const [milk, synth] of Object.entries(UNIFORM_MAPPINGS)) {
    // Match as variable reference (not part of identifier)
    const uniformRegex = new RegExp(`\\b${milk}\\b`, 'g');
    result = result.replace(uniformRegex, synth);
  }

  // Handle static const (HLSL) -> const (GLSL)
  result = result.replace(/\bstatic\s+const\b/g, 'const');

  // Handle discard in HLSL way
  result = result.replace(/\bclip\s*\(([^)]+)\)/g, 'if ($1 < 0.0) discard');

  return result;
}

/**
 * Generate GLSL header with required uniforms and inputs
 */
function generateGLSLHeader(shaderType: 'warp' | 'comp' | 'custom'): string {
  const header = `#version 300 es
precision highp float;

// VisualSynth uniforms
uniform float uTime;
uniform float uFrame;
uniform float uFps;
uniform float uRms;

// Audio uniforms
uniform float audioLow;      // bass
uniform float audioLowSmooth; // bass_att
uniform float audioMid;      // mid
uniform float audioMidSmooth; // mid_att
uniform float audioHigh;     // treb
uniform float audioHighSmooth; // treb_att

// Screen uniforms
uniform float uAspectX;
uniform float uAspectY;
uniform vec2 uAspect;
uniform vec2 uTexSize;

// Random values
uniform vec2 uRandomPreset;
uniform vec2 uRandomFrame;

// Input from vertex shader
in vec2 vUv;
in float vRadius;
in float vAngle;

// Output
out vec4 fragColor;

// Textures
uniform sampler2D sampler_main;
uniform sampler2D sampler_noise_lq;
uniform sampler2D sampler_noise_mq;
uniform sampler2D sampler_noise_hq;
uniform sampler2D sampler_blur1;
uniform sampler2D sampler_blur2;
uniform sampler2D sampler_blur3;

// Helper functions
float clamp01(float x) { return clamp(x, 0.0, 1.0); }
vec2 clamp01(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }
vec3 clamp01(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }
vec4 clamp01(vec4 x) { return clamp(x, vec4(0.0), vec4(1.0)); }

// Texture helper functions
vec4 GetPixel(vec2 uv) { return texture(sampler_main, uv); }
vec4 GetBlur1(vec2 uv) { return texture(sampler_blur1, uv); }
vec4 GetBlur2(vec2 uv) { return texture(sampler_blur2, uv); }
vec4 GetBlur3(vec2 uv) { return texture(sampler_blur3, uv); }

`;
  return header;
}

/**
 * Generate shader body wrapper
 */
function wrapShaderBody(code: string, shaderType: 'warp' | 'comp' | 'custom'): string {
  const processedCode = processShaderBody(code);

  // Check if the code already has a main function
  if (processedCode.includes('void main(')) {
    return processedCode;
  }

  // Check if the code has shader_body
  if (processedCode.includes('shader_body')) {
    // Extract shader_body contents
    const bodyMatch = processedCode.match(/shader_body\s*\{([\s\S]*)\}/);
    if (bodyMatch) {
      const bodyCode = bodyMatch[1];
      return `
void main() {
  vec4 ret = vec4(0.0);
  vec2 uv = vUv;
  float rad = vRadius;
  ${bodyCode}
  fragColor = ret;
}`;
    }
  }

  // Wrap in main function
  return `
void main() {
  vec4 ret = vec4(0.0);
  vec2 uv = vUv;
  float rad = vRadius;
  ${processedCode}
  fragColor = ret;
}`;
}

/**
 * Transpile HLSL shader code to GLSL
 */
export function hlslToGlsl(
  hlslCode: string,
  options: TranspilerOptions = {}
): string {
  const {
    mapUniforms = true,
    wrapInShader = true,
    shaderType = 'custom'
  } = options;

  let glslCode = hlslCode;

  // Process the shader body
  glslCode = processShaderBody(glslCode);

  if (wrapInShader) {
    const header = generateGLSLHeader(shaderType);
    const body = wrapShaderBody(glslCode, shaderType);
    glslCode = header + body;
  }

  return glslCode;
}

/**
 * Transpile a complete MilkDrop shader (warp or comp)
 */
export function transpileMilkDropShader(
  shaderCode: string,
  shaderType: 'warp' | 'comp'
): { glsl: string; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for unsupported features
  if (shaderCode.includes('sampler3D')) {
    warnings.push('3D textures are not fully supported in WebGL2');
  }

  if (shaderCode.includes('ComputeShader') || shaderCode.includes('RWTexture')) {
    errors.push('Compute shaders are not supported in WebGL2');
  }

  // Check for common HLSL features that need special handling
  if (shaderCode.includes('static const')) {
    warnings.push('Static constants converted to const');
  }

  // Convert shader
  const glsl = hlslToGlsl(shaderCode, {
    mapUniforms: true,
    wrapInShader: true,
    shaderType
  });

  return { glsl, warnings, errors };
}

/**
 * Generate category based on preset characteristics
 * Uses existing VisualSynth categories where possible
 */
export function inferPresetCategory(presetName: string, shaderCode: string): string {
  const nameLower = presetName.toLowerCase();
  const codeLower = shaderCode.toLowerCase();
  const combined = nameLower + ' ' + codeLower;

  // Atmosphere & Terrain - weather, landscape, environmental
  if (combined.includes('terrain') || combined.includes('landscape') ||
      combined.includes('atmosphere') || combined.includes('weather') ||
      combined.includes('storm') || combined.includes('cloud') ||
      combined.includes('rain') || combined.includes('fog') ||
      combined.includes('mist') || combined.includes('hurricane') ||
      combined.includes('tornado') || combined.includes('earthquake')) {
    return 'Atmosphere & Terrain';
  }

  // Space - cosmic, stars, nebulae
  if (combined.includes('cosmic') || combined.includes('space') ||
      combined.includes('nebula') || combined.includes('star') ||
      combined.includes('galaxy') || combined.includes('universe') ||
      combined.includes('planet') || combined.includes('orbit') ||
      combined.includes('asteroid') || combined.includes('solar') ||
      combined.includes('lunar') || combined.includes('moon')) {
    return 'Space';
  }

  // Audio Reactive - beat, spectrum, waveform
  if (combined.includes('audio') || combined.includes('spectrum') ||
      combined.includes('wave') || combined.includes('beat') ||
      combined.includes('bass') || combined.includes('treb') ||
      combined.includes('frequency') || combined.includes('sound') ||
      combined.includes('music') || combined.includes('rhythm')) {
    return 'Audio Reactive';
  }

  // Organic - fluid, plasma, natural forms
  if (combined.includes('plasma') || combined.includes('fluid') ||
      combined.includes('liquid') || combined.includes('flow') ||
      combined.includes('organic') || combined.includes('cell') ||
      combined.includes('bio') || combined.includes('life') ||
      combined.includes('growth') || combined.includes('nature') ||
      combined.includes('water') || combined.includes('blood') ||
      combined.includes('vein') || combined.includes('crystall')) {
    return 'Organic';
  }

  // Geometry - shapes, patterns, mathematical
  if (combined.includes('sdf') || combined.includes('geometry') ||
      combined.includes('shape') || combined.includes('fractal') ||
      combined.includes('polygon') || combined.includes('hexagon') ||
      combined.includes('circle') || combined.includes('spiral') ||
      combined.includes('mandala') || combined.includes('kaleido') ||
      combined.includes('tile') || combined.includes('grid')) {
    return 'Geometry';
  }

  // Abstract - tunnels, warps, portals
  if (combined.includes('tunnel') || combined.includes('warp') ||
      combined.includes('portal') || combined.includes('wormhole') ||
      combined.includes('abstract') || combined.includes('neon') ||
      combined.includes('cyber') || combined.includes('synth') ||
      combined.includes('vortex') || combined.includes('spin') ||
      combined.includes('twist') || combined.includes('morph')) {
    return 'Abstract';
  }

  // Hydro & Pyro - water, fire, effects
  if (combined.includes('water') || combined.includes('fire') ||
      combined.includes('flame') || combined.includes('ocean') ||
      combined.includes('sea') || combined.includes('wave') ||
      combined.includes('splash') || combined.includes('ember') ||
      combined.includes('burn') || combined.includes('sunken')) {
    return 'Hydro & Pyro';
  }

  // Particles - particle systems
  if (combined.includes('particle') || combined.includes('swarm') ||
      combined.includes('flock') || combined.includes('dust') ||
      combined.includes('spark') || combined.includes('firefly')) {
    return 'Particles';
  }

  // Cinema - cinematic, film-like
  if (combined.includes('film') || combined.includes('cinema') ||
      combined.includes('movie') || combined.includes('vintage') ||
      combined.includes('vhs') || combined.includes('retro') ||
      combined.includes('classic')) {
    return 'Cinema';
  }

  // Immersion - immersive experiences
  if (combined.includes('immersive') || combined.includes('depth') ||
      combined.includes('underwater') || combined.includes('cave') ||
      combined.includes('abyss') || combined.includes('void')) {
    return 'Immersion';
  }

  // DNA - DNA-style visualizations
  if (combined.includes('dna') || combined.includes('helix') ||
      combined.includes('strand') || combined.includes('genetic')) {
    return 'DNA';
  }

  // Goth - dark, gothic themes
  if (combined.includes('goth') || combined.includes('dark') ||
      combined.includes('crypt') || combined.includes('vampire') ||
      combined.includes('blood') || combined.includes('horror') ||
      combined.includes('halloween') || combined.includes('nightmare')) {
    return 'Goth Generators';
  }

  // Retro Game - 8-bit, arcade
  if (combined.includes('8bit') || combined.includes('8-bit') ||
      combined.includes('pixel') || combined.includes('arcade') ||
      combined.includes('game') || combined.includes('chiptune') ||
      combined.includes('retro') || combined.includes('score')) {
    return 'Retro Game Generators';
  }

  // Generators - default for generators
  if (combined.includes('generator') || combined.includes('gen')) {
    return 'Generators';
  }

  // Default to Imported for Milkwave presets
  return 'Imported';
}

/**
 * Determine layer roles based on preset characteristics
 * Returns core, support, and atmosphere layer assignments
 */
export function inferLayerRoles(presetData: {
  name: string;
  hasWarpShader: boolean;
  hasCompShader: boolean;
  hasPerPixelCode: boolean;
  hasPerFrameCode: boolean;
}): { core: string[]; support: string[]; atmosphere: string[] } {
  const { name, hasWarpShader, hasCompShader, hasPerPixelCode, hasPerFrameCode } = presetData;

  // For now, all Milkwave imports use a single layer with gen-milkwave generator
  // The warp shader is the core visual, comp shader is post-processing

  const core: string[] = ['layer-milkwave'];
  const support: string[] = [];
  const atmosphere: string[] = [];

  // If there's significant per-frame code, it likely affects core dynamics
  if (hasPerFrameCode && !hasWarpShader) {
    core.push('layer-milkwave-effects');
  }

  return { core, support, atmosphere };
}