import { toFileUrl } from '../shared/fileUrl';
import type { AssetItem } from '../shared/project';
import type { AssetTextureSampling } from '../shared/assets';

export interface RenderState {
  timeMs: number;
  rms: number;
  peak: number;
  strobe: number;
  plasmaEnabled: boolean;
  spectrumEnabled: boolean;
  spectrum: Float32Array;
  contrast: number;
  saturation: number;
  paletteShift: number;
  plasmaOpacity: number;
  spectrumOpacity: number;
  plasmaAssetBlendMode: number;
  plasmaAssetAudioReact: number;
  spectrumAssetBlendMode: number;
  spectrumAssetAudioReact: number;
  effectsEnabled: boolean;
  bloom: number;
  blur: number;
  chroma: number;
  posterize: number;
  kaleidoscope: number;
  feedback: number;
  persistence: number;
  trailSpectrum: Float32Array;
  particlesEnabled: boolean;
  particleDensity: number;
  particleSpeed: number;
  particleSize: number;
  particleGlow: number;
  sdfEnabled: boolean;
  sdfShape: number;
  sdfScale: number;
  sdfEdge: number;
  sdfGlow: number;
  sdfRotation: number;
  sdfFill: number;
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
uniform float uContrast;
uniform float uSaturation;
uniform float uPaletteShift;
uniform float uPlasmaOpacity;
uniform float uSpectrumOpacity;
uniform float uEffectsEnabled;
uniform float uBloom;
uniform float uBlur;
uniform float uChroma;
uniform float uPosterize;
uniform float uKaleidoscope;
uniform float uFeedback;
uniform float uPersistence;
uniform float uTrailSpectrum[64];
uniform float uParticlesEnabled;
uniform float uParticleDensity;
uniform float uParticleSpeed;
uniform float uParticleSize;
uniform float uParticleGlow;
uniform float uSdfEnabled;
uniform float uSdfShape;
uniform float uSdfScale;
uniform float uSdfEdge;
uniform float uSdfGlow;
uniform float uSdfRotation;
uniform float uSdfFill;
uniform float uPlasmaAssetEnabled;
uniform sampler2D uPlasmaAsset;
uniform float uPlasmaAssetBlend;
uniform float uSpectrumAssetEnabled;
uniform sampler2D uSpectrumAsset;
uniform float uSpectrumAssetBlend;
uniform float uPlasmaAssetAudioReact;
uniform float uSpectrumAssetAudioReact;

in vec2 vUv;
out vec4 outColor;

vec3 blendAdd(vec3 base, vec3 blend) {
  return min(base + blend, 1.0);
}

vec3 blendMultiply(vec3 base, vec3 blend) {
  return base * blend;
}

vec3 blendScreen(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) * (1.0 - blend);
}

vec3 blendOverlay(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend,
    1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
    step(0.5, base)
  );
}

vec3 blendDifference(vec3 base, vec3 blend) {
  return abs(base - blend);
}

vec3 applyBlendMode(vec3 base, vec3 blend, float mode, float opacity) {
  vec3 result;
  if (mode < 0.5) {
    result = blend;
  } else if (mode < 1.5) {
    result = blendAdd(base, blend);
  } else if (mode < 2.5) {
    result = blendMultiply(base, blend);
  } else if (mode < 3.5) {
    result = blendScreen(base, blend);
  } else if (mode < 4.5) {
    result = blendOverlay(base, blend);
  } else {
    result = blendDifference(base, blend);
  }
  return mix(base, result, opacity);
}

