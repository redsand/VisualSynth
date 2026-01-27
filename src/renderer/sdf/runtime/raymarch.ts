/**
 * SDF Raymarcher
 *
 * 3D raymarching implementation with lighting, ambient occlusion,
 * soft shadows, and fog support.
 */

// ============================================================================
// Raymarch Configuration
// ============================================================================

export interface RaymarchConfig {
  maxSteps: number;
  epsilon: number;
  maxDistance: number;
  normalEpsilon: number;
}

export interface LightingConfig {
  ambient: [number, number, number];
  diffuseColor: [number, number, number];
  specularColor: [number, number, number];
  shininess: number;
  lightDir: [number, number, number];
  lightIntensity: number;
}

export interface ShadowConfig {
  enabled: boolean;
  softness: number;
  minDistance: number;
  maxDistance: number;
  hardness: number;
}

export interface AmbientOcclusionConfig {
  enabled: boolean;
  steps: number;
  stepSize: number;
  intensity: number;
}

export interface FogConfig {
  enabled: boolean;
  density: number;
  color: [number, number, number];
  startDistance: number;
}

export interface Raymarch3DConfig {
  raymarch: RaymarchConfig;
  lighting: LightingConfig;
  shadows: ShadowConfig;
  ao: AmbientOcclusionConfig;
  fog: FogConfig;
  backgroundColor: [number, number, number];
}

// ============================================================================
// Default Configurations
// ============================================================================

export const defaultRaymarchConfig: RaymarchConfig = {
  maxSteps: 128,
  epsilon: 0.001,
  maxDistance: 100.0,
  normalEpsilon: 0.0005
};

export const defaultLightingConfig: LightingConfig = {
  ambient: [0.1, 0.1, 0.15],
  diffuseColor: [1.0, 0.95, 0.9],
  specularColor: [1.0, 1.0, 1.0],
  shininess: 32.0,
  lightDir: [0.577, 0.577, 0.577], // Normalized (1,1,1)
  lightIntensity: 1.0
};

export const defaultShadowConfig: ShadowConfig = {
  enabled: true,
  softness: 16.0,
  minDistance: 0.01,
  maxDistance: 50.0,
  hardness: 8.0
};

export const defaultAOConfig: AmbientOcclusionConfig = {
  enabled: true,
  steps: 5,
  stepSize: 0.1,
  intensity: 0.5
};

export const defaultFogConfig: FogConfig = {
  enabled: false,
  density: 0.02,
  color: [0.5, 0.6, 0.7],
  startDistance: 10.0
};

export const default3DConfig: Raymarch3DConfig = {
  raymarch: defaultRaymarchConfig,
  lighting: defaultLightingConfig,
  shadows: defaultShadowConfig,
  ao: defaultAOConfig,
  fog: defaultFogConfig,
  backgroundColor: [0.05, 0.05, 0.08]
};

// ============================================================================
// GLSL Code Generation
// ============================================================================

export const generateRaymarchUniforms = (config: Raymarch3DConfig): string => `
// Raymarch uniforms
uniform int uMaxSteps;
uniform float uEpsilon;
uniform float uMaxDistance;
uniform float uNormalEpsilon;

// Lighting uniforms
uniform vec3 uAmbient;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;
uniform float uShininess;
uniform vec3 uLightDir;
uniform float uLightIntensity;

// Shadow uniforms
uniform bool uShadowsEnabled;
uniform float uShadowSoftness;
uniform float uShadowMinDist;
uniform float uShadowMaxDist;
uniform float uShadowHardness;

// AO uniforms
uniform bool uAOEnabled;
uniform int uAOSteps;
uniform float uAOStepSize;
uniform float uAOIntensity;

// Fog uniforms
uniform bool uFogEnabled;
uniform float uFogDensity;
uniform vec3 uFogColor;
uniform float uFogStart;

// Background
uniform vec3 uBackgroundColor;
`;

