/**
 * Dynamic Generator Uniform Resolver
 *
 * Replaces hundreds of hand-wired getLayerParamNumber → renderState → gl.uniform1f lines
 * with a single data-driven pipeline.
 *
 * Flow:
 *   1. Parse uniform prefix from each shader block's `Enabled` uniform
 *   2. For each scene layer, look up its generator's params from the registry
 *   3. Resolve param values: base → modValue → midi overlay
 *   4. Write to a flat Record<string, number> keyed by uniform name (without 'u' prefix)
 *   5. glRenderer iterates the record and calls gl.uniform1f for each entry
 */

import { GENERATOR_SHADER_BLOCKS, GeneratorShaderBlock } from './generatorShaderBlocks';
import { getLayerType, type ParamDef } from './parameterRegistry';

// ---------------------------------------------------------------------------
// 1. Uniform prefix extraction
// ---------------------------------------------------------------------------

export interface GenUniformMeta {
  /** Generator id, e.g. 'gen-laser-beam' */
  genId: string;
  /** Uniform prefix extracted from the Enabled uniform, e.g. 'Laser' */
  prefix: string;
  /** All parsed uniform names from the block (without 'u' prefix) */
  uniformNames: string[];
}

const PREFIX_CACHE = new Map<string, GenUniformMeta>();
const LAYER_ID_ALIASES: Record<string, string[]> = {
  'gen-milkwave': ['layer-milkwave', 'layer-milkwave-effects'],
  'gen-8bit-grid': ['gen-eight-bit-grid']
};
const META_OVERRIDES: Record<string, GenUniformMeta> = {
  'gen-strobe': {
    genId: 'gen-strobe',
    prefix: 'Strobe',
    uniformNames: [
      'StrobeEnabled',
      'StrobeOpacity',
      'StrobeRate',
      'StrobeDutyCycle',
      'StrobeMode',
      'StrobeAudioTrigger',
      'StrobeThreshold',
      'StrobeFadeOut',
      'StrobePattern'
    ]
  }
};

/** Parse `uniform float uFooEnabled;` → prefix 'Foo' */
const extractPrefix = (uniforms: string): string | null => {
  const match = uniforms.match(/uniform\s+float\s+u(\w+?)Enabled\s*;/);
  return match ? match[1] : null;
};

/** Parse all `uniform float uXxx;` names from a block */
const extractUniformNames = (uniforms: string): string[] => {
  const names: string[] = [];
  const re = /uniform\s+(?:float|int|vec[234]|sampler2D)\s+u(\w+)\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(uniforms)) !== null) {
    names.push(m[1]);
  }
  return names;
};

/** Build and cache GenUniformMeta for every shader block */
export const buildGenUniformMeta = (): Map<string, GenUniformMeta> => {
  if (PREFIX_CACHE.size > 0) return PREFIX_CACHE;
  for (const block of GENERATOR_SHADER_BLOCKS) {
    const prefix = extractPrefix(block.uniforms);
    if (!prefix) {
      const override = META_OVERRIDES[block.id];
      if (override) {
        PREFIX_CACHE.set(block.id, override);
      }
      continue;
    }
    PREFIX_CACHE.set(block.id, {
      genId: block.id,
      prefix,
      uniformNames: extractUniformNames(block.uniforms),
    });
  }
  return PREFIX_CACHE;
};

// ---------------------------------------------------------------------------
// 2. Param → Uniform name mapping
// ---------------------------------------------------------------------------

/**
 * Convert a param id to its uniform name (without 'u' prefix).
 * E.g. prefix='Laser', param='beamCount' → 'LaserBeamCount'
 */
const paramToUniformName = (prefix: string, paramId: string): string =>
  prefix + paramId.charAt(0).toUpperCase() + paramId.slice(1);

// ---------------------------------------------------------------------------
// 3. Layer types that use the gen-* pipeline (skip legacy layer-* types)
// ---------------------------------------------------------------------------

/** IDs that start with 'gen-' or 'layer-' prefixed generators that have shader blocks */
const isGenLayer = (generatorId: string): boolean =>
  PREFIX_CACHE.has(generatorId) || PREFIX_CACHE.has(`gen-${generatorId}`);

const resolveBlockId = (generatorId: string): string | null => {
  if (PREFIX_CACHE.has(generatorId)) return generatorId;
  const withPrefix = `gen-${generatorId}`;
  if (PREFIX_CACHE.has(withPrefix)) return withPrefix;
  return null;
};

// ---------------------------------------------------------------------------
// 4. Main resolver: scene layers → genUniforms dict
// ---------------------------------------------------------------------------