float plasma(vec2 uv, float t) {
  float v = sin(uv.x * 8.0 + t) + sin(uv.y * 6.0 - t * 1.1);
  v += sin((uv.x + uv.y) * 4.0 + t * 0.7);
  return v * 0.5 + 0.5;
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float particleField(vec2 uv, float t, float density, float speed, float size) {
  float grid = mix(18.0, 90.0, density);
  vec2 drift = vec2(t * 0.02 * (0.2 + speed), t * 0.015 * (0.2 + speed));
  vec2 gv = uv * grid + drift;
  vec2 cell = floor(gv);
  vec2 f = fract(gv);
  float rnd = hash21(cell);
  vec2 pos = vec2(hash21(cell + 1.3), hash21(cell + 9.1));
  pos = 0.2 + 0.6 * pos;
  float twinkle = 0.4 + 0.6 * sin(t * (1.5 + rnd * 2.5) + rnd * 6.2831);
  float radius = mix(0.05, 0.015, density) * mix(1.4, 0.6, size);
  float d = distance(f, pos);
  float spark = smoothstep(radius, 0.0, d);
  return spark * twinkle;
}

vec2 rotate2d(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdEquilateralTriangle(vec2 p, float r) {
  float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) {
    p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
  }
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

vec3 applySaturation(vec3 color, float amount) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(luma), color, amount);
}

vec3 applyContrast(vec3 color, float amount) {
  return (color - 0.5) * amount + 0.5;
}

vec3 shiftPalette(vec3 color, float shift) {
  float angle = shift * 6.28318;
  mat3 rot = mat3(
    0.299 + 0.701 * cos(angle) + 0.168 * sin(angle), 0.587 - 0.587 * cos(angle) + 0.330 * sin(angle), 0.114 - 0.114 * cos(angle) - 0.497 * sin(angle),
    0.299 - 0.299 * cos(angle) - 0.328 * sin(angle), 0.587 + 0.413 * cos(angle) + 0.035 * sin(angle), 0.114 - 0.114 * cos(angle) + 0.292 * sin(angle),
    0.299 - 0.300 * cos(angle) + 1.250 * sin(angle), 0.587 - 0.588 * cos(angle) - 1.050 * sin(angle), 0.114 + 0.886 * cos(angle) - 0.203 * sin(angle)
  );
  return clamp(rot * color, 0.0, 1.0);
}

vec2 kaleidoscope(vec2 uv, float amount) {
  if (amount <= 0.01) return uv;
  vec2 centered = uv * 2.0 - 1.0;
  float angle = atan(centered.y, centered.x);
  float radius = length(centered);
  float slices = mix(1.0, 8.0, amount);
  float slice = 6.28318 / slices;
  angle = mod(angle, slice);
  angle = abs(angle - slice * 0.5);
  vec2 rotated = vec2(cos(angle), sin(angle)) * radius;
  return rotated * 0.5 + 0.5;
}

vec3 posterize(vec3 color, float amount) {
  if (amount <= 0.01) return color;
  float levels = mix(16.0, 3.0, amount);
  return floor(color * levels) / levels;
}