export const generateRaymarchFunctions = (): string => `
// ============================================================================
// Raymarch Core Functions
// ============================================================================

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(uNormalEpsilon, 0.0);
  return normalize(vec3(
    sdfScene3D(p + e.xyy) - sdfScene3D(p - e.xyy),
    sdfScene3D(p + e.yxy) - sdfScene3D(p - e.yxy),
    sdfScene3D(p + e.yyx) - sdfScene3D(p - e.yyx)
  ));
}

float raymarch(vec3 ro, vec3 rd, out int steps) {
  float t = 0.0;
  steps = 0;

  for (int i = 0; i < 256; i++) {
    if (i >= uMaxSteps) break;
    steps = i;

    vec3 p = ro + rd * t;
    float d = sdfScene3D(p);

    if (d < uEpsilon) return t;
    if (t > uMaxDistance) break;

    t += d;
  }

  return -1.0;
}

// ============================================================================
// Soft Shadows
// ============================================================================

float softShadow(vec3 ro, vec3 rd) {
  if (!uShadowsEnabled) return 1.0;

  float res = 1.0;
  float t = uShadowMinDist;
  float ph = 1e10;

  for (int i = 0; i < 64; i++) {
    if (t > uShadowMaxDist) break;

    vec3 p = ro + rd * t;
    float h = sdfScene3D(p);

    if (h < uEpsilon * 0.5) return 0.0;

    // Improved soft shadow
    float y = h * h / (2.0 * ph);
    float d = sqrt(h * h - y * y);
    res = min(res, uShadowSoftness * d / max(0.0, t - y));

    ph = h;
    t += h * 0.5;
  }

  return clamp(res, 0.0, 1.0);
}

// ============================================================================
// Ambient Occlusion
// ============================================================================

float ambientOcclusion(vec3 p, vec3 n) {
  if (!uAOEnabled) return 1.0;

  float occ = 0.0;
  float scale = 1.0;

  for (int i = 0; i < 8; i++) {
    if (i >= uAOSteps) break;

    float h = uAOStepSize * float(i + 1);
    float d = sdfScene3D(p + n * h);
    occ += (h - d) * scale;
    scale *= 0.5;
  }

  return clamp(1.0 - uAOIntensity * occ, 0.0, 1.0);
}

// ============================================================================
// Fog
// ============================================================================

vec3 applyFog(vec3 col, float t) {
  if (!uFogEnabled) return col;

  float fogAmount = 1.0 - exp(-uFogDensity * max(0.0, t - uFogStart));
  return mix(col, uFogColor, fogAmount);
}

// ============================================================================
// Lighting
// ============================================================================

vec3 shade(vec3 p, vec3 n, vec3 rd) {
  vec3 l = normalize(uLightDir);
  vec3 h = normalize(l - rd);

  // Diffuse
  float diff = max(dot(n, l), 0.0);

  // Specular (Blinn-Phong)
  float spec = pow(max(dot(n, h), 0.0), uShininess);

  // Shadows
  float shadow = softShadow(p + n * uEpsilon * 2.0, l);

  // AO
  float ao = ambientOcclusion(p, n);

  // Combine
  vec3 ambient = uAmbient * ao;
  vec3 diffuse = uDiffuseColor * diff * shadow * uLightIntensity;
  vec3 specular = uSpecularColor * spec * shadow * uLightIntensity;

  return ambient + diffuse + specular;
}

// ============================================================================
// Main Render
// ============================================================================

vec3 render3D(vec3 ro, vec3 rd) {
  int steps;
  float t = raymarch(ro, rd, steps);

  if (t < 0.0) {
    return uBackgroundColor;
  }

  vec3 p = ro + rd * t;
  vec3 n = calcNormal(p);

  // Base material color (can be extended for material system)
  vec3 matColor = vec3(0.8, 0.8, 0.85);

  // Apply lighting
  vec3 col = matColor * shade(p, n, rd);

  // Apply fog
  col = applyFog(col, t);

  return col;
}
`;

export const generateCameraSetup = (): string => `
// ============================================================================
// Camera
// ============================================================================

uniform vec3 uCameraPos;
uniform vec3 uCameraTarget;
uniform float uCameraFov;

mat3 setCamera(vec3 ro, vec3 ta, float cr) {
  vec3 cw = normalize(ta - ro);
  vec3 cp = vec3(sin(cr), cos(cr), 0.0);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = normalize(cross(cu, cw));
  return mat3(cu, cv, cw);
}

vec3 getRayDirection(vec2 uv, vec3 ro, vec3 ta, float fov) {
  mat3 ca = setCamera(ro, ta, 0.0);
  return ca * normalize(vec3(uv, fov));
}
`;

// ============================================================================
// Full 3D Fragment Shader Template
// ============================================================================

export const generate3DFragmentShader = (
  sdfSceneCode: string,
  config: Raymarch3DConfig
): string => `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform float uTime;
uniform vec2 uResolution;
uniform float uAspect;

${generateRaymarchUniforms(config)}
${generateCameraSetup()}

// SDF Scene function (generated)
${sdfSceneCode}

${generateRaymarchFunctions()}

void main() {
  // Centered UV with aspect correction
  vec2 uv = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0);

  // Camera setup
  vec3 ro = uCameraPos;
  vec3 rd = getRayDirection(uv, ro, uCameraTarget, uCameraFov);

  // Render
  vec3 col = render3D(ro, rd);

  // Gamma correction
  col = pow(col, vec3(0.4545));

  outColor = vec4(col, 1.0);
}
`;

// ============================================================================
// Uniform Setters
// ============================================================================

export interface Raymarch3DUniforms {
  setRaymarchConfig: (config: RaymarchConfig) => void;
  setLightingConfig: (config: LightingConfig) => void;
  setShadowConfig: (config: ShadowConfig) => void;
  setAOConfig: (config: AmbientOcclusionConfig) => void;
  setFogConfig: (config: FogConfig) => void;
  setBackgroundColor: (color: [number, number, number]) => void;
  setCameraPosition: (pos: [number, number, number]) => void;
  setCameraTarget: (target: [number, number, number]) => void;
  setCameraFov: (fov: number) => void;
}

