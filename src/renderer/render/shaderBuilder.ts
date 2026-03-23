import type { GeneratorShaderBlock } from '../../shared/generatorShaderBlocks';
import type { CustomShaderBlock } from '../../shared/customShaderBlock';

export type { GeneratorShaderBlock };

/**
 * Merges custom shader blocks with the built-in registry.
 * Custom blocks with the same id override the corresponding built-in block.
 * Custom blocks with new ids are appended to the end.
 */
export const mergeShaderBlocks = (
  builtIn: GeneratorShaderBlock[],
  custom: CustomShaderBlock[]
): GeneratorShaderBlock[] => {
  if (!custom.length) return builtIn;
  const overrides = new Map(custom.map(b => [b.id, b as GeneratorShaderBlock]));
  const merged = builtIn.map(b => overrides.get(b.id) ?? b);
  custom.filter(b => !builtIn.some(bi => bi.id === b.id)).forEach(b => merged.push(b as GeneratorShaderBlock));
  return merged;
};

export interface ShaderParts {
  /**
   * Static preamble: version directive, precision, non-generator uniforms, utility functions.
   * Must contain the placeholder comment "/* @@GENERATOR_UNIFORMS *\/" where generator
   * uniform declarations will be injected.
   * Must contain the placeholder comment "/* @@GENERATOR_FUNCTIONS *\/" where generator
   * function bodies will be injected (if absent, functions are appended after preamble).
   */
  preamble: string;
  /**
   * The main() function body template.
   * Must contain the placeholder comment "/* @@GENERATOR_CALLS *\/" where conditional
   * generator invocations will be injected.
   */
  mainTemplate: string;
}

/**
 * Builds a complete fragment shader source string containing only the specified generators.
 * Pure function — no side effects, no WebGL calls.
 */
export const buildFragmentShader = (
  parts: ShaderParts,
  blocks: GeneratorShaderBlock[],
  activeIds: Set<string>,
  sdfUniforms = '',
  sdfFunctions = '',
  sdfMapBody = '10.0',
  plasmaSource: string | null = null,
  fxUniforms = ''
): string => {
  const activeBlocks = blocks.filter(b => activeIds.has(b.id));

  const generatorUniforms = activeBlocks.map(b => b.uniforms).join('');
  const generatorFunctions = activeBlocks.map(b => b.functions).join('');
  const generatorCalls = activeBlocks.map(b => b.mainCall).join('');

  const allFunctions = generatorFunctions + sdfFunctions;

  const preambleWithFx = parts.preamble
    .replace('/* @@FX_UNIFORMS */', fxUniforms);

  const preambleWithUniforms = preambleWithFx
    .replace('/* @@GENERATOR_UNIFORMS */', generatorUniforms + sdfUniforms);

  // If preamble has a functions placeholder, inject there; otherwise prepend to main
  const hasFunctionsPlaceholder = preambleWithUniforms.includes('/* @@GENERATOR_FUNCTIONS */');
  const preambleWithFunctions = hasFunctionsPlaceholder
    ? preambleWithUniforms.replace('/* @@GENERATOR_FUNCTIONS */', allFunctions)
    : preambleWithUniforms;

  const functionPrefix = hasFunctionsPlaceholder ? '' : allFunctions;

  const preamble = preambleWithFunctions
    .replace('/* @@SDF_MAP_BODY */', sdfMapBody);

  const main = parts.mainTemplate
    .replace('/* @@PLASMA_DEFINE */', plasmaSource ? '#define HAS_CUSTOM_PLASMA' : '')
    .replace('/* @@PLASMA_SOURCE */', plasmaSource ?? '')
    .replace('/* @@GENERATOR_CALLS */', generatorCalls);

  return preamble + functionPrefix + main;
};

/**
 * Produces a canonical, order-independent cache key for a compiled shader variant.
 */
export const shaderCacheKey = (
  activeIds: Set<string>,
  sdfMapBody: string,
  plasmaSource: string | null,
  customHash = ''
): string =>
  [...activeIds].sort().join(',') + '|' + sdfMapBody + '|' + (plasmaSource ?? '') + '|' + customHash;