export interface ResolverDeps {
  /** All layers in the active scene */
  layers: any[];
  /** modValue(target, base) applies mod matrix */
  modValue: (target: string, base: number) => number;
  /** MIDI sum record, keyed by legacy target id e.g. 'gen-laser-beam.opacity' */
  midiSum: Record<string, number>;
  /** Macro sum record, keyed by legacy target id e.g. 'layer-laser-beam.opacity' */
  macroSum: Record<string, number>;
  /** Helper to read a numeric param from a layer */
  getLayerParamNumber: (layer: any, param: string, fallback: number) => number;
  /** Helper to find a layer by its generatorId */
  findLayerById: (layers: any[] | undefined, genId: string) => any | undefined;
  /** Build legacy mod target string: e.g. (layerType, param) → 'layer-laser-beam.opacity' */
  buildLegacyTarget: (layerType: string, param: string) => string;
  /** Role weight multipliers — applied to opacity for each layer's role */
  roleWeights: { core: number; support: number; atmosphere: number };
}

/**
 * Resolve all gen-* layer params into a flat uniform dictionary.
 * Returns Record<string, number> keyed by uniform name WITHOUT the 'u' prefix.
 * E.g. { LaserEnabled: 1, LaserOpacity: 0.8, LaserBeamCount: 4, ... }
 */
export const resolveGenUniforms = (deps: ResolverDeps): Record<string, number> => {
  const meta = buildGenUniformMeta();
  const result: Record<string, number> = {};

  for (const [blockId, genMeta] of meta) {
    const { prefix } = genMeta;

    // Find the layer in the scene, including legacy aliases such as imported Milkwave ids.
    const layer =
      deps.findLayerById(deps.layers, blockId) ??
      LAYER_ID_ALIASES[blockId]?.reduce<any | undefined>(
        (match, alias) => match ?? deps.findLayerById(deps.layers, alias),
        undefined
      );

    // Enabled flag (always set, even if layer not present)
    result[`${prefix}Enabled`] = (layer?.enabled ?? false) ? 1 : 0;

    // Look up the param registry for this generator
    const layerType = getLayerType(blockId);
    if (!layerType) {
      // No registry entry — just set enabled and skip
      continue;
    }

    // Build legacy prefix for mod targets (e.g. 'layer-laser-beam')
    const legacyPrefix = deps.buildLegacyTarget(layerType.id, '').replace(/\.$/, '');

    for (const param of layerType.params) {
      if (param.type !== 'number' && param.type !== 'boolean' && param.type !== 'enum') continue;

      const uniformName = paramToUniformName(prefix, param.id);
      const baseValue = deps.getLayerParamNumber(layer, param.id, param.default ?? 0);

      // Opacity gets multiplied by layer.opacity and role weight
      let value: number;
      if (
        param.id === 'opacity' &&
        blockId === 'gen-milkwave' &&
        typeof layer?.id === 'string' &&
        LAYER_ID_ALIASES[blockId]?.includes(layer.id)
      ) {
        value = layer?.opacity ?? baseValue;
      } else if (param.id === 'opacity') {
        const layerOpacity = layer?.opacity ?? 1;
        const role: string = layer?.role ?? 'support';
        const rw = deps.roleWeights ?? { core: 1, support: 1, atmosphere: 1 };
        const roleWeight = role === 'core' ? rw.core : role === 'atmosphere' ? rw.atmosphere : rw.support;
        value = layerOpacity * baseValue * roleWeight;
      } else {
        value = baseValue;
      }

      // Apply mod matrix for modulatable params (skip enums/modes)
      if (param.modulatable) {
        const modTarget = `${legacyPrefix}.${param.id}`;
        value = deps.modValue(modTarget, value);
      }

      // Apply MIDI sum. resolveMidiMappedValue returns an ABSOLUTE value: 0/1 for
      // booleans, the enum index for enums, and a value scaled to [min,max] for
      // numbers. Opacity multiplies; numbers add (existing offset design shared
      // with the macro path below); but booleans/enums must REPLACE — adding an
      // absolute 0/1 or index to the base meant a boolean whose base was 1
      // stayed 1 even when MIDI sent 0 (MIDI could never turn it off), and an
      // enum's base+offset selected the wrong option.
      const midiKey = `${blockId}.${param.id}`;
      const midiVal = deps.midiSum[midiKey];
      if (midiVal != null) {
        if (param.id === 'opacity') {
          value *= midiVal;
        } else if (param.type === 'boolean' || param.type === 'enum') {
          value = midiVal;
        } else {
          value += midiVal;
        }
      }

      // Apply macro sum (opacity: multiplicative via (1 + macroVal), others: additive)
      const macroKey = `${legacyPrefix}.${param.id}`;
      const macroVal = deps.macroSum[macroKey];
      if (macroVal != null && macroVal !== 0) {
        if (param.id === 'opacity') {
          value *= (1 + macroVal);
        } else {
          value += macroVal;
        }
      }

      result[uniformName] = value;
    }
  }

  return result;
};
