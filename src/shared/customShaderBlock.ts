/**
 * Describes a single parameter exposed by a custom shader block.
 * The UI uses this to render sliders/controls automatically.
 */
export interface CustomShaderParamDef {
  /** GLSL uniform name (e.g. "uMySpeed") */
  uniform: string;
  /** GLSL type */
  type: 'float' | 'vec2' | 'vec3';
  min?: number;
  max?: number;
  /** Default value(s) — single number for float, array for vec2/vec3 */
  default: number | number[];
  /** Display label for the UI */
  label?: string;
}

/**
 * A custom shader generator block that can be embedded in a preset file.
 * Custom blocks extend or override the built-in GENERATOR_SHADER_BLOCKS.
 * If `id` matches a built-in generator id, it overrides that generator's GLSL.
 * If `id` is new, it registers a completely new generator for this project.
 */
export interface CustomShaderBlock {
  /** Unique generator ID. Can shadow a built-in ID to override it. */
  id: string;
  /** Display name shown in the layer panel */
  label: string;
  /** GLSL uniform declarations (must include uXxxEnabled float uniform) */
  uniforms: string;
  /** GLSL helper function definitions (optional) */
  functions?: string;
  /** GLSL code for main(), wrapped in if (uXxxEnabled > 0.5) */
  mainCall: string;
  /** Parameter metadata for UI rendering */
  params: Record<string, CustomShaderParamDef>;
}