void main() {
  vec2 uv = vUv;
  vec2 effectUv = kaleidoscope(uv, uKaleidoscope);
  if (uFeedback > 0.01) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float radius = length(centered);
    float twist = uFeedback * 2.0;
    float angle = atan(centered.y, centered.x) + twist * radius * 2.0;
    effectUv = vec2(cos(angle), sin(angle)) * (radius * (1.0 - uFeedback * 0.2)) * 0.5 + 0.5;
  }
  vec3 color = vec3(0.02, 0.04, 0.08);
  if (uPlasmaEnabled > 0.5) {
    float p = plasma(effectUv, uTime);
    color += vec3(0.1 + p * 0.4, 0.2 + p * 0.5, 0.3 + p * 0.6) * uPlasmaOpacity;
  }

  if (uPlasmaAssetEnabled > 0.5) {
    vec2 assetUv = effectUv;
    float audioMod = 1.0 + (uRms * 0.3 + uPeak * 0.5) * uPlasmaAssetAudioReact;
    vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
    centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
    vec4 assetSample = texture(uPlasmaAsset, centeredAssetUv);
    vec3 assetColor = assetSample.rgb * (0.85 + audioMod * 0.15);
    float alpha = assetSample.a * clamp(uPlasmaOpacity, 0.0, 1.0);
    color = applyBlendMode(color, assetColor, uPlasmaAssetBlend, alpha);
  }

  if (uSpectrumEnabled > 0.5) {
    float band = floor(effectUv.x * 64.0);
    int index = int(clamp(band, 0.0, 63.0));
    float amp = uSpectrum[index];
    float trail = uTrailSpectrum[index];
    float bar = step(effectUv.y, amp);
    float trailBar = step(effectUv.y, trail);
    color += vec3(0.1, 0.6, 1.0) * bar * 0.8 * uSpectrumOpacity;
    if (uPersistence > 0.01) {
      color += vec3(0.1, 0.4, 0.8) * trailBar * 0.5 * uPersistence;
    }
  }

  if (uSpectrumAssetEnabled > 0.5) {
    vec2 assetUv = effectUv;
    float band = floor(assetUv.x * 64.0);
    int specIndex = int(clamp(band, 0.0, 63.0));
    float specVal = uSpectrum[specIndex];
    float audioMod = 1.0 + (specVal * 0.4 + uRms * 0.3) * uSpectrumAssetAudioReact;
    vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
    centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
    vec4 assetSample = texture(uSpectrumAsset, centeredAssetUv);
    vec3 assetColor = assetSample.rgb * (0.8 + audioMod * 0.2);
    float alpha = assetSample.a * clamp(uSpectrumOpacity, 0.0, 1.0);
    color = applyBlendMode(color, assetColor, uSpectrumAssetBlend, alpha);
  }

  if (uParticlesEnabled > 0.5) {
    float particles = particleField(effectUv, uTime, uParticleDensity, uParticleSpeed, uParticleSize);
    float lift = 0.5 + uRms * 0.8;
    color += vec3(0.2, 0.7, 1.0) * particles * uParticleGlow * lift;
  }

  if (uSdfEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    centered = rotate2d(centered, uSdfRotation);
    float scale = mix(0.2, 0.9, uSdfScale);
    float sdfValue = 0.0;
    if (uSdfShape < 0.5) {
      sdfValue = sdCircle(centered, scale);
    } else if (uSdfShape < 1.5) {
      sdfValue = sdBox(centered, vec2(scale));
    } else {
      sdfValue = sdEquilateralTriangle(centered, scale);
    }
    float edge = smoothstep(uSdfEdge + 0.02, 0.0, abs(sdfValue));
    float fill = smoothstep(0.02, -0.02, sdfValue);
    float sdfIntensity = max(fill * uSdfFill, edge * uSdfGlow);
    float pulse = 0.85 + uPeak * 0.6;
    color += vec3(1.0, 0.6, 0.25) * sdfIntensity * pulse;
  }

  float flash = uStrobe * 1.5;
  color += vec3(flash);
  color += vec3(uPeak * 0.2, uRms * 0.5, uRms * 0.8);

  if (uEffectsEnabled > 0.5) {
    float bloom = uBloom;
    color += pow(color, vec3(2.0)) * bloom;
    color = posterize(color, uPosterize);
  }

  if (uEffectsEnabled > 0.5 && uChroma > 0.01) {
    vec2 offset = vec2(uChroma * 0.02, 0.0);
    vec3 shifted = vec3(color.r, color.g, color.b);
    shifted.r = color.r + offset.x;
    shifted.b = color.b - offset.x;
    color = mix(color, shifted, 0.3);
  }

  if (uEffectsEnabled > 0.5 && uBlur > 0.01) {
    color = mix(color, vec3((color.r + color.g + color.b) / 3.0), uBlur * 0.3);
  }

  color = shiftPalette(color, uPaletteShift);
  color = applySaturation(color, uSaturation);
  color = applyContrast(color, uContrast);

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
  const contrastLocation = gl.getUniformLocation(program, 'uContrast');
  const saturationLocation = gl.getUniformLocation(program, 'uSaturation');
  const paletteLocation = gl.getUniformLocation(program, 'uPaletteShift');
  const plasmaOpacityLocation = gl.getUniformLocation(program, 'uPlasmaOpacity');
  const spectrumOpacityLocation = gl.getUniformLocation(program, 'uSpectrumOpacity');
  const effectsEnabledLocation = gl.getUniformLocation(program, 'uEffectsEnabled');
  const bloomLocation = gl.getUniformLocation(program, 'uBloom');
  const blurLocation = gl.getUniformLocation(program, 'uBlur');
  const chromaLocation = gl.getUniformLocation(program, 'uChroma');
  const posterizeLocation = gl.getUniformLocation(program, 'uPosterize');
  const kaleidoscopeLocation = gl.getUniformLocation(program, 'uKaleidoscope');
  const feedbackLocation = gl.getUniformLocation(program, 'uFeedback');
  const persistenceLocation = gl.getUniformLocation(program, 'uPersistence');
  const trailSpectrumLocation = gl.getUniformLocation(program, 'uTrailSpectrum');
  const plasmaAssetEnabledLocation = gl.getUniformLocation(program, 'uPlasmaAssetEnabled');
  const plasmaAssetSamplerLocation = gl.getUniformLocation(program, 'uPlasmaAsset');
  const plasmaAssetBlendLocation = gl.getUniformLocation(program, 'uPlasmaAssetBlend');
  const plasmaAssetAudioReactLocation = gl.getUniformLocation(program, 'uPlasmaAssetAudioReact');
  const spectrumAssetEnabledLocation = gl.getUniformLocation(program, 'uSpectrumAssetEnabled');
  const spectrumAssetSamplerLocation = gl.getUniformLocation(program, 'uSpectrumAsset');
  const spectrumAssetBlendLocation = gl.getUniformLocation(program, 'uSpectrumAssetBlend');
  const spectrumAssetAudioReactLocation = gl.getUniformLocation(program, 'uSpectrumAssetAudioReact');
  const particlesEnabledLocation = gl.getUniformLocation(program, 'uParticlesEnabled');
  const particleDensityLocation = gl.getUniformLocation(program, 'uParticleDensity');
  const particleSpeedLocation = gl.getUniformLocation(program, 'uParticleSpeed');
  const particleSizeLocation = gl.getUniformLocation(program, 'uParticleSize');
  const particleGlowLocation = gl.getUniformLocation(program, 'uParticleGlow');
  const sdfEnabledLocation = gl.getUniformLocation(program, 'uSdfEnabled');
  const sdfShapeLocation = gl.getUniformLocation(program, 'uSdfShape');
  const sdfScaleLocation = gl.getUniformLocation(program, 'uSdfScale');
  const sdfEdgeLocation = gl.getUniformLocation(program, 'uSdfEdge');
  const sdfGlowLocation = gl.getUniformLocation(program, 'uSdfGlow');
  const sdfRotationLocation = gl.getUniformLocation(program, 'uSdfRotation');
  const sdfFillLocation = gl.getUniformLocation(program, 'uSdfFill');

  type AssetLayerId = 'layer-plasma' | 'layer-spectrum';
  const ASSET_LAYER_UNITS: Record<AssetLayerId, number> = {
    'layer-plasma': 1,
    'layer-spectrum': 2
  };

  interface AssetCacheEntry {
    assetId: string;
    texture: WebGLTexture;
    video?: HTMLVideoElement;
    width?: number;
    height?: number;
    options?: AssetItem['options'];
    frameBlendCanvas?: HTMLCanvasElement;
    frameBlendBackCanvas?: HTMLCanvasElement;
  }

  const assetCache = new Map<string, AssetCacheEntry>();
  const pendingAssetLoads = new Map<string, Promise<AssetCacheEntry>>();
  const layerBindings: Partial<Record<AssetLayerId, AssetCacheEntry>> = {};

  const isPowerOf2 = (value: number) => (value & (value - 1)) === 0;
  const getSamplingFilter = (sampling: AssetTextureSampling | undefined) =>
    sampling === 'nearest' ? gl.NEAREST : gl.LINEAR;

  const applyTextureSampling = (
    sampling: AssetTextureSampling | undefined,
    generateMipmaps: boolean,
    width?: number,
    height?: number
  ) => {
    const filter = getSamplingFilter(sampling);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    if (generateMipmaps && width && height && isPowerOf2(width) && isPowerOf2(height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  };

  const loadImageAsset = (asset: AssetItem): Promise<AssetCacheEntry> =>
    new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) {
        resolve({ assetId: asset.id, texture: gl.createTexture()! });
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (!asset.path) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        resolve({
          assetId: asset.id,
          texture,
          width: asset.width,
          height: asset.height
        });
        return;
      }
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        applyTextureSampling(
          asset.options?.textureSampling,
          Boolean(asset.options?.generateMipmaps),
          image.width,
          image.height
        );
        resolve({
          assetId: asset.id,
          texture,
          width: image.width,
          height: image.height
        });
      };
      image.onerror = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        resolve({
          assetId: asset.id,
          texture,
          width: asset.width,
          height: asset.height
        });
      };
      image.src = toFileUrl(asset.path);
    });

  const loadVideoAsset = (asset: AssetItem, videoOverride?: HTMLVideoElement): Promise<AssetCacheEntry> =>
    new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) {
        resolve({ assetId: asset.id, texture: gl.createTexture()! });
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const video = videoOverride ?? document.createElement('video');
      if (!videoOverride) {
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.loop = asset.options?.loop ?? true;
        video.playsInline = true;
        video.preload = 'auto';
        video.autoplay = true;
        video.playbackRate = asset.options?.playbackRate ?? 1;
      }
      const applyPlaybackDirection = () => {
        const baseRate = asset.options?.playbackRate ?? 1;
        if (asset.options?.reverse) {
          const rate = Math.max(0.01, Math.abs(baseRate));
          video.playbackRate = -rate;
          if (video.duration) {
            video.currentTime = video.duration;
          }
        } else {
          video.playbackRate = baseRate;
        }
      };

      const finalize = () => {
        applyPlaybackDirection();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        applyTextureSampling(asset.options?.textureSampling, false, video.videoWidth, video.videoHeight);
        resolve({
          assetId: asset.id,
          texture,
          video,
          width: video.videoWidth || asset.width,
          height: video.videoHeight || asset.height,
          options: asset.options
        });
      };
      const ensureReverseLoop = () => {
        if (!asset.options?.reverse) return;
        video.addEventListener('ended', () => {
          video.currentTime = video.duration || 0;
          video.playbackRate = -Math.abs(asset.options?.playbackRate ?? 1);
          void video.play().catch(() => undefined);
        });
      };
      const scheduleFinalize = () => {
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
          finalize();
        } else {
          video.addEventListener('loadeddata', finalize, { once: true });
        }
      };
      if (!videoOverride) {
        video.addEventListener(
          'error',
          () => {
            resolve({ assetId: asset.id, texture, video });
          },
          { once: true }
        );
        if (asset.path) {
          video.src = toFileUrl(asset.path);
          void video.play().catch(() => undefined);
        } else {
          resolve({ assetId: asset.id, texture, video });
          return;
        }
      }
      ensureReverseLoop();
      scheduleFinalize();
    });

  const assetOptionsHash = (options?: AssetItem['options']) => JSON.stringify(options ?? {});

  const loadTextAsset = (asset: AssetItem, canvas: HTMLCanvasElement): Promise<AssetCacheEntry> =>
    new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) {
        resolve({ assetId: asset.id, texture: gl.createTexture()! });
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      resolve({
        assetId: asset.id,
        texture,
        width: canvas.width,
        height: canvas.height,
        options: asset.options
      });
    });

  const ensureAssetEntry = (
    asset: AssetItem,
    videoOverride?: HTMLVideoElement,
    textCanvas?: HTMLCanvasElement
  ) => {
    if (assetCache.has(asset.id)) {
      const cached = assetCache.get(asset.id)!;
      if (assetOptionsHash(cached.options) === assetOptionsHash(asset.options)) {
        return Promise.resolve(cached);
      }
      assetCache.delete(asset.id);
    }
    if (pendingAssetLoads.has(asset.id)) {
      return pendingAssetLoads.get(asset.id)!;
    }
    let loader: Promise<AssetCacheEntry>;
    if (asset.kind === 'video' || asset.kind === 'live') {
      loader = loadVideoAsset(asset, videoOverride);
    } else if (asset.kind === 'text' && textCanvas) {
      loader = loadTextAsset(asset, textCanvas);
    } else {
      loader = loadImageAsset(asset);
    }
    pendingAssetLoads.set(asset.id, loader);
    loader.then((entry) => {
      assetCache.set(asset.id, entry);
      pendingAssetLoads.delete(asset.id);
    });
    return loader;
  };

  const ensureFrameBlendCanvases = (entry: AssetCacheEntry, width: number, height: number) => {
    const make = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    };
    if (!entry.frameBlendCanvas) {
      entry.frameBlendCanvas = make();
    }
    if (!entry.frameBlendBackCanvas) {
      entry.frameBlendBackCanvas = make();
    }
    [entry.frameBlendCanvas, entry.frameBlendBackCanvas].forEach((canvas) => {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    });
  };

  const blendVideoTexture = (entry: AssetCacheEntry, width: number, height: number, blend: number) => {
    if (!entry.video || blend <= 0) return null;
    ensureFrameBlendCanvases(entry, width, height);
    const target = entry.frameBlendCanvas!;
    const prev = entry.frameBlendBackCanvas!;
    const ctx = target.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - blend;
    ctx.drawImage(entry.video, 0, 0, width, height);
    ctx.globalAlpha = blend;
    ctx.drawImage(prev, 0, 0, width, height);
    [entry.frameBlendCanvas, entry.frameBlendBackCanvas] = [prev, target];
    return target;
  };

  const getVideoDimensions = (entry: AssetCacheEntry) => {
    const width = entry.video?.videoWidth || entry.width || canvas.width;
    const height = entry.video?.videoHeight || entry.height || canvas.height;
    return { width, height };
  };

  const updateVideoTextures = () => {
    (Object.keys(ASSET_LAYER_UNITS) as AssetLayerId[]).forEach((layerId) => {
      const entry = layerBindings[layerId];
      if (entry?.video && entry.texture && entry.video.readyState >= entry.video.HAVE_CURRENT_DATA) {
        const unitIndex = ASSET_LAYER_UNITS[layerId];
        gl.activeTexture(gl.TEXTURE0 + unitIndex);
        gl.bindTexture(gl.TEXTURE_2D, entry.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        const { width, height } = getVideoDimensions(entry);
        const blend = entry.options?.frameBlend ?? 0;
        const blendedSource = blendVideoTexture(entry, width, height, blend);
        const source = blendedSource ?? entry.video;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        entry.width = width;
        entry.height = height;
      }
    });
  };

  const applyLayerBinding = (
    layerId: AssetLayerId,
    enabledLocation: WebGLUniformLocation | null,
    samplerLocation: WebGLUniformLocation | null
  ) => {
    const entry = layerBindings[layerId];
    const unitIndex = ASSET_LAYER_UNITS[layerId];
    const enabled = Boolean(entry);
    if (enabledLocation) {
      gl.uniform1f(enabledLocation, enabled ? 1 : 0);
    }
    if (samplerLocation) {
      gl.uniform1i(samplerLocation, unitIndex);
    }
    gl.activeTexture(gl.TEXTURE0 + unitIndex);
    gl.bindTexture(gl.TEXTURE_2D, entry?.texture ?? null);
  };

  const setLayerAsset = async (
    layerId: AssetLayerId,
    asset: AssetItem | null,
    videoOverride?: HTMLVideoElement,
    textCanvas?: HTMLCanvasElement
  ) => {
    if (!ASSET_LAYER_UNITS[layerId]) return;
    if (!asset) {
      delete layerBindings[layerId];
      return;
    }
    const entry = await ensureAssetEntry(asset, videoOverride, textCanvas);
    layerBindings[layerId] = entry;
  };

  const render = (state: RenderState) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.02, 0.03, 0.06, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    updateVideoTextures();
    if (timeLocation) gl.uniform1f(timeLocation, state.timeMs * 0.001);
    if (rmsLocation) gl.uniform1f(rmsLocation, state.rms);
    if (peakLocation) gl.uniform1f(peakLocation, state.peak);
    if (strobeLocation) gl.uniform1f(strobeLocation, state.strobe);
    if (plasmaLocation) gl.uniform1f(plasmaLocation, state.plasmaEnabled ? 1 : 0);
    if (spectrumLocation) gl.uniform1f(spectrumLocation, state.spectrumEnabled ? 1 : 0);
    if (spectrumArrayLocation) {
      gl.uniform1fv(spectrumArrayLocation, state.spectrum);
    }
    if (contrastLocation) gl.uniform1f(contrastLocation, state.contrast);
    if (saturationLocation) gl.uniform1f(saturationLocation, state.saturation);
    if (paletteLocation) gl.uniform1f(paletteLocation, state.paletteShift);
    if (plasmaOpacityLocation) gl.uniform1f(plasmaOpacityLocation, state.plasmaOpacity);
    if (spectrumOpacityLocation) gl.uniform1f(spectrumOpacityLocation, state.spectrumOpacity);
    if (effectsEnabledLocation) gl.uniform1f(effectsEnabledLocation, state.effectsEnabled ? 1 : 0);
    if (bloomLocation) gl.uniform1f(bloomLocation, state.bloom);
    if (blurLocation) gl.uniform1f(blurLocation, state.blur);
    if (chromaLocation) gl.uniform1f(chromaLocation, state.chroma);
    if (posterizeLocation) gl.uniform1f(posterizeLocation, state.posterize);
    if (kaleidoscopeLocation) gl.uniform1f(kaleidoscopeLocation, state.kaleidoscope);
    if (feedbackLocation) gl.uniform1f(feedbackLocation, state.feedback);
    if (persistenceLocation) gl.uniform1f(persistenceLocation, state.persistence);
    if (trailSpectrumLocation) gl.uniform1fv(trailSpectrumLocation, state.trailSpectrum);
    if (particlesEnabledLocation) gl.uniform1f(particlesEnabledLocation, state.particlesEnabled ? 1 : 0);
    if (particleDensityLocation) gl.uniform1f(particleDensityLocation, state.particleDensity);
    if (particleSpeedLocation) gl.uniform1f(particleSpeedLocation, state.particleSpeed);
    if (particleSizeLocation) gl.uniform1f(particleSizeLocation, state.particleSize);
    if (particleGlowLocation) gl.uniform1f(particleGlowLocation, state.particleGlow);
    if (sdfEnabledLocation) gl.uniform1f(sdfEnabledLocation, state.sdfEnabled ? 1 : 0);
    if (sdfShapeLocation) gl.uniform1f(sdfShapeLocation, state.sdfShape);
    if (sdfScaleLocation) gl.uniform1f(sdfScaleLocation, state.sdfScale);
    if (sdfEdgeLocation) gl.uniform1f(sdfEdgeLocation, state.sdfEdge);
    if (sdfGlowLocation) gl.uniform1f(sdfGlowLocation, state.sdfGlow);
    if (sdfRotationLocation) gl.uniform1f(sdfRotationLocation, state.sdfRotation);
    if (sdfFillLocation) gl.uniform1f(sdfFillLocation, state.sdfFill);
    applyLayerBinding('layer-plasma', plasmaAssetEnabledLocation, plasmaAssetSamplerLocation);
    if (plasmaAssetBlendLocation) gl.uniform1f(plasmaAssetBlendLocation, state.plasmaAssetBlendMode);
    if (plasmaAssetAudioReactLocation) gl.uniform1f(plasmaAssetAudioReactLocation, state.plasmaAssetAudioReact);
    applyLayerBinding('layer-spectrum', spectrumAssetEnabledLocation, spectrumAssetSamplerLocation);
    if (spectrumAssetBlendLocation) gl.uniform1f(spectrumAssetBlendLocation, state.spectrumAssetBlendMode);
    if (spectrumAssetAudioReactLocation) gl.uniform1f(spectrumAssetAudioReactLocation, state.spectrumAssetAudioReact);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  return {
    render,
    setLayerAsset
  };
};