export const createUniformSetters = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram
): Raymarch3DUniforms => {
  const getLocation = (name: string) => gl.getUniformLocation(program, name);

  return {
    setRaymarchConfig: (config: RaymarchConfig) => {
      gl.uniform1i(getLocation('uMaxSteps'), config.maxSteps);
      gl.uniform1f(getLocation('uEpsilon'), config.epsilon);
      gl.uniform1f(getLocation('uMaxDistance'), config.maxDistance);
      gl.uniform1f(getLocation('uNormalEpsilon'), config.normalEpsilon);
    },

    setLightingConfig: (config: LightingConfig) => {
      gl.uniform3fv(getLocation('uAmbient'), config.ambient);
      gl.uniform3fv(getLocation('uDiffuseColor'), config.diffuseColor);
      gl.uniform3fv(getLocation('uSpecularColor'), config.specularColor);
      gl.uniform1f(getLocation('uShininess'), config.shininess);
      gl.uniform3fv(getLocation('uLightDir'), config.lightDir);
      gl.uniform1f(getLocation('uLightIntensity'), config.lightIntensity);
    },

    setShadowConfig: (config: ShadowConfig) => {
      gl.uniform1i(getLocation('uShadowsEnabled'), config.enabled ? 1 : 0);
      gl.uniform1f(getLocation('uShadowSoftness'), config.softness);
      gl.uniform1f(getLocation('uShadowMinDist'), config.minDistance);
      gl.uniform1f(getLocation('uShadowMaxDist'), config.maxDistance);
      gl.uniform1f(getLocation('uShadowHardness'), config.hardness);
    },

    setAOConfig: (config: AmbientOcclusionConfig) => {
      gl.uniform1i(getLocation('uAOEnabled'), config.enabled ? 1 : 0);
      gl.uniform1i(getLocation('uAOSteps'), config.steps);
      gl.uniform1f(getLocation('uAOStepSize'), config.stepSize);
      gl.uniform1f(getLocation('uAOIntensity'), config.intensity);
    },

    setFogConfig: (config: FogConfig) => {
      gl.uniform1i(getLocation('uFogEnabled'), config.enabled ? 1 : 0);
      gl.uniform1f(getLocation('uFogDensity'), config.density);
      gl.uniform3fv(getLocation('uFogColor'), config.color);
      gl.uniform1f(getLocation('uFogStart'), config.startDistance);
    },

    setBackgroundColor: (color: [number, number, number]) => {
      gl.uniform3fv(getLocation('uBackgroundColor'), color);
    },

    setCameraPosition: (pos: [number, number, number]) => {
      gl.uniform3fv(getLocation('uCameraPos'), pos);
    },

    setCameraTarget: (target: [number, number, number]) => {
      gl.uniform3fv(getLocation('uCameraTarget'), target);
    },

    setCameraFov: (fov: number) => {
      gl.uniform1f(getLocation('uCameraFov'), fov);
    }
  };
};

// ============================================================================
// Adaptive Quality
// ============================================================================

export interface AdaptiveQualityState {
  currentSteps: number;
  targetFps: number;
  fpsHistory: number[];
  lastAdjustTime: number;
}

export const createAdaptiveQuality = (
  config: RaymarchConfig,
  targetFps = 60
): AdaptiveQualityState => ({
  currentSteps: config.maxSteps,
  targetFps,
  fpsHistory: [],
  lastAdjustTime: 0
});

export const updateAdaptiveQuality = (
  state: AdaptiveQualityState,
  currentFps: number,
  minSteps = 32,
  maxSteps = 256
): number => {
  const now = performance.now();

  // Track FPS history
  state.fpsHistory.push(currentFps);
  if (state.fpsHistory.length > 30) {
    state.fpsHistory.shift();
  }

  // Adjust every 500ms
  if (now - state.lastAdjustTime < 500) {
    return state.currentSteps;
  }

  state.lastAdjustTime = now;

  // Calculate average FPS
  const avgFps = state.fpsHistory.reduce((a, b) => a + b, 0) / state.fpsHistory.length;

  // Adjust steps based on FPS
  if (avgFps < state.targetFps * 0.9) {
    // Too slow, reduce quality
    state.currentSteps = Math.max(minSteps, Math.floor(state.currentSteps * 0.8));
  } else if (avgFps > state.targetFps * 1.1 && state.currentSteps < maxSteps) {
    // Room to increase quality
    state.currentSteps = Math.min(maxSteps, Math.floor(state.currentSteps * 1.1));
  }

  return state.currentSteps;
};

// ============================================================================
// Cost Estimation
// ============================================================================

export const estimateRaymarchCost = (
  config: Raymarch3DConfig,
  sdfComplexity: number
): number => {
  let cost = 0;

  // Base raymarch cost
  cost += config.raymarch.maxSteps * 0.01 * sdfComplexity;

  // Shadow cost (raymarch again)
  if (config.shadows.enabled) {
    cost += 64 * 0.005 * sdfComplexity;
  }

  // AO cost (multiple SDF evaluations)
  if (config.ao.enabled) {
    cost += config.ao.steps * 0.01 * sdfComplexity;
  }

  return cost;
};
