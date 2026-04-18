export interface GeneratorShaderBlock {
  /** Generator ID matching an entry in GENERATORS from generatorLibrary.ts */
  id: string;
  /** GLSL uniform declarations for this generator */
  uniforms: string;
  /** Complete GLSL function definition(s) for this generator */
  functions: string;
  /** Single conditional call line for main(), e.g. "  if (uXxxEnabled > 0.5) color += generatorName(...);\\n" */
  mainCall: string;
}

/**
 * Registry of generator shader blocks extracted from glRenderer.ts
 * Each block contains the uniforms, functions, and main call for a single generator.
 */
export const GENERATOR_SHADER_BLOCKS: GeneratorShaderBlock[] = [
  // Layer Generators
  {
    id: 'layer-plasma',
    uniforms: `uniform float uPlasmaEnabled;
uniform float uPlasmaOpacity;
uniform float uPlasmaSpeed;
uniform float uPlasmaScale;
uniform float uPlasmaComplexity;
uniform float uPlasmaAudioReact;
uniform float uPlasmaAssetEnabled;
uniform sampler2D uPlasmaAsset;
uniform float uPlasmaAssetBlend;
uniform float uPlasmaAssetAudioReact;
`,
    functions: `float plasmaDefault(vec2 uv, float t) {
  float v = 0.0;
  vec2 p = uv * uPlasmaScale;
  float audio = (uRms * 0.5 + uPeak * 0.5) * uPlasmaAudioReact;

  for (float i = 1.0; i < 9.0; i += 1.0) {
      if (i > uPlasmaComplexity) break;
      v += sin(p.x * i + t * uPlasmaSpeed * (1.0 + i * 0.1) + audio * i);
      v += sin(p.y * i - t * uPlasmaSpeed * (1.1 + i * 0.15) + audio * 0.5);
      p += vec2(sin(t * 0.1), cos(t * 0.1)) * 0.5;
  }

  return v / uPlasmaComplexity * 0.5 + 0.5;
}

vec3 samplePlasma(vec2 uv, float t) {
#ifdef HAS_CUSTOM_PLASMA
  return customPlasma(uv, t);
#else
  float p = plasmaDefault(uv, t);
  return getPaletteColor(p);
#endif
}
`,
    mainCall: `  if (uPlasmaEnabled > 0.5) {
    vec3 plasmaColor = samplePlasma(effectUv, uTime);
    applyScopedFx(plasmaColor, effectUv, ulayer_layer_plasma_0_bloom, ulayer_layer_plasma_0_chroma, ulayer_layer_plasma_0_blur, ulayer_layer_plasma_0_posterize);
    color += plasmaColor * uPlasmaOpacity;
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
`
  },

  {
    id: 'layer-spectrum',
    uniforms: `uniform float uSpectrumEnabled;
uniform float uSpectrumOpacity;
uniform float uSpectrumAssetEnabled;
uniform sampler2D uSpectrumAsset;
uniform float uSpectrumAssetBlend;
uniform float uSpectrumAssetAudioReact;
`,
    functions: ``, // Spectrum uses direct uniform array sampling, no functions needed
    mainCall: `  if (uSpectrumEnabled > 0.5) {
    float band = floor(effectUv.x * 64.0);
    int index = int(clamp(band, 0.0, 63.0));
    float amp = uSpectrum[index];
    float trail = uTrailSpectrum[index];
    float bar = step(effectUv.y, amp);
    float trailBar = step(effectUv.y, trail);
    vec3 specColor = getPaletteColor(amp) * bar * 0.8;
    applyScopedFx(specColor, effectUv, ulayer_layer_spectrum_0_bloom, ulayer_layer_spectrum_0_chroma, ulayer_layer_spectrum_0_blur, ulayer_layer_spectrum_0_posterize);
    color += specColor * uSpectrumOpacity;
    if (uPersistence > 0.01) { color += getPaletteColor(trail) * trailBar * 0.5 * uPersistence; }
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
`
  },

  // Additional Layer Generators
  {
    id: 'layer-origami',
    uniforms: `uniform float uOrigamiEnabled;
uniform float uOrigamiOpacity;
uniform float uOrigamiSpeed;
uniform float uOrigamiFoldState;
uniform float uOrigamiFoldSharpness;
`,
    functions: ``,
    mainCall: `  if (uOrigamiEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float sharp = mix(0.12, 0.02, clamp(uOrigamiFoldSharpness, 0.0, 1.0));
    float foldPhase = uOrigamiFoldState * 6.28318;
    float foldField = abs(sin((centered.x * 0.9 + centered.y * 0.4) * mix(2.5, 7.5, low) + uTime * 0.35 * uOrigamiSpeed + foldPhase));
    float crease = smoothstep(sharp, 0.0, foldField);
    vec3 creaseCol = getPaletteColor(0.9) * (0.5 + high * 0.5);
    applyScopedFx(creaseCol, effectUv, ulayer_layer_origami_0_bloom, ulayer_layer_origami_0_chroma, ulayer_layer_origami_0_blur, ulayer_layer_origami_0_posterize);
    color += creaseCol * crease * uOrigamiOpacity;
  }
`,
  },

  {
    id: 'layer-glyph',
    uniforms: `uniform float uGlyphEnabled;
uniform float uGlyphOpacity;
uniform float uGlyphSpeed;
uniform float uGlyphMode;
uniform float uGlyphSeed;
`,
    functions: `float glyphShape(vec2 p, float seed, float band, float complexity) {
  float s = fract(seed * 0.1234);
  float t = floor(s * 6.0);
  float r = 0.3 * complexity;
  if (t < 1.0) return sdCircle(p, r);
  if (t < 2.0) return sdBox(p, vec2(r));
  if (t < 3.0) return sdEquilateralTriangle(p, r);
  if (t < 4.0) return sdRing(p, r, 0.06);
  if (t < 5.0) return sdStar(p, r, 5, 2.0);
  return sdHexagon(p, r * 0.8);
}`,
    mainCall: `  if (uGlyphEnabled > 0.5) {
    vec2 grid = vec2(18.0, 10.0);
    vec2 cell = floor(effectUv * grid);
    vec2 local = fract(effectUv * grid) - 0.5;
    float cellId = cell.x + cell.y * grid.x;
    float band = floor((cell.x / grid.x) * 8.0);
    int bandIndex = int(clamp(band, 0.0, 7.0));
    float bandVal = uSpectrum[bandIndex * 8];
    float complexity = clamp(0.3 + bandVal * 0.8 + uGlyphBeat * 0.4, 0.0, 1.0);
    float seed = uGlyphSeed + cellId * 0.37 + band * 2.1 + floor(uGlyphBeat * 4.0) * 7.0;
    if (uGlyphMode < 0.5) { local.y += (mod(cell.x, 3.0) - 1.0) * (0.08 + bandVal * 0.12); }
    else if (uGlyphMode < 1.5) { local = rotate2d(local, uTime * 0.15 * uGlyphSpeed + cellId * 0.12); }
    else if (uGlyphMode < 2.5) { local += normalize(local + 0.0001) * (uGlyphBeat * 0.35 + bandVal * 0.12); }
    else { local.x += sin(uTime * 0.2 * uGlyphSpeed + cell.y * 0.6) * 0.2; local.y += (cell.x / grid.x - 0.5) * 0.12; }
    if (uGlyphMode > 2.5) { local.y += (mod(cell.y, 4.0) - 1.5) * 0.06; local.x += sin(uTime * 0.2 * uGlyphSpeed + cell.y * 0.8) * 0.06; }
    float dist = glyphShape(local, seed, band, complexity);
    float stroke = smoothstep(0.04, 0.0, dist);
    vec3 glyphColor = getPaletteColor(fract(float(bandIndex) * 0.15 + uTime * 0.05));
    glyphColor *= 0.55 + complexity * 0.75;
    applyScopedFx(glyphColor, effectUv, ulayer_layer_glyph_0_bloom, ulayer_layer_glyph_0_chroma, ulayer_layer_glyph_0_blur, ulayer_layer_glyph_0_posterize);
    color += glyphColor * stroke * uGlyphOpacity;
  }
`,
  },

  {
    id: 'layer-crystal',
    uniforms: `uniform float uCrystalEnabled;
uniform float uCrystalOpacity;
uniform float uCrystalSpeed;
uniform float uCrystalScale;
uniform float uCrystalMode;
uniform float uCrystalBrittleness;
`,
    functions: `float crystalField(vec2 p, float t, float scale) {
  vec2 q = p * scale;
  vec2 cell = floor(q);
  vec2 f = fract(q);
  float minDist = 1.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 n = vec2(float(dx), float(dy));
      vec2 cellPos = n + hash22(cell + n + floor(vec2(t)));
      minDist = min(minDist, length(f - cellPos + n));
    }
  }
  return minDist;
}`,
    mainCall: `  if (uCrystalEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float alignment = smoothstep(0.2, 0.7, uRms);
    float bassStability = clamp(low * 1.4, 0.0, 1.0);
    float timeScale = uCrystalSpeed > 0.01 ? uCrystalSpeed : 1.0;
    float cell = crystalField(centered, uTime * 0.02 * timeScale + uCrystalMode * 2.0, mix(4.0, 10.0, bassStability) * (uCrystalScale > 0.01 ? uCrystalScale : 1.0));
    float shard = smoothstep(0.22, 0.02, cell);
    float growth = mix(0.35, 0.9, alignment) + mid * 0.2;
    vec3 base = getPaletteColor(0.1), core = getPaletteColor(0.5), caustic = getPaletteColor(0.9);
    vec3 crystal = mix(base, core, (1.0 - cell) * (0.6 + bassStability * 0.6));
    crystal += caustic * smoothstep(0.1, 0.0, cell - high * 0.05) * clamp(uPeak - uRms, 0.0, 1.0) * (0.6 + high);
    crystal *= growth + (uCrystalMode < 0.5 ? 0.15 : uCrystalMode < 1.5 ? 0.35 : uCrystalMode < 2.5 ? 0.7 : 0.05);
    crystal *= 0.4 + (1.0 - clamp(uCrystalBrittleness, 0.0, 1.0)) * 0.6;
    applyScopedFx(crystal, effectUv, ulayer_layer_crystal_0_bloom, ulayer_layer_crystal_0_chroma, ulayer_layer_crystal_0_blur, ulayer_layer_crystal_0_posterize);
    color += crystal * shard * uCrystalOpacity;
  }
`,
  },

  {
    id: 'layer-inkflow',
    uniforms: `uniform float uInkEnabled;
uniform float uInkOpacity;
uniform float uInkSpeed;
uniform float uInkScale;
uniform float uInkPressure;
uniform float uInkLifespan;
uniform float uInkBrush;
`,
    functions: ``,
    mainCall: `  if (uInkEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float flowScale = mix(1.5, 4.0, uRms) * uInkScale;
    vec2 flow = vec2(sin(centered.y * flowScale + uTime * 0.4 * uInkSpeed + uPeak * 1.2), cos(centered.x * flowScale - uTime * 0.35 * uInkSpeed + uRms));
    flow += vec2(-centered.y, centered.x) * (0.25 + uPeak * 0.5);
    if (uGlyphBeat > 0.1) flow = vec2(flow.y, -flow.x);
    vec2 inkUv = effectUv + flow * 0.08;
    float stroke = smoothstep(0.6, 0.0, abs(sin((inkUv.x + inkUv.y) * 18.0 * uInkScale + uTime * 0.6 * uInkSpeed))) * (0.4 + uInkPressure * 0.8);
    vec3 inkColor = getPaletteColor(uInkBrush < 0.5 ? 0.1 : uInkBrush < 1.5 ? 0.4 : 0.7);
    if (uInkBrush > 0.5 && uInkBrush < 1.5) stroke *= 0.6 + abs(sin(inkUv.x * 12.0 + uTime * 0.4 * uInkSpeed)) * 0.6;
    applyScopedFx(inkColor, effectUv, ulayer_layer_inkflow_0_bloom, ulayer_layer_inkflow_0_chroma, ulayer_layer_inkflow_0_blur, ulayer_layer_inkflow_0_posterize);
    color += inkColor * stroke * mix(0.3, 0.9, uInkLifespan) * uInkOpacity;
  }
`,
  },

  {
    id: 'layer-topo',
    uniforms: `uniform float uTopoEnabled;
uniform float uTopoOpacity;
uniform float uTopoScale;
uniform float uTopoElevation;
uniform float uTopoTravel;
uniform float uTopoPlate;
uniform float uTopoQuake;
uniform float uTopoSlide;
`,
    functions: ``,
    mainCall: `  if (uTopoEnabled > 0.5) {
    vec2 centered = (effectUv * 2.0 - 1.0) * (2.0 - clamp(uTopoScale, 0.1, 1.9));
    float travel = uTopoTravel + uTopoPlate * 0.4;
    vec2 flow = centered + vec2(travel * 0.4, travel * 0.2);
    float elevation = (low * 0.6 + mid * 0.3 + high * 0.1) * uTopoElevation;
    float terrain = (abs(sin(flow.x * 2.4 + travel) + cos(flow.y * 2.2 - travel)) * 0.35) * (0.6 + elevation) + elevation * 0.6;
    terrain += uTopoQuake * 0.6 * sin(flow.x * 6.0 + uTime * 1.4);
    terrain -= uTopoSlide * 0.5 * smoothstep(0.2, 0.9, terrain);
    float mask = smoothstep(0.12, 0.02, abs(sin(terrain * mix(6.0, 18.0, high))) * mix(0.2, 1.0, mid));
    vec3 topoColor = mix(vec3(0.18, 0.28, 0.35), vec3(0.4, 0.6, 0.7), clamp(terrain, 0.0, 1.0));
    applyScopedFx(topoColor, effectUv, ulayer_layer_topo_0_bloom, ulayer_layer_topo_0_chroma, ulayer_layer_topo_0_blur, ulayer_layer_topo_0_posterize);
    color += topoColor * mask * uTopoOpacity;
  }
`,
  },

  {
    id: 'layer-weather',
    uniforms: `uniform float uWeatherEnabled;
uniform float uWeatherOpacity;
uniform float uWeatherSpeed;
uniform float uWeatherMode;
uniform float uWeatherIntensity;
`,
    functions: ``,
    mainCall: `  if (uWeatherEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float pressure = low * 1.2 + uWeatherIntensity * 0.4;
    vec2 flow = vec2(sin(centered.y * 1.6 + uTime * 0.2 * uWeatherSpeed), cos(centered.x * 1.4 - uTime * 0.18 * uWeatherSpeed));
    flow += vec2(-centered.y, centered.x) * (0.2 + (uWeatherMode > 2.5 ? 1.0 : 0.0) * 0.6) * (0.4 + pressure);
    vec2 wUv = effectUv + flow * (0.08 + mid * 1.1 * 0.15);
    float cloud = smoothstep(0.1, 0.7, (sin(wUv.x * 3.2 + uTime * 0.1 * uWeatherSpeed) + cos(wUv.y * 2.6 - uTime * 0.08 * uWeatherSpeed)) * 0.35 + pressure);
    vec3 cCol = mix(vec3(0.6, 0.65, 0.7), vec3(0.85, 0.88, 0.9), cloud);
    if (uWeatherMode < 0.5) cCol = mix(cCol, vec3(0.45, 0.55, 0.65), 1.0);
    else if (uWeatherMode < 2.5) cCol = mix(cCol, vec3(0.7, 0.75, 0.8), 1.0);
    float pHigh = high * 1.2 + uWeatherIntensity * 0.2;
    float rain = smoothstep(0.6, 0.0, abs(sin((wUv.x + uTime * 0.4 * uWeatherSpeed) * 30.0)) * pHigh) * (uWeatherMode < 0.5 || uWeatherMode > 2.5 ? 1.0 : 0.0);
    float snow = smoothstep(0.65, 0.0, abs(sin((wUv.y - uTime * 0.2 * uWeatherSpeed) * 18.0)) * pHigh) * (uWeatherMode > 0.5 && uWeatherMode < 1.5 ? 1.0 : 0.0);
    vec3 weatherColor = (cCol * cloud + vec3(0.4, 0.55, 0.8) * rain + vec3(0.8, 0.85, 0.9) * snow + vec3(1.2, 1.1, 0.9) * smoothstep(0.9, 1.0, pHigh) * (uWeatherMode < 0.5 ? 1.0 : 0.0) * uGlyphBeat) * (0.5 + uWeatherIntensity * 0.6);
    applyScopedFx(weatherColor, effectUv, ulayer_layer_weather_0_bloom, ulayer_layer_weather_0_chroma, ulayer_layer_weather_0_blur, ulayer_layer_weather_0_posterize);
    color += weatherColor * uWeatherOpacity;
  }
`,
  },

  {
    id: 'layer-portal',
    uniforms: `uniform float uPortalEnabled;
uniform float uPortalOpacity;
uniform float uPortalStyle;
uniform float uPortalShift;
uniform vec2 uPortalPos[4];
uniform float uPortalRadius[4];
uniform float uPortalActive[4];
`,
    functions: ``,
    mainCall: `  if (uPortalEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    vec2 warp = vec2(0.0); float ringGlow = 0.0;
    float style = clamp(uPortalStyle, 0.0, 2.0);
    float ringWidth = mix(0.02, 0.05, step(0.5, style));
    ringWidth = mix(ringWidth, 0.08, step(1.5, style));
    for (int i = 0; i < 4; i += 1) {
      if (uPortalActive[i] < 0.5) continue;
      vec2 delta = centered - uPortalPos[i]; float dist = length(delta), rad = uPortalRadius[i];
      ringGlow += smoothstep(rad + ringWidth, rad, dist) * smoothstep(rad - ringWidth, rad - ringWidth * 2.5, dist);
      warp += normalize(delta + 0.0001) * (rad - dist) * mix(0.06, 0.12, step(1.5, style));
    }
    effectUv = clamp(effectUv + warp * mix(0.45, 0.6, step(0.5, style)), 0.0, 1.0);
    vec3 baseCol = vec3(0.2, 0.6, 0.9);
    if (style > 0.5 && style < 1.5) baseCol = vec3(0.7, 0.35, 0.95);
    if (style >= 1.5) baseCol = vec3(0.2, 0.9, 0.55);
    vec3 portalColor = (baseCol + vec3(0.2, 0.1, 0.3) * uPortalShift) * ringGlow;
    applyScopedFx(portalColor, effectUv, ulayer_layer_portal_0_bloom, ulayer_layer_portal_0_chroma, ulayer_layer_portal_0_blur, ulayer_layer_portal_0_posterize);
    color += portalColor * uPortalOpacity;
  }
`,
  },

  {
    id: 'layer-media',
    uniforms: `uniform float uMediaEnabled;
uniform float uMediaOpacity;
uniform float uMediaAssetEnabled;
uniform sampler2D uMediaAsset;
uniform float uMediaAssetBlend;
uniform float uMediaAssetAudioReact;
uniform float uMediaBurstActive[8];
uniform vec2 uMediaBurstPos[8];
uniform float uMediaBurstRadius[8];
uniform float uMediaBurstType[8];
`,
    functions: ``,
    mainCall: `  if (uMediaEnabled > 0.5 && uMediaAssetEnabled > 0.5) {
    vec2 assetUv = effectUv;
    float audioMod = 1.0 + (uRms * 0.3 + uPeak * 0.5) * uMediaAssetAudioReact;
    vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
    centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
    vec4 assetSample = texture(uMediaAsset, centeredAssetUv);
    vec3 assetColor = assetSample.rgb * (0.85 + audioMod * 0.15);
    applyScopedFx(assetColor, effectUv, ulayer_layer_media_0_bloom, ulayer_layer_media_0_chroma, ulayer_layer_media_0_blur, ulayer_layer_media_0_posterize);
    float alpha = assetSample.a * clamp(uMediaOpacity, 0.0, 1.0);
    color = applyBlendMode(color, assetColor, uMediaAssetBlend, alpha);
  }
  if (uMediaEnabled > 0.5) {
      for (float i = 0.0; i < 8.0; i += 1.0) {
        float activeAmt = uMediaBurstActive[int(i)];
        if (activeAmt <= 0.01) continue;
        vec2 delta = effectUv - uMediaBurstPos[int(i)];
        float r = uMediaBurstRadius[int(i)];
        float ring = smoothstep(r, r * 0.7, length(delta)) * smoothstep(r * 0.3, r * 0.6, length(delta));
        vec3 burstColor = vec3(1.0, 0.9, 0.8) * ring * activeAmt;
        applyScopedFx(burstColor, effectUv, ulayer_layer_media_0_bloom, ulayer_layer_media_0_chroma, ulayer_layer_media_0_blur, ulayer_layer_media_0_posterize);
        color += burstColor * uMediaOpacity;
      }
  }
`,
  },

  {
    id: 'gen-asset-vortex',
    uniforms: `uniform float uAssetVortexEnabled;
uniform float uAssetVortexOpacity;
uniform sampler2D uAssetVortexAsset;
uniform float uAssetVortexStrength;
uniform float uAssetVortexSpeed;
`,
    functions: `vec2 vortexWarp(vec2 uv, float t, float strength) {
  vec2 centered = uv - 0.5;
  float dist = length(centered);
  float angle = atan(centered.y, centered.x);
  float twist = strength * (1.0 - dist) * sin(t * 2.0 + dist * 10.0);
  angle += twist;
  float pull = 1.0 - dist * strength * 0.3;
  return 0.5 + vec2(cos(angle), sin(angle)) * dist * pull;
}`,
    mainCall: `  if (uAssetVortexEnabled > 0.5) {
    vec2 warpedUv = vortexWarp(effectUv, uTime * uAssetVortexSpeed, uAssetVortexStrength + uPeak * 2.0);
    warpedUv = clamp(warpedUv, 0.0, 1.0);
    vec4 tex = texture(uAssetVortexAsset, warpedUv);
    color = applyBlendMode(color, tex.rgb, 3.0, tex.a * uAssetVortexOpacity);
  }
`,
  },

  {
    id: 'gen-asset-slices',
    uniforms: `uniform float uAssetSlicesEnabled;
uniform float uAssetSlicesOpacity;
uniform sampler2D uAssetSlicesAsset;
uniform float uAssetSlicesCount;
uniform float uAssetSlicesShift;
`,
    functions: ``, 
    mainCall: `  if (uAssetSlicesEnabled > 0.5) {
    float slices = max(8.0, uAssetSlicesCount);
    float sliceY = floor(effectUv.y * slices) / slices;
    int band = int(sliceY * 64.0) % 64;
    float amp = uSpectrum[band];
    float shift = amp * uAssetSlicesShift;
    vec2 slicedUv = vec2(fract(effectUv.x + shift), effectUv.y);
    vec4 tex = texture(uAssetSlicesAsset, slicedUv);
    color = applyBlendMode(color, tex.rgb, 1.0, tex.a * uAssetSlicesOpacity);
  }
`,
  },

  {
    id: 'gen-asset-polar',
    uniforms: `uniform float uAssetPolarEnabled;
uniform float uAssetPolarOpacity;
uniform sampler2D uAssetPolarAsset;
uniform float uAssetPolarRadius;
uniform float uAssetPolarTwist;
`,
    functions: `vec2 polarCoords(vec2 uv, float radius, float twist) {
  vec2 centered = uv - 0.5;
  float r = length(centered) / radius;
  float theta = atan(centered.y, centered.x) + twist * r;
  return vec2(theta / 6.28318 + 0.5, r);
}`,
    mainCall: `  if (uAssetPolarEnabled > 0.5) {
    vec2 polarUv = polarCoords(effectUv, uAssetPolarRadius + uRms * 0.2, uAssetPolarTwist + uTime * 0.1);
    vec4 tex = texture(uAssetPolarAsset, clamp(polarUv, 0.0, 1.0));
    color = applyBlendMode(color, tex.rgb, 3.0, tex.a * uAssetPolarOpacity);
  }
`,
  },

  {
    id: 'gen-asset-mosaic',
    uniforms: `uniform float uAssetMosaicEnabled;
uniform float uAssetMosaicOpacity;
uniform sampler2D uAssetMosaicAsset;
uniform float uAssetMosaicTiles;
uniform float uAssetMosaicFlip;
`,
    functions: ``,
    mainCall: `  if (uAssetMosaicEnabled > 0.5) {
    float tiles = max(4.0, uAssetMosaicTiles);
    vec2 tileUv = fract(effectUv * tiles);
    vec2 tileId = floor(effectUv * tiles);
    float hash = fract(sin(dot(tileId, vec2(12.9898, 78.233))) * 43758.5453);
    float flip = step(0.5 + uPeak * uAssetMosaicFlip, hash);
    tileUv = mix(tileUv, 1.0 - tileUv, flip);
    vec4 tex = texture(uAssetMosaicAsset, tileUv);
    color = applyBlendMode(color, tex.rgb, 3.0, tex.a * uAssetMosaicOpacity);
  }
`,
  },

  {
    id: 'gen-asset-ripple',
    uniforms: `uniform float uAssetRippleEnabled;
uniform float uAssetRippleOpacity;
uniform sampler2D uAssetRippleAsset;
uniform float uAssetRippleAmplitude;
uniform float uAssetRippleFrequency;
`,
    functions: `vec2 rippleWarp(vec2 uv, float t, float amp, float freq) {
  vec2 centered = uv - 0.5;
  float dist = length(centered);
  float ripple = sin(dist * freq - t * 3.0) * amp;
  return uv + normalize(centered + 0.001) * ripple * (1.0 - dist);
}`,
    mainCall: `  if (uAssetRippleEnabled > 0.5) {
    float amp = uAssetRippleAmplitude + uPeak * 0.05;
    vec2 rippledUv = rippleWarp(effectUv, uTime, amp, uAssetRippleFrequency);
    rippledUv = clamp(rippledUv, 0.0, 1.0);
    vec4 tex = texture(uAssetRippleAsset, rippledUv);
    color = applyBlendMode(color, tex.rgb, 3.0, tex.a * uAssetRippleOpacity);
  }
`,
  },

  {
    id: 'gen-asset-scatter',
    uniforms: `uniform float uAssetScatterEnabled;
uniform float uAssetScatterOpacity;
uniform sampler2D uAssetScatterAsset;
uniform float uAssetScatterAmount;
uniform float uAssetScatterSeed;
`,
    functions: `vec2 scatterWarp(vec2 uv, float amount, float seed) {
  float n = fract(sin(dot(uv * 100.0 + seed, vec2(12.9898, 78.233))) * 43758.5453);
  vec2 offset = vec2(n - 0.5, fract(n * 17.0) - 0.5) * amount;
  return uv + offset;
}`,
    mainCall: `  if (uAssetScatterEnabled > 0.5) {
    float scatter = uAssetScatterAmount * (1.0 + uPeak * 5.0);
    vec2 scatteredUv = scatterWarp(effectUv, scatter, uAssetScatterSeed + uTime * 0.1);
    vec4 tex = texture(uAssetScatterAsset, clamp(scatteredUv, 0.0, 1.0));
    color = applyBlendMode(color, tex.rgb, 3.0, tex.a * uAssetScatterOpacity);
  }
`,
  },

  {
    id: 'gen-asset-echo',
    uniforms: `uniform float uAssetEchoEnabled;
uniform float uAssetEchoOpacity;
uniform sampler2D uAssetEchoAsset;
uniform float uAssetEchoCount;
uniform float uAssetEchoSpread;
uniform float uAssetEchoFade;
`,
    functions: ``,
    mainCall: `  if (uAssetEchoEnabled > 0.5) {
    float count = max(1.0, uAssetEchoCount);
    for (float i = 0.0; i < 5.0; i += 1.0) {
      if (i >= count) break;
      float offset = i / count * uAssetEchoSpread;
      vec2 echoUv = effectUv + vec2(offset * sin(uTime + i), offset * cos(uTime + i));
      echoUv = clamp(echoUv, 0.0, 1.0);
      vec4 tex = texture(uAssetEchoAsset, echoUv);
      float fade = pow(uAssetEchoFade, i);
      color = applyBlendMode(color, tex.rgb, 1.0, tex.a * uAssetEchoOpacity * fade);
    }
  }
`,
  },

  {
    id: 'layer-oscillo',
    uniforms: `uniform float uOscilloEnabled;
uniform float uOscilloOpacity;
uniform float uOscilloMode;
uniform float uOscilloRotate;
uniform float uOscilloFreeze;
uniform float uOscillo[64];
`,
    functions: `float oscilloSample(float t) {
  int idx = int(clamp(t * 63.0, 0.0, 63.0));
  return uOscillo[idx];
}`,
    mainCall: `  if (uOscilloEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float rot = uOscilloRotate * 0.6 + uTime * 0.12 * (1.0 - uOscilloFreeze), minDist = 10.0, arcGlow = 0.0;
    for (float i = 0.0; i < 64.0; i += 1.0) {
      float t = i / 63.0, rad = 0.28 + oscilloSample(t) * 0.22 + uRms * 0.12;
      vec2 p = rotate2d(vec2(cos(t * 6.28318 * (1.0 + floor(uOscilloMode) * 0.35)), sin(t * 6.28318 * (1.0 + floor(uOscilloMode) * 0.35))) * rad, rot);
      minDist = min(minDist, length(centered - p));
      arcGlow += smoothstep(0.08, 0.0, abs(length(centered) - (rad + 0.06 * sin(t * 12.0 + uTime * 0.3)))) * 0.2;
    }
    vec3 oscColor = (mix(vec3(0.95, 0.82, 0.6), vec3(0.6, 0.8, 1.0), uSpectrum[28]) * (0.6 + smoothstep(0.2, 0.7, uRms) * 0.5) + mix(vec3(0.95, 0.5, 0.2), vec3(0.7, 0.9, 1.0), uSpectrum[8]) * (0.2 + uPeak * 0.6) + vec3(0.2, 0.15, 0.4) * arcGlow) * (smoothstep(0.07, 0.0, minDist) + smoothstep(0.18, 0.0, minDist) * 0.35 + arcGlow);
    applyScopedFx(oscColor, effectUv, ulayer_layer_oscillo_0_bloom, ulayer_layer_oscillo_0_chroma, ulayer_layer_oscillo_0_blur, ulayer_layer_oscillo_0_posterize);
    color += oscColor * uOscilloOpacity;
  }
`,
  },

  // EDM Generators
  {
    id: 'gen-lightning',
    uniforms: `uniform float uLightningEnabled;
uniform float uLightningOpacity;
uniform float uLightningSpeed;
uniform float uLightningBranches;
uniform float uLightningThickness;
uniform float uLightningColor;
`,
    functions: `float lightningBolt(vec2 uv, float t, float audio) {
  vec2 p = (uv * 2.0 - 1.0);
  p.x *= uAspect;
  
  float v = 0.0;
  float intensity = uLightningOpacity;
  float branches = uLightningBranches; 
  float thickness = uLightningThickness; 
  
  for (float i = 0.0; i < 3.0; i += 1.0) {
    if (i >= uLightningBranches) break;
    float t2 = t * uLightningSpeed * (1.0 + i * 0.5) + i * 135.2;
    vec2 seed = vec2(t2 * 0.5, t2 * 0.2);
    
    float noiseVal = fbm(p * (2.0 + i) + seed);
    float bolt = 1.0 / (abs(p.y + (noiseVal - 0.5) * 1.5) + 0.05);
    
    // Masking to keep it somewhat central but wild
    bolt *= smoothstep(1.5, 0.0, abs(p.x));
    
    v += bolt * thickness;
  }
  
  v *= (1.0 + audio * 2.0);
  return clamp(v, 0.0, 1.0) * intensity;
}`,
    mainCall: `  if (uLightningEnabled > 0.5) {
    float lightningVal = lightningBolt(effectUv, uTime, high);
    vec3 lightningCol = getPaletteColor(uLightningColor < 0.5 ? 0.2 : (uLightningColor < 1.5 ? 0.5 : 0.8));
    color += lightningCol * lightningVal;
  }
`,
  },

  {
    id: 'gen-analog-oscillo',
    uniforms: `uniform float uAnalogOscilloEnabled;
uniform float uAnalogOscilloOpacity;
uniform float uAnalogOscilloMode;
uniform float uAnalogOscilloThickness;
uniform float uAnalogOscilloGlow;
uniform float uAnalogOscilloColor;
`,
    functions: `float analogOscillo(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float v = 0.0;
  float mode = floor(uAnalogOscilloMode + 0.5);
  if (mode > 0.5 && mode < 1.5) {
    p = vec2(p.y, p.x);
  } else if (mode > 1.5 && mode < 2.5) {
    p = vec2(length(p - 0.5), p.x);
  } else if (mode > 2.5) {
    p.x = fract(p.x + sin(t * 0.2) * 0.2);
  }
  
  float wave = getWaveform(p.x);
  float jitter = (hash21(vec2(t * 100.0, p.y)) - 0.5) * 0.01;
  float dist = abs(p.y - 0.5 - wave * 0.5 + jitter);
  float thickness = uAnalogOscilloThickness; 
  float glow = uAnalogOscilloGlow;
  
  v = smoothstep(thickness, 0.0, dist);
  v += exp(-dist * 20.0) * glow;
  
  return clamp(v, 0.0, 1.0) * uAnalogOscilloOpacity * (1.0 + audio * 0.5);
}`,
    mainCall: `  if (uAnalogOscilloEnabled > 0.5) {
    float oscVal = analogOscillo(effectUv, uTime, mid);
    vec3 oscCol = getPaletteColor(uAnalogOscilloColor < 0.5 ? 0.1 : (uAnalogOscilloColor < 1.5 ? 0.4 : 0.7));
    color += oscCol * oscVal;
  }
`,
  },

  {
    id: 'gen-speaker-cone',
    uniforms: `uniform float uSpeakerConeEnabled;
uniform float uSpeakerConeOpacity;
uniform float uSpeakerConeForce;
`,
    functions: `vec3 speakerPulse(vec2 uv, float bass) {
  vec2 centered = uv - 0.5;
  float dist = length(centered);
  // Add baseline visibility (0.3) plus audio reactivity
  float drive = clamp(0.3 + bass * uSpeakerConeForce * 1.5, 0.3, 2.0);
  float ringRadius = 0.28 + drive * 0.06;
  float ringWidth = 0.008 + drive * 0.005;
  float ring = smoothstep(ringRadius + ringWidth, ringRadius, dist) -
    smoothstep(ringRadius + ringWidth * 1.5, ringRadius + ringWidth, dist);
  float glow = exp(-abs(dist - ringRadius) * 40.0) * (0.3 + drive * 0.4);
  float cone = smoothstep(0.55, 0.0, dist) * (0.25 + drive * 0.35);
  vec3 col = mix(getPaletteColor(0.25 + drive * 0.1), getPaletteColor(0.85), 0.35 + drive * 0.2);
  return col * (ring + glow + cone) * uSpeakerConeOpacity;
}`,
    mainCall: `  if (uSpeakerConeEnabled > 0.5) {
    color += speakerPulse(effectUv, low);
  }
`,
  },

  {
    id: 'gen-glitch-scanline',
    uniforms: `uniform float uGlitchScanlineEnabled;
uniform float uGlitchScanlineSpeed;
uniform float uGlitchScanlineCount;
uniform float uGlitchScanlineOpacity;
`,
    functions: `vec3 glitchScanline(vec2 uv, float t, float audio) {
  float speed = uGlitchScanlineSpeed;
  float scan = sin(uv.y * 100.0 * uGlitchScanlineCount + t * speed) * 0.5 + 0.5;

  float blockY = floor(uv.y * 20.0);
  float blockHash = hash21(vec2(floor(t * speed * 3.0), blockY));
  float hShift = 0.0;
  if (blockHash > 0.85) {
    hShift = (hash21(vec2(t * speed * 5.0, blockY)) - 0.5) * 0.2;
  }
  vec2 glitchUv = vec2(uv.x + hShift, uv.y);

  float tearLine = smoothstep(0.01, 0.0, abs(fract(uv.y * 15.0 + t * speed * 0.5) - 0.5)) * 0.6;
  float flicker = step(0.92, hash21(vec2(floor(t * 20.0), 0.0))) * 0.4;

  vec3 col = vec3(scan * 0.6);
  col += getPaletteColor(fract(blockY * 0.1 + t * 0.05)) * abs(hShift) * 5.0;
  col += vec3(tearLine);
  col *= (1.0 - flicker);

  if (blockHash > 0.93) {
    col = vec3(1.0, 0.1, 0.1) * (0.5 + audio);
  }

  return col * uGlitchScanlineOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uGlitchScanlineEnabled > 0.5) {
    color += glitchScanline(effectUv, uTime, low);
  }
`,
  },

  {
    id: 'gen-laser-starfield',
    uniforms: `uniform float uLaserStarfieldEnabled;
uniform float uLaserStarfieldSpeed;
uniform float uLaserStarfieldDensity;
uniform float uLaserStarfieldOpacity;
`,
    functions: `vec3 laserStarfield(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  vec3 col = vec3(0.0);
  float layers = 3.0;
  for (float i = 0.0; i < layers; i += 1.0) {
    float depth = fract(t * uLaserStarfieldSpeed * 0.1 + i/layers);
    float scale = mix(20.0, 0.1, depth);
    float fade = depth * smoothstep(1.0, 0.8, depth);
    vec2 gv = p * scale + i * 453.2;
    vec2 id = floor(gv);
    vec2 f = fract(gv) - 0.5;
    float rnd = hash21(id);
    if(rnd > 1.0 - uLaserStarfieldDensity * 0.2) {
      float star = smoothstep(0.1, 0.0, length(f));
      col += getPaletteColor(rnd) * star * fade;
    }
  }
  return col * uLaserStarfieldOpacity * (1.0 + audio * 0.5);
}`,
    mainCall: `  if (uLaserStarfieldEnabled > 0.5) {
    color += laserStarfield(effectUv, uTime, high);
  }
`,
  },

  {
    id: 'gen-pulsing-ribbons',
    uniforms: `uniform float uPulsingRibbonsEnabled;
uniform float uPulsingRibbonsCount;
uniform float uPulsingRibbonsWidth;
uniform float uPulsingRibbonsOpacity;
`,
    functions: `vec3 pulsingRibbons(vec2 uv, float t, float audio) {
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < uPulsingRibbonsCount; i += 1.0) {
    float offset = i * 0.2;
    float wave = sin(uv.x * 5.0 + t * 2.0 + offset) * 0.2;
    wave += sin(uv.x * 10.0 - t * 1.5) * 0.1;
    float d = abs(uv.y - 0.5 - wave);
    float ribbon = smoothstep(uPulsingRibbonsWidth, 0.0, d);
    col += getPaletteColor(fract(i * 0.3 + t * 0.1)) * ribbon;
  }
  return col * uPulsingRibbonsOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uPulsingRibbonsEnabled > 0.5) {
    color += pulsingRibbons(effectUv, uTime, mid);
  }
`,
  },

  {
    id: 'gen-electric-arc',
    uniforms: `uniform float uElectricArcEnabled;
uniform float uElectricArcRadius;
uniform float uElectricArcChaos;
uniform float uElectricArcOpacity;
`,
    functions: `vec3 electricArc(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  float d = length(p);
  float arc = abs(d - uElectricArcRadius);
  float noise = fbm(p * uElectricArcChaos + t * 2.0);
  float val = smoothstep(0.05, 0.0, arc + noise * 0.1);
  return getPaletteColor(fract(t * 0.1 + noise)) * val * uElectricArcOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uElectricArcEnabled > 0.5) {
    color += electricArc(effectUv, uTime, mid);
  }
`,
  },

  {
    id: 'gen-pyro-burst',
    uniforms: `uniform float uPyroBurstEnabled;
uniform float uPyroBurstForce;
uniform float uPyroBurstOpacity;
`,
    functions: `vec3 pyroBurst(vec2 uv, float t, float peak) {
  vec2 p = uv - 0.5;
  p.x *= uAspect;
  float d = length(p);
  float angle = atan(p.y, p.x);
  float burst = smoothstep(0.1, 0.0, abs(sin(angle * 10.0 + t * 10.0))) * smoothstep(uPyroBurstForce * peak, 0.0, d);
  return getPaletteColor(fract(t * 0.5 + d)) * burst * uPyroBurstOpacity;
}`,
    mainCall: `  if (uPyroBurstEnabled > 0.5) {
    color += pyroBurst(effectUv, uTime, uPeak);
  }
`,
  },

  {
    id: 'gen-geo-wireframe',
    uniforms: `uniform float uGeoWireframeEnabled;
uniform float uGeoWireframeShape;
uniform float uGeoWireframeScale;
uniform float uGeoWireframeOpacity;
`,
    functions: `vec3 geoWireframe(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p = rotate2d(p, t * 0.5);
  float shape = 0.0;
  if(uGeoWireframeShape < 0.5) shape = abs(sdBox(p, vec2(uGeoWireframeScale))) - 0.01;
  else shape = abs(sdEquilateralTriangle(p, uGeoWireframeScale)) - 0.01;
  float val = smoothstep(0.02, 0.0, shape);
  return getPaletteColor(fract(t * 0.1)) * val * uGeoWireframeOpacity * (1.0 + audio * 0.5);
}`,
    mainCall: `  if (uGeoWireframeEnabled > 0.5) {
    color += geoWireframe(effectUv, uTime, low);
  }
`,
  },

  {
    id: 'gen-signal-noise',
    uniforms: `uniform float uSignalNoiseEnabled;
uniform float uSignalNoiseOpacity;
uniform float uSignalNoiseAmount;
uniform float uSignalNoiseAssetEnabled;
uniform sampler2D uSignalNoiseAsset;
`,
    functions: `vec3 signalNoise(vec2 uv, float t, vec3 baseColor) {
  float n = hash21(uv * 200.0 + t * 10.0);
  float n2 = hash21(floor(uv * 80.0) + t * 5.0);

  float scanline = step(0.97, hash21(vec2(t * 7.0, floor(uv.y * 30.0))));
  float hShift = scanline * (hash21(vec2(t * 13.0, floor(uv.y * 30.0))) - 0.5) * 0.15;
  float staticGrain = n * 0.5 + n2 * 0.3;
  float burst = scanline * 1.5;

  vec3 noiseCol = getPaletteColor(fract(n + t * 0.1)) * (staticGrain + burst);
  noiseCol += vec3(scanline) * 0.4;

  return mix(baseColor, noiseCol, uSignalNoiseAmount) * uSignalNoiseOpacity;
}`,
    mainCall: `  if (uSignalNoiseEnabled > 0.5) {
    vec3 base = vec3(0.0);
    if (uSignalNoiseAssetEnabled > 0.5) {
      base = texture(uSignalNoiseAsset, effectUv).rgb;
    }
    color += signalNoise(effectUv, uTime, base);
  }
`,
  },

  {
    id: 'gen-ribbon-tunnel',
    uniforms: `uniform float uRibbonTunnelEnabled;
uniform float uRibbonTunnelTwist;
uniform float uRibbonTunnelSpeed;
uniform float uRibbonTunnelOpacity;
`,
    functions: `vec3 ribbonTunnel(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);

  float z = 1.0 / (r + 0.01);
  vec3 col = vec3(0.0);

  for (float i = 0.0; i < 3.0; i += 1.0) {
    float offset = i * 0.8;
    float twist = a + z * uRibbonTunnelTwist * (1.0 + i * 0.3) + t * uRibbonTunnelSpeed + offset;
    float ribbon = smoothstep(0.15, 0.0, abs(sin(twist * (4.0 + i))));
    ribbon *= smoothstep(0.0, 0.4, r);
    float glow = exp(-abs(sin(twist * (4.0 + i))) * 6.0) * 0.4;
    glow *= smoothstep(0.0, 0.3, r);
    col += getPaletteColor(fract(z * 0.15 + i * 0.33 + t * 0.03)) * (ribbon + glow);
  }

  float depth = smoothstep(2.0, 0.5, z) * 0.6;
  col += getPaletteColor(fract(z * 0.1 + 0.5)) * depth * smoothstep(0.0, 0.3, r);

  return col * uRibbonTunnelOpacity * (1.0 + audio * 0.8);
}`,
    mainCall: `  if (uRibbonTunnelEnabled > 0.5) {
    color += ribbonTunnel(effectUv, uTime, mid);
  }
`,
  },

  {
    id: 'gen-fractal-tunnel',
    uniforms: `uniform float uFractalTunnelEnabled;
uniform float uFractalTunnelSpeed;
uniform float uFractalTunnelComplexity;
uniform float uFractalTunnelOpacity;
`,
    functions: `vec3 fractalTunnel(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= uAspect;

  float col = 0.0;
  float z = t * uFractalTunnelSpeed;
  float glow = 0.0;
  vec2 p0 = p;

  for (float i = 0.0; i < 8.0; i += 1.0) {
    p = abs(p) / dot(p, p) - (0.5 + audio * 0.1);
    p = rotate2d(p, z * 0.15 + i * 0.2);
    float d = length(p);
    float fade = exp(-d * max(0.5, 5.0 - uFractalTunnelComplexity));
    col += fade;
    glow += smoothstep(0.3, 0.0, d) * (1.0 / (i + 1.0));
  }

  col *= 0.25;
  vec3 c = getPaletteColor(fract(col * 0.3 + z * 0.05)) * col;
  c += getPaletteColor(fract(col * 0.5 + 0.3)) * glow * 0.4;

  return c * uFractalTunnelOpacity * (1.0 + audio * 0.8);
}`,
    mainCall: `  if (uFractalTunnelEnabled > 0.5) {
    color += fractalTunnel(effectUv, uTime, low);
  }
`,
  },

  {
    id: 'gen-circuit-conduit',
    uniforms: `uniform float uCircuitConduitEnabled;
uniform float uCircuitConduitSpeed;
uniform float uCircuitConduitOpacity;
`,
    functions: `vec3 circuitConduit(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  float r = max(abs(p.x), abs(p.y)); // Square tunnel
  float z = 1.0 / (r + 0.01);
  vec2 tu = vec2(atan(p.y, p.x) / 1.57, z + t * uCircuitConduitSpeed);
  
  float grid = step(0.95, fract(tu.x * 4.0)) + step(0.95, fract(tu.y * 10.0));
  float pulses = step(0.98, fract(tu.y * 2.0 - t * 5.0));
  
  return getPaletteColor(fract(z * 0.1)) * (grid + pulses * 2.0) * uCircuitConduitOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uCircuitConduitEnabled > 0.5) {
    color += circuitConduit(effectUv, uTime, low);
  }
`,
  },

  {
    id: 'gen-aura-portal',
    uniforms: `uniform float uAuraPortalEnabled;
uniform float uAuraPortalColor;
uniform float uAuraPortalOpacity;
`,
    functions: `vec3 auraPortal(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float d = length(p);
  float a = atan(p.y, p.x);

  float core = exp(-d * 4.0) * (1.5 + audio);
  float ring1 = smoothstep(0.03, 0.0, abs(d - 0.3 - audio * 0.1)) * 0.8;
  float ring2 = smoothstep(0.04, 0.0, abs(d - 0.55 - audio * 0.05)) * 0.5;
  float ring3 = smoothstep(0.05, 0.0, abs(d - 0.8)) * 0.3;

  float pulse = sin(d * 12.0 - t * 2.0) * 0.5 + 0.5;
  pulse *= smoothstep(1.0, 0.2, d);

  float rays = smoothstep(0.4, 0.0, abs(sin(a * 6.0 + t * 0.5))) * smoothstep(1.0, 0.1, d) * 0.3;

  float baseHue = uAuraPortalColor < 0.5 ? 0.2 : 0.8;
  vec3 coreCol = getPaletteColor(baseHue) * core;
  vec3 ringCol = getPaletteColor(baseHue + 0.1) * (ring1 + ring2 + ring3);
  vec3 pulseCol = getPaletteColor(baseHue + 0.2) * pulse * 0.35;
  vec3 rayCol = getPaletteColor(baseHue + 0.3) * rays;

  return (coreCol + ringCol + pulseCol + rayCol) * uAuraPortalOpacity;
}`,
    mainCall: `  if (uAuraPortalEnabled > 0.5) {
    color += auraPortal(effectUv, uTime, low);
  }
`,
  },

  {
    id: 'gen-freq-terrain',
    uniforms: `uniform float uFreqTerrainEnabled;
uniform float uFreqTerrainScale;
uniform float uFreqTerrainOpacity;
`,
    functions: `vec3 frequencyTerrain(vec2 uv, float t, float audio) {
  vec3 col = vec3(0.0);
  float bandF = uv.x * 64.0;
  float bandFloor = floor(bandF);
  float amp = uSpectrum[int(clamp(bandFloor, 0.0, 63.0))];

  float bandNextF = min(bandFloor + 1.0, 63.0);
  float ampNext = uSpectrum[int(bandNextF)];
  float fr = fract(bandF);
  float smoothAmp = mix(amp, ampNext, fr);

  float barHeight = smoothAmp * uFreqTerrainScale;
  float barBase = 0.5 - barHeight * 0.5;
  float barTop = 0.5 + barHeight * 0.5;
  float inBar = step(barBase, uv.y) * step(uv.y, barTop);

  float edge = smoothstep(0.02, 0.0, abs(uv.y - barTop));
  edge += smoothstep(0.02, 0.0, abs(uv.y - barBase));

  float glow = exp(-abs(uv.y - barTop) * 15.0) * smoothAmp;
  glow += exp(-abs(uv.y - barBase) * 15.0) * smoothAmp;

  vec3 barCol = getPaletteColor(smoothAmp * 0.8 + 0.1) * inBar * (0.4 + smoothAmp * 0.6);
  vec3 edgeCol = getPaletteColor(smoothAmp * 0.6 + 0.3) * edge;
  vec3 glowCol = getPaletteColor(smoothAmp * 0.4 + 0.5) * glow * 0.5;

  col = barCol + edgeCol + glowCol;
  return col * uFreqTerrainOpacity;
}`,
    mainCall: `  if (uFreqTerrainEnabled > 0.5) {
    color += frequencyTerrain(effectUv, uTime, mid);
  }
`,
  },

  {
    id: 'gen-data-stream',
    uniforms: `uniform float uDataStreamEnabled;
uniform float uDataStreamSpeed;
uniform float uDataStreamOpacity;
`,
    functions: `vec3 dataStream(vec2 uv, float t, float audio) {
  vec2 gv = fract(uv * vec2(20.0, 1.0) + vec2(0.0, t * uDataStreamSpeed));
  float line = step(0.98, gv.x);
  float bits = step(0.9, hash21(floor(uv * vec2(20.0, 10.0) + vec2(0.0, t * 5.0))));
  return getPaletteColor(fract(uv.x * 0.1 + t * 0.05)) * (line + bits) * uDataStreamOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uDataStreamEnabled > 0.5) {
    color += dataStream(effectUv, uTime, low);
  }
`,
  },

  {
    id: 'gen-caustic-liquid',
    uniforms: `uniform float uCausticLiquidEnabled;
uniform float uCausticLiquidSpeed;
uniform float uCausticLiquidOpacity;
`,
    functions: `vec3 causticLiquid(vec2 uv, float t, float audio) {
  vec2 p = uv * 8.0;
  float swirl = 0.0;
  for (float i = 1.0; i < 5.0; i += 1.0) {
    p.x += 0.3 / i * sin(i * 3.0 * p.y + t * uCausticLiquidSpeed + 0.3 * i) + 0.5;
    p.y += 0.3 / i * sin(i * 3.0 * p.x + t * uCausticLiquidSpeed + 0.3 * i) + 0.5;
    swirl += length(p) * 0.05;
  }
  float c = sin(p.x + p.y + swirl) * 0.5 + 0.5;
  return getPaletteColor(c) * smoothstep(0.0, 1.0, c) * uCausticLiquidOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uCausticLiquidEnabled > 0.5) {
    color += causticLiquid(effectUv, uTime, mid);
  }
`,
  },

  {
    id: 'gen-shimmer-veil',
    uniforms: `uniform float uShimmerVeilEnabled;
uniform float uShimmerVeilComplexity;
uniform float uShimmerVeilOpacity;
`,
    functions: `vec3 shimmerVeil(vec2 uv, float t, float audio) {
  float v = sin(uv.x * 10.0 + t) * sin(uv.y * uShimmerVeilComplexity + t * 0.5);
  float pattern = smoothstep(0.1, 0.0, abs(v));
  return getPaletteColor(fract(t * 0.1)) * pattern * uShimmerVeilOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uShimmerVeilEnabled > 0.5) {
    color += shimmerVeil(effectUv, uTime, high);
  }
`,
  },

  {
    id: 'gen-nebula-cloud',
    uniforms: `uniform float uNebulaCloudEnabled;
uniform float uNebulaCloudDensity;
uniform float uNebulaCloudSpeed;
uniform float uNebulaCloudOpacity;
`,
    functions: `vec3 nebulaCloud(vec2 uv, float t, float audio) {
  vec2 p = uv * uNebulaCloudDensity;
  float n = fbm(p + t * uNebulaCloudSpeed);
  float n2 = fbm(p * 2.0 - t * uNebulaCloudSpeed * 0.5);
  vec3 col = getPaletteColor(n + n2 + audio * 0.2);
  return col * pow(n, 3.0) * uNebulaCloudOpacity;
}`,
    mainCall: `  if (uNebulaCloudEnabled > 0.5) color += nebulaCloud(effectUv, uTime, high);
`
  },

  {
    id: 'gen-circuit-board',
    uniforms: `uniform float uCircuitBoardEnabled;
uniform float uCircuitBoardComplexity;
uniform float uCircuitBoardGrowth;
uniform float uCircuitBoardOpacity;
`,
    functions: `vec3 circuitBoard(vec2 uv, float t, float audio) {
  vec2 p = uv * uCircuitBoardComplexity;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float h = hash21(id);
  float growth = fract(t * uCircuitBoardGrowth + h);
  float line = smoothstep(0.1, 0.0, abs(f.x - 0.5)) * step(f.y, growth);
  float node = smoothstep(0.2, 0.0, length(f - 0.5)) * step(0.9, h);
  return getPaletteColor(h) * (line + node * (1.0 + audio)) * uCircuitBoardOpacity;
}`,
    mainCall: `  if (uCircuitBoardEnabled > 0.5) color += circuitBoard(effectUv, uTime, mid);
`
  },

  {
id: 'gen-lorenz-attractor',
    uniforms: `uniform float uLorenzAttractorEnabled;
uniform float uLorenzAttractorSpeed;
uniform float uLorenzAttractorChaos;
uniform float uLorenzAttractorOpacity;
`,
    functions: `vec3 lorenzAttractor(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float d = 10000000000.0;
  float dt = 0.01 * uLorenzAttractorSpeed;
  float trail = 50.0 + audio * 30.0;
  float start = mod(t * uLorenzAttractorSpeed * 5.0, 200.0);
  vec3 curr = vec3(0.1, 0.0, 0.0);
  for (float i = 0.0; i < 250.0; i += 1.0) {
    vec3 next;
    next.x = curr.x + dt * 10.0 * (curr.y - curr.x);
    next.y = curr.y + dt * (curr.x * (28.0 - curr.z) - curr.y);
    next.z = curr.z + dt * (curr.x * curr.y - (8.0/3.0) * curr.z);
    curr = next;
    if (i >= start && i < start + trail) {
      float fade = 1.0 - (i - start) / trail;
      float dist = length(p - curr.xy * 0.05 * uLorenzAttractorChaos);
      d = min(d, dist / fade);
    }
  }
  return getPaletteColor(t * 0.1) * smoothstep(0.05, 0.0, d) * uLorenzAttractorOpacity;
}`,
    mainCall: `  if (uLorenzAttractorEnabled > 0.5) color += lorenzAttractor(effectUv, uTime, low);
`
  },

  {
    id: 'gen-mandala-spinner',
    uniforms: `uniform float uMandalaSpinnerEnabled;
uniform float uMandalaSpinnerSpeed;
uniform float uMandalaSpinnerSides;
uniform float uMandalaSpinnerOpacity;
`,
    functions: `vec3 mandalaSpinner(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x) + t * uMandalaSpinnerSpeed;
  float sides = uMandalaSpinnerSides;
  a = mod(a, 6.28/sides) - 3.14/sides;
  p = vec2(cos(a), sin(a)) * r;
  float mask = smoothstep(0.02, 0.0, abs(p.y - sin(p.x * 10.0 + t) * 0.1));
  return getPaletteColor(r + audio) * mask * uMandalaSpinnerOpacity;
}`,
    mainCall: `  if (uMandalaSpinnerEnabled > 0.5) color += mandalaSpinner(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-starburst-galaxy',
    uniforms: `uniform float uStarburstGalaxyEnabled;
uniform float uStarburstGalaxyCount;
uniform float uStarburstGalaxyForce;
uniform float uStarburstGalaxyOpacity;
`,
    functions: `vec3 starburstGalaxy(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= uAspect;
  vec3 col = vec3(0.0);
  float count = clamp(uStarburstGalaxyCount, 10.0, 200.0);
  for (float i = 0.0; i < 200.0; i += 1.0) {
    if (i >= count) break;
    float h = hash21(vec2(i, 123.4));
    float h2 = hash21(vec2(i, 456.7));
    float burst = fract(t * uStarburstGalaxyForce * (0.5 + h2 * 0.5) + h);
    float angle = h * 6.28 + h2 * 0.5;
    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 pos = dir * burst * 1.5;
    float size = mix(0.06, 0.02, burst);
    float star = smoothstep(size, 0.0, length(p - pos));
    float trail = smoothstep(size * 3.0, 0.0, length(p - pos)) * 0.3;
    float fade = (1.0 - burst) * (1.0 - burst);
    col += getPaletteColor(fract(h + t * 0.05)) * (star + trail) * fade;
  }
  return col * uStarburstGalaxyOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uStarburstGalaxyEnabled > 0.5) color += starburstGalaxy(effectUv, uTime, high);
`
  },

  {
    id: 'gen-digital-rain-v2',
    uniforms: `uniform float uDigitalRainV2Enabled;
uniform float uDigitalRainV2Density;
uniform float uDigitalRainV2Speed;
uniform float uDigitalRainV2Opacity;
`,
    functions: `vec3 digitalRainV2(vec2 uv, float t, float audio) {
  float density = clamp(uDigitalRainV2Density, 0.0, 1.0);
  float columns = mix(10.0, 60.0, density);
  vec2 p = uv * vec2(columns, 1.0);
  float col_id = floor(p.x);
  float h = hash21(vec2(col_id, 456.7));
  float speed = uDigitalRainV2Speed * (0.5 + h);
  float drop = fract(uv.y + t * speed + h);
  float mask = step(0.9, fract(p.x)) * smoothstep(0.2, 0.0, abs(drop - 0.5));
  mask *= mix(0.7, 1.2, density);
  return getPaletteColor(h) * mask * uDigitalRainV2Opacity * (1.0 + audio);
}`,
    mainCall: `  if (uDigitalRainV2Enabled > 0.5) color += digitalRainV2(effectUv, uTime, low);
`
  },

  {
    id: 'gen-lava-flow',
    uniforms: `uniform float uLavaFlowEnabled;
uniform float uLavaFlowViscosity;
uniform float uLavaFlowHeat;
uniform float uLavaFlowOpacity;
`,
    functions: `vec3 lavaFlow(vec2 uv, float t, float audio) {
  vec2 p = uv * 3.0;
  float n = fbm(p + vec2(t * 0.2 * uLavaFlowViscosity));
  float heat = clamp(n * uLavaFlowHeat + audio * 0.2, 0.0, 1.0);
  return getPaletteColor(heat) * heat * uLavaFlowOpacity;
}`,
    mainCall: `  if (uLavaFlowEnabled > 0.5) color += lavaFlow(effectUv, uTime, low);
`
  },

  {
    id: 'gen-crystal-growth',
    uniforms: `uniform float uCrystalGrowthEnabled;
uniform float uCrystalGrowthRate;
uniform float uCrystalGrowthSharpness;
uniform float uCrystalGrowthOpacity;
`,
    functions: `vec3 crystalGrowth(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float d = 10000000000.0;
  for (float i = 0.0; i < 8.0; i += 1.0) {
    p = abs(p) - 0.3;
    p = rotate2d(p, t * uCrystalGrowthRate * 0.15);
    d = min(d, length(p) * 0.5);
  }
  // Make the edge much more visible with multiple glow layers
  float edge = smoothstep(0.05 * uCrystalGrowthSharpness, 0.0, d);
  float glow = smoothstep(0.15 * uCrystalGrowthSharpness, 0.0, d) * 0.5;
  return (getPaletteColor(audio) * edge + getPaletteColor(audio + 0.3) * glow) * uCrystalGrowthOpacity * (1.0 + audio * 0.5);
}`,
    mainCall: `  if (uCrystalGrowthEnabled > 0.5) color += crystalGrowth(effectUv, uTime, high);
`
  },

  {
    id: 'gen-techno-grid',
    uniforms: `uniform float uTechnoGridEnabled;
uniform float uTechnoGridSpeed;
uniform float uTechnoGridHeight;
uniform float uTechnoGridOpacity;
`,
    functions: `vec3 technoGrid3D(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  float z = 1.0 / (abs(p.y) + 0.01);
  vec2 grid_uv = vec2(p.x * z, z + t * uTechnoGridSpeed);
  float grid = step(0.95, fract(grid_uv.x * 5.0)) + step(0.95, fract(grid_uv.y * 5.0));
  float towers = step(0.98, hash21(floor(grid_uv * 5.0))) * z * uTechnoGridHeight * 0.1;
  return getPaletteColor(fract(z * 0.1 + t * 0.05)) * (grid + towers) * uTechnoGridOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uTechnoGridEnabled > 0.5) color += technoGrid3D(effectUv, uTime, low);
`
  },

  {
    id: 'gen-magnetic-field',
    uniforms: `uniform float uMagneticFieldEnabled;
uniform float uMagneticFieldDensity;
uniform float uMagneticFieldStrength;
uniform float uMagneticFieldOpacity;
`,
    functions: `vec3 magneticField(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  vec3 col = vec3(0.0);
  float lines = uMagneticFieldDensity;
  for (float i = 0.0; i < 20.0; i += 1.0) {
    if (i >= float(lines)) break;
    float h = i / lines;
    vec2 force = vec2(sin(t + h * 6.28), cos(t * 0.5 + h * 6.28)) * uMagneticFieldStrength;
    float d = abs(length(p - force) - 0.5);
    col += getPaletteColor(h) * smoothstep(0.02, 0.0, d);
  }
  return col * uMagneticFieldOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uMagneticFieldEnabled > 0.5) color += magneticField(effectUv, uTime, high);
`
  },

  {
    id: 'gen-prism-shards',
    uniforms: `uniform float uPrismShardsEnabled;
uniform float uPrismShardsCount;
uniform float uPrismShardsRefraction;
uniform float uPrismShardsOpacity;
`,
    functions: `vec3 prismShards(vec2 uv, float t, float audio) {
  vec2 p = uv;
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 8.0; i += 1.0) {
    if (i >= float(uPrismShardsCount)) break;
    // Position shards in a more visible pattern
    float angle = i * 6.28 / float(uPrismShardsCount);
    vec2 pos = 0.5 + vec2(cos(angle), sin(angle)) * 0.3 * (0.5 + 0.5 * sin(t * 0.3));
    float dist = length(p - pos);
    float refract_val = uPrismShardsRefraction * sin(t * 2.0 + i);
    float size = 0.15 + 0.1 * sin(t + i);
    float edge = smoothstep(size, 0.0, dist);
    float glow = smoothstep(size * 2.5, 0.0, dist) * 0.4;
    col += (getPaletteColor(dist + refract_val) * edge + getPaletteColor(dist + refract_val + 0.2) * glow);
  }
  return col * uPrismShardsOpacity * (1.0 + audio * 0.5);
}`,
    mainCall: `  if (uPrismShardsEnabled > 0.5) color += prismShards(effectUv, uTime, high);
`
  },

  {
    id: 'gen-neural-net',
    uniforms: `uniform float uNeuralNetEnabled;
uniform float uNeuralNetDensity;
uniform float uNeuralNetActivity;
uniform float uNeuralNetOpacity;
`,
    functions: `vec3 neuralNet(vec2 uv, float t, float audio) {
  vec2 p = uv * 6.0 * uNeuralNetDensity;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float node = smoothstep(0.12, 0.0, length(f - 0.5));
  float connections = 0.0;
  for (float y = -1.0; y <= 1.0; y += 1.0) {
    for (float x = -1.0; x <= 1.0; x += 1.0) {
      if (x == 0.0 && y == 0.0) continue;
      vec2 neighbor = vec2(x, y);
      float h = hash21(id + neighbor);
      float pulse = 0.5 + 0.5 * sin(t * uNeuralNetActivity + h * 6.28);
      if (pulse > 0.25) {
        vec2 target = neighbor * 0.5;
        vec2 toTarget = target - f;
        float lineDist = abs(toTarget.x * 0.5 - toTarget.y) / length(toTarget);
        float lineFade = 1.0 - length(f - 0.5) * 2.0;
        connections += smoothstep(0.03, 0.0, lineDist) * pulse * max(0.0, lineFade);
      }
    }
  }
  return getPaletteColor(audio + t * 0.05) * (node + connections * 0.8) * uNeuralNetOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uNeuralNetEnabled > 0.5) color += neuralNet(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-aurora-chord',
    uniforms: `uniform float uAuroraChordEnabled;
uniform float uAuroraChordColorRange;
uniform float uAuroraChordWaviness;
uniform float uAuroraChordOpacity;
`,
    functions: `vec3 auroraChord(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= uAspect;
  float v = 0.0;
  float audioAmp = 1.0 + audio * 2.0;
  for (float i = 0.0; i < 3.0; i += 1.0) {
    float shift = i * uAuroraChordColorRange;
    float wave1 = sin(p.x * 3.0 + t + i * 0.5) * sin(p.y * 2.0 - t * 0.3 + i * 0.3);
    float wave2 = sin(p.x * 2.5 + t * 0.7 + i * 0.8) * sin(p.y * 1.5 + t * 0.4);
    v += (wave1 + wave2 * 0.5) * audioAmp * uAuroraChordWaviness;
  }
  v = v * 0.15 + 0.5;
  float glow = smoothstep(0.8, 0.2, length(p)) * 0.3;
  return getPaletteColor(v * 0.3 + t * 0.05 + audio * 0.2) * (abs(v - 0.5) * 2.0 + glow) * uAuroraChordOpacity;
}`,
    mainCall: `  if (uAuroraChordEnabled > 0.5) color += auroraChord(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-vhs-glitch',
    uniforms: `uniform float uVhsGlitchEnabled;
uniform float uVhsGlitchJitter;
uniform float uVhsGlitchNoise;
uniform float uVhsGlitchOpacity;
`,
    functions: `vec3 vhsGlitch(vec2 uv, float t, float audio) {
  vec2 p = uv;
  p.x += (hash21(vec2(t, floor(uv.y * 10.0))) - 0.5) * uVhsGlitchJitter * 0.1;
  float noise = hash21(uv + t) * uVhsGlitchNoise;
  vec3 col = vec3(noise);
  if (abs(uv.y - fract(t)) < 0.01) col.r = 1.0;
  return col * uVhsGlitchOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uVhsGlitchEnabled > 0.5) color += vhsGlitch(effectUv, uTime, low);
`
  },

  {
    id: 'gen-moire-pattern',
    uniforms: `uniform float uMoirePatternEnabled;
uniform float uMoirePatternScale;
uniform float uMoirePatternSpeed;
uniform float uMoirePatternOpacity;
`,
    functions: `vec3 moirePattern(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * uMoirePatternScale;

  // First grating - grid pattern
  float freq1 = 10.0;
  float v1 = sin(p.x * freq1 + t * uMoirePatternSpeed) * sin(p.y * freq1);

  // Second grating - rotated grid with slightly different frequency
  vec2 p2 = rotate2d(p, t * 0.3 * uMoirePatternSpeed);
  float freq2 = 10.5; // Slightly different frequency for more pronounced moire
  float v2 = sin(p2.x * freq2) * sin(p2.y * freq2);

  // Moire interference pattern
  float moire = v1 * v2;

  // Enhance contrast
  moire = moire * 0.5 + 0.5; // Map to 0-1
  moire = pow(moire, 0.7); // Increase contrast

  return getPaletteColor(moire) * uMoirePatternOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uMoirePatternEnabled > 0.5) color += moirePattern(effectUv, uTime, high);
`
  },

  {
    id: 'gen-hypercube',
    uniforms: `uniform float uHypercubeEnabled;
uniform float uHypercubeSpeed;
uniform float uHypercubeProjection;
uniform float uHypercubeOpacity;
`,
    functions: `vec3 hypercube(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float rot = t * uHypercubeSpeed;
  p = rotate2d(p, rot);
  float box = max(abs(p.x), abs(p.y));
  float inner = max(abs(p.x), abs(p.y)) * uHypercubeProjection;
  // Make the outer box much more visible
  float mask = smoothstep(0.6, 0.4, box) * smoothstep(0.3, 0.5, box);
  // Add inner box with glow
  float innerMask = smoothstep(0.35, 0.2, inner) * smoothstep(0.1, 0.25, inner);
  mask += innerMask * 0.5;
  // Add glowing corners
  float cornerDist = max(abs(p.x) - 0.4, abs(p.y) - 0.4);
  float corners = smoothstep(0.1, 0.0, cornerDist);
  mask += corners * 0.3;
  return getPaletteColor(rot + audio * 0.2) * mask * uHypercubeOpacity * (1.0 + audio * 0.5);
}`,
    mainCall: `  if (uHypercubeEnabled > 0.5) color += hypercube(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-fluid-swirl',
    uniforms: `uniform float uFluidSwirlEnabled;
uniform float uFluidSwirlVorticity;
uniform float uFluidSwirlColorMix;
uniform float uFluidSwirlOpacity;
`,
    functions: `vec3 fluidSwirl(vec2 uv, float t, float audio) {
  vec2 p = uv;
  for (float i = 0.0; i < 3.0; i += 1.0) {
    p += sin(p.yx * 4.0 + t) * 0.1 * uFluidSwirlVorticity;
  }
  float swirl = length(p - uv);
  return getPaletteColor(swirl * uFluidSwirlColorMix) * swirl * 10.0 * uFluidSwirlOpacity;
}`,
    mainCall: `  if (uFluidSwirlEnabled > 0.5) color += fluidSwirl(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-ascii-stream',
    uniforms: `uniform float uAsciiStreamEnabled;
uniform float uAsciiStreamResolution;
uniform float uAsciiStreamContrast;
uniform float uAsciiStreamOpacity;
`,
    functions: `vec3 asciiStream(vec2 uv, float t, float audio) {
  vec2 p = floor(uv * uAsciiStreamResolution) / uAsciiStreamResolution;
  float h = hash21(p + floor(t * 10.0));
  float bright = (sin(uv.x * 10.0) + sin(uv.y * 10.0)) * 0.5 + 0.5;
  float mask = step(0.5, fract(h * 10.0));
  return getPaletteColor(h) * mask * bright * uAsciiStreamContrast * uAsciiStreamOpacity;
}`,
    mainCall: `  if (uAsciiStreamEnabled > 0.5) color += asciiStream(effectUv, uTime, high);
`
  },

  {
    id: 'gen-retro-wave',
    uniforms: `uniform float uRetroWaveEnabled;
uniform float uRetroWaveGridSpeed;
uniform float uRetroWaveSunSize;
uniform float uRetroWaveOpacity;
`,
    functions: `vec3 retroWave(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  
  // Custom standalone grid for retroWave
  float z = 1.0 / (abs(p.y + 0.1) + 0.01);
  vec2 grid_uv = vec2(p.x * z, z + t * uRetroWaveGridSpeed);
  float gridLine = step(0.95, fract(grid_uv.x * 5.0)) + step(0.95, fract(grid_uv.y * 5.0));
  float grid = gridLine * smoothstep(0.0, -0.5, p.y); // Only show grid on bottom half
  
  float sunDist = length(p - vec2(0.0, 0.3));
  float sun = smoothstep(uRetroWaveSunSize * 0.5, uRetroWaveSunSize * 0.48, sunDist);
  
  // Retro sun stripes
  if (p.y < 0.3 && fract(p.y * 15.0) < 0.25) sun = 0.0;
  
  vec3 sunCol = getPaletteColor(0.9); 
  vec3 gridCol = getPaletteColor(0.2); 
  
  return (sunCol * sun + gridCol * grid) * uRetroWaveOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uRetroWaveEnabled > 0.5) color += retroWave(effectUv, uTime, low);
`
  },

  {
    id: 'gen-bubble-pop',
    uniforms: `uniform float uBubblePopEnabled;
uniform float uBubblePopPopRate;
uniform float uBubblePopSize;
uniform float uBubblePopOpacity;
`,
    functions: `vec3 bubblePop(vec2 uv, float t, float audio) {
  vec2 p = uv * 5.0;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float h = hash21(id);
  float size = fract(t * uBubblePopPopRate + h) * uBubblePopSize;
  float bubble = smoothstep(size, size - 0.02, length(f - 0.5));
  return getPaletteColor(h) * bubble * uBubblePopOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uBubblePopEnabled > 0.5) color += bubblePop(effectUv, uTime, uPeak);
`
  },

  {
    id: 'gen-sound-wave-3d',
    uniforms: `uniform float uSoundWave3DEnabled;
uniform float uSoundWave3DSmoothness;
uniform float uSoundWave3DAmplitude;
uniform float uSoundWave3DOpacity;
`,
    functions: `vec3 soundWave3D(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float depth = clamp(1.0 - uv.y, 0.0, 1.0);
  float z = mix(0.3, 2.5, depth);
  float smoothness = max(0.2, uSoundWave3DSmoothness);
  float phase = t * 0.15 + depth * 2.5;
  float sampleX = fract((p.x * 0.5 + 0.5) * smoothness + phase);
  float wave = getWaveform(sampleX) * uSoundWave3DAmplitude;
  float amp = (0.12 + audio * 0.5) * (0.6 + depth * 0.8);
  float y = wave * amp;
  float lineY = (p.y + (depth - 0.5) * 0.35) / z;
  float width = mix(0.03, 0.008, depth);
  float d = abs(lineY - y);
  float line = smoothstep(width, 0.0, d);
  vec3 col = getPaletteColor(fract(depth + audio * 0.3 + t * 0.05));
  col *= (0.6 + depth * 0.7);
  return col * line * uSoundWave3DOpacity;
}`,
    mainCall: `  if (uSoundWave3DEnabled > 0.5) color += soundWave3D(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-particle-vortex',
    uniforms: `uniform float uParticleVortexEnabled;
uniform float uParticleVortexSpin;
uniform float uParticleVortexSuction;
uniform float uParticleVortexOpacity;
`,
    functions: `vec3 particleVortex(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float r = length(p);
  float a = atan(p.y, p.x) + t * uParticleVortexSpin + r * uParticleVortexSuction;
  vec2 pv = vec2(cos(a), sin(a)) * r;

  // Create more visible particles with different sizes
  float particles = 0.0;
  for (float i = 0.0; i < 3.0; i += 1.0) {
    float scale = 15.0 + i * 5.0;
    float h = hash21(floor(pv * scale) + i * 10.0);
    float threshold = 0.92 + i * 0.02;
    if (h > threshold) {
      vec2 gridPos = floor(pv * scale);
      vec2 cellCenter = (gridPos + 0.5) / scale;
      float d = length(pv - cellCenter);
      float size = 0.08 + 0.05 * i;
      float glow = smoothstep(size * 1.5, 0.0, d) * 0.5;
      float core = smoothstep(size, 0.0, d);
      particles += core + glow;
    }
  }

  // Add spiral trail effect
  float trail = 0.0;
  for (float i = 0.0; i < 5.0; i += 1.0) {
    float trailAngle = a - i * 0.3;
    vec2 trailPos = vec2(cos(trailAngle), sin(trailAngle)) * r * (1.0 - i * 0.1);
    float trailD = length(p - trailPos);
    trail += smoothstep(0.1 - i * 0.015, 0.0, trailD) * (0.3 - i * 0.05);
  }

  return (getPaletteColor(r + audio * 0.2) * particles + getPaletteColor(r + 0.3) * trail) * uParticleVortexOpacity * (1.0 + audio * 0.5);
}`,
    mainCall: `  if (uParticleVortexEnabled > 0.5) color += particleVortex(effectUv, uTime, low);
`
  },

  {
    id: 'gen-glow-worms',
    uniforms: `uniform float uGlowWormsEnabled;
uniform float uGlowWormsSpeed;
uniform float uGlowWormsLength;
uniform float uGlowWormsOpacity;
`,
    functions: `vec3 glowWorms(vec2 uv, float t, float audio) {
  vec2 p = uv;
  vec3 col = vec3(0.0);

  // Create more visible glow worms with trails
  for (float i = 0.0; i < 8.0; i += 1.0) {
    // Different movement patterns for each worm
    float speedMult = 0.5 + i * 0.15;
    float phase = i * 0.7;
    float radius = 0.25 + 0.15 * sin(t * 0.2 + i);

    vec2 center = vec2(0.5) + vec2(
      sin(t * uGlowWormsSpeed * speedMult + phase),
      cos(t * uGlowWormsSpeed * speedMult * 0.7 + phase)
    ) * radius;

    // Main glow - brighter and more visible
    float d = length(p - center);
    float glow = exp(-d * (15.0 / uGlowWormsLength));
    col += getPaletteColor(audio + i * 0.1) * glow * 1.5;

    // Trail effect - creates a glowing path
    for (float j = 1.0; j <= 10.0; j += 1.0) {
      float trailPhase = phase - j * 0.1;
      vec2 trailPos = vec2(0.5) + vec2(
        sin(t * uGlowWormsSpeed * speedMult + trailPhase),
        cos(t * uGlowWormsSpeed * speedMult * 0.7 + trailPhase)
      ) * radius;
      float trailD = length(p - trailPos);
      float trailGlow = exp(-trailD * (12.0 / uGlowWormsLength)) * (0.5 - j * 0.04);
      col += getPaletteColor(audio + i * 0.1 + j * 0.05) * trailGlow;
    }

    // Core bright spot
    float core = smoothstep(0.08 / uGlowWormsLength, 0.0, d);
    col += vec3(1.0, 0.9, 0.8) * core * 2.0;
  }

  return col * uGlowWormsOpacity * (1.0 + audio * 0.4);
}`,
    mainCall: `  if (uGlowWormsEnabled > 0.5) color += glowWorms(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-mirror-maze',
    uniforms: `uniform float uMirrorMazeEnabled;
uniform float uMirrorMazeRecursion;
uniform float uMirrorMazeAngle;
uniform float uMirrorMazeOpacity;
`,
    functions: `vec3 mirrorMaze(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= uAspect;
  float col = 0.0;
  float edge = 0.0;
  for (float i = 0.0; i < 8.0; i += 1.0) {
    if (i >= float(uMirrorMazeRecursion)) break;
    vec2 prev = p;
    p = abs(p) - 0.2;
    p = rotate2d(p, uMirrorMazeAngle);
    // Detect edges from folding
    edge += smoothstep(0.02, 0.0, abs(prev.x - 0.2));
    edge += smoothstep(0.02, 0.0, abs(prev.x + 0.2));
    edge += smoothstep(0.02, 0.0, abs(prev.y - 0.2));
    edge += smoothstep(0.02, 0.0, abs(prev.y + 0.2));
  }
  // Draw maze edges
  col = edge * 0.3;
  // Add glow based on position
  float d = length(p);
  col += smoothstep(0.5, 0.0, d) * 0.5;
  // Audio reactive pulse
  col *= 1.0 + audio * 0.5;
  return getPaletteColor(d + t + audio * 0.3) * col * uMirrorMazeOpacity;
}`,
    mainCall: `  if (uMirrorMazeEnabled > 0.5) color += mirrorMaze(effectUv, uTime, high);
`
  },

  {
    id: 'gen-pulse-heart',
    uniforms: `uniform float uPulseHeartEnabled;
uniform float uPulseHeartBeats;
uniform float uPulseHeartLayers;
uniform float uPulseHeartOpacity;
`,
    functions: `vec3 pulseHeart(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float r = length(p);
  float pulse = sin(t * 5.0 * uPulseHeartBeats) * 0.1 + 0.5;
  float heart = 0.0;
  for (float i = 0.0; i < 10.0; i += 1.0) {
    if (i >= float(uPulseHeartLayers)) break;
    float radius = pulse * (i / uPulseHeartLayers);
    heart += smoothstep(radius, radius - 0.02, r) - smoothstep(radius - 0.04, radius - 0.06, r);
  }
  return getPaletteColor(fract(pulse * 0.2 + audio)) * heart * uPulseHeartOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uPulseHeartEnabled > 0.5) color += pulseHeart(effectUv, uTime, low);
`
  },

  {
    id: 'gen-data-shards',
    uniforms: `uniform float uDataShardsEnabled;
uniform float uDataShardsSpeed;
uniform float uDataShardsSharpness;
uniform float uDataShardsOpacity;
`,
    functions: `vec3 dataShards(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 5.0; i += 1.0) {
    float h = hash21(vec2(i, 88.8));
    vec2 dir = vec2(cos(t * uDataShardsSpeed + h * 6.28), sin(t * uDataShardsSpeed + h * 6.28));
    float shard = smoothstep(0.1 * uDataShardsSharpness, 0.0, abs(dot(p, dir) - h));
    col += getPaletteColor(h) * shard;
  }
  return col * uDataShardsOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uDataShardsEnabled > 0.5) color += dataShards(effectUv, uTime, high);
`
  },

  {
    id: 'gen-hex-cell',
    uniforms: `uniform float uHexCellEnabled;
uniform float uHexCellScale;
uniform float uHexCellPulse;
uniform float uHexCellOpacity;
`,
    functions: `vec3 hexCell(vec2 uv, float t, float audio) {
  vec2 p = uv * 10.0 * uHexCellScale;
  vec2 r = vec2(1.0, 1.73);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  float d = length(gv);
  float pulse = sin(t * uHexCellPulse) * 0.1 + 0.4;
  float hex = smoothstep(pulse, pulse - 0.05, d);
  return getPaletteColor(d) * hex * uHexCellOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uHexCellEnabled > 0.5) color += hexCell(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-plasma-ball',
    uniforms: `uniform float uPlasmaBallEnabled;
uniform float uPlasmaBallFilaments;
uniform float uPlasmaBallVoltage;
uniform float uPlasmaBallOpacity;
`,
    functions: `vec3 plasmaBall(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float col = 0.0;
  for (float i = 0.0; i < 20.0; i += 1.0) {
    if (i >= float(uPlasmaBallFilaments)) break;
    float h = i * 123.4;
    vec2 target = vec2(sin(t + h), cos(t * 0.5 + h)) * 0.8;
    float line = smoothstep(0.02, 0.0, abs(length(p - target * sin(t)) - 0.1));
    col += line;
  }
  return getPaletteColor(fract(t * 0.1 + audio)) * col * uPlasmaBallVoltage * uPlasmaBallOpacity;
}`,
    mainCall: `  if (uPlasmaBallEnabled > 0.5) color += plasmaBall(effectUv, uTime, uPeak);
`
  },

  {
    id: 'gen-warp-drive',
    uniforms: `uniform float uWarpDriveEnabled;
uniform float uWarpDriveWarp;
uniform float uWarpDriveGlow;
uniform float uWarpDriveOpacity;
`,
    functions: `vec3 warpDrive(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float a = atan(p.y, p.x);
  float r = length(p);
  float streaks = step(0.95, hash21(vec2(floor(a * 20.0), 1.0)));
  float star = streaks * smoothstep(1.0, 0.0, fract(r - t * uWarpDriveWarp));
  return getPaletteColor(fract(a * 0.1 + t * 0.05)) * star * uWarpDriveGlow * uWarpDriveOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uWarpDriveEnabled > 0.5) color += warpDrive(effectUv, uTime, high);
`
  },

  {
    id: 'gen-visual-feedback',
    uniforms: `uniform float uVisualFeedbackEnabled;
uniform float uVisualFeedbackZoom;
uniform float uVisualFeedbackRotation;
uniform float uVisualFeedbackOpacity;
`,
    functions: `vec3 visualFeedback(vec2 uv, float t, float audio) {
  // This is a pseudo-feedback since we can't easily sample the backbuffer here     
  // We simulate it with recursive coordinate warping
  vec2 p = uv;
  float f = 0.0;
  for (float i = 0.0; i < 4.0; i += 1.0) {
    p = (p - 0.5) * uVisualFeedbackZoom + 0.5;
    p = rotate2d(p - 0.5, uVisualFeedbackRotation) + 0.5;
    f += fbm(p * 5.0 + t);
  }  return getPaletteColor(f * 0.2) * f * 0.5 * uVisualFeedbackOpacity;
}`,
    mainCall: `  if (uVisualFeedbackEnabled > 0.5) color += visualFeedback(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-mycelium-growth',
    uniforms: `uniform float uMyceliumGrowthEnabled;
uniform float uMyceliumGrowthSpread;
uniform float uMyceliumGrowthDecay;
uniform float uMyceliumGrowthOpacity;
`,
    functions: `vec3 myceliumGrowth(vec2 uv, float t, float audio) {
  vec2 p = uv * mix(3.0, 8.0, clamp(uMyceliumGrowthSpread, 0.0, 1.0));
  float growthRate = mix(0.03, 0.18, clamp(uMyceliumGrowthDecay, 0.0, 1.0));
  float n = fbm(p + t * (0.08 + growthRate));
  float pattern = smoothstep(0.35, 0.55, n) - smoothstep(0.55, 0.75, n);
  float phase = fract(t * growthRate);
  float life = smoothstep(0.0, 0.2, phase) * smoothstep(1.0, 0.6, phase);
  float pulse = 0.6 + 0.4 * sin(t * (0.6 + growthRate * 2.0));
  float energy = mix(0.7, 1.3, clamp(audio, 0.0, 1.0));
  return getPaletteColor(n + audio) * pattern * life * pulse * energy * uMyceliumGrowthOpacity;
}`,
    mainCall: `  if (uMyceliumGrowthEnabled > 0.5) color += myceliumGrowth(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-laser-beam',
    uniforms: `uniform float uLaserEnabled;
uniform float uLaserOpacity;
uniform float uLaserMode;
uniform float uLaserBeamCount;
uniform float uLaserBeamLength;
uniform float uLaserBeamWidth;
uniform float uLaserRotation;
uniform float uLaserRotationSpeed;
uniform float uLaserSpread;
uniform float uLaserGlow;
uniform float uLaserColorShift;
uniform float uLaserAudioReact;
`,
    functions: `vec3 laserBeam(vec2 uv, float t, float audio) {
  vec2 centered = uv - 0.5;
  centered.x *= uAspect;
  vec3 color = vec3(0.0);
  float beamCount = (uLaserMode > 3.5) ? 1.0 : uLaserBeamCount;

  for (float i = 0.0; i < 16.0; i += 1.0) {
    if (i >= beamCount) break;

    float angle;
    vec2 beamOrigin = vec2(0.0);
    float beamLength = uLaserBeamLength;

    // Mode 0: Radial - beams emanate from center
    if (uLaserMode < 0.5) {
      angle = uLaserRotation + t * uLaserRotationSpeed + i * uLaserSpread / beamCount;
    }
    // Mode 1: Parallel - beams move horizontally
    else if (uLaserMode < 1.5) {
      angle = uLaserRotation;
      float yOffset = (i / beamCount - 0.5) * 0.8;
      beamOrigin = vec2(-0.5, yOffset);
    }
    // Mode 2: Crossing - beams cross in X pattern
    else if (uLaserMode < 2.5) {
      float side = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
      angle = uLaserRotation + t * uLaserRotationSpeed * side + (i * 0.2 - 0.5) * side;
      beamOrigin = vec2(-0.5 * side, -0.5);
    }
    // Mode 3: Scanning - single beam sweeps back and forth
    else {
      float sweep = sin(t * uLaserRotationSpeed + i * 0.5) * uLaserSpread * 0.5;
      angle = uLaserRotation + sweep;
    }
    // Mode 4: Distance Sweep - single beam across screen from far origin
    if (uLaserMode > 3.5) {
      float sweep = sin(t * uLaserRotationSpeed) * 0.6;
      angle = uLaserRotation;
      beamOrigin = vec2(-1.2, sweep);
      beamLength = 3.0;
    }

    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 delta = centered - beamOrigin;

    // Distance to beam line
    float proj = dot(delta, dir);
    float perp = abs(dot(delta, vec2(-dir.y, dir.x)));

    // Beam visibility
    float inBeam = step(0.0, proj) * step(proj, beamLength);

    // Soft edge with audio-reactive width
    float width = uLaserBeamWidth * (1.0 + audio * uLaserAudioReact * 0.5);
    float beam = smoothstep(width, 0.0, perp) * inBeam;
    float glow = exp(-perp / (width * 4.0)) * uLaserGlow * inBeam * 0.5;

    // Color with optional shift
    vec3 beamColor = getPaletteColor(0.3 + i * 0.1);
    if (uLaserColorShift > 0.0) {
      float hueShift = (i / beamCount + audio * uLaserAudioReact) * uLaserColorShift;
      beamColor = hueRotate(beamColor, hueShift * 6.28);
    }

    color += beamColor * (beam + glow);
  }
  return color * uLaserOpacity;
}`,
    mainCall: `  if (uLaserEnabled > 0.5) {
    float audio = uRms * 0.5 + uPeak * 0.5;
    color += laserBeam(effectUv, uTime, audio);
  }
`,
  },

  {
    id: 'gen-strobe',
    uniforms: ``,
    functions: `vec3 strobeFlash(vec2 uv, float t, float audio, float peak) {
  float beatPhase = fract(t * uStrobeRate * 0.5);
  float flash = step(beatPhase, uStrobeDutyCycle);

  // Audio trigger override: Force flash to 1.0 immediately on peak
  bool isHit = uStrobeAudioTrigger > 0.5 && peak > uStrobeThreshold;
  if (isHit) {
    flash = 1.0;
  }

  // Fade decay: only apply decay to the beat-synced flash OR the audio hit
  float fadeT = isHit ? 0.0 : beatPhase / max(uStrobeDutyCycle, 0.01);
  flash *= exp(-fadeT * (1.0 / max(uStrobeFadeOut, 0.01)));

  vec3 color = getPaletteColor(1.0); // Use top of palette for white-ish flashes

  // Mode 0: White (mapped to palette peak)
  if (uStrobeMode < 0.5) {
    color = getPaletteColor(1.0);
  }
  // Mode 1: Color (use palette)
  else if (uStrobeMode < 1.5) {
    color = getPaletteColor(0.5);
  }
  // Mode 2: Rainbow
  else if (uStrobeMode < 2.5) {
    color = getPaletteColor(fract(t * 0.2));
  }
  // Mode 3: Invert (handled in main)
  else {
    color = vec3(1.0);
  }

  // Pattern variation
  // Pattern 0: Solid (no modification)
  // Pattern 1: Scanlines
  if (uStrobePattern > 0.5 && uStrobePattern < 1.5) {
    flash *= step(0.5, fract(uv.y * 100.0));
  }
  // Pattern 2: Radial
  else if (uStrobePattern > 1.5) {
    flash *= 1.0 - smoothstep(0.0, 0.7, length(uv - 0.5) * 2.0);
  }

  return color * flash * uStrobeOpacity;
}`,
    mainCall: `  if (uStrobeEnabled > 0.5) {
    color += strobeFlash(effectUv, uTime, uRms * 0.5 + uPeak * 0.5, uPeak);
  }
`,
  },

  {
    id: 'gen-shape-burst',
    uniforms: `uniform float uShapeBurstEnabled;
uniform float uShapeBurstOpacity;
uniform float uBurstActives[8];
uniform float uBurstSpawnTimes[8];
uniform float uShapeBurstStartSize;
uniform float uShapeBurstExpandSpeed;
uniform float uShapeBurstMaxSize;
uniform float uShapeBurstFadeMode;
uniform float uShapeBurstShape;
uniform float uShapeBurstThickness;
`,
    functions: `vec3 shapeBurst(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  centered.x *= uAspect;
  vec3 color = vec3(0.0);

  for (float i = 0.0; i < 8.0; i += 1.0) {
    if (uBurstActives[int(i)] < 0.5) continue;

    float age = t - uBurstSpawnTimes[int(i)];
    if (age < 0.0) continue;

    float size = uShapeBurstStartSize + age * uShapeBurstExpandSpeed;
    if (size > uShapeBurstMaxSize) continue;

    float fadeT = size / uShapeBurstMaxSize;
    float opacity = 1.0;

    // Fade mode: 0=size, 1=opacity, 2=both
    if (uShapeBurstFadeMode > 0.5) {
      opacity = 1.0 - fadeT;
    }

    float dist = length(centered);
    float shape = 0.0;

    // Shape 0: Ring
    if (uShapeBurstShape < 0.5) {
      shape = smoothstep(uShapeBurstThickness, 0.0, abs(dist - size * 0.5));
    }
    // Shape 1: Circle (filled)
    else if (uShapeBurstShape < 1.5) {
      shape = smoothstep(size * 0.5 + uShapeBurstThickness, size * 0.5, dist);
    }
    // Shape 2: Hexagon
    else if (uShapeBurstShape < 2.5) {
      float hex = sdHexagon(centered, size * 0.5);
      shape = smoothstep(uShapeBurstThickness, 0.0, abs(hex));
    }
    // Shape 3: Star
    else if (uShapeBurstShape < 3.5) {
      float star = sdStar(centered, size * 0.5, 5, 2.5);
      shape = smoothstep(uShapeBurstThickness, 0.0, abs(star));
    }
    // Shape 4: Triangle
    else {
      float tri = sdEquilateralTriangle(centered, size * 0.5);
      shape = smoothstep(uShapeBurstThickness, 0.0, abs(tri));
    }

    vec3 burstColor = getPaletteColor(fract(float(i) * 0.15 + age * 0.5));
    color += burstColor * shape * opacity;
  }

  return color * uShapeBurstOpacity;
}`,
    mainCall: `  if (uShapeBurstEnabled > 0.5) {
    color += shapeBurst(effectUv, uTime);
  }
`,
  },

  {
    id: 'gen-grid-tunnel',
    uniforms: `uniform float uGridTunnelEnabled;
uniform float uGridTunnelOpacity;
uniform float uGridTunnelSpeed;
uniform float uGridTunnelAudioReact;
uniform float uGridTunnelMode;
uniform float uGridTunnelHorizonY;
uniform float uGridTunnelPerspective;
uniform float uGridTunnelGridSize;
uniform float uGridTunnelLineWidth;
uniform float uGridTunnelGlow;
`,
    functions: `vec3 gridTunnel(vec2 uv, float t, float audio) {
  float speed = uGridTunnelSpeed * (1.0 + audio * uGridTunnelAudioReact);
  vec3 color = vec3(0.0);

  // Mode 0: Floor
  if (uGridTunnelMode < 0.5) {
    float y = uv.y - uGridTunnelHorizonY;
    if (abs(y) < 0.01) return color;

    float z = uGridTunnelPerspective / (abs(y) + 0.01);
    float x = (uv.x - 0.5) * z;

    float gridX = fract(x * uGridTunnelGridSize * 0.1);
    float gridZ = fract(z * uGridTunnelGridSize * 0.1 - t * speed);

    float lineX = smoothstep(uGridTunnelLineWidth, 0.0, min(gridX, 1.0 - gridX));
    float lineZ = smoothstep(uGridTunnelLineWidth, 0.0, min(gridZ, 1.0 - gridZ));
    float grid = max(lineX, lineZ);

    float fade = exp(-abs(y) * 3.0);
    float horizon = smoothstep(0.0, 0.1, abs(y));

    vec3 gridColor = getPaletteColor(0.6);
    color = gridColor * grid * fade * horizon * (1.0 + uGridTunnelGlow);
  }
  // Mode 1: Tunnel
  else if (uGridTunnelMode < 1.5) {
    vec2 centered = uv - 0.5;
    centered.x *= uAspect;

    float r = length(centered);
    float angle = atan(centered.y, centered.x);

    float z = uGridTunnelPerspective / (r + 0.01);
    z = fract(z * 0.2 - t * speed * 0.5);

    float angleGrid = fract(angle / 6.28318 * uGridTunnelGridSize);

    float lineR = smoothstep(uGridTunnelLineWidth * 2.0, 0.0, min(z, 1.0 - z));
    float lineA = smoothstep(uGridTunnelLineWidth, 0.0, min(angleGrid, 1.0 - angleGrid));
    float grid = max(lineR, lineA);

    float fade = 1.0 - smoothstep(0.0, 0.5, r);

    vec3 gridColor = getPaletteColor(0.7);
    color = gridColor * grid * fade * (1.0 + uGridTunnelGlow);
  }
  // Mode 2: Box
  else {
    vec2 centered = (uv - 0.5) * 2.0;
    centered.x *= uAspect;

    // Create a box perspective effect
    float z = fract(t * speed * 0.5);
    float scale = 1.0 + z * 2.0;
    vec2 scaled = centered * scale;

    // Box edges
    float boxDist = max(abs(scaled.x), abs(scaled.y));
    float boxLine = smoothstep(uGridTunnelLineWidth * scale, 0.0, abs(boxDist - 1.0));

    // Grid on surfaces
    float gridX = fract(scaled.x * uGridTunnelGridSize * 0.2);
    float gridY = fract(scaled.y * uGridTunnelGridSize * 0.2);
    float gridLine = smoothstep(uGridTunnelLineWidth, 0.0, min(gridX, 1.0 - gridX));
    gridLine = max(gridLine, smoothstep(uGridTunnelLineWidth, 0.0, min(gridY, 1.0 - gridY)));

    float fade = 1.0 - z;

    vec3 gridColor = getPaletteColor(0.5 + z * 0.3);
    color = gridColor * (boxLine + gridLine * 0.5) * fade * (1.0 + uGridTunnelGlow);
  }

  return color * uGridTunnelOpacity;
}`,
    mainCall: `  if (uGridTunnelEnabled > 0.5) {
    float audio = low; // Bass drives grid
    color += gridTunnel(effectUv, uTime, audio);
  }
`,
  },

  {
    id: 'gen-cellular-growth',
    uniforms: `uniform float uCellularGrowthEnabled;
uniform float uCellularGrowthDensity;
uniform float uCellularGrowthRate;
uniform float uCellularGrowthOpacity;
`,
    functions: `vec3 cellularGrowth(vec2 uv, float t, float audio) {
  vec2 p = uv * uCellularGrowthDensity * 8.0;
  vec2 id = floor(p);
  vec2 f = fract(p);

  float col = 0.0;
  // Game of Life-like cellular pattern
  float h = hash21(id);
  float alive = h > 0.5 ? 1.0 : 0.0;

  // Check neighbors
  float neighbors = 0.0;
  for (float y = -1.0; y <= 1.0; y += 1.0) {
    for (float x = -1.0; x <= 1.0; x += 1.0) {
      if (x == 0.0 && y == 0.0) continue;
      float nh = hash21(id + vec2(x, y));
      neighbors += nh > 0.5 ? 1.0 : 0.0;
    }
  }

  // Cellular automaton rules
  float newState = (alive > 0.5 && (neighbors == 2.0 || neighbors == 3.0)) ? 1.0 : (alive <= 0.5 && neighbors == 3.0) ? 1.0 : 0.0;

  // Animate with audio
  float pulse = sin(t * uCellularGrowthRate + id.x * 0.5 + id.y * 0.5) * 0.5 + 0.5;
  newState = mix(newState, pulse, audio * 0.5);

  float d = smoothstep(0.2, 0.0, length(f - 0.5));
  col += newState * d;
  col += d * 0.3 * (0.5 + 0.5 * sin(t * uCellularGrowthRate + neighbors));

  return getPaletteColor(fract(id.x * 0.1 + id.y * 0.1 + t * 0.1)) * col * uCellularGrowthOpacity * (1.0 + audio);
}`,
    mainCall: `  if (uCellularGrowthEnabled > 0.5) color += cellularGrowth(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-bio-luminescent-forest',
    uniforms: `uniform float uBioLuminescentForestEnabled;
uniform float uBioLuminescentForestDensity;
uniform float uBioLuminescentForestPulse;
uniform float uBioLuminescentForestOpacity;
`,
    functions: `vec3 bioLuminescentForest(vec2 uv, float t, float audio) {
  vec2 p = uv;
  vec3 col = vec3(0.0);

  // Create forest of glowing elements
  for (float i = 0.0; i < 15.0; i += 1.0) {
    float h = hash21(vec2(i, 0.0));
    vec2 treePos = vec2(h, hash21(vec2(0.0, i)));
    treePos = treePos * uBioLuminescentForestDensity * 0.8 + 0.1;

    float dist = length(p - treePos);
    float treeSize = 0.02 + h * 0.03;

    // Pulsing glow
    float pulse = sin(t * uBioLuminescentForestPulse + i * 0.5) * 0.5 + 0.5;
    pulse *= (1.0 + audio);

    // Main glow
    float glow = smoothstep(treeSize * (1.5 - pulse * 0.5), 0.0, dist);
    float core = smoothstep(treeSize * 0.5, 0.0, dist);

    // Color based on position and audio
    vec3 treeColor = getPaletteColor(h + audio * 0.3 + i * 0.1);

    col += treeColor * (core * 0.8 + glow * 0.4);
  }

  // Add ambient forest glow
  float forestGlow = fbm(p * 3.0 + t * 0.1) * 0.3;
  col += getPaletteColor(forestGlow) * forestGlow * 0.2;

  return col * uBioLuminescentForestOpacity * (1.0 + audio * 0.5);
}`,
    mainCall: `  if (uBioLuminescentForestEnabled > 0.5) color += bioLuminescentForest(effectUv, uTime, high);
`
  },

  {
    id: 'gen-crystalline',
    uniforms: `uniform float uCrystallineEnabled;
uniform float uCrystallineRotation;
uniform float uCrystallineRefraction;
uniform float uCrystallineOpacity;
`,
    functions: `vec3 crystalline(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  p = rotate2d(p, t * uCrystallineRotation);

  vec3 col = vec3(0.0);
  float facets = 0.0;

  // Crystal facets
  for (float i = 0.0; i < 8.0; i += 1.0) {
    float angle = i * 6.28 / 8.0;
    vec2 normal = vec2(cos(angle), sin(angle));
    float d = dot(p, normal);

    // Refraction effect
    float refract = d + uCrystallineRefraction * sin(t * 2.0 + i);
    float facet = smoothstep(0.02, 0.0, abs(refract));

    facets += facet;

    // Add rainbow refraction
    vec3 refractColor = getPaletteColor(refract * 0.5 + t * 0.1 + i * 0.05);
    col += refractColor * facet * 0.3;
  }

  // Core glow
  float core = smoothstep(0.1, 0.0, length(p));
  col += getPaletteColor(audio + t * 0.05) * core * 0.5;

  // Edge glow
  float edge = smoothstep(0.5, 0.45, max(abs(p.x), abs(p.y)));
  col += getPaletteColor(edge + t * 0.1) * edge * 0.4;

  return col * uCrystallineOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uCrystallineEnabled > 0.5) color += crystalline(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-audio-dna',
    uniforms: `uniform float uAudioDnaEnabled;
uniform float uAudioDnaRotation;
uniform float uAudioDnaSegments;
uniform float uAudioDnaOpacity;
`,
    functions: `vec3 audioDna(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  p = rotate2d(p, t * uAudioDnaRotation);

  vec3 col = vec3(0.0);

  // Double helix structure
  for (float helix = 0.0; helix < 2.0; helix += 1.0) {
    float phase = helix * 3.14159;
    float helixOffset = phase + t * 0.5;

    for (float i = 0.0; i < uAudioDnaSegments; i += 1.0) {
      float z = (i / uAudioDnaSegments) * 2.0 - 1.0;
      float radius = 0.2 + audio * 0.1;

      // Helical position
      float helixAngle = z * 5.0 + helixOffset;
      vec2 helixPos = vec2(cos(helixAngle), sin(helixAngle)) * radius;

      // Project to 2D
      vec2 projPos = helixPos;
      projPos.y += z * 0.5;

      float dist = length(p - projPos);

      // Audio-reactive base pairs
      float pairSize = 0.03 + audio * 0.02;
      if (helix > 0.5) {
        pairSize *= (0.5 + 0.5 * sin(z * 10.0 + t * 2.0));
      }

      float basePair = smoothstep(pairSize, 0.0, dist);
      float glow = smoothstep(pairSize * 2.5, 0.0, dist) * 0.4;

      float hue = (i / uAudioDnaSegments) + helix * 0.5 + t * 0.05;
      vec3 bpColor = getPaletteColor(hue);

      col += bpColor * (basePair + glow);
    }
  }

  // Add connecting backbone
  float backbone = smoothstep(0.02, 0.0, abs(p.x)) * smoothstep(1.0, 0.8, abs(p.y));
  col += getPaletteColor(audio + t * 0.1) * backbone * 0.3;

  return col * uAudioDnaOpacity * (1.0 + audio * 0.5);
}`,
    mainCall: `  if (uAudioDnaEnabled > 0.5) color += audioDna(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-liquid-metal',
    uniforms: `uniform float uLiquidMetalEnabled;
uniform float uLiquidMetalFlow;
uniform float uLiquidMetalShimmer;
uniform float uLiquidMetalOpacity;
`,
    functions: `vec3 liquidMetal(vec2 uv, float t, float audio) {
  vec2 p = uv;

  // Fluid distortion
  float flow = uLiquidMetalFlow;
  p.x += sin(p.y * 3.0 + t * flow) * 0.1;
  p.y += cos(p.x * 2.5 + t * flow * 0.7) * 0.1;

  // Metallic waves
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 3.0; i += 1.0) {
    float phase = i * 2.0;
    float wave = sin(p.x * 10.0 + phase + t * flow) * sin(p.y * 8.0 - t * flow * 0.5);
    wave += sin(p.x * 5.0 + phase * 1.5 - t * flow * 0.3) * sin(p.y * 6.0 + t * flow);

    // Metallic sheen
    float sheen = abs(wave);
    sheen = pow(sheen, 3.0 + uLiquidMetalShimmer * 2.0);

    vec3 waveColor = getPaletteColor(sheen + audio * 0.2 + phase * 0.1);
    col += waveColor * sheen * (0.4 - i * 0.1);
  }

  // Add reflections
  float reflect = smoothstep(0.5, 0.45, p.y) - smoothstep(0.5, 0.55, p.y);
  reflect *= (0.5 + 0.5 * sin(p.x * 20.0 + t * flow * 2.0));
  col += vec3(0.8, 0.9, 1.0) * reflect * 0.3;

  return col * uLiquidMetalOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uLiquidMetalEnabled > 0.5) color += liquidMetal(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-neon-cityscape',
    uniforms: `uniform float uNeonCityscapeEnabled;
uniform float uNeonCityscapeDensity;
uniform float uNeonCityscapeSpeed;
uniform float uNeonCityscapeOpacity;
`,
    functions: `vec3 neonCityscape(vec2 uv, float t, float audio) {
  vec2 p = uv;

  vec3 col = vec3(0.0);

  // Building silhouettes
  float buildings = 0.0;
  for (float i = 0.0; i < 10.0; i += 1.0) {
    float x = (i + 0.5) / 10.0;
    float h = hash21(vec2(i, 0.0)) * uNeonCityscapeDensity;
    float building = smoothstep(0.02, 0.0, abs(p.x - x)) * step(p.y, h * 0.5);
    buildings += building;
  }

  // Neon lights on buildings
  for (float i = 0.0; i < 15.0; i += 1.0) {
    float h = hash21(vec2(i, 1.0));
    vec2 lightPos = vec2(h, hash21(vec2(2.0, i)) * 0.5 * uNeonCityscapeDensity);
    lightPos.x += sin(t * uNeonCityscapeSpeed + i * 0.5) * 0.02;

    float dist = length(p - lightPos);
    float lightSize = 0.01 + 0.01 * sin(t * 2.0 + i);

    // Neon glow with audio reactivity
    float pulse = 0.5 + 0.5 * sin(t * 3.0 + i * 2.0);
    pulse *= (1.0 + audio * 0.5);

    float neon = smoothstep(lightSize, 0.0, dist) * pulse;
    float neonGlow = smoothstep(lightSize * 3.0, 0.0, dist) * 0.3 * pulse;

    vec3 neonColor = getPaletteColor(h + i * 0.07 + audio * 0.2);
    col += neonColor * (neon + neonGlow);
  }

  // Add silhouette
  col += vec3(0.1, 0.05, 0.05) * buildings * 0.5;

  return col * uNeonCityscapeOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uNeonCityscapeEnabled > 0.5) color += neonCityscape(effectUv, uTime, low);
`
  },

  {
    id: 'gen-cosmic-nebula',
    uniforms: `uniform float uCosmicNebulaEnabled;
uniform float uCosmicNebulaExpansion;
uniform float uCosmicNebulaTurbulence;
uniform float uCosmicNebulaOpacity;
`,
    functions: `vec3 cosmicNebula(vec2 uv, float t, float audio) {
  vec2 p = uv;

  // Nebula clouds using FBM
  float expansion = uCosmicNebulaExpansion;
  float turbulence = uCosmicNebulaTurbulence;

  vec3 col = vec3(0.0);

  for (float i = 0.0; i < 4.0; i += 1.0) {
    vec2 offset = vec2(sin(i * 1.5 + t * 0.1), cos(i * 1.2 + t * 0.15)) * expansion * 0.2;
    float scale = 2.0 + i * 1.5;
    float noise = fbm((p + offset) * scale + t * 0.05 * (i + 1.0));

    // Add audio-reactive turbulence
    noise += fbm((p + offset) * scale * (1.0 + turbulence) + t * 0.1 + audio) * turbulence;

    float cloud = smoothstep(0.3, 0.5, noise) * smoothstep(0.7, 0.5, noise);

    vec3 cloudColor = getPaletteColor(noise * 0.3 + i * 0.15 + t * 0.02);
    col += cloudColor * cloud * (0.3 - i * 0.05);
  }

  // Stars
  float stars = 0.0;
  for (float i = 0.0; i < 50.0; i += 1.0) {
    vec2 starPos = vec2(hash21(vec2(i, 3.0)), hash21(vec2(4.0, i)));
    float starSize = hash21(vec2(5.0, i)) * 0.002 + 0.001;
    float dist = length(p - starPos);
    stars += smoothstep(starSize, 0.0, dist) * (0.5 + 0.5 * sin(t * 2.0 + i * 3.0));
  }

  col += vec3(1.0) * stars;

  return col * uCosmicNebulaOpacity * (1.0 + audio * 0.2);
}`,
    mainCall: `  if (uCosmicNebulaEnabled > 0.5) color += cosmicNebula(effectUv, uTime, high);
`
  },

  {
    id: 'gen-sonic-rain',
    uniforms: `uniform float uSonicRainEnabled;
uniform float uSonicRainSpeed;
uniform float uSonicRainDensity;
uniform float uSonicRainOpacity;
`,
    functions: `vec3 sonicRain(vec2 uv, float t, float audio) {
  vec2 p = uv;

  vec3 col = vec3(0.0);

  // Audio-reactive rain
  float speed = uSonicRainSpeed;
  float density = uSonicRainDensity;

  float rainCount = density * 20.0;
  for (float i = 0.0; i < 20.0; i += 1.0) {
    if (i >= rainCount) break;
    float x = (i + hash21(vec2(i, 0.0))) / 20.0;
    float phase = t * speed + i * 0.5;

    // Rain drop position with audio influence
    float y = fract(phase + hash21(vec2(i, 1.0)));
    y = pow(y, 1.0 + audio * 0.5);

    float dist = length(p - vec2(x, y));
    float dropSize = 0.005 + audio * 0.003;

    // Rain drop
    float drop = smoothstep(dropSize, 0.0, dist);
    float trail = smoothstep(dropSize * 3.0, 0.0, dist) * 0.4 * (1.0 - y);

    // Color based on position and audio
    float hue = (i / 20.0) + audio * 0.3 + t * 0.05;
    vec3 dropColor = getPaletteColor(hue);

    col += dropColor * (drop + trail);
  }

  // Add sonic ripple effect on strong beats
  float ripple = 0.0;
  if (audio > 0.7) {
    float rippleStrength = (audio - 0.7) / 0.3;
    float ripplePhase = t * 2.0;
    float r = length(p - 0.5);
    ripple = smoothstep(0.3, 0.25, abs(r - fract(ripplePhase) * 0.4)) * rippleStrength;
    col += vec3(0.8, 0.9, 1.0) * ripple * 0.5;
  }

  return col * uSonicRainOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uSonicRainEnabled > 0.5) color += sonicRain(effectUv, uTime, high);
`
  },

  {
    id: 'gen-morphing-geometry',
    uniforms: `uniform float uMorphingGeometryEnabled;
uniform float uMorphingGeometrySpeed;
uniform float uMorphingGeometryComplexity;
uniform float uMorphingGeometryOpacity;
`,
    functions: `vec3 morphingGeometry(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float speed = uMorphingGeometrySpeed;
  float complexity = uMorphingGeometryComplexity;

  vec3 col = vec3(0.0);

  // Morph between different geometric shapes
  float morphPhase = t * speed;
  int currentShape = int(mod(morphPhase, 4.0));
  float blend = fract(morphPhase);

  for (float i = 0.0; i < 4.0; i += 1.0) {
    float shapeDist = 100000.0;

    // Circle
    if (i == 0.0) {
      shapeDist = length(p);
    }
    // Square
    else if (i == 1.0) {
      shapeDist = max(abs(p.x), abs(p.y));
    }
    // Triangle
    else if (i == 2.0) {
      vec2 tp = p;
      tp.y += 0.2;
      float d1 = abs(-tp.x - tp.y * 0.577) / 1.155;
      float d2 = abs(tp.x - tp.y * 0.577) / 1.155;
      float d3 = abs(tp.y + 0.346);
      shapeDist = max(d1, max(d2, d3));
    }
    // Hexagon
    else {
      float angle = atan(p.y, p.x) + 3.14159 / 6.0;
      float r = length(p) * cos(fract(angle / 6.28318) * 6.28318 - 3.14159 / 6.0);
      shapeDist = r;
    }

    // Add complexity with audio
    shapeDist += sin(shapeDist * (10.0 + complexity * 5.0) + t * 2.0 + i) * audio * 0.05;

    // Edge glow
    float edge = smoothstep(0.02, 0.0, abs(shapeDist - 0.5 - complexity * 0.1));
    float glow = smoothstep(0.1, 0.0, abs(shapeDist - 0.5 - complexity * 0.1)) * 0.3;

    // Weight based on morph position
    float weight = 1.0 - abs(i - morphPhase);
    weight = pow(clamp(weight, 0.0, 1.0), 2.0);

    vec3 shapeColor = getPaletteColor(i * 0.25 + t * 0.02);
    col += shapeColor * (edge + glow) * weight;
  }

  return col * uMorphingGeometryOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uMorphingGeometryEnabled > 0.5) color += morphingGeometry(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-urban-rhythm',
    uniforms: `uniform float uUrbanRhythmEnabled;
uniform float uUrbanRhythmBpm;
uniform float uUrbanRhythmIntensity;
uniform float uUrbanRhythmOpacity;
`,
    functions: `vec3 urbanRhythm(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float bpm = uUrbanRhythmBpm;
  float intensity = uUrbanRhythmIntensity;

  vec3 col = vec3(0.0);

  // Beat detection simulation
  float beat = sin(t * bpm * 0.5) * 0.5 + 0.5;
  beat = smoothstep(0.3, 0.7, beat) * intensity;

  // Urban elements - grid of lights
  float gridSize = 6.0;
  vec2 grid = floor(p * gridSize);
  vec2 cell = fract(p * gridSize);

  for (float i = 0.0; i < 4.0; i += 1.0) {
    float h = hash21(grid + i);
    float light = step(0.7, h);

    // Beat-reactive flickering
    float flicker = sin(t * bpm + grid.x * 2.0 + grid.y * 3.0 + i * 4.0);
    flicker = smoothstep(0.3, 0.7, flicker) * beat;

    float lightPos = h;
    vec2 lightCenter = vec2(0.5 + (lightPos - 0.5) * 0.6, 0.5 + (hash21(grid + vec2(0.0, i)) - 0.5) * 0.4);
    float dist = length(p - lightCenter);

    float lightSize = 0.03 + flicker * 0.02;
    float lightGlow = smoothstep(lightSize, 0.0, dist);
    float lightHalo = smoothstep(lightSize * 3.0, 0.0, dist) * 0.3;

    vec3 lightColor = getPaletteColor(h + beat * 0.3 + i * 0.1);
    col += lightColor * (lightGlow + lightHalo);
  }

  // Add beat pulse circles
  for (float i = 0.0; i < 3.0; i += 1.0) {
    float pulsePhase = t * bpm * 0.3 + i * 2.0;
    float pulseRing = smoothstep(0.05, 0.04, abs(length(p - 0.5) - fract(pulsePhase) * 0.4));
    col += getPaletteColor(audio + i * 0.2 + t * 0.05) * pulseRing * beat * 0.5;
  }

  return col * uUrbanRhythmOpacity * (1.0 + audio * 0.4);
}`,
    mainCall: `  if (uUrbanRhythmEnabled > 0.5) color += urbanRhythm(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-crimson-veil',
    uniforms: `uniform float uCrimsonVeilEnabled;
uniform float uCrimsonVeilFlow;
uniform float uCrimsonVeilDarkness;
uniform float uCrimsonVeilOpacity;
`,
    functions: `vec3 crimsonVeil(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float flow = uCrimsonVeilFlow;
  float darkness = uCrimsonVeilDarkness;

  vec3 col = vec3(0.0);

  // Flowing crimson fabric effect
  for (float i = 0.0; i < 4.0; i += 1.0) {
    float layerOffset = i * 0.25;
    float wavePhase = t * flow * 0.3 + layerOffset;

    // Fabric wave pattern
    float wave1 = sin(p.x * 8.0 + wavePhase) * 0.5 + 0.5;
    float wave2 = sin(p.y * 6.0 + wavePhase * 1.3) * 0.5 + 0.5;
    float fabric = wave1 * wave2;

    // Darken with audio
    float darkFactor = 1.0 - darkness * (0.5 + audio * 0.5);

    // Crimson color with variations
    vec3 crimson = vec3(0.8, 0.1, 0.2);
    crimson = mix(crimson, vec3(0.3, 0.0, 0.05), fabric * darkFactor);

    // Add blood-like dripping effect
    float drip = sin(p.y * 10.0 + t * flow * 0.5 + p.x * 5.0);
    drip = smoothstep(0.7, 0.9, drip) * (0.3 + audio * 0.2);

    // Layer with depth
    float alpha = smoothstep(0.3, 0.7, fabric) * (1.0 - i * 0.2);
    col += crimson * alpha + vec3(0.6, 0.05, 0.1) * drip * alpha;
  }

  // Add subtle texture
  float noise = hash21(floor(p * 50.0));
  col *= 0.9 + noise * 0.2;

  return col * uCrimsonVeilOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uCrimsonVeilEnabled > 0.5) color += crimsonVeil(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-victorian-crypt',
    uniforms: `uniform float uVictorianCryptEnabled;
uniform float uVictorianCryptComplexity;
uniform float uVictorianCryptDecay;
uniform float uVictorianCryptOpacity;
`,
    functions: `vec3 victorianCrypt(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float complexity = uVictorianCryptComplexity;
  float decay = uVictorianCryptDecay;

  vec3 col = vec3(0.0);

  // Gothic arch pattern
  float arches = 0.0;
  for (float i = 0.0; i < 5.0; i += 1.0) {
    if (i >= complexity) break;

    float archSize = 0.3 + i * 0.15;
    float archX = sin(t * 0.2 + i * 0.5) * 0.2;
    float archY = cos(t * 0.15 + i * 0.7) * 0.1;

    // Pointed gothic arch
    vec2 archCenter = vec2(archX, archY + 0.5);
    float dx = p.x - archCenter.x;
    float dy = p.y - archCenter.y;

    // Arch shape
    float arch = smoothstep(archSize, archSize - 0.02, abs(dx) + abs(dy) * 0.5);
    float archTop = smoothstep(archSize * 0.3, archSize * 0.3 - 0.01, length(p - archCenter));

    // Combine arch elements
    float archShape = min(arch, archTop);

    // Dark stone color with decay
    vec3 stone = vec3(0.2, 0.15, 0.2);
    stone = mix(stone, vec3(0.05, 0.05, 0.08), decay * 0.7);

    // Audio-reactive glow
    float glow = smoothstep(archSize * 0.8, 0.0, length(p - archCenter)) * audio * 0.3;
    col += stone * archShape + vec3(0.3, 0.1, 0.2) * glow * (1.0 - decay * 0.5);
  }

  // Add vaulted ceiling pattern
  float vault = 0.0;
  for (float i = 0.0; i < 3.0; i++) {
    float vaultAngle = t * 0.1 + i * 1.0;
    float vaultLine = smoothstep(0.02, 0.0, abs(p.y - 0.5 - sin(p.x * 3.0 + vaultAngle) * 0.1));
    vault += vaultLine * (0.3 + i * 0.1);
  }
  col += vec3(0.15, 0.1, 0.15) * vault * (1.0 - decay * 0.3);

  return col * uVictorianCryptOpacity * (1.0 + audio * 0.2);
}`,
    mainCall: `  if (uVictorianCryptEnabled > 0.5) color += victorianCrypt(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-spectral-apparition',
    uniforms: `uniform float uSpectralApparitionEnabled;
uniform float uSpectralApparitionDensity;
uniform float uSpectralApparitionFade;
uniform float uSpectralApparitionOpacity;
`,
    functions: `vec3 spectralApparition(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float density = uSpectralApparitionDensity;
  float fade = uSpectralApparitionFade;

  vec3 col = vec3(0.0);

  // Ghostly figures
  for (float i = 0.0; i < density * 8.0; i++) {
    float ghostX = sin(t * 0.3 + i * 1.5) * 0.4 + hash21(vec2(i, 0.0)) * 0.2;
    float ghostY = 0.5 + cos(t * 0.2 + i * 1.3) * 0.3;

    // Drifting movement
    vec2 ghostPos = vec2(ghostX, ghostY);
    float drift = sin(t * 0.1 + i * 0.7) * 0.05;

    // Ghostly form - tall vertical gradient
    float ghostHeight = 0.4 + i * 0.05;
    float ghostWidth = 0.08 + sin(t + i) * 0.02;

    float distX = smoothstep(ghostWidth, 0.0, abs(p.x - ghostPos.x - drift));
    float distY = smoothstep(ghostHeight, 0.0, abs(p.y - ghostPos.y));

    // Fade at bottom
    float bottomFade = smoothstep(-ghostHeight * 0.5, 0.0, p.y - ghostPos.y);

    // Ethereal color
    vec3 ghostColor = vec3(0.7, 0.7, 0.9);
    ghostColor = mix(ghostColor, vec3(0.4, 0.4, 0.6), fade * 0.5);

    // Audio-reactive intensity
    float intensity = 1.0 + audio * 0.5;

    // Add flicker
    float flicker = 0.8 + sin(t * 5.0 + i * 2.0) * 0.2;

    col += ghostColor * distX * distY * bottomFade * flicker * intensity * 0.3;
  }

  // Add spectral mist
  float mist = 0.0;
  for (float i = 0.0; i < 3.0; i++) {
    float mistX = sin(t * 0.2 + i * 1.7) * 0.5;
    float mistY = 0.5 + cos(t * 0.15 + i * 1.9) * 0.4;
    mist += smoothstep(0.3, 0.0, length(p - vec2(mistX, mistY))) * 0.2;
  }
  col += vec3(0.6, 0.6, 0.8) * mist * (1.0 - fade * 0.5);

  return col * uSpectralApparitionOpacity * (1.0 + audio * 0.4);
}`,
    mainCall: `  if (uSpectralApparitionEnabled > 0.5) color += spectralApparition(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-gothic-cobwebs',
    uniforms: `uniform float uGothicCobwebsEnabled;
uniform float uGothicCobwebsDensity;
uniform float uGothicCobwebsDecay;
uniform float uGothicCobwebsOpacity;
`,
    functions: `vec3 gothicCobwebs(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float density = uGothicCobwebsDensity;
  float decay = uGothicCobwebsDecay;

  vec3 col = vec3(0.0);

  // Radial cobweb pattern
  float webs = 0.0;
  vec2 center = vec2(0.5);
  float toCenter = length(p - center);
  float angle = atan(p.y - center.y, p.x - center.x);

  for (float i = 0.0; i < density * 6.0; i++) {
    float spokeAngle = (i / (density * 6.0)) * 6.28318 + t * 0.05;

    // Web spokes
    float spokeAngleDiff = mod(abs(angle - spokeAngle), 6.28318);
    float spokeAngleDiff2 = min(spokeAngleDiff, 6.28318 - spokeAngleDiff);
    float spoke = smoothstep(0.03, 0.0, spokeAngleDiff2) * smoothstep(0.4, 0.45, toCenter) * smoothstep(0.0, 0.05, toCenter);

    // Web rings
    float ringPhase = (i + 1.0) * 0.07;
    float ring = smoothstep(0.003, 0.0, abs(toCenter - ringPhase - sin(t * 0.1 + i * 0.3) * 0.01));

    // Dew drops on webs
    float dropX = cos(spokeAngle) * ringPhase;
    float dropY = sin(spokeAngle) * ringPhase;
    float drop = smoothstep(0.015, 0.0, length(p - center - vec2(dropX, dropY)));

    // Web color
    vec3 webColor = vec3(0.85, 0.85, 0.9);
    webColor = mix(webColor, vec3(0.3, 0.25, 0.35), decay * 0.6);

    // Dew drop glow
    vec3 dewColor = vec3(0.9, 0.95, 1.0);

    webs += spoke * 0.5 + ring * 0.5 + drop * 0.8;

    // Add to color
    col += webColor * (spoke + ring) * 0.2;
    col += dewColor * drop * 0.3;
  }

  // Add subtle dust particles
  float dust = 0.0;
  for (float i = 0.0; i < 20.0; i++) {
    float dustX = hash21(vec2(i, 0.0));
    float dustY = hash21(vec2(0.0, i));
    vec2 dustPos = vec2(dustX, dustY);
    dust += smoothstep(0.005, 0.0, length(p - dustPos));
  }
  col += vec3(0.7, 0.7, 0.8) * dust * 0.1 * (1.0 - decay * 0.8);

  // Audio-reactive vibration
  float vibration = sin(angle * 20.0 + t * 10.0) * audio * 0.02;
  webs += smoothstep(0.01, 0.0, abs(vibration));

  return col * uGothicCobwebsOpacity * (1.0 + audio * 0.2);
}`,
    mainCall: `  if (uGothicCobwebsEnabled > 0.5) color += gothicCobwebs(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-blood-moon-rise',
    uniforms: `uniform float uBloodMoonRiseEnabled;
uniform float uBloodMoonRiseEclipse;
uniform float uBloodMoonRiseGlow;
uniform float uBloodMoonRiseOpacity;
`,
    functions: `vec3 bloodMoonRise(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float eclipse = uBloodMoonRiseEclipse;
  float glow = uBloodMoonRiseGlow;

  vec3 col = vec3(0.0);

  // Moon position (rising)
  float moonY = 0.3 + sin(t * 0.1) * 0.1;
  vec2 moonCenter = vec2(0.5, moonY);
  float toMoon = length(p - moonCenter);

  // Blood moon
  float moon = smoothstep(0.12, 0.11, toMoon) - smoothstep(0.12, 0.125, toMoon);

  // Eclipse effect
  vec2 moonDir = p - moonCenter;
  float eclipseShadow = smoothstep(0.12 - eclipse * 0.08, 0.13 - eclipse * 0.08, toMoon - sin(atan(moonDir.y, moonDir.x) * 3.0) * 0.02 * eclipse);

  // Blood color
  vec3 bloodMoon = vec3(0.8, 0.1, 0.15);
  bloodMoon = mix(bloodMoon, vec3(0.3, 0.0, 0.05), eclipse * 0.7);

  // Crater texture
  float craters = 0.0;
  for (float i = 0.0; i < 8.0; i++) {
    float craterX = cos(i * 0.785) * 0.05;
    float craterY = sin(i * 0.785) * 0.05;
    float crater = smoothstep(0.015, 0.01, length(p - moonCenter - vec2(craterX, craterY)));
    craters += crater * 0.3;
  }

  // Moon glow
  float moonGlow = smoothstep(0.15, 0.0, toMoon) * glow;
  vec3 glowColor = vec3(0.7, 0.2, 0.3);

  // Audio-reactive pulse
  float pulse = 1.0 + audio * 0.3;
  float pulseGlow = smoothstep(0.15 + audio * 0.03, 0.0, toMoon) * 0.5;

  // Dark landscape silhouette
  float landscape = 0.0;
  for (float i = 0.0; i < 10.0; i++) {
    float spikeX = i * 0.1 + 0.05;
    float spikeHeight = 0.15 + hash21(vec2(i, 0.0)) * 0.1 + sin(t * 0.05 + i * 0.5) * 0.02;
    float spike = smoothstep(0.02, 0.0, abs(p.x - spikeX)) * smoothstep(0.0, 0.05, p.y - spikeHeight);
    landscape += spike;
  }

  col += bloodMoon * moon * (1.0 - craters * 0.5);
  col += glowColor * moonGlow * pulse;
  col += glowColor * pulseGlow;
  col += vec3(0.05, 0.05, 0.08) * landscape;

  return col * uBloodMoonRiseOpacity * (1.0 + audio * 0.2);
}`,
    mainCall: `  if (uBloodMoonRiseEnabled > 0.5) color += bloodMoonRise(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-candlelight-vigil',
    uniforms: `uniform float uCandlelightVigilEnabled;
uniform float uCandlelightVigilFlicker;
uniform float uCandlelightVigilDecay;
uniform float uCandlelightVigilOpacity;
`,
    functions: `vec3 candlelightVigil(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float flicker = uCandlelightVigilFlicker;
  float decay = uCandlelightVigilDecay;

  vec3 col = vec3(0.0);

  // Multiple candles
  for (float i = 0.0; i < 5.0; i++) {
    float candleX = -0.4 + i * 0.2;
    vec2 candlePos = vec2(candleX, 0.4 + sin(t * 0.05 + i * 0.5) * 0.05);

    // Flame flicker
    float flameFlicker = 1.0 + sin(t * (8.0 + i * 2.0) + i) * flicker * 0.3 + audio * 0.5;
    float flameX = candlePos.x + sin(t * 3.0 + i) * 0.01 * flicker;
    float flameY = candlePos.y + 0.05 + cos(t * 4.0 + i * 0.5) * 0.01 * flicker;

    // Flame shape
    vec2 toFlame = p - vec2(flameX, flameY);
    float flameDist = length(toFlame);
    float flame = smoothstep(0.04 * flameFlicker, 0.0, flameDist) * smoothstep(0.0, 0.02, toFlame.y + 0.02);

    // Flame color gradient
    vec3 flameBase = vec3(1.0, 0.6, 0.1);
    vec3 flameTip = vec3(1.0, 0.9, 0.4);
    vec3 flameColor = mix(flameBase, flameTip, smoothstep(0.0, 0.04, flameDist));

    // Flame glow
    float flameGlow = smoothstep(0.08, 0.0, flameDist) * 0.5;

    // Candle body
    float candle = smoothstep(0.015, 0.01, abs(p.x - candlePos.x)) * smoothstep(candlePos.y + 0.15, candlePos.y, p.y);
    vec3 candleColor = vec3(0.9, 0.85, 0.7);
    candleColor = mix(candleColor, vec3(0.3, 0.25, 0.2), decay * 0.7);

    // Wax drip
    float dripX = candlePos.x + sin(t * 0.5 + i * 2.0) * 0.005;
    float drip = smoothstep(0.005, 0.0, abs(p.x - dripX)) * smoothstep(candlePos.y - 0.1, candlePos.y - 0.08, p.y);

    col += flameColor * flame;
    col += flameColor * flameGlow;
    col += candleColor * candle;
    col += candleColor * drip * 0.5;
  }

  // Dark atmosphere
  float darkness = 1.0 - decay * 0.8;
  col *= darkness;

  // Subtle smoke
  float smoke = 0.0;
  for (float i = 0.0; i < 3.0; i++) {
    float smokeX = -0.4 + i * 0.2 + sin(t * 0.3 + i * 0.7) * 0.05;
    float smokeY = 0.5 + t * 0.1 + i * 0.2;
    smoke += smoothstep(0.1, 0.0, length(p - vec2(smokeX, smokeY))) * 0.1;
  }
  col += vec3(0.2, 0.15, 0.1) * smoke * (1.0 - decay * 0.6);

  return col * uCandlelightVigilOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uCandlelightVigilEnabled > 0.5) color += candlelightVigil(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-gargoyles-awake',
    uniforms: `uniform float uGargoylesAwakeEnabled;
uniform float uGargoylesAwakeAnimation;
uniform float uGargoylesAwakeShadow;
uniform float uGargoylesAwakeOpacity;
`,
    functions: `vec3 gargoylesAwake(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float animation = uGargoylesAwakeAnimation;
  float shadow = uGargoylesAwakeShadow;

  vec3 col = vec3(0.0);

  // Gargoyle silhouettes
  for (float i = 0.0; i < 4.0; i++) {
    float gargoyleX = -0.3 + i * 0.2;
    float gargoyleY = 0.6 + sin(t * 0.08 + i * 0.5) * 0.02 * animation;
    vec2 gargoylePos = vec2(gargoyleX, gargoyleY);

    // Gargoyle body - rough stone shape
    float body = 0.0;
    for (float j = 0.0; j < 6.0; j++) {
      float angle = j * 0.628 + sin(t * 0.1 * animation + i + j) * 0.1;
      float radius = 0.08 + sin(j * 0.8 + i) * 0.02;
      float offsetX = cos(angle) * radius;
      float offsetY = sin(angle) * radius * 0.6;
      body += smoothstep(0.03, 0.01, length(p - gargoylePos - vec2(offsetX, offsetY)));
    }

    // Wings
    float wingAngle = -0.5 + sin(t * 0.2 * animation + i) * 0.3;
    float wingL = smoothstep(0.02, 0.01, length(p - gargoylePos - vec2(cos(wingAngle) * 0.12, sin(wingAngle) * 0.05)));
    float wingR = smoothstep(0.02, 0.01, length(p - gargoylePos - vec2(cos(-wingAngle) * 0.12, sin(-wingAngle) * 0.05)));

    // Eyes
    float eyeX = gargoylePos.x + 0.02 * sin(t * 0.5 * animation);
    float eyeY = gargoylePos.y - 0.02;
    float eye = smoothstep(0.008, 0.005, length(p - vec2(eyeX, eyeY)));

    // Stone color
    vec3 stoneColor = vec3(0.15, 0.12, 0.15);
    vec3 eyeColor = vec3(0.8, 0.1, 0.2);

    // Shadow
    float shadowDist = smoothstep(0.15, 0.0, length(p - gargoylePos - vec2(0.0, 0.1)));
    vec3 shadowColor = vec3(0.0, 0.0, 0.0) * shadowDist * shadow;

    col += stoneColor * (body + wingL + wingR);
    col += eyeColor * eye * (0.3 + audio * 0.7) * animation;
    col += shadowColor;
  }

  // Background texture
  float texture = hash21(floor(p * 30.0)) * 0.05;
  col += vec3(0.05, 0.05, 0.08) + texture;

  return col * uGargoylesAwakeOpacity * (1.0 + audio * 0.4);
}`,
    mainCall: `  if (uGargoylesAwakeEnabled > 0.5) color += gargoylesAwake(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-crypt-shadows',
    uniforms: `uniform float uCryptShadowsEnabled;
uniform float uCryptShadowsDepth;
uniform float uCryptShadowsMovement;
uniform float uCryptShadowsOpacity;
`,
    functions: `vec3 cryptShadows(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float depth = uCryptShadowsDepth;
  float movement = uCryptShadowsMovement;

  vec3 col = vec3(0.0);

  // Deep darkness
  col += vec3(0.02, 0.02, 0.04);

  // Moving shadows
  for (float i = 0.0; i < depth * 5.0; i++) {
    float shadowX = hash21(vec2(i, 0.0));
    float shadowY = hash21(vec2(0.0, i));
    float shadowSpeed = 0.1 + i * 0.05;

    vec2 shadowPos = vec2(
      shadowX + sin(t * shadowSpeed * movement) * 0.2,
      shadowY + cos(t * shadowSpeed * movement * 0.7) * 0.15
    );

    // Shadow entity
    float shadowSize = 0.1 + i * 0.02;
    float shadowDist = length(p - shadowPos);

    // Shadow shape
    float shadowShape = smoothstep(shadowSize, 0.0, shadowDist);

    // Shadow wisps
    float wisp = 0.0;
    for (float j = 0.0; j < 3.0; j++) {
      float wispAngle = j * 2.094 + t * 0.5;
      float wispX = cos(wispAngle) * shadowSize * 0.5;
      float wispY = sin(wispAngle) * shadowSize * 0.5;
      wisp += smoothstep(0.03, 0.0, length(p - shadowPos - vec2(wispX, wispY)));
    }

    // Dark shadow color
    vec3 shadowColor = vec3(0.0, 0.0, 0.0);

    // Audio-reactive shadow intensity
    float shadowIntensity = 0.5 + audio * 0.5;

    col += shadowColor * shadowShape * shadowIntensity * 0.3;
    col += shadowColor * wisp * shadowIntensity * 0.2;
  }

  // Crypt pillars
  for (float i = 0.0; i < 6.0; i++) {
    float pillarX = 0.1 + i * 0.15;
    float pillar = smoothstep(0.03, 0.0, abs(p.x - pillarX)) * smoothstep(0.0, 0.8, p.y);

    // Pillar texture
    float pillarTexture = sin(p.y * 20.0 + i) * 0.02;

    vec3 pillarColor = vec3(0.03, 0.03, 0.05) + pillarTexture;
    col += pillarColor * pillar;
  }

  // Subtle light beams
  for (float i = 0.0; i < 2.0; i++) {
    float beamAngle = 0.5 + sin(t * 0.1 + i * 1.5) * 0.3;
    float beamWidth = 0.05 + audio * 0.03;
    float beam = smoothstep(beamWidth, 0.0, abs(p.x - 0.5 - sin(p.y * 0.5 + t * 0.05 + i) * 0.1));

    vec3 beamColor = vec3(0.1, 0.08, 0.12) * (0.3 + audio * 0.3);
    col += beamColor * beam * (1.0 - depth * 0.5);
  }

  return col * uCryptShadowsOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uCryptShadowsEnabled > 0.5) color += cryptShadows(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-gothic-rose',
    uniforms: `uniform float uGothicRoseEnabled;
uniform float uGothicRoseDecay;
uniform float uGothicRoseThorns;
uniform float uGothicRoseOpacity;
`,
    functions: `vec3 gothicRose(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float decay = uGothicRoseDecay;
  float thorns = uGothicRoseThorns;

  vec3 col = vec3(0.0);

  // Multiple roses
  for (float i = 0.0; i < 4.0; i++) {
    float roseX = -0.3 + i * 0.2 + sin(t * 0.1 + i * 0.5) * 0.05;
    float roseY = 0.5 + cos(t * 0.08 + i * 0.7) * 0.05;
    vec2 rosePos = vec2(roseX, roseY);

    // Rose petals
    float rose = 0.0;
    for (float j = 0.0; j < 8.0; j++) {
      float petalAngle = (j / 8.0) * 6.28318 + t * 0.05 * (1.0 - decay);
      float petalSize = 0.05 + j * 0.005;
      float petalX = cos(petalAngle) * petalSize;
      float petalY = sin(petalAngle) * petalSize * 0.7;

      float petal = smoothstep(0.02, 0.01, length(p - rosePos - vec2(petalX, petalY)));
      rose += petal;
    }

    // Rose center
    float center = smoothstep(0.015, 0.01, length(p - rosePos));

    // Dark rose color
    vec3 roseColor = vec3(0.3, 0.05, 0.1);
    roseColor = mix(roseColor, vec3(0.1, 0.02, 0.05), decay * 0.8);

    // Center color
    vec3 centerColor = vec3(0.4, 0.1, 0.15);

    // Thorns
    float thornCount = thorns * 3.0;
    for (float j = 0.0; j < thornCount; j++) {
      float thornAngle = (j / thornCount) * 6.28318 + t * 0.1;
      float thornDist = 0.08;
      float thornX = rosePos.x + cos(thornAngle) * thornDist;
      float thornY = rosePos.y + sin(thornAngle) * thornDist;
      float thorn = smoothstep(0.005, 0.002, length(p - vec2(thornX, thornY)));

      col += vec3(0.15, 0.1, 0.12) * thorn;
    }

    // Falling petals
    float fallingPetals = 0.0;
    for (float j = 0.0; j < decay * 5.0; j++) {
      float petalFallX = roseX + sin(t * 0.3 + j * 0.8) * 0.1;
      float petalFallY = roseY + 0.2 + fract(t * 0.2 + j * 0.5) * 0.5;
      float petalFall = smoothstep(0.015, 0.01, length(p - vec2(petalFallX, petalFallY)));
      fallingPetals += petalFall;
    }

    col += roseColor * rose;
    col += centerColor * center * 0.5;
    col += roseColor * fallingPetals * 0.3;
  }

  // Vine texture
  float vine = 0.0;
  for (float i = 0.0; i < 10.0; i++) {
    float vineY = i * 0.1;
    float vineX = sin(vineY * 10.0 + t * 0.05) * 0.1;
    vine += smoothstep(0.008, 0.004, abs(p.x - vineX - 0.5)) * smoothstep(0.05, 0.0, abs(p.y - vineY));
  }
  col += vec3(0.1, 0.08, 0.1) * vine;

  return col * uGothicRoseOpacity * (1.0 + audio * 0.2);
}`,
    mainCall: `  if (uGothicRoseEnabled > 0.5) color += gothicRose(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-eternal-darkness',
    uniforms: `uniform float uEternalDarknessEnabled;
uniform float uEternalDarknessVoid;
uniform float uEternalDarknessTraces;
uniform float uEternalDarknessOpacity;
`,
    functions: `vec3 eternalDarkness(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float voidParam = uEternalDarknessVoid;
  float traces = uEternalDarknessTraces;

  vec3 col = vec3(0.0);

  // Pure black void
  col += vec3(0.0, 0.0, 0.0) * voidParam;

  // Subtle traces of gothic elements
  for (float i = 0.0; i < traces * 5.0; i++) {
    float traceX = hash21(vec2(i, 0.0));
    float traceY = hash21(vec2(0.0, i));
    vec2 tracePos = vec2(traceX, traceY);

    // Faint gothic symbols
    float symbolSize = 0.02 + i * 0.003;
    float symbol = smoothstep(symbolSize, 0.0, length(p - tracePos));

    // Very dark color
    vec3 traceColor = vec3(0.02, 0.015, 0.02);

    // Audio-reactive visibility
    float visibility = 0.1 + audio * 0.9;

    col += traceColor * symbol * visibility * 0.2;
  }

  // Subtle fog
  float fog = 0.0;
  for (float i = 0.0; i < 3.0; i++) {
    float fogX = sin(t * 0.05 + i * 1.3) * 0.5;
    float fogY = 0.5 + cos(t * 0.03 + i * 1.7) * 0.4;
    fog += smoothstep(0.3, 0.0, length(p - vec2(fogX, fogY))) * 0.05;
  }
  col += vec3(0.01, 0.01, 0.02) * fog * (1.0 - voidParam * 0.8);

  // Occasional flash of gothic element
  float flash = smoothstep(0.995, 1.0, sin(t * 0.5 + audio * 2.0));
  vec2 flashPos = vec2(0.5, 0.5);
  float flashElement = smoothstep(0.1, 0.0, length(p - flashPos)) * flash;
  col += vec3(0.1, 0.05, 0.1) * flashElement * (1.0 - voidParam * 0.5);

  return col * uEternalDarknessOpacity * (1.0 + audio * 0.1);
}`,
    mainCall: `  if (uEternalDarknessEnabled > 0.5) color += eternalDarkness(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-pixel-dust',
    uniforms: `uniform float uPixelDustEnabled;
uniform float uPixelDustDensity;
uniform float uPixelDustPixelSize;
uniform float uPixelDustOpacity;
`,
    functions: `vec3 pixelDust(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float density = uPixelDustDensity;
  float pixelSize = uPixelDustPixelSize;

  vec3 col = vec3(0.0);

  // Pixel quantization
  vec2 pixelatedUV = floor(p / pixelSize) * pixelSize;

  // Floating pixel particles
  for (float i = 0.0; i < density * 30.0; i++) {
    float pixelX = hash21(vec2(i, 0.0));
    float pixelY = hash21(vec2(0.0, i));
    vec2 pixelPos = vec2(pixelX, pixelY);

    // Drifting movement
    float driftX = sin(t * 0.3 + i * 0.7) * 0.1;
    float driftY = cos(t * 0.2 + i * 0.9) * 0.08;
    pixelPos += vec2(driftX, driftY);

    // Pixelate position
    vec2 pixelatedPos = floor(pixelPos / pixelSize) * pixelSize;

    // Pixel brightness
    float brightness = hash21(vec2(i, t * 0.5));

    // 8-bit color palette
    vec3 pixelColor;
    float colorIndex = hash21(vec2(i, 0.0));
    if (colorIndex < 0.2) pixelColor = vec3(1.0, 0.2, 0.2);
    else if (colorIndex < 0.4) pixelColor = vec3(0.2, 1.0, 0.2);
    else if (colorIndex < 0.6) pixelColor = vec3(0.2, 0.2, 1.0);
    else if (colorIndex < 0.8) pixelColor = vec3(1.0, 1.0, 0.2);
    else pixelColor = vec3(1.0, 1.0, 1.0);

    // Pixel shape
    float pixel = smoothstep(pixelSize, 0.0, length(pixelatedUV - pixelatedPos));

    // Audio-reactive intensity
    float intensity = 0.3 + audio * 0.7 + brightness * 0.2;

    col += pixelColor * pixel * intensity * 0.3;
  }

  // Add scanline effect
  float scanline = sin(p.y * 50.0) * 0.05;
  col *= 1.0 + scanline;

  return col * uPixelDustOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uPixelDustEnabled > 0.5) color += pixelDust(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-retro-starfield',
    uniforms: `uniform float uRetroStarfieldEnabled;
uniform float uRetroStarfieldSpeed;
uniform float uRetroStarfieldSize;
uniform float uRetroStarfieldOpacity;
`,
    functions: `vec3 retroStarfield(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float speed = uRetroStarfieldSpeed;
  float starSize = uRetroStarfieldSize;

  vec3 col = vec3(0.0, 0.0, 0.05);

  // Multiple layers of stars
  for (float layer = 0.0; layer < 3.0; layer++) {
    float layerSpeed = speed * (layer + 1.0) * 0.1;
    float layerDepth = 1.0 - layer * 0.3;

    for (float i = 0.0; i < 50.0; i++) {
      float starX = hash21(vec2(i, layer));
      float starY = hash21(vec2(layer, i));

      // Horizontal scrolling
      starX = fract(starX - t * layerSpeed * 0.5);

      vec2 starPos = vec2(starX, starY);

      // Pixelate star position
      vec2 pixelatedPos = floor(starPos / starSize) * starSize;

      // Star brightness
      float brightness = 0.5 + 0.5 * sin(t * 2.0 + i + layer);

      // Star color (retro palette)
      vec3 starColor;
      float colorIndex = hash21(vec2(i, layer));
      if (colorIndex < 0.33) starColor = vec3(1.0, 1.0, 1.0);
      else if (colorIndex < 0.66) starColor = vec3(1.0, 0.8, 0.6);
      else starColor = vec3(0.8, 0.8, 1.0);

      // Star shape (pixel)
      float star = smoothstep(starSize, 0.0, length(p - pixelatedPos));

      // Audio-reactive brightness
      float audioBoost = audio * 0.5;

      col += starColor * star * brightness * layerDepth * (1.0 + audioBoost) * 0.3;
    }
  }

  // Add scanlines
  float scanline = sin(p.y * 40.0) * 0.03;
  col *= 1.0 - scanline;

  return col * uRetroStarfieldOpacity * (1.0 + audio * 0.2);
}`,
    mainCall: `  if (uRetroStarfieldEnabled > 0.5) color += retroStarfield(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-8bit-grid',
    uniforms: `uniform float u8BitGridEnabled;
uniform float u8BitGridOpacity;
uniform float u8BitGridSpeed;
uniform float u8BitGridPixelSize;
`,
    functions: `vec3 eightBitGrid(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float gridSpeed = u8BitGridSpeed;
  float pixelSize = u8BitGridPixelSize;

  vec3 col = vec3(0.0);

  // Pixelate UV
  vec2 pixelatedUV = floor(p / pixelSize) * pixelSize;

  // Grid pattern
  vec2 gridUV = pixelatedUV;
  float gridSize = 0.1;
  vec2 grid = floor(gridUV / gridSize);
  vec2 cell = fract(gridUV / gridSize);

  // Grid lines
  float gridLine = step(0.9, cell.x) + step(0.9, cell.y);

  // Animated grid cells
  float cellPattern = hash21(grid);
  float cellAnimation = sin(t * gridSpeed + grid.x + grid.y) * 0.5 + 0.5;

  // Retro color palette
  vec3 gridColor;
  float colorIndex = hash21(grid);
  if (colorIndex < 0.2) gridColor = vec3(1.0, 0.0, 0.0);
  else if (colorIndex < 0.4) gridColor = vec3(0.0, 1.0, 0.0);
  else if (colorIndex < 0.6) gridColor = vec3(0.0, 0.0, 1.0);
  else if (colorIndex < 0.8) gridColor = vec3(1.0, 1.0, 0.0);
  else gridColor = vec3(1.0, 1.0, 1.0);

  // Cell fill
  float cellFill = cellPattern * cellAnimation;

  // Audio-reactive intensity
  float audioIntensity = audio * 0.7;

  // Grid line color
  vec3 lineColor = vec3(0.3, 0.3, 0.3);

  col += gridColor * cellFill * 0.3;
  col += lineColor * gridLine * 0.5;
  col += gridColor * gridLine * (0.3 + audioIntensity);

  // Pixel effect
  col = floor(col * 4.0) / 4.0;

  return col * u8BitGridOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (u8BitGridEnabled > 0.5) color += eightBitGrid(effectUv, uTime, mid);
`,
  },

  {
    id: 'gen-arcade-invaders',
    uniforms: `uniform float uArcadeInvadersEnabled;
uniform float uArcadeInvadersDensity;
uniform float uArcadeInvadersAnimation;
uniform float uArcadeInvadersOpacity;
`,
    functions: `vec3 arcadeInvaders(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float density = uArcadeInvadersDensity;
  float animation = uArcadeInvadersAnimation;

  vec3 col = vec3(0.0);

  // Invader grid
  float gridSize = 0.15;
  vec2 grid = floor(p / gridSize);
  vec2 cell = fract(p / gridSize);

  // Invader movement
  float moveX = sin(t * 0.5 * animation) * 0.1;
  float moveY = floor(t * 0.3 * animation) * gridSize * 0.1;

  // Create invaders
  for (float i = 0.0; i < density * 10.0; i++) {
    float invaderX = fract(hash21(vec2(i, 0.0)) + moveX);
    float invaderY = fract(hash21(vec2(0.0, i)) - moveY);

    vec2 invaderPos = vec2(invaderX, invaderY);
    vec2 invaderGrid = floor(p / gridSize) - floor(invaderPos / gridSize);

    // Invader sprite (simple 5x5 pattern)
    float invader = 0.0;
    float invaderCenterX = 0.5;
    float invaderCenterY = 0.5;
    vec2 localUV = (cell - vec2(invaderCenterX, invaderCenterY)) * 10.0;

    // Simple invader shape
    float body = smoothstep(0.3, 0.0, abs(localUV.x)) * smoothstep(0.4, 0.0, abs(localUV.y));
    float arms = smoothstep(0.2, 0.0, abs(abs(localUV.x) - 0.8)) * smoothstep(0.2, 0.0, abs(localUV.y - 0.6));
    float legs = smoothstep(0.15, 0.0, abs(abs(localUV.x) - 0.5)) * smoothstep(0.2, 0.0, abs(localUV.y + 0.7));

    float invaderShape = max(body, max(arms, legs));

    // Invader color
    vec3 invaderColor;
    float colorIndex = hash21(vec2(i, t));
    if (colorIndex < 0.5) invaderColor = vec3(0.0, 1.0, 0.0);
    else invaderColor = vec3(1.0, 0.0, 0.0);

    // Animation
    float wave = sin(t * 3.0 + i) * 0.1;

    // Audio-reactive intensity
    float audioBoost = audio * 0.5;

    col += invaderColor * invaderShape * (1.0 + wave + audioBoost) * 0.3;
  }

  // Background grid
  float bgGrid = step(0.95, fract(p.x / gridSize)) + step(0.95, fract(p.y / gridSize));
  col += vec3(0.1, 0.1, 0.15) * bgGrid;

  return col * uArcadeInvadersOpacity * (1.0 + audio * 0.4);
}`,
    mainCall: `  if (uArcadeInvadersEnabled > 0.5) color += arcadeInvaders(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-power-up-pulse',
    uniforms: `uniform float uPowerUpPulseEnabled;
uniform float uPowerUpPulseIntensity;
uniform float uPowerUpPulseSpeed;
uniform float uPowerUpPulseOpacity;
`,
    functions: `vec3 powerUpPulse(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float intensity = uPowerUpPulseIntensity;
  float speed = uPowerUpPulseSpeed;

  vec3 col = vec3(0.0);

  // Power-up orbs
  for (float i = 0.0; i < 5.0; i++) {
    float orbX = 0.2 + i * 0.15;
    float orbY = 0.5 + sin(t * speed + i * 0.8) * 0.2;

    vec2 orbPos = vec2(orbX, orbY);
    float toOrb = length(p - orbPos);

    // Orb size with pulse
    float orbSize = 0.05 + sin(t * 3.0 + i) * 0.01 * intensity;

    // Orb glow
    float orbGlow = smoothstep(orbSize * 2.0, 0.0, toOrb);
    float orbCore = smoothstep(orbSize, 0.0, toOrb);

    // Power-up colors
    vec3 orbColor;
    float colorIndex = i / 5.0;
    if (colorIndex < 0.2) orbColor = vec3(1.0, 0.0, 0.0);
    else if (colorIndex < 0.4) orbColor = vec3(1.0, 1.0, 0.0);
    else if (colorIndex < 0.6) orbColor = vec3(0.0, 1.0, 0.0);
    else if (colorIndex < 0.8) orbColor = vec3(0.0, 0.5, 1.0);
    else orbColor = vec3(1.0, 0.0, 1.0);

    // Audio-reactive pulse
    float audioPulse = sin(t * 5.0 + i + audio * 3.0) * 0.5 + 0.5;

    col += orbColor * orbGlow * intensity * 0.3;
    col += orbColor * orbCore * (0.5 + audioPulse * 0.5);

    // Sparkle effect
    float sparkle = smoothstep(0.005, 0.0, length(p - orbPos - vec2(sin(t * 10.0 + i) * 0.02, cos(t * 10.0 + i * 1.5) * 0.02)));
    col += vec3(1.0, 1.0, 1.0) * sparkle * 0.5;
  }

  // Background gradient
  float bgGradient = smoothstep(0.0, 1.0, p.y);
  col += vec3(0.05, 0.02, 0.08) * bgGradient;

  return col * uPowerUpPulseOpacity * (1.0 + audio * 0.4);
}`,
    mainCall: `  if (uPowerUpPulseEnabled > 0.5) color += powerUpPulse(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-dungeon-tiles',
    uniforms: `uniform float uDungeonTilesEnabled;
uniform float uDungeonTilesPattern;
uniform float uDungeonTilesAnimation;
uniform float uDungeonTilesOpacity;
`,
    functions: `vec3 dungeonTiles(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float pattern = uDungeonTilesPattern;
  float animation = uDungeonTilesAnimation;

  vec3 col = vec3(0.0);

  // Tile grid
  float tileSize = 0.08;
  vec2 tile = floor(p / tileSize);
  vec2 cell = fract(p / tileSize);

  // Dungeon floor pattern
  float tileType = hash21(tile);
  float floorPattern = mod(tile.x + tile.y, 2.0);

  // Tile colors
  vec3 floorColor1 = vec3(0.15, 0.1, 0.1);
  vec3 floorColor2 = vec3(0.2, 0.15, 0.15);
  vec3 wallColor = vec3(0.1, 0.08, 0.08);

  // Tile texture
  float texture = hash21(floor(cell * 5.0)) * 0.1;

  // Animated tiles
  float tileAnim = sin(t * animation + tile.x + tile.y) * 0.5 + 0.5;

  // Floor tiles — tileAnim brightens the active cell slightly
  vec3 tileColor = mix(floorColor1, floorColor2, floorPattern);
  tileColor *= 0.9 + tileAnim * 0.1;

  // Wall tiles
  if (tileType > pattern) {
    tileColor = wallColor;
    // Wall texture
    tileColor += vec3(0.02, 0.02, 0.02) * texture;
  }

  // Torch effect (animated light)
  for (float i = 0.0; i < 3.0; i++) {
    float torchX = 0.2 + i * 0.3;
    float torchY = 0.5 + sin(t * 0.5 + i) * 0.1;
    vec2 torchPos = vec2(torchX, torchY);

    float torchDist = length(p - torchPos);
    float torchGlow = smoothstep(0.15, 0.0, torchDist);

    // Torch flicker
    float flicker = sin(t * 8.0 + i * 2.0) * 0.3 + 0.7;

    // Audio-reactive torch
    float audioBoost = audio * 0.5;

    vec3 torchColor = vec3(1.0, 0.8, 0.4) * flicker * (1.0 + audioBoost);
    tileColor += torchColor * torchGlow * 0.3;
  }

  col += tileColor;

  // Pixel effect
  col = floor(col * 8.0) / 8.0;

  return col * uDungeonTilesOpacity * (1.0 + audio * 0.2);
}`,
    mainCall: `  if (uDungeonTilesEnabled > 0.5) color += dungeonTiles(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-chiptune-wave',
    uniforms: `uniform float uChiptuneWaveEnabled;
uniform float uChiptuneWaveBits;
uniform float uChiptuneWaveSpeed;
uniform float uChiptuneWaveOpacity;
`,
    functions: `vec3 chiptuneWave(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float bits = uChiptuneWaveBits;
  float speed = uChiptuneWaveSpeed;

  vec3 col = vec3(0.0);

  // Multiple audio-reactive waves
  for (float i = 0.0; i < bits; i++) {
    float waveY = 0.5 + sin(p.x * (5.0 + i * 2.0) + t * speed * (1.0 + i * 0.2)) * 0.1;

    // Audio modulation
    float audioMod = audio * 0.2;
    waveY += sin(p.x * (3.0 + i) + t * speed * 0.5) * audioMod;

    // Wave thickness
    float waveThickness = 0.02 + sin(t * 2.0 + i) * 0.01;

    // Wave line
    float wave = smoothstep(waveThickness, 0.0, abs(p.y - waveY));

    // 8-bit color palette
    vec3 waveColor;
    float colorIndex = i / bits;
    if (colorIndex < 0.25) waveColor = vec3(1.0, 0.0, 0.0);
    else if (colorIndex < 0.5) waveColor = vec3(1.0, 1.0, 0.0);
    else if (colorIndex < 0.75) waveColor = vec3(0.0, 1.0, 1.0);
    else waveColor = vec3(1.0, 0.0, 1.0);

    // Wave intensity
    float intensity = 0.5 + audio * 0.5;

    col += waveColor * wave * intensity * 0.4;
  }

  // Background grid
  float bgGrid = step(0.95, fract(p.x * 10.0)) + step(0.95, fract(p.y * 10.0));
  col += vec3(0.05, 0.05, 0.1) * bgGrid;

  // Pixel effect
  col = floor(col * 4.0) / 4.0;

  return col * uChiptuneWaveOpacity * (1.0 + audio * 0.5);
}`,
    mainCall: `  if (uChiptuneWaveEnabled > 0.5) color += chiptuneWave(effectUv, uTime, high);
`
  },

  {
    id: 'gen-score-counter',
    uniforms: `uniform float uScoreCounterEnabled;
uniform float uScoreCounterDigits;
uniform float uScoreCounterAnimation;
uniform float uScoreCounterOpacity;
`,
    functions: `vec3 scoreCounter(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float digits = uScoreCounterDigits;
  float animation = uScoreCounterAnimation;

  vec3 col = vec3(0.0, 0.0, 0.02);

  // Score display
  float score = fract(t * animation * 0.1) * 1000000.0;

  // Digit positions
  float digitWidth = 0.05;
  float startX = 0.2;

  for (float i = 0.0; i < digits; i++) {
    float digitX = startX + i * digitWidth;
    float digitY = 0.5;

    vec2 digitPos = vec2(digitX, digitY);
    vec2 digitUV = (p - digitPos) / digitWidth;

    // Digit value
    float digitValue = mod(floor(score / pow(10.0, digits - 1.0 - i)), 10.0);

    // 7-segment display simulation
    float segments = 0.0;

    // Segments (simplified)
    if (digitValue != 1.0 && digitValue != 4.0) segments += smoothstep(0.1, 0.0, abs(digitUV.y - 0.3)) * smoothstep(0.6, 0.0, abs(digitUV.x));
    if (digitValue != 5.0 && digitValue != 6.0) segments += smoothstep(0.1, 0.0, abs(digitUV.y - 0.3)) * smoothstep(0.6, 0.0, abs(digitUV.x - 1.0));
    if (digitValue != 2.0) segments += smoothstep(0.1, 0.0, abs(digitUV.y)) * smoothstep(0.6, 0.0, abs(digitUV.x - 0.5));
    if (digitValue != 1.0 && digitValue != 2.0 && digitValue != 3.0 && digitValue != 7.0) segments += smoothstep(0.6, 0.0, abs(digitUV.y - 0.15)) * smoothstep(0.1, 0.0, abs(digitUV.x - 0.5));
    if (digitValue != 0.0 && digitValue != 6.0 && digitValue != 8.0) segments += smoothstep(0.6, 0.0, abs(digitUV.y - 0.45)) * smoothstep(0.1, 0.0, abs(digitUV.x - 0.5));
    if (digitValue != 1.0 && digitValue != 3.0 && digitValue != 4.0 && digitValue != 5.0 && digitValue != 7.0 && digitValue != 9.0) segments += smoothstep(0.6, 0.0, abs(digitUV.y - 0.15)) * smoothstep(0.1, 0.0, abs(digitUV.x));
    if (digitValue != 0.0 && digitValue != 2.0 && digitValue != 6.0 && digitValue != 8.0) segments += smoothstep(0.6, 0.0, abs(digitUV.y - 0.45)) * smoothstep(0.1, 0.0, abs(digitUV.x - 1.0));

    // Digit color
    vec3 digitColor = vec3(1.0, 1.0, 1.0);

    // Audio-reactive glow
    float audioGlow = audio * 0.3;

    col += digitColor * segments * (1.0 + audioGlow) * 0.5;
  }

  // Score label
  float labelY = 0.6;
  vec3 labelColor = vec3(1.0, 1.0, 0.0);
  float label = smoothstep(0.15, 0.0, abs(p.y - labelY)) * smoothstep(0.2, 0.0, abs(p.x - 0.5));
  col += labelColor * label * 0.3;

  return col * uScoreCounterOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uScoreCounterEnabled > 0.5) color += scoreCounter(effectUv, uTime, mid);
`
  },

  {
    id: 'gen-pixel-rain',
    uniforms: `uniform float uPixelRainEnabled;
uniform float uPixelRainDensity;
uniform float uPixelRainSpeed;
uniform float uPixelRainOpacity;
`,
    functions: `vec3 pixelRain(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float density = uPixelRainDensity;
  float speed = uPixelRainSpeed;

  vec3 col = vec3(0.0, 0.0, 0.02);

  // Falling pixels
  for (float i = 0.0; i < density * 20.0; i++) {
    float pixelX = hash21(vec2(i, 0.0));
    float pixelY = fract(hash21(vec2(0.0, i)) + t * speed * (0.5 + hash21(vec2(i, t))));

    vec2 pixelPos = vec2(pixelX, pixelY);

    // Pixel size
    float pixelSize = 0.02;

    // Pixel quantization
    vec2 pixelatedPos = floor(pixelPos / pixelSize) * pixelSize;
    vec2 pixelatedUV = floor(p / pixelSize) * pixelSize;

    // Trail effect
    float trail = smoothstep(0.0, 0.2, pixelY) * smoothstep(0.4, 0.2, pixelY);

    // Pixel brightness
    float brightness = hash21(vec2(i, t * 0.5));

    // Pixel color (Matrix-style but game-colored)
    vec3 pixelColor;
    float colorIndex = hash21(vec2(i, 0.0));
    if (colorIndex < 0.33) pixelColor = vec3(0.0, 1.0, 0.0);
    else if (colorIndex < 0.66) pixelColor = vec3(0.0, 0.8, 0.5);
    else pixelColor = vec3(0.0, 0.5, 1.0);

    // Audio-reactive intensity
    float audioIntensity = audio * 0.5;

    // Pixel shape
    float pixel = smoothstep(pixelSize, 0.0, length(pixelatedUV - pixelatedPos));

    col += pixelColor * pixel * brightness * trail * (1.0 + audioIntensity) * 0.3;
  }

  // Scanlines
  float scanline = sin(p.y * 30.0) * 0.03;
  col *= 1.0 - scanline;

  return col * uPixelRainOpacity * (1.0 + audio * 0.4);
}`,
    mainCall: `  if (uPixelRainEnabled > 0.5) color += pixelRain(effectUv, uTime, mid);
`
  },

  // ── Category 1: Generators with actual shader code in glRenderer.ts ──────────

  {
    id: 'gen-particles',
    uniforms: `uniform float uParticlesEnabled;
uniform float uParticleDensity;
uniform float uParticleSpeed;
uniform float uParticleSize;
uniform float uParticleGlow;
uniform float uParticleTurbulence;
uniform float uParticleAudioLift;
`,
    functions: `float particleField(vec2 uv, float t, float density, float speed, float size) {
  float grid = mix(18.0, 90.0, density);
  float audio = (uRms * 0.4 + uPeak * 0.6) * uParticleAudioLift;
  vec2 drift = vec2(t * 0.02 * (0.2 + speed), t * 0.015 * (0.2 + speed));
  vec2 turb = vec2(
      sin(uv.y * 4.0 + t * 0.5),
      cos(uv.x * 4.0 + t * 0.5)
  ) * uParticleTurbulence * 0.5;
  vec2 gv = uv * grid + drift + turb;
  vec2 cell = floor(gv);
  vec2 f = fract(gv);
  float rnd = hash21(cell);
  vec2 pos = vec2(hash21(cell + 1.3), hash21(cell + 9.1));
  pos = 0.2 + 0.6 * pos;
  float twinkle = 0.4 + 0.6 * sin(t * (1.5 + rnd * 2.5) + rnd * 6.2831) + audio;
  float radius = mix(0.05, 0.015, density) * mix(1.4, 0.6, size);
  float d = distance(f, pos);
  float spark = smoothstep(radius, 0.0, d);
  return spark * twinkle;
}
`,
    mainCall: `  if (uParticlesEnabled > 0.5) color += getPaletteColor(0.5) * particleField(effectUv, uTime, uParticleDensity, uParticleSpeed, uParticleSize) * uParticleGlow * (0.5 + uRms * 0.8);
`,
  },

  {
    id: 'gen-sdf',
    uniforms: `uniform float uSdfEnabled;
uniform float uSdfShape;
uniform float uSdfScale;
uniform float uSdfEdge;
uniform float uSdfGlow;
uniform float uSdfRotation;
uniform float uSdfFill;
uniform vec3 uSdfColor;
uniform float uInternalSource;
uniform float uAdvancedSdfEnabled;
uniform vec3 uCameraPos;
uniform vec3 uCameraTarget;
uniform float uCameraFov;
uniform vec3 uSdfLightDir;
uniform vec3 uSdfLightColor;
uniform float uSdfLightIntensity;
uniform float uSdfAoEnabled;
uniform float uSdfShadowsEnabled;
`,
    functions: ``,
    mainCall: `  if (uSdfEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    if (uAdvancedSdfEnabled > 0.5) {
      vec2 uv = centered * vec2(uAspect, 1.0);
      vec3 ro = uCameraPos;
      vec3 rd = getRayDirection(uv, ro, uCameraTarget, uCameraFov);
      float t = 0.0; vec2 res = vec2(0.0); bool hit = false;
      for (float i = 0.0; i < 64.0; i += 1.0) {
        vec3 p = ro + rd * t; res = advancedSdfMap(p);
        if (res.x < 0.001) { hit = true; break; }
        if (t > 10.0) break;
        t += res.x;
      }
      if (hit) {
        vec3 p = ro + rd * t, n = calcSdfNormal(p), l = normalize(uSdfLightDir);
        float diff = max(dot(n, l), 0.0) * uSdfLightIntensity;
        float amb = 0.2;
        float shadow = uSdfShadowsEnabled > 0.5 ? calcSdfShadow(p, l, 8.0) : 1.0;
        float ao = uSdfAoEnabled > 0.5 ? calcSdfAO(p, n) : 1.0;
        vec3 lighting = uSdfLightColor * (diff * shadow + amb) * ao;
        float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 32.0) * 0.5 * shadow;
        vec3 baseCol = getSdfColor(res.y);
        if (uInternalSource > 0.5) {
            float sampleVal = getWaveform(fract(res.y * 0.123 + uTime * 0.1));
            baseCol = mix(baseCol, vec3(sampleVal), 0.5);
        }
        baseCol *= uSdfColor;
        color += (baseCol * lighting + spec + smoothstep(0.1, 0.0, res.x) * uSdfGlow) * uSdfFill;
      }
    } else {
      centered = rotate2d(centered, uSdfRotation);
      float scale = mix(0.2, 0.9, uSdfScale);
      float sdfValue;
      if (uSdfShape < 0.5) sdfValue = sdCircle(centered, scale);
      else if (uSdfShape < 1.5) sdfValue = sdBox(centered, vec2(scale));
      else if (uSdfShape < 2.5) sdfValue = sdEquilateralTriangle(centered, scale);
      else if (uSdfShape < 3.5) sdfValue = sdHexagon(centered, scale);
      else if (uSdfShape < 4.5) sdfValue = sdStar(centered, scale, 5, 2.0);
      else sdfValue = sdRing(centered, scale, uSdfEdge * 0.5);
      color += uSdfColor * max(smoothstep(0.02, -0.02, sdfValue) * uSdfFill, smoothstep(uSdfEdge + 0.02, 0.0, abs(sdfValue)) * uSdfGlow) * (0.85 + uPeak * 0.6);
    }
  }
`,
  },

  {
    id: 'gen-sdf-scene',
    uniforms: `uniform float uSdfSceneEnabled;
`,
    functions: ``,
    mainCall: `  if (uSdfSceneEnabled > 0.5) color += vec3(0.0); // Advanced SDF rendering handled by gen-sdf block
`,
  },

  {
    id: 'gen-infinite-wormhole',
    uniforms: `uniform float uWormholeEnabled;
uniform float uWormholeOpacity;
uniform float uWormholeSpeed;
uniform float uWormholeWeave;
uniform float uWormholeIter;
`,
    functions: `vec3 infiniteWormhole(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);
  float iter = max(2.0, uWormholeIter);
  float speed = uWormholeSpeed;
  float weave = uWormholeWeave;
  float depth = 1.0 / (r + 0.05);
  vec3 col = vec3(0.0);
  for (float i = 1.0; i <= 6.0; i += 1.0) {
    if (i > iter) break;
    float phase = depth * i * 0.4 - t * speed * (0.3 + i * 0.07);
    float twist = a + depth * weave * i * 0.3 + t * speed * 0.2;
    float ring = smoothstep(0.04, 0.0, abs(fract(phase) - 0.5) - 0.44);
    col += getPaletteColor(fract(i * 0.17 + twist * 0.1 + t * 0.05 + audio * 0.3)) * ring * (0.6 + audio * 0.6);
  }
  float vignette = smoothstep(1.2, 0.1, r);
  return col * vignette * uWormholeOpacity;
}
`,
    mainCall: `  if (uWormholeEnabled > 0.5) {
    color += infiniteWormhole(effectUv, uTime, low);
  }
`,
  },

  // ── Category 2: Variant generators (unique enabled uniform, no-op stub) ──────

  {
    id: 'variant-plasma-vortex',
    uniforms: `uniform float uVariantPlasmaVortexEnabled;
uniform float uVariantPlasmaVortexOpacity;
`,
    functions: `vec3 variantPlasmaVortex(vec2 uv, float t, float audio) { return vec3(0.0); }
`,
    mainCall: `  if (uVariantPlasmaVortexEnabled > 0.5) color += variantPlasmaVortex(effectUv, uTime, mid) * uVariantPlasmaVortexOpacity;
`,
  },

  {
    id: 'variant-plasma-liquid',
    uniforms: `uniform float uVariantPlasmaLiquidEnabled;
uniform float uVariantPlasmaLiquidOpacity;
`,
    functions: `vec3 variantPlasmaLiquid(vec2 uv, float t, float audio) { return vec3(0.0); }
`,
    mainCall: `  if (uVariantPlasmaLiquidEnabled > 0.5) color += variantPlasmaLiquid(effectUv, uTime, mid) * uVariantPlasmaLiquidOpacity;
`,
  },

  {
    id: 'variant-spectrum-neon',
    uniforms: `uniform float uVariantSpectrumNeonEnabled;
uniform float uVariantSpectrumNeonOpacity;
`,
    functions: `vec3 variantSpectrumNeon(vec2 uv, float t, float audio) { return vec3(0.0); }
`,
    mainCall: `  if (uVariantSpectrumNeonEnabled > 0.5) color += variantSpectrumNeon(effectUv, uTime, mid) * uVariantSpectrumNeonOpacity;
`,
  },

  {
    id: 'variant-origami-canyon',
    uniforms: `uniform float uVariantOrigamiCanyonEnabled;
uniform float uVariantOrigamiCanyonOpacity;
`,
    functions: `vec3 variantOrigamiCanyon(vec2 uv, float t, float audio) { return vec3(0.0); }
`,
    mainCall: `  if (uVariantOrigamiCanyonEnabled > 0.5) color += variantOrigamiCanyon(effectUv, uTime, mid) * uVariantOrigamiCanyonOpacity;
`,
  },

  {
    id: 'variant-glyph-orbit',
    uniforms: `uniform float uVariantGlyphOrbitEnabled;
uniform float uVariantGlyphOrbitOpacity;
`,
    functions: `vec3 variantGlyphOrbit(vec2 uv, float t, float audio) { return vec3(0.0); }
`,
    mainCall: `  if (uVariantGlyphOrbitEnabled > 0.5) color += variantGlyphOrbit(effectUv, uTime, mid) * uVariantGlyphOrbitOpacity;
`,
  },

  {
    id: 'variant-crystal-fracture',
    uniforms: `uniform float uVariantCrystalFractureEnabled;
uniform float uVariantCrystalFractureOpacity;
`,
    functions: `vec3 variantCrystalFracture(vec2 uv, float t, float audio) { return vec3(0.0); }
`,
    mainCall: `  if (uVariantCrystalFractureEnabled > 0.5) color += variantCrystalFracture(effectUv, uTime, mid) * uVariantCrystalFractureOpacity;
`,
  },

  {
    id: 'variant-ink-neon',
    uniforms: `uniform float uVariantInkNeonEnabled;
uniform float uVariantInkNeonOpacity;
`,
    functions: `vec3 variantInkNeon(vec2 uv, float t, float audio) { return vec3(0.0); }
`,
    mainCall: `  if (uVariantInkNeonEnabled > 0.5) color += variantInkNeon(effectUv, uTime, mid) * uVariantInkNeonOpacity;
`,
  },

  {
    id: 'variant-topo-rift',
    uniforms: `uniform float uVariantTopoRiftEnabled;
uniform float uVariantTopoRiftOpacity;
`,
    functions: `vec3 variantTopoRift(vec2 uv, float t, float audio) { return vec3(0.0); }
`,
    mainCall: `  if (uVariantTopoRiftEnabled > 0.5) color += variantTopoRift(effectUv, uTime, mid) * uVariantTopoRiftOpacity;
`,
  },

  {
    id: 'variant-weather-stormcells',
    uniforms: `uniform float uVariantWeatherStormcellsEnabled;
uniform float uVariantWeatherStormcellsOpacity;
`,
    functions: `vec3 variantWeatherStormcells(vec2 uv, float t, float audio) { return vec3(0.0); }
`,
    mainCall: `  if (uVariantWeatherStormcellsEnabled > 0.5) color += variantWeatherStormcells(effectUv, uTime, mid) * uVariantWeatherStormcellsOpacity;
`,
  },

  {
    id: 'variant-portal-echo',
    uniforms: `uniform float uVariantPortalEchoEnabled;
uniform float uVariantPortalEchoOpacity;
`,
    functions: `vec3 variantPortalEcho(vec2 uv, float t, float audio) { return vec3(0.0); }
`,
    mainCall: `  if (uVariantPortalEchoEnabled > 0.5) color += variantPortalEcho(effectUv, uTime, mid) * uVariantPortalEchoOpacity;
`,
  },

  // ── Category 3: New gen- generators + variants (stubs) ───────────────────────

  {
    id: 'gen-audio-geometry',
    uniforms: `uniform float uAudioGeometryEnabled;
uniform float uAudioGeometryOpacity;
`,
    functions: `vec3 audioGeometry(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  vec3 col = vec3(0.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  for (float i = 1.0; i <= 4.0; i += 1.0) {
    float radius = 0.2 * i + audio * 0.12 * i;
    float sides = 3.0 + i;
    float angle = a + t * 0.3 * (i * 0.5 - 1.0);
    float sector = 6.28318 / sides;
    float sa = mod(angle, sector) - sector * 0.5;
    float d = cos(sa) * radius - r;
    float ring = smoothstep(0.02, 0.0, abs(d));
    col += getPaletteColor(fract(i * 0.25 + t * 0.05)) * ring * (0.6 + audio * 0.8);
  }
  float core = smoothstep(0.05 + audio * 0.1, 0.0, r);
  col += getPaletteColor(0.1) * core * (1.0 + audio * 2.0);
  return col;
}
`,
    mainCall: `  if (uAudioGeometryEnabled > 0.5) color += audioGeometry(effectUv, uTime, mid) * uAudioGeometryOpacity;
`,
  },

  {
    id: 'variant-audio-geometry-prism',
    uniforms: `uniform float uVariantAudioGeometryPrismEnabled;
uniform float uVariantAudioGeometryPrismOpacity;
`,
    functions: `vec3 variantAudioGeometryPrism(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  vec3 col = vec3(0.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  for (float ch = 0.0; ch < 3.0; ch += 1.0) {
    float offset = ch * 0.015 * (1.0 + audio);
    for (float i = 1.0; i <= 5.0; i += 1.0) {
      float radius = 0.18 * i + audio * 0.1 * i + offset;
      float sides = 4.0 + i;
      float angle = a + t * 0.2 * i + ch * 0.4;
      float sector = 6.28318 / sides;
      float sa = mod(angle, sector) - sector * 0.5;
      float d = abs(cos(sa) * radius - r);
      float ring = smoothstep(0.018, 0.0, d);
      vec3 chCol = ch < 0.5 ? vec3(1.0, 0.2, 0.2) : ch < 1.5 ? vec3(0.2, 1.0, 0.2) : vec3(0.2, 0.4, 1.0);
      col += chCol * ring * 0.5 * (0.5 + audio);
    }
  }
  return col;
}
`,
    mainCall: `  if (uVariantAudioGeometryPrismEnabled > 0.5) color += variantAudioGeometryPrism(effectUv, uTime, mid) * uVariantAudioGeometryPrismOpacity;
`,
  },

  {
    id: 'gen-organic-fluid',
    uniforms: `uniform float uOrganicFluidEnabled;
uniform float uOrganicFluidOpacity;
`,
    functions: `vec3 organicFluid(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float speed = 0.25 + audio * 0.4;
  vec2 q = vec2(fbm(p + vec2(0.0, t * speed * 0.3)),
                fbm(p + vec2(5.2, t * speed * 0.3)));
  vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * speed * 0.15),
                fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * speed * 0.15));
  float f = fbm(p + 4.0 * r);
  vec3 col = mix(getPaletteColor(0.1), getPaletteColor(0.5), clamp(f * f * 4.0, 0.0, 1.0));
  col = mix(col, getPaletteColor(0.9), clamp(length(q), 0.0, 1.0));
  col = mix(col, getPaletteColor(0.6), clamp(r.x * r.x, 0.0, 1.0));
  f = pow(clamp(f, 0.0, 1.0), 0.5 + audio * 0.5);
  return col * f * (0.8 + audio * 0.4);
}
`,
    mainCall: `  if (uOrganicFluidEnabled > 0.5) color += organicFluid(effectUv, uTime, mid) * uOrganicFluidOpacity;
`,
  },

  {
    id: 'variant-organic-fluid-ink',
    uniforms: `uniform float uVariantOrganicFluidInkEnabled;
uniform float uVariantOrganicFluidInkOpacity;
`,
    functions: `vec3 variantOrganicFluidInk(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float speed = 0.15 + audio * 0.3;
  vec2 q = vec2(fbm(p * 1.5 + vec2(0.0, t * speed)),
                fbm(p * 1.5 + vec2(3.2, t * speed)));
  vec2 r = vec2(fbm(p * 2.0 + 4.0 * q + vec2(1.7, 9.2) + t * speed * 0.5),
                fbm(p * 2.0 + 4.0 * q + vec2(8.3, 2.8) + t * speed * 0.5));
  float f = fbm(p * 2.5 + 4.0 * r + t * speed * 0.2);
  float ink = pow(abs(sin(f * 8.0 + t * 0.2)), 2.0 + audio * 2.0);
  vec3 col = mix(vec3(0.0), getPaletteColor(f + uPaletteShift), ink * (0.5 + audio * 0.8));
  return col;
}
`,
    mainCall: `  if (uVariantOrganicFluidInkEnabled > 0.5) color += variantOrganicFluidInk(effectUv, uTime, mid) * uVariantOrganicFluidInkOpacity;
`,
  },

  {
    id: 'gen-neon-wireframe',
    uniforms: `uniform float uNeonWireframeEnabled;
uniform float uNeonWireframeOpacity;
`,
    functions: `vec3 neonWireframe(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float ca = cos(t * 0.4), sa = sin(t * 0.4);
  float cb = cos(t * 0.3 + audio * 1.5), sb = sin(t * 0.3 + audio * 1.5);
  vec2 verts[8];
  float s = 0.55 + audio * 0.12;
  for (int i = 0; i < 8; i++) {
    float x = (float(i & 1) * 2.0 - 1.0) * s;
    float y = (float((i >> 1) & 1) * 2.0 - 1.0) * s;
    float z = (float((i >> 2) & 1) * 2.0 - 1.0) * s;
    float x2 = x * ca - z * sa; float z2 = x * sa + z * ca;
    float y2 = y * cb - z2 * sb;
    float z3 = y * sb + z2 * cb;
    float fov = 2.0 / (z3 + 3.0);
    verts[i] = vec2(x2, y2) * fov;
  }
  vec3 col = vec3(0.0);
  int edges[24] = int[24](0,1, 2,3, 4,5, 6,7, 0,2, 1,3, 4,6, 5,7, 0,4, 1,5, 2,6, 3,7);
  for (int e = 0; e < 12; e++) {
    vec2 a = verts[edges[e*2]], b = verts[edges[e*2+1]];
    float d = sdSegment(p, a, b);
    float glow = (0.004 + audio * 0.003) / (d + 0.001);
    col += getPaletteColor(float(e) / 12.0 + t * 0.04) * glow * 0.012;
  }
  return col;
}
`,
    mainCall: `  if (uNeonWireframeEnabled > 0.5) color += neonWireframe(effectUv, uTime, mid) * uNeonWireframeOpacity;
`,
  },

  {
    id: 'variant-neon-wireframe-grid',
    uniforms: `uniform float uVariantNeonWireframeGridEnabled;
uniform float uVariantNeonWireframeGridOpacity;
`,
    functions: `vec3 variantNeonWireframeGrid(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float horizon = 0.5 + 0.05 * sin(t * 0.3);
  if (p.y < horizon) return vec3(0.0);
  float y = p.y - horizon;
  float z = 1.0 / (y + 0.01);
  float x = (p.x - 0.5) * z;
  float speed = t * 0.5 * (1.0 + audio * 0.8);
  vec2 grid = vec2(x, z + speed);
  float gx = smoothstep(0.06, 0.0, abs(fract(grid.x + 0.5) - 0.5));
  float gz = smoothstep(0.06, 0.0, abs(fract(grid.y + 0.5) - 0.5));
  float line = max(gx, gz) * min(1.0, z * 0.1);
  float fade = smoothstep(0.0, 0.3, y) * smoothstep(2.0, 0.5, y);
  vec3 col = getPaletteColor(fract(z * 0.05 + t * 0.03)) * line * fade;
  col *= (0.8 + audio * 0.6);
  return col;
}
`,
    mainCall: `  if (uVariantNeonWireframeGridEnabled > 0.5) color += variantNeonWireframeGrid(effectUv, uTime, mid) * uVariantNeonWireframeGridOpacity;
`,
  },

  {
    id: 'gen-glitch-datamosh',
    uniforms: `uniform float uGlitchDatamoshEnabled;
uniform float uGlitchDatamoshOpacity;
`,
    functions: `vec3 glitchDatamosh(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float glitchIntensity = audio * 0.6 + 0.1;
  float blockY = floor(p.y * (8.0 + audio * 16.0)) / (8.0 + audio * 16.0);
  float glitchH = hash21(vec2(blockY, floor(t * 4.0)));
  float doGlitch = step(0.65, glitchH);
  float offsetX = (hash21(vec2(blockY * 3.7, floor(t * 6.0))) - 0.5) * 0.25 * glitchIntensity * doGlitch;
  vec2 displaced = vec2(fract(p.x + offsetX), p.y);
  float chromaX = 0.02 * glitchIntensity * doGlitch;
  float r = getPaletteColor(hash21(floor(displaced * vec2(80.0, 40.0)) + vec2(t * 3.0, 0.0))).r;
  float g = getPaletteColor(hash21(floor(displaced * vec2(80.0, 40.0) + vec2(chromaX, 0.0) * 80.0) + vec2(t * 3.0 + 0.5, 0.0))).g;
  float b = getPaletteColor(hash21(floor(displaced * vec2(80.0, 40.0) - vec2(chromaX, 0.0) * 80.0) + vec2(t * 3.0 + 1.0, 0.0))).b;
  vec3 col = vec3(r, g, b);
  float scan = step(0.5, fract(p.y * 120.0)) * 0.15;
  col *= (1.0 - scan);
  return col * (0.5 + audio * 0.6);
}
`,
    mainCall: `  if (uGlitchDatamoshEnabled > 0.5) color += glitchDatamosh(effectUv, uTime, mid) * uGlitchDatamoshOpacity;
`,
  },

  {
    id: 'variant-glitch-datamosh-hard',
    uniforms: `uniform float uVariantGlitchDatamoshHardEnabled;
uniform float uVariantGlitchDatamoshHardOpacity;
`,
    functions: `vec3 variantGlitchDatamoshHard(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float beats = floor(t * 2.0);
  float blockY = floor(p.y * 4.0) / 4.0;
  float glitchH = hash21(vec2(blockY, beats));
  float offsetX = step(0.4, glitchH) * (hash21(vec2(blockY * 7.1, beats)) - 0.5) * 0.6;
  float offsetY = step(0.7, hash21(vec2(blockY * 2.3, beats))) * (hash21(vec2(blockY * 5.5, beats + 0.5)) - 0.5) * 0.1;
  vec2 g = fract(p + vec2(offsetX, offsetY));
  vec3 col = getPaletteColor(hash21(floor(g * vec2(16.0, 8.0)) + beats));
  float tear = step(0.8, hash21(vec2(floor(p.y * 8.0), beats * 0.5)));
  col *= (1.0 - tear * 0.9);
  col *= (0.7 + audio * 0.9);
  return col;
}
`,
    mainCall: `  if (uVariantGlitchDatamoshHardEnabled > 0.5) color += variantGlitchDatamoshHard(effectUv, uTime, mid) * uVariantGlitchDatamoshHardOpacity;
`,
  },

  {
    id: 'gen-particle-swarm',
    uniforms: `uniform float uParticleSwarmEnabled;
uniform float uParticleSwarmOpacity;
`,
    functions: `vec3 particleSwarm(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  vec3 col = vec3(0.0);
  float count = 48.0;
  for (float i = 0.0; i < count; i += 1.0) {
    float fi = i / count;
    float phase = fi * 6.28318;
    float px = sin(phase * 3.0 + t * 0.7 + audio * 2.0) * (0.4 + audio * 0.2);
    float py = sin(phase * 2.0 + t * 0.5) * 0.35;
    vec2 pp = vec2(px, py);
    float d = length(p - pp);
    float glow = (0.006 + audio * 0.004) / (d * d + 0.001);
    col += getPaletteColor(fi + t * 0.05) * glow * 0.003;
  }
  return col;
}
`,
    mainCall: `  if (uParticleSwarmEnabled > 0.5) color += particleSwarm(effectUv, uTime, mid) * uParticleSwarmOpacity;
`,
  },

  {
    id: 'variant-particle-swarm-bloom',
    uniforms: `uniform float uVariantParticleSwarmBloomEnabled;
uniform float uVariantParticleSwarmBloomOpacity;
`,
    functions: `vec3 variantParticleSwarmBloom(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  vec3 col = vec3(0.0);
  float count = 32.0;
  for (float i = 0.0; i < count; i += 1.0) {
    float fi = i / count;
    float phase = fi * 6.28318;
    float spd = 0.4 + fi * 0.6;
    float px = sin(phase * 2.0 + t * spd + audio * 3.0) * (0.5 + audio * 0.25);
    float py = cos(phase * 3.0 + t * spd * 0.7) * 0.4;
    vec2 pp = vec2(px, py);
    float d = length(p - pp);
    float core = smoothstep(0.03, 0.0, d);
    float bloom = 0.015 / (d * d + 0.004);
    vec3 c = getPaletteColor(fi + t * 0.04 + audio * 0.2);
    col += c * (core * 2.0 + bloom * 0.02 * (0.5 + audio));
  }
  return col;
}
`,
    mainCall: `  if (uVariantParticleSwarmBloomEnabled > 0.5) color += variantParticleSwarmBloom(effectUv, uTime, mid) * uVariantParticleSwarmBloomOpacity;
`,
  },

  {
    id: 'gen-typography-reveal',
    uniforms: `uniform float uTypographyRevealEnabled;
uniform float uTypographyRevealOpacity;
`,
    functions: `vec3 typographyReveal(vec2 uv, float t, float audio) {
  vec2 p = uv;
  vec2 gridSize = vec2(14.0, 8.0);
  vec2 cell = floor(p * gridSize);
  vec2 local = fract(p * gridSize);
  float rnd = hash21(cell + floor(t * 0.5));
  float rnd2 = hash21(cell + 13.7);
  float activeVal = step(0.3, rnd);
  float charPhase = fract(t * 0.25 + rnd2);
  float charType = floor(hash21(cell + charPhase) * 6.0);
  float stroke = 0.0;
  vec2 lp = local - 0.5;
  if (charType < 1.0) stroke = max(smoothstep(0.04, 0.0, abs(lp.x)), smoothstep(0.04, 0.0, abs(lp.y)));
  else if (charType < 2.0) stroke = smoothstep(0.04, 0.0, abs(length(lp) - 0.3));
  else if (charType < 3.0) stroke = smoothstep(0.04, 0.0, abs(lp.x)) * step(-0.3, lp.y) * step(lp.y, 0.3);
  else if (charType < 4.0) stroke = smoothstep(0.04, 0.0, abs(lp.y)) * step(-0.3, lp.x) * step(lp.x, 0.3);
  else stroke = smoothstep(0.06, 0.0, sdBox(lp, vec2(0.28, 0.28)));
  stroke *= activeVal * (0.5 + audio * 0.7);
  float band = floor(cell.x / gridSize.x * 8.0);
  int bIdx = int(clamp(band, 0.0, 7.0));
  float amp = uSpectrum[bIdx * 8];
  vec3 col = getPaletteColor(fract(rnd2 + t * 0.04 + amp * 0.3)) * stroke;
  return col;
}
`,
    mainCall: `  if (uTypographyRevealEnabled > 0.5) color += typographyReveal(effectUv, uTime, mid) * uTypographyRevealOpacity;
`,
  },

  {
    id: 'variant-typography-reveal-glow',
    uniforms: `uniform float uVariantTypographyRevealGlowEnabled;
uniform float uVariantTypographyRevealGlowOpacity;
`,
    functions: `vec3 variantTypographyRevealGlow(vec2 uv, float t, float audio) {
  vec2 p = uv;
  vec2 gridSize = vec2(10.0, 6.0);
  vec2 cell = floor(p * gridSize);
  vec2 local = fract(p * gridSize) - 0.5;
  float rnd = hash21(cell + floor(t * 0.3));
  float activeVal = step(0.25, rnd);
  float charType = floor(hash21(cell + 5.7) * 4.0);
  float d;
  if (charType < 1.0) d = sdCircle(local, 0.3);
  else if (charType < 2.0) d = sdBox(local, vec2(0.25));
  else if (charType < 3.0) d = sdEquilateralTriangle(local, 0.3);
  else d = sdHexagon(local, 0.28);
  float outline = smoothstep(0.04, 0.0, abs(d));
  float glow = exp(-abs(d) * 8.0) * 0.3 * activeVal;
  float amp = uSpectrum[int(clamp(cell.x / gridSize.x * 64.0, 0.0, 63.0))];
  vec3 c = getPaletteColor(hash21(cell) + t * 0.03 + amp * 0.2);
  return c * (outline + glow) * activeVal * (0.5 + audio * 0.8);
}
`,
    mainCall: `  if (uVariantTypographyRevealGlowEnabled > 0.5) color += variantTypographyRevealGlow(effectUv, uTime, mid) * uVariantTypographyRevealGlowOpacity;
`,
  },

  {
    id: 'gen-kaleido-shard',
    uniforms: `uniform float uKaleidoShardEnabled;
uniform float uKaleidoShardOpacity;
`,
    functions: `vec3 kaleidoShard(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);
  float segments = 6.0 + floor(audio * 4.0);
  float seg = 6.28318 / segments;
  a = mod(a + t * 0.1, seg);
  if (a > seg * 0.5) a = seg - a;
  vec2 q = vec2(cos(a), sin(a)) * r;
  float minDist = 1.0;
  float minId = 0.0;
  for (float i = 0.0; i < 8.0; i += 1.0) {
    vec2 seed = hash22(vec2(i, floor(t * 0.5))) * 2.0 - 1.0;
    seed *= 0.6;
    float d = length(q - seed);
    if (d < minDist) { minDist = d; minId = i; }
  }
  float edge = 1.0 - smoothstep(0.0, 0.05, minDist);
  float cell = smoothstep(0.3, 0.0, minDist) * 0.4;
  vec3 col = getPaletteColor(minId / 8.0 + t * 0.04) * (edge + cell) * (0.7 + audio * 0.8);
  col *= smoothstep(1.4, 0.2, r);
  return col;
}
`,
    mainCall: `  if (uKaleidoShardEnabled > 0.5) color += kaleidoShard(effectUv, uTime, mid) * uKaleidoShardOpacity;
`,
  },

  {
    id: 'variant-kaleido-shard-iris',
    uniforms: `uniform float uVariantKaleidoShardIrisEnabled;
uniform float uVariantKaleidoShardIrisOpacity;
`,
    functions: `vec3 variantKaleidoShardIris(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);
  float segments = 12.0;
  float seg = 6.28318 / segments;
  a = mod(a + t * 0.08, seg);
  if (a > seg * 0.5) a = seg - a;
  float rings = 4.0;
  float ringD = abs(fract(r * rings - t * 0.2) - 0.5) * 2.0;
  float angularD = abs(a / (seg * 0.5) - 0.5) * 2.0;
  float shard = smoothstep(0.1, 0.0, ringD * angularD);
  float iris = smoothstep(0.05, 0.0, abs(r - 0.5 - audio * 0.15));
  vec3 col = getPaletteColor(r * 0.4 + a / 6.28318 + t * 0.05) * (shard * 0.7 + iris * 0.5);
  col *= (0.6 + audio * 1.0) * smoothstep(1.3, 0.1, r);
  return col;
}
`,
    mainCall: `  if (uVariantKaleidoShardIrisEnabled > 0.5) color += variantKaleidoShardIris(effectUv, uTime, mid) * uVariantKaleidoShardIrisOpacity;
`,
  },

  {
    id: 'gen-radar-hud',
    uniforms: `uniform float uRadarHudEnabled;
uniform float uRadarHudOpacity;
`,
    functions: `vec3 radarHud(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec3 col = vec3(0.0);
  for (float i = 1.0; i <= 3.0; i += 1.0) {
    float ring = smoothstep(0.025, 0.0, abs(r - i * 0.35));
    col += vec3(0.0, ring * 0.4, ring * 0.15);
  }
  float sweepSpeed = 1.0 + audio * 0.8;
  float sweepAngle = mod(t * sweepSpeed, 6.28318) - 3.14159;
  float da = mod(a - sweepAngle + 3.14159, 6.28318) - 3.14159;
  float sweep = exp(-abs(da) * 3.0) * smoothstep(1.1, 0.0, r);
  col += vec3(0.0, sweep * 0.8, sweep * 0.3) * (0.5 + audio * 0.5);
  for (float i = 0.0; i < 8.0; i += 1.0) {
    float blipAngle = i / 8.0 * 6.28318;
    float blipR = 0.2 + uSpectrum[int(i * 8.0)] * 0.6;
    vec2 blipPos = vec2(cos(blipAngle), sin(blipAngle)) * blipR;
    float blipFade = mod(sweepAngle - blipAngle + 6.28318, 6.28318) / 6.28318;
    float blip = smoothstep(0.05, 0.0, length(p - blipPos)) * (1.0 - blipFade);
    col += vec3(0.0, blip, blip * 0.5) * 1.5;
  }
  float ch = smoothstep(0.015, 0.0, abs(p.x)) + smoothstep(0.015, 0.0, abs(p.y));
  ch *= smoothstep(0.04, 0.06, r);
  col += vec3(0.0, ch * 0.3, ch * 0.1);
  return col;
}
`,
    mainCall: `  if (uRadarHudEnabled > 0.5) color += radarHud(effectUv, uTime, mid) * uRadarHudOpacity;
`,
  },

  {
    id: 'variant-radar-hud-deep',
    uniforms: `uniform float uVariantRadarHudDeepEnabled;
uniform float uVariantRadarHudDeepOpacity;
`,
    functions: `vec3 variantRadarHudDeep(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec3 col = vec3(0.0);
  for (float sweep = 0.0; sweep < 3.0; sweep += 1.0) {
    float sweepSpeed = 0.6 + sweep * 0.5 + audio * 0.4;
    float sweepA = mod(t * sweepSpeed + sweep * 2.09, 6.28318) - 3.14159;
    float da = mod(a - sweepA + 3.14159, 6.28318) - 3.14159;
    float arm = exp(-abs(da) * 4.0) * smoothstep(1.2, 0.0, r);
    col += getPaletteColor(sweep / 3.0 + t * 0.02) * arm * 0.5 * (0.4 + audio * 0.6);
  }
  for (float i = 0.5; i <= 4.0; i += 0.5) {
    float ring = smoothstep(0.018, 0.0, abs(r - i * 0.28));
    col += getPaletteColor(i * 0.2) * ring * 0.5;
  }
  col *= smoothstep(1.15, 0.05, r);
  return col;
}
`,
    mainCall: `  if (uVariantRadarHudDeepEnabled > 0.5) color += variantRadarHudDeep(effectUv, uTime, mid) * uVariantRadarHudDeepOpacity;
`,
  },

  {
    id: 'gen-fractal-bloom',
    uniforms: `uniform float uFractalBloomEnabled;
uniform float uFractalBloomOpacity;
`,
    functions: `vec3 fractalBloom(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  vec2 c = vec2(0.355 + sin(t * 0.2) * 0.05, 0.355 + cos(t * 0.15) * 0.05 + audio * 0.08);
  vec2 z = p * (1.5 + audio * 0.3);
  float smooth_iter = 0.0;
  for (float i = 0.0; i < 64.0; i += 1.0) {
    if (dot(z, z) > 4.0) { smooth_iter = i - log2(log2(dot(z, z))); break; }
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
  }
  if (smooth_iter == 0.0) return getPaletteColor(0.0) * 0.05;
  float f = smooth_iter / 64.0;
  vec3 col = getPaletteColor(f + t * 0.03);
  col *= 1.0 - f * 0.5;
  col = col * col;
  return col * (0.8 + audio * 0.5);
}
`,
    mainCall: `  if (uFractalBloomEnabled > 0.5) color += fractalBloom(effectUv, uTime, mid) * uFractalBloomOpacity;
`,
  },

  {
    id: 'variant-fractal-bloom-ember',
    uniforms: `uniform float uVariantFractalBloomEmberEnabled;
uniform float uVariantFractalBloomEmberOpacity;
`,
    functions: `vec3 variantFractalBloomEmber(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  vec2 c = vec2(-0.5 + sin(t * 0.12) * 0.1, -0.5 + audio * 0.1);
  vec2 z = p * (1.2 + audio * 0.25);
  float smooth_iter = 0.0;
  for (float i = 0.0; i < 48.0; i += 1.0) {
    z = vec2(abs(z.x), abs(z.y));
    if (dot(z, z) > 4.0) { smooth_iter = i - log2(log2(dot(z, z))); break; }
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
  }
  float f = smooth_iter / 48.0;
  vec3 ember;
  if (f < 0.25) ember = mix(vec3(0.0), vec3(0.8, 0.0, 0.0), f * 4.0);
  else if (f < 0.5) ember = mix(vec3(0.8, 0.0, 0.0), vec3(1.0, 0.5, 0.0), (f - 0.25) * 4.0);
  else if (f < 0.75) ember = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 1.0, 0.3), (f - 0.5) * 4.0);
  else ember = mix(vec3(1.0, 1.0, 0.3), vec3(1.0), (f - 0.75) * 4.0);
  return ember * (0.6 + audio * 0.8);
}
`,
    mainCall: `  if (uVariantFractalBloomEmberEnabled > 0.5) color += variantFractalBloomEmber(effectUv, uTime, mid) * uVariantFractalBloomEmberOpacity;
`,
  },

  {
    id: 'gen-vhs-scanline',
    uniforms: `uniform float uVhsScanlineGenEnabled;
uniform float uVhsScanlineGenOpacity;
`,
    functions: `vec3 vhsScanlineGen(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float scanSpeed = 0.4 + audio * 0.6;
  float bands = sin(p.y * 80.0 - t * scanSpeed * 10.0) * 0.5 + 0.5;
  float bands2 = sin(p.y * 160.0 + t * scanSpeed * 7.0) * 0.5 + 0.5;
  float barX = floor(p.x * 7.0) / 7.0;
  vec3 barCol = getPaletteColor(barX + t * 0.02);
  float noise = hash21(vec2(floor(p.x * 120.0), floor(p.y * 60.0 + t * 30.0)));
  float noiseStripe = step(0.92, noise);
  float dropY = floor(p.y * 50.0 + t * 8.0);
  float dropOut = step(0.96, hash21(vec2(dropY, floor(t * 3.0))));
  vec3 col = barCol * bands * (0.5 + audio * 0.6);
  col = mix(col, getPaletteColor(0.8), noiseStripe * 0.7);
  col *= (1.0 - dropOut * 0.8);
  col *= 0.7 + bands2 * 0.4;
  return col;
}
`,
    mainCall: `  if (uVhsScanlineGenEnabled > 0.5) color += vhsScanlineGen(effectUv, uTime, mid) * uVhsScanlineGenOpacity;
`,
  },

  {
    id: 'variant-vhs-scanline-warp',
    uniforms: `uniform float uVariantVhsScanlineWarpEnabled;
uniform float uVariantVhsScanlineWarpOpacity;
`,
    functions: `vec3 variantVhsScanlineWarp(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float warpAmt = (hash21(vec2(floor(p.y * 40.0), floor(t * 5.0))) - 0.5) * 0.04 * (0.5 + audio);
  p.x = fract(p.x + warpAmt);
  float ghost = hash21(vec2(floor(p.x * 80.0 + 3.0), floor(p.y * 40.0 + t * 20.0)));
  float ghost2 = hash21(vec2(floor(p.x * 80.0 - 5.0), floor(p.y * 40.0 + t * 20.0)));
  vec3 col = getPaletteColor(ghost + t * 0.03) * 0.6 + getPaletteColor(ghost2 + 0.5) * 0.3;
  float scan = step(0.4, fract(p.y * 60.0));
  col *= 0.5 + scan * 0.5;
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, 0.4 + audio * 0.4);
  return col;
}
`,
    mainCall: `  if (uVariantVhsScanlineWarpEnabled > 0.5) color += variantVhsScanlineWarp(effectUv, uTime, mid) * uVariantVhsScanlineWarpOpacity;
`,
  },

  {
    id: 'gen-tunnel-warp',
    uniforms: `uniform float uTunnelWarpEnabled;
uniform float uTunnelWarpOpacity;
`,
    functions: `vec3 tunnelWarp(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);
  float speed = 0.5 + audio * 0.8;
  float z = 1.0 / (r + 0.001);
  vec2 tuv = vec2(a / 6.28318 + t * 0.05, z - t * speed);
  float gridU = step(0.97, fract(tuv.x * 8.0));
  float gridV = step(0.93, fract(tuv.y * 6.0));
  float grid = max(gridU, gridV);
  float warp = sin(tuv.x * 12.0 + t * 2.0) * audio * 0.06;
  float d = abs(r - (0.3 + warp));
  float ring = smoothstep(0.06, 0.0, d) * 0.5;
  vec3 col = getPaletteColor(fract(z * 0.08 + t * 0.04)) * (grid * 0.8 + ring);
  col *= smoothstep(0.0, 0.15, r) * (0.6 + audio * 0.7);
  return col;
}
`,
    mainCall: `  if (uTunnelWarpEnabled > 0.5) color += tunnelWarp(effectUv, uTime, mid) * uTunnelWarpOpacity;
`,
  },

  {
    id: 'variant-tunnel-warp-spiral',
    uniforms: `uniform float uVariantTunnelWarpSpiralEnabled;
uniform float uVariantTunnelWarpSpiralOpacity;
`,
    functions: `vec3 variantTunnelWarpSpiral(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);
  float z = 1.0 / (r + 0.001);
  float spiralA = a + z * 2.5 + t * 0.3;
  float speed = 0.6 + audio * 1.0;
  float tuv_z = z - t * speed;
  float spiral = fract(spiralA / 6.28318 * 5.0 + tuv_z * 0.5);
  float stripes = smoothstep(0.4, 0.5, spiral) - smoothstep(0.5, 0.6, spiral);
  float depth = smoothstep(3.0, 0.3, z) * smoothstep(0.0, 0.1, r);
  vec3 col = getPaletteColor(fract(z * 0.06 + a / 6.28318 + t * 0.05)) * stripes * depth;
  col *= (0.7 + audio * 0.8);
  return col;
}
`,
    mainCall: `  if (uVariantTunnelWarpSpiralEnabled > 0.5) color += variantTunnelWarpSpiral(effectUv, uTime, mid) * uVariantTunnelWarpSpiralOpacity;
`,
  },

  {
    id: 'gen-wormhole-core',
    uniforms: `uniform float uWormholeCoreEnabled;
uniform float uWormholeCoreOpacity;
`,
    functions: `vec3 wormholeCore(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec3 col = vec3(0.0);
  for (float i = 1.0; i <= 5.0; i += 1.0) {
    float radius = 0.15 * i + sin(t * 0.4 * i + audio * i) * 0.05;
    float ring = smoothstep(0.04, 0.0, abs(r - radius));
    col += getPaletteColor(i / 5.0 + t * 0.06) * ring * (0.6 + audio * 0.6);
  }
  float disk = smoothstep(0.1, 0.0, abs(r - 0.45 - sin(a * 3.0 + t) * 0.06));
  col += getPaletteColor(a / 6.28318 + t * 0.08) * disk * (0.8 + audio);
  float core = smoothstep(0.12, 0.0, r) * 2.0;
  col = max(col - vec3(core), vec3(0.0));
  return col;
}
`,
    mainCall: `  if (uWormholeCoreEnabled > 0.5) color += wormholeCore(effectUv, uTime, mid) * uWormholeCoreOpacity;
`,
  },

  {
    id: 'variant-wormhole-core-echo',
    uniforms: `uniform float uVariantWormholeCoreEchoEnabled;
uniform float uVariantWormholeCoreEchoOpacity;
`,
    functions: `vec3 variantWormholeCoreEcho(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 6.0; i += 1.0) {
    float phase = fract(t * 0.4 + i / 6.0);
    float radius = phase * 0.9;
    float fade = (1.0 - phase) * (0.5 + audio * 0.5);
    float ring = smoothstep(0.03, 0.0, abs(r - radius));
    col += getPaletteColor(i / 6.0 + t * 0.04) * ring * fade;
  }
  float twist = a + r * 4.0 * (1.0 + audio) - t * 0.6;
  float swirl = smoothstep(0.0, 0.3, r) * smoothstep(0.5, 0.2, r);
  col += getPaletteColor(twist / 6.28318 + t * 0.05) * swirl * 0.4;
  return col;
}
`,
    mainCall: `  if (uVariantWormholeCoreEchoEnabled > 0.5) color += variantWormholeCoreEcho(effectUv, uTime, mid) * uVariantWormholeCoreEchoOpacity;
`,
  },

  {
    id: 'gen-nebula-drift',
    uniforms: `uniform float uNebulaDriftEnabled;
uniform float uNebulaDriftOpacity;
`,
    functions: `vec3 nebulaDrift(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float speed = 0.06 + audio * 0.04;
  vec2 drift = vec2(t * speed, t * speed * 0.6);
  float n1 = fbm(p * 2.5 + drift);
  float n2 = fbm(p * 4.0 - drift * 0.5 + 3.2);
  float n3 = fbm(p * 8.0 + drift * 0.3 + 1.7);
  float nebula = n1 * 0.6 + n2 * 0.3 + n3 * 0.1;
  nebula = pow(nebula, 1.5 - audio * 0.4);
  vec3 col = mix(getPaletteColor(0.6), getPaletteColor(0.8), n2);
  col = mix(col, getPaletteColor(0.2), n3 * 0.5);
  col *= nebula;
  vec2 starGrid = floor(p * 80.0);
  float star = hash21(starGrid);
  float starBright = step(0.97, star);
  float twinkle = 0.5 + 0.5 * sin(t * (2.0 + star * 5.0));
  col += vec3(starBright * twinkle * (0.8 + audio * 0.4));
  return col;
}
`,
    mainCall: `  if (uNebulaDriftEnabled > 0.5) color += nebulaDrift(effectUv, uTime, mid) * uNebulaDriftOpacity;
`,
  },

  {
    id: 'variant-nebula-drift-cold',
    uniforms: `uniform float uVariantNebulaDriftColdEnabled;
uniform float uVariantNebulaDriftColdOpacity;
`,
    functions: `vec3 variantNebulaDriftCold(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float speed = 0.04 + audio * 0.03;
  vec2 drift = vec2(t * speed * 0.8, -t * speed * 0.5);
  float n1 = fbm(p * 3.0 + drift);
  float n2 = fbm(p * 6.0 - drift * 0.7 + 5.1);
  float cloud = pow(n1 * 0.7 + n2 * 0.3, 2.0 - audio * 0.5);
  vec3 cold;
  if (cloud < 0.2) cold = mix(vec3(0.0), vec3(0.0, 0.05, 0.2), cloud * 5.0);
  else if (cloud < 0.5) cold = mix(vec3(0.0, 0.05, 0.2), vec3(0.0, 0.4, 0.7), (cloud - 0.2) / 0.3);
  else if (cloud < 0.8) cold = mix(vec3(0.0, 0.4, 0.7), vec3(0.5, 0.9, 1.0), (cloud - 0.5) / 0.3);
  else cold = mix(vec3(0.5, 0.9, 1.0), vec3(1.0), (cloud - 0.8) / 0.2);
  vec2 sg = floor(p * 100.0);
  float s = step(0.975, hash21(sg));
  cold += s * vec3(0.7, 0.9, 1.0) * (0.5 + 0.5 * sin(t * hash21(sg + 1.0) * 8.0));
  return cold * (0.8 + audio * 0.4);
}
`,
    mainCall: `  if (uVariantNebulaDriftColdEnabled > 0.5) color += variantNebulaDriftCold(effectUv, uTime, mid) * uVariantNebulaDriftColdOpacity;
`,
  },

  // ── Category 4: Visualizer generators (stub) ─────────────────────────────────

  {
    id: 'viz-off',
    uniforms: `uniform float uVizOffEnabled;
`,
    functions: ``,
    mainCall: `  if (uVizOffEnabled > 0.5) color += vec3(0.0);
`,
  },

  {
    id: 'viz-spectrum',
    uniforms: `uniform float uVizSpectrumEnabled;
`,
    functions: ``,
    mainCall: `  if (uVizSpectrumEnabled > 0.5) color += vec3(0.0);
`,
  },

  {
    id: 'viz-waveform',
    uniforms: `uniform float uVizWaveformEnabled;
`,
    functions: ``,
    mainCall: `  if (uVizWaveformEnabled > 0.5) color += vec3(0.0);
`,
  },

  {
    id: 'viz-oscilloscope',
    uniforms: `uniform float uVizOscilloscopeEnabled;
`,
    functions: ``,
    mainCall: `  if (uVizOscilloscopeEnabled > 0.5) color += vec3(0.0);
`,
  },

  // ── Category 5: Effect generators (stub) ─────────────────────────────────────

  // ── Category 6: Dynamic/special ──────────────────────────────────────────────

  {
    id: 'gen-milkwave',
    uniforms: `uniform float uMilkwaveEnabled;
uniform float uMilkwaveOpacity;
`,
    functions: `vec3 milkwave(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float warp = fbm(p * 2.8 + vec2(t * 0.08, -t * 0.06));
  float tunnel = sin(angle * 6.0 + t * 0.7 + warp * 4.0);
  float ripples = sin(radius * 24.0 - t * (1.6 + audio * 2.0) + warp * 5.0);
  float glow = smoothstep(0.45, 0.0, abs(tunnel) * radius);
  float bands = smoothstep(-0.15, 0.95, ripples);
  float haze = fbm(p * 4.5 - vec2(t * 0.12, t * 0.09));
  vec3 col = mix(
    getPaletteColor(fract(warp * 0.35 + t * 0.02)),
    getPaletteColor(fract(0.35 + radius * 0.6 - t * 0.03)),
    0.5 + 0.5 * sin(angle + t * 0.2)
  );
  col += getPaletteColor(fract(0.7 + radius * 0.25 + audio * 0.2)) * glow * (0.5 + audio);
  col += getPaletteColor(fract(angle * 0.08 + t * 0.04)) * bands * 0.25;
  return col * (0.35 + haze * 0.85);
}
`,
    mainCall: `  if (uMilkwaveEnabled > 0.5) color += milkwave(effectUv, uTime, mid) * uMilkwaveOpacity;
`,
  },

  {
    id: 'gen-boss-health',
    uniforms: `uniform float uBossHealthEnabled;
uniform float uBossHealthValue;
uniform float uBossHealthBars;
uniform float uBossHealthOpacity;
`,
    functions: `vec3 bossHealth(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float healthValue = uBossHealthValue;
  float bars = uBossHealthBars;

  vec3 col = vec3(0.0, 0.0, 0.02);

  // Boss name
  vec3 bossColor = vec3(1.0, 0.0, 0.0);
  float bossName = smoothstep(0.1, 0.0, abs(p.y - 0.8)) * smoothstep(0.3, 0.0, abs(p.x - 0.5));
  col += bossColor * bossName * 0.5;

  // Health bars
  float barWidth = 0.6;
  float barHeight = 0.04;
  float barSpacing = 0.05;
  float startY = 0.65;

  for (float i = 0.0; i < bars; i++) {
    float barY = startY - i * barSpacing;

    // Background bar
    float bgBar = smoothstep(barHeight, 0.0, abs(p.y - barY)) * smoothstep(barWidth / 2.0 + 0.02, 0.0, abs(p.x - 0.5));
    col += vec3(0.2, 0.1, 0.1) * bgBar;

    // Health bar fill
    float healthFill = healthValue * (1.0 - i * 0.1);
    float currentBarWidth = barWidth * healthFill;

    // Bar color based on health
    vec3 barColor;
    if (healthFill > 0.6) barColor = vec3(0.0, 1.0, 0.0);
    else if (healthFill > 0.3) barColor = vec3(1.0, 1.0, 0.0);
    else barColor = vec3(1.0, 0.0, 0.0);

    // Audio-reactive pulse
    float pulse = sin(t * 3.0 + i + audio * 2.0) * 0.5 + 0.5;

    // Health bar
    float healthBar = smoothstep(barHeight, 0.0, abs(p.y - barY)) * smoothstep(currentBarWidth / 2.0 + 0.02, 0.0, abs(p.x - 0.5));
    col += barColor * healthBar * (1.0 + pulse * 0.2);

    // Health segments
    float segments = 10.0;
    for (float j = 0.0; j < segments; j++) {
      float segX = -currentBarWidth / 2.0 + j * (currentBarWidth / segments);
      float segWidth = currentBarWidth / segments - 0.01;

      if (j / segments < healthFill) {
        float segment = smoothstep(barHeight, 0.0, abs(p.y - barY)) * smoothstep(segWidth, 0.0, abs(p.x - 0.5 - segX));
        col += barColor * segment * 0.5;
      }
    }
  }

  // HP label
  float hpY = startY + barSpacing;
  vec3 hpColor = vec3(1.0, 1.0, 1.0);
  float hpLabel = smoothstep(0.02, 0.0, abs(p.y - hpY)) * smoothstep(0.2, 0.0, abs(p.x - 0.35));
  col += hpColor * hpLabel * 0.3;

  // Health number
  float healthNumberY = startY + barSpacing;
  vec3 numberColor = vec3(1.0, 0.0, 0.0);
  float number = smoothstep(0.02, 0.0, abs(p.y - healthNumberY)) * smoothstep(0.15, 0.0, abs(p.x - 0.65));
  col += numberColor * number * 0.5;

  return col * uBossHealthOpacity * (1.0 + audio * 0.3);
}`,
    mainCall: `  if (uBossHealthEnabled > 0.5) color += bossHealth(effectUv, uTime, mid);
`
  },

  // Traditional Visualization Generators
  {
    id: 'gen-voronoi-tessellation',
    uniforms: `uniform float uVoronoiEnabled;
uniform float uVoronoiOpacity;
uniform float uVoronoiSpeed;
uniform float uVoronoiScale;
uniform float uVoronoiEdgeWidth;
uniform float uVoronoiColorMode;
`,
    functions: `vec2 voronoiPoint(vec2 uv, float t) {
  return vec2(fract(sin(dot(uv, vec2(127.1, 311.7))) * 43758.5453),
              fract(cos(dot(uv, vec2(269.5, 183.3))) * 43758.5453)) + sin(t * uVoronoiSpeed + uv * 6.28318) * 0.15;
}

vec3 voronoiTessellation(vec2 uv, float t) {
  vec2 p = uv * uVoronoiScale;
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float minDist = 8.0;
  float secondDist = 8.0;
  vec2 closestCell = ip;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cell = ip + neighbor;
      vec2 point = voronoiPoint(cell, t);
      float d = length(neighbor + point - fp);
      if (d < minDist) {
        secondDist = minDist;
        minDist = d;
        closestCell = cell;
      } else if (d < secondDist) {
        secondDist = d;
      }
    }
  }
  float edge = secondDist - minDist;
  float edgeLine = smoothstep(uVoronoiEdgeWidth, 0.0, edge);
  float cellId = fract(sin(dot(closestCell, vec2(12.9898, 78.233))) * 43758.5453);
  float audioVal = uSpectrum[int(cellId * 64.0)] * 0.5 + uRms * 0.5;
  vec3 cellColor = getPaletteColor(cellId + audioVal * 0.3);
  vec3 edgeColor = getPaletteColor(0.8 + uPeak * 0.15);
  vec3 col = mix(cellColor * (0.4 + audioVal * 0.6), edgeColor, edgeLine);
  col *= (0.6 + smoothstep(0.3, 0.0, minDist) * 0.4);
  return col * uVoronoiOpacity;
}`,
    mainCall: `  if (uVoronoiEnabled > 0.5) color += voronoiTessellation(effectUv, uTime);
`
  },

  {
    id: 'gen-choropleth-wave',
    uniforms: `uniform float uChoroplethEnabled;
uniform float uChoroplethOpacity;
uniform float uChoroplethSpeed;
uniform float uChoroplethGridSize;
uniform float uChoroplethHeatMode;
uniform float uChoroplethSmoothing;
`,
    functions: `vec3 choroplethWave(vec2 uv, float t) {
  float gridSize = uChoroplethGridSize;
  vec2 cell = floor(uv * gridSize);
  vec2 cellUv = fract(uv * gridSize);
  float cellHash = hash21(cell);
  float bandIdx = cell.x / gridSize;
  int specIdx = int(clamp(bandIdx * 63.0, 0.0, 63.0));
  float specVal = uSpectrum[specIdx];
  float heat = mix(cellHash * 0.3, specVal, 0.5 + uChoroplethHeatMode * 0.3);
  heat += sin(cell.y * 0.8 + t * uChoroplethSpeed) * 0.15;
  heat = clamp(heat, 0.0, 1.0);
  float smooth2 = uChoroplethSmoothing;
  vec3 cold = vec3(0.1, 0.2, 0.8);
  vec3 mid2 = vec3(0.1, 0.8, 0.3);
  vec3 hot = vec3(0.9, 0.2, 0.1);
  vec3 heatColor = heat < 0.5 ? mix(cold, mid2, heat * 2.0) : mix(mid2, hot, (heat - 0.5) * 2.0);
  float border = smoothstep(smooth2, 0.0, min(cellUv.x, cellUv.y)) + smoothstep(1.0 - smooth2, 1.0, max(cellUv.x, cellUv.y));
  border = clamp(border, 0.0, 1.0);
  vec3 col = mix(heatColor, vec3(0.05), border * 0.6);
  col *= (0.5 + uPeak * 0.5);
  return col * uChoroplethOpacity;
}`,
    mainCall: `  if (uChoroplethEnabled > 0.5) color += choroplethWave(effectUv, uTime);
`
  },

  {
    id: 'gen-sankey-flow',
    uniforms: `uniform float uSankeyEnabled;
uniform float uSankeyOpacity;
uniform float uSankeySpeed;
uniform float uSankeyFlowCount;
uniform float uSankeySpread;
uniform float uSankeyColorSeed;
`,
    functions: `vec3 sankeyFlow(vec2 uv, float t) {
  float count = max(2.0, uSankeyFlowCount);
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 8.0; i++) {
    if (i >= count) break;
    float yBase = (i + 0.5) / count;
    float audio = uSpectrum[int(i * 8.0)];
    float flowWidth = (0.3 + audio * 0.5) / count * uSankeySpread;
    float drift = sin(t * uSankeySpeed * 0.5 + i * 2.1) * 0.08;
    float bend = sin(uv.x * 3.14159 + i * 1.7) * 0.06 * (1.0 + mid);
    float y = yBase + drift + bend * uv.x;
    float dist = abs(uv.y - y);
    float flow = smoothstep(flowWidth, flowWidth * 0.3, dist);
    float fade = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x);
    float seed = uSankeyColorSeed + i * 0.12;
    vec3 flowColor = getPaletteColor(seed + audio * 0.2);
    float pulse = sin(uv.x * 20.0 - t * uSankeySpeed * 2.0 + i) * 0.5 + 0.5;
    col += flowColor * flow * fade * (0.5 + pulse * 0.5 + audio * 0.3);
  }
  return col * uSankeyOpacity;
}`,
    mainCall: `  if (uSankeyEnabled > 0.5) color += sankeyFlow(effectUv, uTime);
`
  },

  {
    id: 'gen-scatter-plot',
    uniforms: `uniform float uScatterEnabled;
uniform float uScatterOpacity;
uniform float uScatterSpeed;
uniform float uScatterDensity;
uniform float uScatterPointSize;
uniform float uScatterTrail;
`,
    functions: `vec3 scatterPlot(vec2 uv, float t) {
  vec3 col = vec3(0.0);
  float count = uScatterDensity * 80.0;
  for (float i = 0.0; i < 80.0; i++) {
    if (i >= count) break;
    float hash1 = fract(sin(i * 127.1) * 43758.5453);
    float hash2 = fract(sin(i * 269.5) * 43758.5453);
    int specIdx = int(clamp(hash1 * 63.0, 0.0, 63.0));
    float spec = uSpectrum[specIdx];
    float x = hash1 + sin(t * uScatterSpeed * 0.3 + i * 0.7) * 0.08;
    float y = hash2 + cos(t * uScatterSpeed * 0.2 + i * 0.5) * 0.06 + spec * 0.15;
    vec2 point = vec2(x, y);
    float dist = length(uv - point);
    float size = uScatterPointSize * (1.0 + spec * 2.0);
    float dot = smoothstep(size, size * 0.3, dist);
    float glow = exp(-dist * 30.0) * 0.3;
    vec3 dotColor = getPaletteColor(hash1 + uPeak * 0.1);
    col += dotColor * (dot + glow);
    if (uScatterTrail > 0.01) {
      for (float j = 1.0; j < 4.0; j++) {
        float trailT = t - j * 0.05 * uScatterTrail;
        float tx = hash1 + sin(trailT * uScatterSpeed * 0.3 + i * 0.7) * 0.08;
        float ty = hash2 + cos(trailT * uScatterSpeed * 0.2 + i * 0.5) * 0.06;
        float trailDist = length(uv - vec2(tx, ty));
        col += dotColor * exp(-trailDist * 40.0) * 0.15 / j;
      }
    }
  }
  return col * uScatterOpacity;
}`,
    mainCall: `  if (uScatterEnabled > 0.5) color += scatterPlot(effectUv, uTime);
`
  },

  {
    id: 'gen-radial-bar',
    uniforms: `uniform float uRadialBarEnabled;
uniform float uRadialBarOpacity;
uniform float uRadialBarSpeed;
uniform float uRadialBarCount;
uniform float uRadialBarWidth;
uniform float uRadialBarInnerRadius;
`,
    functions: `vec3 radialBar(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  float dist = length(centered);
  float angle = atan(centered.y, centered.x);
  float normAngle = (angle + 3.14159) / 6.28318;
  float count = max(4.0, uRadialBarCount);
  float barIdx = floor(normAngle * count);
  float barFrac = fract(normAngle * count);
  float barCenter = abs(barFrac - 0.5) * 2.0;
  float inBar = smoothstep(1.0, 0.85, barCenter);
  int specIdx = int(clamp(barIdx / count * 63.0, 0.0, 63.0));
  float spec = uSpectrum[specIdx];
  float barLen = uRadialBarInnerRadius + (1.0 - uRadialBarInnerRadius) * spec;
  float barLenAnim = mix(barLen, 1.0 - uRadialBarInnerRadius, sin(t * uRadialBarSpeed + barIdx * 0.5) * 0.5 + 0.5);
  barLenAnim = max(barLenAnim, uRadialBarInnerRadius);
  float inRadius = smoothstep(uRadialBarInnerRadius - 0.01, uRadialBarInnerRadius + 0.01, dist);
  float inLength = smoothstep(barLenAnim + 0.01, barLenAnim - 0.01, dist);
  float bar = inBar * inRadius * inLength;
  float width = uRadialBarWidth;
  float edge = smoothstep(width, width * 0.5, abs(dist - barLenAnim));
  vec3 barColor = getPaletteColor(barIdx / count + spec * 0.15);
  barColor *= 0.5 + spec * 0.5 + edge * 0.3;
  float innerGlow = smoothstep(uRadialBarInnerRadius + 0.05, uRadialBarInnerRadius, dist) * smoothstep(uRadialBarInnerRadius - 0.05, uRadialBarInnerRadius, dist);
  vec3 col = barColor * bar + vec3(0.3, 0.4, 0.6) * innerGlow * 0.3;
  return col * uRadialBarOpacity;
}`,
    mainCall: `  if (uRadialBarEnabled > 0.5) color += radialBar(effectUv, uTime);
`
  },

  // Complex Visual Generators
  {
    id: 'gen-reaction-diffusion',
    uniforms: `uniform float uReactionDiffusionEnabled;
uniform float uReactionDiffusionOpacity;
uniform float uReactionDiffusionSpeed;
uniform float uReactionDiffusionFeed;
uniform float uReactionDiffusionKill;
uniform float uReactionDiffusionScale;
`,
    functions: `vec3 reactionDiffusion(vec2 uv, float t) {
  vec2 p = uv * uReactionDiffusionScale;
  float feed = uReactionDiffusionFeed;
  float kill = uReactionDiffusionKill;
  float a = 1.0;
  float b = 0.0;
  for (float i = 0.0; i < 20.0; i++) {
    float phase = i * 0.31415 + t * uReactionDiffusionSpeed;
    vec2 samplePt = p + vec2(cos(phase), sin(phase * 1.3)) * 0.1;
    float n = fbm(samplePt + i * 0.1);
    float audio = uSpectrum[int(clamp(abs(n) * 63.0, 0.0, 63.0))];
    float lapA = sin(p.x * 6.0 + phase) * cos(p.y * 6.0 - phase) * 0.5;
    float lapB = cos(p.x * 5.0 - phase * 0.7) * sin(p.y * 5.0 + phase * 0.7) * 0.5;
    lapA += audio * 0.2;
    float reaction = a * b * b;
    float dA = 1.0 * lapA - reaction + feed * (1.0 - a);
    float dB = 0.5 * lapB + reaction - (kill + feed) * b;
    a = clamp(a + dA * 0.03, 0.0, 1.0);
    b = clamp(b + dB * 0.03, 0.0, 1.0);
  }
  float pattern = a - b;
  vec3 col = getPaletteColor(pattern * 0.5 + 0.5);
  col *= (0.4 + abs(pattern) * 0.6) * (0.8 + uRms * 0.4);
  return col * uReactionDiffusionOpacity;
}`,
    mainCall: `  if (uReactionDiffusionEnabled > 0.5) color += reactionDiffusion(effectUv, uTime);
`
  },

  {
    id: 'gen-penrose-tiling',
    uniforms: `uniform float uPenroseEnabled;
uniform float uPenroseOpacity;
uniform float uPenroseSpeed;
uniform float uPenroseScale;
uniform float uPenroseRotation;
uniform float uPenroseHighlight;
`,
    functions: `vec3 penroseTiling(vec2 uv, float t) {
  vec2 p = (uv - 0.5) * uPenroseScale * 2.0;
  float rot = uPenroseRotation + t * uPenroseSpeed * 0.1;
  float c = cos(rot), s = sin(rot);
  p = mat2(c, -s, s, c) * p;
  float phi = 1.6180339887498;
  float golden = phi;
  float tileVal = 0.0;
  for (float i = 0.0; i < 6.0; i++) {
    float angle = i * 3.14159 / 5.0;
    vec2 axis = vec2(cos(angle), sin(angle));
    float proj = dot(p, axis);
    float stripe = abs(fract(proj * golden * 0.5 + t * uPenroseSpeed * 0.05) - 0.5) * 2.0;
    tileVal += stripe;
  }
  tileVal /= 6.0;
  float accent = smoothstep(uPenroseHighlight, uPenroseHighlight * 0.5, tileVal);
  float audio = uSpectrum[int(clamp(tileVal * 63.0, 0.0, 63.0))];
  vec3 col = getPaletteColor(tileVal + audio * 0.2);
  col = mix(col, col * 1.5 + vec3(0.2, 0.3, 0.5), accent * 0.3);
  col *= (0.5 + audio * 0.5);
  float edgeDetect = fwidth(tileVal);
  float edge = smoothstep(0.02, 0.0, abs(fract(tileVal * 5.0) - 0.5) - 0.45);
  col += vec3(0.3, 0.4, 0.6) * edge * 0.2;
  return col * uPenroseOpacity;
}`,
    mainCall: `  if (uPenroseEnabled > 0.5) color += penroseTiling(effectUv, uTime);
`
  },

  {
    id: 'gen-strange-attractor',
    uniforms: `uniform float uStrangeAttractorEnabled;
uniform float uStrangeAttractorOpacity;
uniform float uStrangeAttractorSpeed;
uniform float uStrangeAttractorType;
uniform float uStrangeAttractorTrail;
uniform float uStrangeAttractorColor;
`,
    functions: `vec3 strangeAttractor(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= uAspect;
  vec3 col = vec3(0.0);
  float trailLen = uStrangeAttractorTrail * 200.0;
  float atype = uStrangeAttractorType;
  for (float i = 0.0; i < 200.0; i++) {
    float tt = t * uStrangeAttractorSpeed - i * 0.005;
    float x = 0.1, y = 0.1;
    for (float j = 0.0; j < 50.0; j++) {
      float step2 = tt + j * 0.01;
      float xn, yn;
      if (atype < 0.5) {
        xn = sin(1.4 * y) - cos(1.4 * x) + step2 * 0.001;
        yn = sin(2.0 * x) - cos(2.0 * y);
      } else if (atype < 1.5) {
        float a2 = -2.24, b2 = 0.43, c2 = -0.65, d2 = -2.43;
        xn = sin(a2 * y) - cos(b2 * x);
        yn = sin(c2 * x) - cos(d2 * y);
      } else {
        float a2 = 1.7, b2 = 1.7;
        xn = sin(a2 * y) + cos(a2 * x);
        yn = sin(b2 * x) - cos(b2 * y);
      }
      x = xn; y = yn;
    }
    vec2 pt = vec2(x, y) * 0.35;
    float dist = length(centered - pt);
    float fade = 1.0 - i / trailLen;
    float glow = exp(-dist * 60.0) * fade;
    vec3 ptColor = getPaletteColor(uStrangeAttractorColor + i * 0.003);
    col += ptColor * glow;
  }
  col *= (0.5 + uRms * 0.5);
  return col * uStrangeAttractorOpacity;
}`,
    mainCall: `  if (uStrangeAttractorEnabled > 0.5) color += strangeAttractor(effectUv, uTime);
`
  },

  {
    id: 'gen-l-system',
    uniforms: `uniform float uLSystemEnabled;
uniform float uLSystemOpacity;
uniform float uLSystemSpeed;
uniform float uLSystemGenerations;
uniform float uLSystemAngle;
uniform float uLSystemBranchScale;
`,
    functions: `vec3 lSystem(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= uAspect;
  vec3 col = vec3(0.0);
  float gens = max(2.0, uLSystemGenerations);
  float angle = uLSystemAngle;
  float branchScale = uLSystemBranchScale;
  for (float branch = 0.0; branch < 6.0; branch++) {
    float bAngle = branch * 6.28318 / 6.0 + t * uLSystemSpeed * 0.1;
    vec2 pos = vec2(0.0);
    vec2 dir = vec2(cos(bAngle), sin(bAngle));
    float len = 0.4;
    float audio = uSpectrum[int(branch * 10.0)] * 0.5;
    for (float g = 0.0; g < 8.0; g++) {
      if (g >= gens) break;
      vec2 end = pos + dir * len;
      float dist = sdSegment(centered, pos, end);
      float width = 0.005 * (1.0 - g / gens) * (1.0 + audio * 0.5);
      float line = smoothstep(width, width * 0.3, dist);
      float glow = exp(-dist * 200.0) * 0.2;
      vec3 branchColor = getPaletteColor(branch / 6.0 + g * 0.05 + t * uLSystemSpeed * 0.02);
      col += branchColor * (line + glow) * (1.0 - g / gens * 0.5);
      pos = end;
      float twist = angle + sin(t * uLSystemSpeed + g * 1.5 + branch) * 0.2;
      float ca = cos(twist), sa = sin(twist);
      dir = vec2(dir.x * ca - dir.y * sa, dir.x * sa + dir.y * ca);
      len *= branchScale;
    }
  }
  col *= (0.5 + uPeak * 0.5);
  return col * uLSystemOpacity;
}`,
    mainCall: `  if (uLSystemEnabled > 0.5) color += lSystem(effectUv, uTime);
`
  },

  {
    id: 'gen-raymarch-terrain',
    uniforms: `uniform float uRaymarchTerrainEnabled;
uniform float uRaymarchTerrainOpacity;
uniform float uRaymarchTerrainSpeed;
uniform float uRaymarchTerrainHeight;
uniform float uRaymarchTerrainDetail;
uniform float uRaymarchTerrainFog;
`,
    functions: `float terrainHeight(vec2 p, float t) {
  float h = 0.0;
  float amp = 1.0;
  float freq = 1.0;
  for (float i = 0.0; i < 8.0; i++) {
    if (i >= uRaymarchTerrainDetail) break;
    h += fbm(p * freq + t * uRaymarchTerrainSpeed * 0.1) * amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return h * uRaymarchTerrainHeight;
}

vec3 raymarchTerrain(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  float camAngle = t * uRaymarchTerrainSpeed * 0.15;
  vec3 ro = vec3(sin(camAngle) * 2.0, 1.5, cos(camAngle) * 2.0 - 3.0);
  vec3 rd = normalize(vec3(centered.x * uAspect, centered.y - 0.3, 1.0));
  float totalDist = 0.0;
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 64.0; i++) {
    vec3 p = ro + rd * totalDist;
    float h = terrainHeight(p.xz, t);
    float audio = uSpectrum[int(clamp(abs(p.x) * 10.0, 0.0, 63.0))];
    h += audio * 0.3 * uRaymarchTerrainHeight;
    float surfaceY = h - p.y;
    if (surfaceY < 0.01) {
      vec3 normal = vec3(0.0, 1.0, 0.0);
      float slope = 1.0 - dot(normal, normalize(vec3(h - terrainHeight(p.xz + vec2(0.01, 0.0), t), 0.01, 0.0)));
      vec3 terrainCol = h < -0.2 ? vec3(0.2, 0.4, 0.8) : h < 0.3 ? vec3(0.2, 0.6, 0.2) : vec3(0.5, 0.4, 0.3);
      terrainCol = mix(terrainCol, vec3(0.9, 0.9, 0.95), smoothstep(0.6, 1.0, h));
      float fog = exp(-totalDist * uRaymarchTerrainFog);
      col = terrainCol * fog * (0.8 + uRms * 0.3);
      break;
    }
    totalDist += max(surfaceY * 0.5, 0.02);
  }
  if (totalDist > 30.0) col = mix(vec3(0.4, 0.5, 0.7), vec3(0.1, 0.15, 0.3), length(centered));
  return col * uRaymarchTerrainOpacity;
}`,
    mainCall: `  if (uRaymarchTerrainEnabled > 0.5) color += raymarchTerrain(effectUv, uTime);
`
  },

  {
    id: 'gen-spirograph',
    uniforms: `uniform float uSpirographEnabled;
uniform float uSpirographOpacity;
uniform float uSpirographSpeed;
uniform float uSpirographInnerRatio;
uniform float uSpirographPenOffset;
uniform float uSpirographRotations;
`,
    functions: `vec3 spirograph(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= uAspect;
  vec3 col = vec3(0.0);
  float R = 1.0;
  float r = R * uSpirographInnerRatio;
  float d = r * uSpirographPenOffset;
  float rotations = max(1.0, uSpirographRotations);
  float speed = uSpirographSpeed;
  float audio = uRms * 0.3 + uPeak * 0.2;
  float minDist = 10.0;
  for (float i = 0.0; i < 500.0; i++) {
    float theta = i / 500.0 * rotations * 6.28318 + t * speed * 0.2;
    float specIdx = i / 500.0;
    float spec = uSpectrum[int(specIdx * 63.0)];
    float angle = theta + audio * spec * 0.5;
    float x = (R - r) * cos(angle) + d * cos((R - r) / r * angle);
    float y = (R - r) * sin(angle) - d * sin((R - r) / r * angle);
    vec2 pt = vec2(x, y) * 0.4;
    float dist = length(centered - pt);
    minDist = min(minDist, dist);
    float glow = exp(-dist * 200.0) * (0.02 + spec * 0.03);
    col += getPaletteColor(i / 500.0 + t * 0.05) * glow;
  }
  float lineGlow = exp(-minDist * 400.0) * 0.8 + smoothstep(0.005, 0.0, minDist);
  vec3 lineColor = getPaletteColor(0.3 + audio * 0.3);
  col += lineColor * lineGlow;
  return col * uSpirographOpacity;
}`,
    mainCall: `  if (uSpirographEnabled > 0.5) color += spirograph(effectUv, uTime);
`
  },

  {
    id: 'gen-uv-feedback',
    uniforms: `uniform float uUvFeedbackEnabled;
uniform float uUvFeedbackOpacity;
uniform float uUvFeedbackSpeed;
uniform float uUvFeedbackIterations;
uniform float uUvFeedbackDistortion;
uniform float uUvFeedbackZoom;
`,
    functions: `vec3 uvFeedback(vec2 uv, float t) {
  vec2 p = uv;
  float iterations = max(2.0, uUvFeedbackIterations);
  float distortion = uUvFeedbackDistortion;
  float zoom = uUvFeedbackZoom;
  float speed = uUvFeedbackSpeed;
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 10.0; i++) {
    if (i >= iterations) break;
    float angle = i * 0.618033 * 6.28318 + t * speed * 0.1;
    float ca = cos(angle), sa = sin(angle);
    vec2 centered = p - 0.5;
    centered = vec2(centered.x * ca - centered.y * sa, centered.x * sa + centered.y * ca);
    float dist = length(centered);
    centered *= 1.0 + zoom * 0.02;
    centered += vec2(sin(t * speed * 0.3 + i * 1.7) * distortion * 0.02, cos(t * speed * 0.2 + i * 2.3) * distortion * 0.02);
    p = centered + 0.5;
    float audio = uSpectrum[int(clamp(dist * 63.0, 0.0, 63.0))];
    float warp = sin(p.x * 10.0 + t * speed) * cos(p.y * 10.0 - t * speed) * 0.02 * (1.0 + audio * distortion);
    p += vec2(warp, warp * 0.7);
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) break;
    float fade = 1.0 - i / iterations;
    float band = fract(i * 0.618033);
    col += getPaletteColor(band + t * speed * 0.02) * fade * 0.15 * (1.0 + audio * 0.5);
  }
  return col * uUvFeedbackOpacity;
}`,
    mainCall: `  if (uUvFeedbackEnabled > 0.5) color += uvFeedback(effectUv, uTime);
`
  },

  {
    id: 'gen-droste-effect',
    uniforms: `uniform float uDrosteEnabled;
uniform float uDrosteOpacity;
uniform float uDrosteSpeed;
uniform float uDrosteZoomRate;
uniform float uDrosteRotations;
uniform float uDrosteFrameCount;
`,
    functions: `vec3 drosteEffect(vec2 uv, float t) {
  vec2 p = uv - 0.5;
  float rot = uDrosteRotations;
  float zoomRate = uDrosteZoomRate;
  float count = max(2.0, uDrosteFrameCount);
  float speed = uDrosteSpeed;
  vec3 col = vec3(0.0);
  float angle = atan(p.y, p.x);
  float radius = length(p);
  for (float i = 0.0; i < 12.0; i++) {
    if (i >= count) break;
    float phase = (t * speed * 0.15 + i * zoomRate) * 6.28318;
    float frameRadius = fract(t * speed * 0.15 + i * zoomRate);
    float frameAngle = phase * rot;
    float ca = cos(frameAngle), sa = sin(frameAngle);
    vec2 rotated = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
    vec2 scaled = rotated / (0.5 + frameRadius * 1.5) + 0.5;
    if (scaled.x < 0.0 || scaled.x > 1.0 || scaled.y < 0.0 || scaled.y > 1.0) continue;
    int specIdx = int(clamp(scaled.x * 63.0, 0.0, 63.0));
    float audio = uSpectrum[specIdx];
    float fade = 1.0 - i / count;
    float innerMask = smoothstep(0.5, 0.45, radius);
    vec3 frameColor = getPaletteColor(i / count * 0.5 + angle / 6.28318 * 0.5 + audio * 0.15);
    float border = smoothstep(0.02, 0.0, abs(radius - (0.3 + frameRadius * 0.2)));
    col = mix(col, frameColor, innerMask * fade * 0.5);
    col += getPaletteColor(0.7) * border * fade * 0.3;
  }
  col *= (0.6 + uRms * 0.4);
  return col * uDrosteOpacity;
}`,
    mainCall: `  if (uDrosteEnabled > 0.5) color += drosteEffect(effectUv, uTime);
`
  },

  {
    id: 'gen-equalizer-matrix',
    uniforms: `uniform float uEqualizerMatrixEnabled;
uniform float uEqualizerMatrixOpacity;
uniform float uEqualizerMatrixSpeed;
uniform float uEqualizerMatrixRows;
uniform float uEqualizerMatrixGap;
uniform float uEqualizerMatrixDepth;
`,
    functions: `vec3 equalizerMatrix(vec2 uv, float t) {
  vec3 col = vec3(0.0);
  float rows = max(4.0, uEqualizerMatrixRows);
  float gap = uEqualizerMatrixGap;
  float depth = uEqualizerMatrixDepth;
  for (float row = 0.0; row < 16.0; row++) {
    if (row >= rows) break;
    float yBase = (row + 0.5) / rows;
    float rowDist = abs(uv.y - yBase) - gap * 0.5 / rows;
    if (rowDist > 0.02) continue;
    float timeOffset = row * 0.15 + t * uEqualizerMatrixSpeed;
    float perspectiveScale = 1.0 - row / rows * depth * 0.3;
    float xScale = (uv.x - 0.5) / perspectiveScale + 0.5;
    if (xScale < 0.0 || xScale > 1.0) continue;
    float bandIdx = floor(xScale * 32.0);
    int specIdx = int(clamp(bandIdx * 2.0, 0.0, 63.0));
    float amp = uSpectrum[specIdx];
    float trailAmp = uTrailSpectrum[specIdx];
    float barHeight = amp * 0.8 + trailAmp * 0.2;
    float barWidth = 1.0 / 32.0 * 0.85;
    float barX = (bandIdx + 0.5) / 32.0;
    float barDist = abs(xScale - barX);
    if (barDist > barWidth * 0.5) continue;
    float barTop = yBase - barHeight * 0.5 / rows;
    float inBar = smoothstep(yBase + gap * 0.5 / rows, yBase, uv.y) * smoothstep(barTop - 0.005, barTop + 0.005, uv.y);
    float fadeRow = 1.0 - row / rows * 0.5;
    vec3 barColor = getPaletteColor(bandIdx / 32.0 + amp * 0.2) * (0.5 + amp);
    float pulse = sin(t * uEqualizerMatrixSpeed * 2.0 + bandIdx * 0.5 + row) * 0.5 + 0.5;
    col += barColor * inBar * fadeRow * (0.7 + pulse * 0.3);
  }
  return col * uEqualizerMatrixOpacity;
}`,
    mainCall: `  if (uEqualizerMatrixEnabled > 0.5) color += equalizerMatrix(effectUv, uTime);
`
  },

  {
    id: 'gen-metaball',
    uniforms: `uniform float uMetaballEnabled;
uniform float uMetaballOpacity;
uniform float uMetaballSpeed;
uniform float uMetaballCount;
uniform float uMetaballThreshold;
uniform float uMetaballScale;
`,
    functions: `vec3 metaball(vec2 uv, float t) {
  vec2 p = uv * uMetaballScale;
  float threshold = uMetaballThreshold;
  float count = max(2.0, uMetaballCount);
  float field = 0.0;
  float closestDist = 10.0;
  vec2 closestId = vec2(0.0);
  for (float i = 0.0; i < 8.0; i++) {
    if (i >= count) break;
    float phase = i * 2.399 + t * uMetaballSpeed * 0.3;
    float radius = 0.15 + uSpectrum[int(i * 8.0)] * 0.15;
    vec2 center = vec2(0.5 + sin(phase) * 0.25, 0.5 + cos(phase * 1.3) * 0.25) * uMetaballScale;
    float dist = length(p - center);
    field += radius * radius / (dist * dist + 0.001);
    if (dist < closestDist) {
      closestDist = dist;
      closestId = center;
    }
  }
  float surface = smoothstep(threshold - 0.1, threshold + 0.1, field);
  float edge = smoothstep(threshold, threshold - 0.02, field) * smoothstep(threshold - 0.15, threshold - 0.1, field);
  float glow = exp(-abs(field - threshold) * 8.0) * 0.3;
  vec3 innerColor = getPaletteColor(hash21(closestId) + uRms * 0.2);
  vec3 edgeColor = getPaletteColor(0.8 + uPeak * 0.1);
  vec3 col = innerColor * surface + edgeColor * edge + edgeColor * glow;
  col *= (0.5 + uRms * 0.5);
  return col * uMetaballOpacity;
}`,
    mainCall: `  if (uMetaballEnabled > 0.5) color += metaball(effectUv, uTime);
`
  },

  {
    id: 'gen-interference-pattern',
    uniforms: `uniform float uInterferenceEnabled;
uniform float uInterferenceOpacity;
uniform float uInterferenceSpeed;
uniform float uInterferenceSourceCount;
uniform float uInterferenceWavelength;
uniform float uInterferenceMode;
`,
    functions: `vec3 interferencePattern(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= uAspect;
  float count = max(2.0, uInterferenceSourceCount);
  float wavelength = uInterferenceWavelength;
  float mode = uInterferenceMode;
  float wave = 0.0;
  for (float i = 0.0; i < 8.0; i++) {
    if (i >= count) break;
    float angle = i / count * 6.28318 + t * uInterferenceSpeed * 0.1;
    float radius = 0.3 + uSpectrum[int(i * 8.0)] * 0.2;
    vec2 source = vec2(cos(angle), sin(angle)) * radius;
    float dist = length(centered - source);
    float phase = dist / wavelength * 6.28318 - t * uInterferenceSpeed;
    if (mode < 0.5) {
      wave += sin(phase);
    } else if (mode < 1.5) {
      wave += cos(phase) * exp(-dist * 2.0);
    } else {
      wave += sin(phase) * (1.0 / (1.0 + dist * 3.0));
    }
  }
  wave /= count;
  float pattern = wave * 0.5 + 0.5;
  vec3 bright = getPaletteColor(pattern + uPeak * 0.1);
  vec3 dark = getPaletteColor(pattern * 0.3);
  vec3 col = mix(dark, bright, smoothstep(0.45, 0.55, pattern));
  float rings = abs(wave);
  col += getPaletteColor(0.9) * smoothstep(0.03, 0.0, rings) * 0.5;
  return col * uInterferenceOpacity;
}`,
    mainCall: `  if (uInterferenceEnabled > 0.5) color += interferencePattern(effectUv, uTime);
`
  },

  {
    id: 'gen-terrain-hypsometric',
    uniforms: `uniform float uTerrainHypsometricEnabled;
uniform float uTerrainHypsometricOpacity;
uniform float uTerrainHypsometricSpeed;
uniform float uTerrainHypsometricScale;
uniform float uTerrainHypsometricContourInterval;
uniform float uTerrainHypsometricElevation;
`,
    functions: `vec3 terrainHypsometric(vec2 uv, float t) {
  vec2 p = (uv - 0.5) * uTerrainHypsometricScale * 2.0;
  float elevation = 0.0;
  float amp = 1.0;
  float freq = 1.0;
  for (float i = 0.0; i < 6.0; i++) {
    elevation += sin(p.x * freq * 2.0 + t * uTerrainHypsometricSpeed * 0.1 * (i + 1.0) * 0.3) * amp;
    elevation += cos(p.y * freq * 1.8 - t * uTerrainHypsometricSpeed * 0.08 * (i + 1.0) * 0.3) * amp;
    elevation += sin((p.x + p.y) * freq * 1.5 + t * uTerrainHypsometricSpeed * 0.05) * amp * 0.5;
    freq *= 2.0;
    amp *= 0.5;
  }
  float audio = uSpectrum[int(clamp(abs(elevation) * 30.0, 0.0, 63.0))];
  elevation = elevation * uTerrainHypsometricElevation + audio * 0.3;
  float norm = elevation * 0.5 + 0.5;
  norm = clamp(norm, 0.0, 1.0);
  float contour = uTerrainHypsometricContourInterval;
  float contourLine = 1.0 - smoothstep(0.0, 0.04, abs(fract(norm / contour) - 0.5) * contour * 2.0);
  vec3 deep = vec3(0.05, 0.15, 0.5);
  vec3 shallow = vec3(0.1, 0.4, 0.6);
  vec3 lowland = vec3(0.2, 0.6, 0.25);
  vec3 highland = vec3(0.6, 0.5, 0.2);
  vec3 mountain = vec3(0.5, 0.35, 0.2);
  vec3 snow = vec3(0.95, 0.95, 1.0);
  vec3 bandColor;
  if (norm < 0.2) bandColor = mix(deep, shallow, norm / 0.2);
  else if (norm < 0.4) bandColor = mix(shallow, lowland, (norm - 0.2) / 0.2);
  else if (norm < 0.6) bandColor = mix(lowland, highland, (norm - 0.4) / 0.2);
  else if (norm < 0.8) bandColor = mix(highland, mountain, (norm - 0.6) / 0.2);
  else bandColor = mix(mountain, snow, (norm - 0.8) / 0.2);
  vec3 col = bandColor + vec3(0.3, 0.35, 0.4) * contourLine;
  return col * uTerrainHypsometricOpacity;
}`,
    mainCall: `  if (uTerrainHypsometricEnabled > 0.5) color += terrainHypsometric(effectUv, uTime);
`
  },

  {
    id: 'gen-phyllotaxis',
    uniforms: `uniform float uPhyllotaxisEnabled;
uniform float uPhyllotaxisOpacity;
uniform float uPhyllotaxisSpeed;
uniform float uPhyllotaxisCount;
uniform float uPhyllotaxisPointSize;
uniform float uPhyllotaxisSpread;
`,
    functions: `vec3 phyllotaxis(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= uAspect;
  vec3 col = vec3(0.0);
  float goldenAngle = 2.39996323;
  float count = max(20.0, uPhyllotaxisCount);
  float spread = uPhyllotaxisSpread;
  for (float i = 0.0; i < 300.0; i++) {
    if (i >= count) break;
    float angle = i * goldenAngle + t * uPhyllotaxisSpeed * 0.1;
    float r = sqrt(i / count) * spread;
    int specIdx = int(clamp(i / count * 63.0, 0.0, 63.0));
    float audio = uSpectrum[specIdx];
    r *= (1.0 + audio * 0.15);
    vec2 pt = vec2(cos(angle), sin(angle)) * r;
    float dist = length(centered - pt);
    float size = uPhyllotaxisPointSize * (1.0 + audio * 1.5) * (1.0 - i / count * 0.3);
    float dot2 = smoothstep(size, size * 0.3, dist);
    float glow = exp(-dist * 80.0) * 0.2;
    vec3 petalColor = getPaletteColor(i / count + sin(t * 0.2) * 0.1);
    float ring = 1.0 + sin(i * 0.1 + t * uPhyllotaxisSpeed) * 0.15;
    col += petalColor * (dot2 + glow) * ring;
  }
  return col * uPhyllotaxisOpacity;
}`,
    mainCall: `  if (uPhyllotaxisEnabled > 0.5) color += phyllotaxis(effectUv, uTime);
`
  },

  {
    id: 'gen-deep-ocean',
    uniforms: `uniform float uDeepOceanEnabled;
uniform float uDeepOceanOpacity;
uniform float uDeepOceanSpeed;
uniform float uDeepOceanDepth;
uniform float uDeepOceanBiolum;
uniform float uDeepOceanCaustic;
`,
    functions: `vec3 deepOcean(vec2 uv, float t) {
  vec3 col = vec3(0.0);
  float speed = uDeepOceanSpeed;
  float depth = uDeepOceanDepth;
  vec2 p = uv;
  float causticStrength = uDeepOceanCaustic;
  float c1 = sin(p.x * 12.0 + t * speed * 0.5) * sin(p.y * 14.0 - t * speed * 0.4);
  float c2 = sin(p.x * 8.0 - t * speed * 0.3 + 1.5) * cos(p.y * 10.0 + t * speed * 0.35);
  float caustics = (c1 + c2) * 0.5 * causticStrength;
  caustics = max(caustics, 0.0);
  caustics *= smoothstep(0.6, 1.0, caustics + 0.5);
  vec3 deepBlue = vec3(0.0, 0.02, 0.08) * (1.0 - depth * 0.5);
  vec3 midWater = vec3(0.0, 0.05, 0.15);
  vec3 causticColor = vec3(0.1, 0.3, 0.5) * caustics;
  col = mix(deepBlue, midWater, uv.y) + causticColor;
  float biolum = uDeepOceanBiolum;
  for (float i = 0.0; i < 20.0; i++) {
    float hash = fract(sin(i * 127.1) * 43758.5453);
    int specIdx = int(hash * 63.0);
    float audio = uSpectrum[specIdx];
    float x = fract(sin(i * 269.5 + t * speed * 0.05) * 0.5 + 0.5);
    float y = fract(cos(i * 183.3 - t * speed * 0.03) * 0.5 + 0.5);
    vec2 pt = vec2(x, y);
    float dist = length(uv - pt);
    float glow = exp(-dist * 100.0) * biolum * (0.3 + audio * 0.7);
    float pulse = sin(t * 2.0 + i * 3.7) * 0.5 + 0.5;
    vec3 bioColor = mix(vec3(0.0, 0.8, 0.6), vec3(0.2, 0.5, 1.0), hash) * glow * pulse;
    col += bioColor;
  }
  float waveDistortion = sin(uv.y * 20.0 + t * speed) * 0.01;
  col += vec3(0.0, 0.02, 0.05) * smoothstep(0.5, 0.0, abs(sin(uv.x * 40.0 + t * speed + waveDistortion * 100.0)));
  col *= (0.8 + uRms * 0.2);
  return col * uDeepOceanOpacity;
}`,
    mainCall: `  if (uDeepOceanEnabled > 0.5) color += deepOcean(effectUv, uTime);
`
  },

  {
    id: 'gen-holographic-prism',
    uniforms: `uniform float uHolographicPrismEnabled;
uniform float uHolographicPrismOpacity;
uniform float uHolographicPrismSpeed;
uniform float uHolographicPrismDispersion;
uniform float uHolographicPrismAngle;
uniform float uHolographicPrismFacets;
`,
    functions: `vec3 holographicPrism(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= uAspect;
  float facets = max(3.0, uHolographicPrismFacets);
  float angle = atan(centered.y, centered.x);
  float dist = length(centered);
  float dispersion = uHolographicPrismDispersion;
  float prismAngle = uHolographicPrismAngle + t * uHolographicPrismSpeed * 0.05;
  float wedge = 6.28318 / facets;
  float sectorAngle = mod(angle - prismAngle, wedge);
  float halfWedge = wedge * 0.5;
  float fromCenter = abs(sectorAngle - halfWedge) / halfWedge;
  float prismShape = smoothstep(1.0, 0.7, dist) * smoothstep(0.0, 0.05, dist);
  float r = prismShape * (0.5 + fromCenter * dispersion);
  float g = prismShape * (0.5 + fromCenter * dispersion * 0.7);
  float b = prismShape * (0.5 + fromCenter * dispersion * 0.4);
  r += sin(dist * 20.0 - t * uHolographicPrismSpeed * 2.0) * 0.15;
  g += sin(dist * 20.0 - t * uHolographicPrismSpeed * 2.0 + 2.094) * 0.15;
  b += sin(dist * 20.0 - t * uHolographicPrismSpeed * 2.0 + 4.189) * 0.15;
  int specIdx = int(clamp(abs(angle) * 10.0, 0.0, 63.0));
  float audio = uSpectrum[specIdx];
  vec3 rainbow = vec3(
    sin(fromCenter * 6.28318 + t * uHolographicPrismSpeed * 0.3) * 0.5 + 0.5,
    sin(fromCenter * 6.28318 + t * uHolographicPrismSpeed * 0.3 + 2.094) * 0.5 + 0.5,
    sin(fromCenter * 6.28318 + t * uHolographicPrismSpeed * 0.3 + 4.189) * 0.5 + 0.5
  );
  vec3 col = rainbow * prismShape * (0.5 + audio * 0.5);
  float edgeGlow = smoothstep(0.05, 0.0, abs(dist - 0.5)) * 2.0;
  col += vec3(0.8, 0.9, 1.0) * edgeGlow * (0.3 + audio * 0.5);
  float scanline = sin(uv.y * 200.0 + t * uHolographicPrismSpeed) * 0.5 + 0.5;
  col *= 0.9 + scanline * 0.1;
  col *= (0.6 + uRms * 0.4);
  return col * uHolographicPrismOpacity;
}`,
    mainCall: `  if (uHolographicPrismEnabled > 0.5) color += holographicPrism(effectUv, uTime);
`
  },

  {
    id: 'gen-boids',
    uniforms: `uniform float uBoidsEnabled;
uniform float uBoidsOpacity;
uniform float uBoidsSpeed;
uniform float uBoidsCount;
uniform float uBoidsCohesion;
uniform float uBoidsVisualRange;
`,
    functions: `vec3 boids(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= uAspect;
  vec3 col = vec3(0.0);
  float count = max(10.0, uBoidsCount);
  float speed = uBoidsSpeed;
  float cohesion = uBoidsCohesion;
  float range = uBoidsVisualRange;
  for (float i = 0.0; i < 60.0; i++) {
    if (i >= count) break;
    float hash1 = fract(sin(i * 127.1) * 43758.5453);
    float hash2 = fract(sin(i * 269.5) * 43758.5453);
    float hash3 = fract(sin(i * 419.3) * 43758.5453);
    int specIdx = int(clamp(i * 1.0, 0.0, 63.0));
    float audio = uSpectrum[specIdx];
    float px = hash1 * 2.0 - 1.0 + sin(t * speed * 0.4 + i * 0.7) * 0.3;
    float py = hash2 * 2.0 - 1.0 + cos(t * speed * 0.35 + i * 0.5) * 0.3;
    float vx = cos(t * speed * 0.2 + i * 2.1 + hash3 * 6.28) * 0.3;
    float vy = sin(t * speed * 0.25 + i * 1.7 + hash3 * 3.14) * 0.3;
    for (float j = 0.0; j < 60.0; j++) {
      if (j >= count) break;
      if (i == j) continue;
      float h1 = fract(sin(j * 127.1) * 43758.5453);
      float h2 = fract(sin(j * 269.5) * 43758.5453);
      float ox = h1 * 2.0 - 1.0 + sin(t * speed * 0.4 + j * 0.7) * 0.3;
      float oy = h2 * 2.0 - 1.0 + cos(t * speed * 0.35 + j * 0.5) * 0.3;
      float dist = length(vec2(px - ox, py - oy));
      if (dist < range) {
        vx += (ox - px) * cohesion * 0.01;
        vy += (oy - py) * cohesion * 0.01;
        if (dist < range * 0.3) {
          vx -= (px - ox) * 0.02;
          vy -= (py - oy) * 0.02;
        }
        float avgVx = cos(t * speed * 0.2 + j * 2.1) * 0.3;
        float avgVy = sin(t * speed * 0.25 + j * 1.7) * 0.3;
        vx += (avgVx - vx) * 0.05;
        vy += (avgVy - vy) * 0.05;
      }
    }
    vx += sin(t * speed * 0.15 + i * 3.7) * audio * 0.2;
    vy += cos(t * speed * 0.12 + i * 2.9) * audio * 0.2;
    vec2 boidPos = vec2(px, py);
    vec2 boidDir = normalize(vec2(vx, vy));
    vec2 toPixel = centered - boidPos;
    float dist = length(toPixel);
    float headDist = length(centered - (boidPos + boidDir * 0.03));
    float tailDist = length(centered - (boidPos - boidDir * 0.02));
    float body = smoothstep(0.04, 0.015, dist) * 0.5 + smoothstep(0.02, 0.005, headDist);
    float trail = exp(-dist * 50.0) * 0.15;
    vec3 boidColor = getPaletteColor(i / count + audio * 0.15);
    col += boidColor * (body + trail) * (0.6 + audio * 0.4);
  }
  return col * uBoidsOpacity;
}`,
    mainCall: `  if (uBoidsEnabled > 0.5) color += boids(effectUv, uTime);
`
  },

  {
    id: 'gen-flow-field',
    uniforms: `uniform float uFlowFieldEnabled;
uniform float uFlowFieldOpacity;
uniform float uFlowFieldSpeed;
uniform float uFlowFieldScale;
uniform float uFlowFieldCurlIntensity;
uniform float uFlowFieldLineCount;
`,
    functions: `vec2 curlNoise(vec2 p, float t) {
  float e = 0.01;
  float n1 = fbm(p + vec2(e, 0.0) + t * 0.1);
  float n2 = fbm(p - vec2(e, 0.0) + t * 0.1);
  float n3 = fbm(p + vec2(0.0, e) + t * 0.1);
  float n4 = fbm(p - vec2(0.0, e) + t * 0.1);
  return vec2((n3 - n4) / (2.0 * e), -(n1 - n2) / (2.0 * e)) * uFlowFieldCurlIntensity;
}

vec3 flowField(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= uAspect;
  vec3 col = vec3(0.0);
  float scale = uFlowFieldScale;
  float speed = uFlowFieldSpeed;
  float count = max(20.0, uFlowFieldLineCount);
  for (float i = 0.0; i < 80.0; i++) {
    if (i >= count) break;
    float hash1 = fract(sin(i * 127.1) * 43758.5453);
    float hash2 = fract(sin(i * 269.5) * 43758.5453);
    vec2 pos = vec2(hash1 * 2.0 - 1.0, hash2 * 2.0 - 1.0);
    vec2 prevPos = pos;
    float trailLen = 8.0;
    float totalDist = 0.0;
    int specIdx = int(clamp(i / count * 63.0, 0.0, 63.0));
    float audio = uSpectrum[specIdx];
    for (float step2 = 0.0; step2 < 8.0; step2++) {
      vec2 field = curlNoise(pos * scale, t * speed * 0.2);
      field *= (1.0 + audio * 0.5);
      prevPos = pos;
      pos += normalize(field + 0.0001) * 0.015 * (1.0 + audio * 0.3);
      float dist = length(centered - pos);
      float prevDist = length(centered - prevPos);
      float lineDist = sdSegment(centered, prevPos, pos);
      float line = smoothstep(0.005, 0.001, lineDist);
      float fade = 1.0 - step2 / trailLen;
      vec3 lineColor = getPaletteColor(i / count + step2 * 0.02);
      col += lineColor * line * fade * 0.3;
      if (pos.x < -1.5 || pos.x > 1.5 || pos.y < -1.5 || pos.y > 1.5) break;
    }
    float headDist = length(centered - pos);
    col += getPaletteColor(i / count) * exp(-headDist * 60.0) * 0.4 * (0.5 + audio * 0.5);
  }
  return col * uFlowFieldOpacity;
}`,
    mainCall: `  if (uFlowFieldEnabled > 0.5) color += flowField(effectUv, uTime);
`
  },

  {
    id: 'gen-stained-glass',
    uniforms: `uniform float uStainedGlassEnabled;
uniform float uStainedGlassOpacity;
uniform float uStainedGlassSpeed;
uniform float uStainedGlassScale;
uniform float uStainedGlassLightAngle;
uniform float uStainedGlassLeadWidth;
`,
    functions: `vec3 stainedGlass(vec2 uv, float t) {
  vec2 p = uv * uStainedGlassScale;
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float minDist = 8.0;
  vec2 closestCell = ip;
  float closestId = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cell = ip + neighbor;
      vec2 pt = vec2(fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453),
                     fract(cos(dot(cell, vec2(269.5, 183.3))) * 43758.5453));
      pt += sin(t * uStainedGlassSpeed * 0.3 + cell * 0.5) * 0.08;
      float d = length(neighbor + pt - fp);
      if (d < minDist) {
        minDist = d;
        closestCell = cell;
        closestId = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      }
    }
  }
  float lead = uStainedGlassLeadWidth;
  float edgeLine = smoothstep(lead, lead * 0.3, minDist);
  int specIdx = int(clamp(closestId * 63.0, 0.0, 63.0));
  float audio = uSpectrum[specIdx];
  float lightAngle = uStainedGlassLightAngle + t * uStainedGlassSpeed * 0.05;
  vec2 lightDir = vec2(cos(lightAngle), sin(lightAngle));
  float lightIntensity = dot(normalize(closestCell), lightDir) * 0.5 + 0.5;
  float innerGlow = exp(-minDist * 8.0) * 0.3;
  vec3 glassColor = getPaletteColor(closestId + audio * 0.2);
  glassColor *= (0.3 + lightIntensity * 0.7 + audio * 0.3);
  glassColor += vec3(1.0, 0.95, 0.8) * innerGlow * lightIntensity;
  vec3 leadColor = vec3(0.08, 0.06, 0.05);
  vec3 col = mix(leadColor, glassColor, edgeLine);
  return col * uStainedGlassOpacity;
}`,
    mainCall: `  if (uStainedGlassEnabled > 0.5) color += stainedGlass(effectUv, uTime);
`
  },

  {
    id: 'gen-hillshade',
    uniforms: `uniform float uHillshadeEnabled;
uniform float uHillshadeOpacity;
uniform float uHillshadeSpeed;
uniform float uHillshadeScale;
uniform float uHillshadeLightAzimuth;
uniform float uHillshadeVertical;
`,
    functions: `float terrainElev(vec2 p, float t) {
  float e = 0.0;
  float amp = 1.0;
  float freq = 1.0;
  for (float i = 0.0; i < 5.0; i++) {
    e += sin(p.x * freq * 2.0 + t * uHillshadeSpeed * 0.08) * amp;
    e += cos(p.y * freq * 1.7 - t * uHillshadeSpeed * 0.06) * amp;
    e += sin((p.x + p.y) * freq * 1.3) * amp * 0.5;
    freq *= 2.1;
    amp *= 0.45;
  }
  return e;
}

vec3 hillshade(vec2 uv, float t) {
  vec2 p = (uv - 0.5) * uHillshadeScale * 2.0;
  float e = 0.01;
  float h = terrainElev(p, t);
  float hx = terrainElev(p + vec2(e, 0.0), t);
  float hy = terrainElev(p + vec2(0.0, e), t);
  vec3 normal = normalize(vec3((h - hx) / e, (h - hy) / e, uHillshadeVertical));
  float azimuth = uHillshadeLightAzimuth + t * uHillshadeSpeed * 0.02;
  float altitude = 0.6;
  vec3 lightDir = normalize(vec3(cos(azimuth) * cos(altitude), sin(azimuth) * cos(altitude), sin(altitude)));
  float diffuse = max(dot(normal, lightDir), 0.0);
  int specIdx2 = int(clamp(abs(h) * 20.0, 0.0, 63.0));
  float audio = uSpectrum[specIdx2];
  float ambient = 0.25 + audio * 0.1;
  float shade = ambient + diffuse * 0.75;
  float normH = clamp(h * 0.3 + 0.5, 0.0, 1.0);
  vec3 low = vec3(0.15, 0.35, 0.12);
  vec3 mid2 = vec3(0.55, 0.45, 0.25);
  vec3 high = vec3(0.85, 0.85, 0.9);
  vec3 terrainCol = normH < 0.5 ? mix(low, mid2, normH * 2.0) : mix(mid2, high, (normH - 0.5) * 2.0);
  float contour = 1.0 - smoothstep(0.0, 0.06, abs(fract(normH / 0.1) - 0.5) * 0.2);
  vec3 col = terrainCol * shade + vec3(0.3, 0.35, 0.4) * contour * 0.2;
  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 16.0) * 0.15;
  return col * uHillshadeOpacity;
}`,
    mainCall: `  if (uHillshadeEnabled > 0.5) color += hillshade(effectUv, uTime);
`
  },

  {
    id: 'gen-truchet-tiles',
    uniforms: `uniform float uTruchetEnabled;
uniform float uTruchetOpacity;
uniform float uTruchetSpeed;
uniform float uTruchetScale;
uniform float uTruchetArcWidth;
uniform float uTruchetStyle;
`,
    functions: `vec3 truchetTiles(vec2 uv, float t) {
  vec2 p = uv * uTruchetScale;
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float cellHash = hash21(ip + 0.5);
  float orient = step(0.5, fract(sin(dot(ip, vec2(7.23, 157.2))) * 43758.5453 + t * uTruchetSpeed * 0.05));
  vec2 q = orient > 0.5 ? fp : vec2(1.0 - fp.x, fp.y);
  int specIdx = int(clamp(cellHash * 63.0, 0.0, 63.0));
  float audio = uSpectrum[specIdx];
  float d1 = abs(q.x - q.y);
  float d2 = abs(q.x + q.y - 1.0);
  float arc1 = smoothstep(uTruchetArcWidth, uTruchetArcWidth * 0.3, d1);
  float arc2 = smoothstep(uTruchetArcWidth, uTruchetArcWidth * 0.3, d2);
  float style = uTruchetStyle;
  float pattern;
  if (style < 0.5) {
    pattern = arc1;
  } else if (style < 1.5) {
    pattern = max(arc1, arc2);
  } else {
    pattern = arc1 * 0.7 + arc2 * 0.3;
  }
  pattern *= (0.7 + audio * 0.3);
  vec3 tileColor = getPaletteColor(cellHash + audio * 0.15);
  vec3 arcColor = tileColor * pattern;
  float nodeCenter = length(fp - 0.5);
  float nodeGlow = exp(-nodeCenter * 20.0) * 0.2 * audio;
  arcColor += tileColor * nodeGlow;
  return arcColor * uTruchetOpacity;
}`,
    mainCall: `  if (uTruchetEnabled > 0.5) color += truchetTiles(effectUv, uTime);
`
  },

  {
    id: 'gen-spectrogram',
    uniforms: `uniform float uSpectrogramEnabled;
uniform float uSpectrogramOpacity;
uniform float uSpectrogramSpeed;
uniform float uSpectrogramFreqScale;
uniform float uSpectrogramHistory;
uniform float uSpectrogramColorMap;
`,
    functions: `vec3 spectrogram(vec2 uv, float t) {
  float history = max(2.0, uSpectrogramHistory);
  float freqScale = uSpectrogramFreqScale;
  float speed = uSpectrogramSpeed;
  float colorMap = uSpectrogramColorMap;
  float timeAxis = 1.0 - uv.x;
  float freqAxis = uv.y;
  vec3 col = vec3(0.0);
  for (float h = 0.0; h < 20.0; h++) {
    if (h >= history) break;
    float histTime = h / history;
    float histStart = 1.0 - histTime * speed * 0.02;
    float histEnd = 1.0 - (histTime + 1.0 / history) * speed * 0.02;
    if (timeAxis < histStart && timeAxis >= histEnd) {
      float band = freqAxis * freqScale;
      int bandIdx = int(clamp(band * 63.0, 0.0, 63.0));
      float amp = uTrailSpectrum[bandIdx] * (1.0 - h / history * 0.8);
      amp = clamp(amp, 0.0, 1.0);
      if (colorMap < 0.5) {
        vec3 cold = vec3(0.0, 0.0, 0.3);
        vec3 warm = vec3(1.0, 0.3, 0.0);
        vec3 hot = vec3(1.0, 1.0, 0.8);
        col = amp < 0.5 ? mix(cold, warm, amp * 2.0) : mix(warm, hot, (amp - 0.5) * 2.0);
      } else if (colorMap < 1.5) {
        col = getPaletteColor(amp * 0.8 + h / history * 0.2);
      } else {
        float v = amp;
        col = vec3(v * v, v, sqrt(v)) * (0.5 + v * 0.5);
      }
      break;
    }
  }
  float nowLine = smoothstep(0.01, 0.0, abs(uv.x - 0.98));
  float currentBand = uv.y * freqScale;
  int curIdx = int(clamp(currentBand * 63.0, 0.0, 63.0));
  float curAmp = uSpectrum[curIdx];
  col += vec3(1.0) * nowLine * 0.3;
  col += getPaletteColor(0.9) * smoothstep(0.01, 0.0, abs(uv.x - 0.98)) * curAmp * 0.5;
  return col * uSpectrogramOpacity;
}`,
    mainCall: `  if (uSpectrogramEnabled > 0.5) color += spectrogram(effectUv, uTime);
`
  },

  {
    id: 'gen-crosshatch',
    uniforms: `uniform float uCrosshatchEnabled;
uniform float uCrosshatchOpacity;
uniform float uCrosshatchSpeed;
uniform float uCrosshatchDensity;
uniform float uCrosshatchAngle1;
uniform float uCrosshatchAngle2;
`,
    functions: `vec3 crosshatch(vec2 uv, float t) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float density = uCrosshatchDensity;
  float a1 = uCrosshatchAngle1;
  float a2 = uCrosshatchAngle2;
  float speed = uCrosshatchSpeed;
  float brightness = fbm(p * 2.0 + t * speed * 0.05) * 0.5 + 0.5;
  brightness += uRms * 0.3;
  brightness = clamp(brightness, 0.0, 1.0);
  vec2 d1 = vec2(cos(a1), sin(a1));
  vec2 d2 = vec2(cos(a2), sin(a2));
  float line1 = abs(dot(p, vec2(-d1.y, d1.x)));
  float line2 = abs(dot(p, vec2(-d2.y, d2.x)));
  float hatch1 = smoothstep(0.02 / density, 0.005 / density, abs(fract(line1 * density) - 0.5));
  float hatch2 = smoothstep(0.02 / density, 0.005 / density, abs(fract(line2 * density) - 0.5));
  float mask1 = smoothstep(0.8, 0.2, brightness);
  float mask2 = smoothstep(0.5, 0.1, brightness);
  vec3 inkColor = getPaletteColor(0.1 + uPeak * 0.1);
  vec3 paperColor = getPaletteColor(0.95);
  vec3 col = paperColor;
  col = mix(col, inkColor, hatch1 * mask1);
  col = mix(col, inkColor * 0.8, hatch2 * mask2);
  float stipple = smoothstep(0.08, 0.0, abs(fract(length(p) * density * 3.0 + hash21(floor(p * density * 10.0))) - 0.5)) * smoothstep(0.3, 0.0, brightness) * 0.3;
  col = mix(col, inkColor * 0.6, stipple);
  col *= (0.9 + uRms * 0.1);
  return col * uCrosshatchOpacity;
}`,
    mainCall: `  if (uCrosshatchEnabled > 0.5) color += crosshatch(effectUv, uTime);
`
  },

  {
    id: 'gen-shatter',
    uniforms: `uniform float uShatterEnabled;
uniform float uShatterOpacity;
uniform float uShatterSpeed;
uniform float uShatterSpread;
uniform float uShatterShardCount;
uniform float uShatterRotation;
`,
    functions: `vec3 shatter(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= uAspect;
  vec3 col = vec3(0.0);
  float spread = uShatterSpread;
  float shardCount = max(5.0, uShatterShardCount);
  float speed = uShatterSpeed;
  float rot = uShatterRotation;
  float impact = t * speed * 0.5;
  for (float i = 0.0; i < 20.0; i++) {
    if (i >= shardCount) break;
    float hash1 = fract(sin(i * 127.1) * 43758.5453);
    float hash2 = fract(sin(i * 269.5) * 43758.5453);
    float hash3 = fract(sin(i * 419.3) * 43758.5453);
    vec2 origin = vec2(hash1 * 2.0 - 1.0, hash2 * 2.0 - 1.0) * 0.3;
    vec2 dir = normalize(origin + 0.0001);
    float dist = length(origin);
    float shardProgress = clamp(impact - i * 0.15, 0.0, 3.0);
    vec2 offset = dir * shardProgress * spread;
    float shardRot = rot * shardProgress * (hash3 - 0.5) * 2.0;
    float ca = cos(shardRot), sa = sin(shardRot);
    vec2 localUv = centered - origin - offset;
    localUv = vec2(localUv.x * ca - localUv.y * sa, localUv.x * sa + localUv.y * ca);
    float size = 0.08 + hash3 * 0.12;
    int specIdx = int(clamp(hash1 * 63.0, 0.0, 63.0));
    float audio = uSpectrum[specIdx];
    size *= (1.0 + audio * 0.3);
    float halfSize = size * 0.5;
    float inShard = step(-halfSize, localUv.x) * step(localUv.x, halfSize) * step(-halfSize, localUv.y) * step(localUv.y, halfSize);
    float edgeX = smoothstep(halfSize, halfSize - 0.01, abs(localUv.x));
    float edgeY = smoothstep(halfSize, halfSize - 0.01, abs(localUv.y));
    float edge = max(edgeX, edgeY);
    vec3 shardColor = getPaletteColor(hash1 + audio * 0.15);
    vec3 edgeColor = vec3(0.9, 0.95, 1.0);
    col += mix(shardColor * (0.4 + audio * 0.3), edgeColor, edge) * inShard * (1.0 - shardProgress * 0.3);
  }
  float crackCount = shardCount * 0.5;
  for (float c = 0.0; c < 10.0; c++) {
    if (c >= crackCount) break;
    float h = fract(sin(c * 57.3) * 43758.5453);
    float angle = h * 6.28318;
    vec2 crackDir = vec2(cos(angle), sin(angle));
    float crackLen = 0.5 + h * 0.5;
    vec2 crackStart = vec2(fract(sin(c * 127.1) * 43758.5453) * 2.0 - 1.0, fract(sin(c * 269.5) * 43758.5453) * 2.0 - 1.0) * 0.3;
    float crackDist = sdSegment(centered, crackStart, crackStart + crackDir * crackLen);
    float crackLine = smoothstep(0.005, 0.001, crackDist) * smoothstep(impact, impact - 0.5, c * 0.1);
    col += vec3(0.8, 0.9, 1.0) * crackLine * 0.3;
  }
  return col * uShatterOpacity;
}`,
    mainCall: `  if (uShatterEnabled > 0.5) color += shatter(effectUv, uTime);
`
  },

  {
    id: 'gen-seigaiha',
    uniforms: `uniform float uSeigaihaEnabled;
uniform float uSeigaihaOpacity;
uniform float uSeigaihaSpeed;
uniform float uSeigaihaScale;
uniform float uSeigaihaWaveCount;
uniform float uSeigaihaLineWeight;
`,
    functions: `vec3 seigaiha(vec2 uv, float t) {
  vec2 p = uv * uSeigaihaScale;
  float speed = uSeigaihaSpeed;
  float waveCount = max(2.0, uSeigaihaWaveCount);
  float lineWeight = uSeigaihaLineWeight;
  float rowHeight = 0.5;
  float colWidth = 0.5;
  float rowIdx = floor(p.y / rowHeight);
  float colOffset = mod(rowIdx, 2.0) * colWidth * 0.5;
  vec2 centered = vec2(mod(p.x + colOffset, colWidth), mod(p.y, rowHeight));
  vec2 cellCenter = vec2(colWidth * 0.5, rowHeight * 0.3);
  vec2 toCenter = centered - cellCenter;
  float dist = length(toCenter);
  float audio = uSpectrum[int(clamp(abs(rowIdx) * 4.0, 0.0, 63.0))];
  float wave = 0.0;
  for (float i = 0.0; i < 6.0; i++) {
    if (i >= waveCount) break;
    float radius = 0.15 + i * 0.1;
    float animOffset = sin(t * speed * 0.5 + rowIdx * 0.3 + i * 0.5) * 0.02;
    radius += animOffset + audio * 0.02 * i;
    float ring = smoothstep(lineWeight, lineWeight * 0.3, abs(dist - radius));
    float fade = 1.0 - i / waveCount * 0.4;
    wave += ring * fade;
  }
  vec3 waveColor = getPaletteColor(rowIdx * 0.1 + t * speed * 0.02 + audio * 0.1);
  vec3 bgColor = getPaletteColor(0.95 - waveCount * 0.02);
  vec3 col = mix(bgColor, waveColor, clamp(wave, 0.0, 1.0));
  float shimmer = sin(dist * 30.0 - t * speed * 2.0) * 0.5 + 0.5;
  col += waveColor * shimmer * 0.05 * wave;
  return col * uSeigaihaOpacity;
}`,
    mainCall: `  if (uSeigaihaEnabled > 0.5) color += seigaiha(effectUv, uTime);
`
  },

  {
    id: 'gen-sierpinski',
    uniforms: `uniform float uSierpinskiEnabled;
uniform float uSierpinskiOpacity;
uniform float uSierpinskiSpeed;
uniform float uSierpinskiDepth;
uniform float uSierpinskiRotation;
uniform float uSierpinskiVariant;
`,
    functions: `vec3 sierpinski(vec2 uv, float t) {
  vec2 centered = uv * 2.0 - 1.0;
  float rot = uSierpinskiRotation + t * uSierpinskiSpeed * 0.05;
  float ca = cos(rot), sa = sin(rot);
  centered = vec2(centered.x * ca - centered.y * sa, centered.x * sa + centered.y * ca);
  vec3 col = vec3(0.0);
  float depth = max(1.0, uSierpinskiDepth);
  float variant = uSierpinskiVariant;
  vec2 p = centered;
  float sierpinskiVal = 1.0;
  for (float i = 0.0; i < 8.0; i++) {
    if (i >= depth) break;
    if (variant < 0.5) {
      p = fract(p * 2.0) * 2.0 - 1.0;
      float mask = 1.0 - step(0.0, -p.x) * step(0.0, -p.y) * step(p.x + p.y, 0.0);
      sierpinskiVal *= mask;
    } else if (variant < 1.5) {
      p = fract(p * 3.0);
      float cx = step(1.0 / 3.0, p.x) * step(p.x, 2.0 / 3.0);
      float cy = step(1.0 / 3.0, p.y) * step(p.y, 2.0 / 3.0);
      sierpinskiVal *= 1.0 - cx * cy;
      p = p * 3.0 - 1.0;
    } else {
      vec2 cell = floor(p * 2.0);
      float cellId = hash21(cell);
      p = fract(p * 2.0) * 2.0 - 1.0;
      float mask = step(0.5, cellId + sin(t * uSierpinskiSpeed * 0.3 + cell.x + cell.y) * 0.3);
      sierpinskiVal *= mask;
    }
  }
  int specIdx = int(clamp(abs(centered.x + centered.y) * 30.0, 0.0, 63.0));
  float audio = uSpectrum[specIdx];
  vec3 fractalColor = getPaletteColor(length(centered) * 0.5 + t * uSierpinskiSpeed * 0.02);
  float edgeGlow = fwidth(sierpinskiVal) * 30.0;
  edgeGlow = clamp(edgeGlow, 0.0, 1.0);
  col = fractalColor * sierpinskiVal * (0.5 + audio * 0.5);
  col += getPaletteColor(0.8) * edgeGlow * 0.5;
  col *= (0.7 + uRms * 0.3);
  return col * uSierpinskiOpacity;
}`,
    mainCall: `  if (uSierpinskiEnabled > 0.5) color += sierpinski(effectUv, uTime);
`
  },

  {
    id: 'gen-orbital',
    uniforms: `uniform float uOrbitalEnabled;
uniform float uOrbitalOpacity;
uniform float uOrbitalSpeed;
uniform float uOrbitalCount;
uniform float uOrbitalTrailLen;
uniform float uOrbitalGravity;`,
    functions: `vec3 orbital(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float aspect = uResolution.x / uResolution.y;
  centered.x *= aspect;
  float audio = uRms;
  int count = int(uOrbitalCount + 2.0);
  float trailLen = uOrbitalTrailLen;
  vec3 col = vec3(0.0);
  float grav = uOrbitalGravity;
  for (int i = 0; i < 8; i++) {
    if (i >= count) break;
    float fi = float(i);
    float phase = fi * 2.094 + t * uOrbitalSpeed * (0.5 + fi * 0.15);
    float r = 0.08 + fi * 0.04 + audio * 0.02 * fi;
    float eccentricity = 0.3 + fi * 0.08;
    vec2 orbit = vec2(
      r * cos(phase) * (1.0 + eccentricity * sin(phase * 0.7)),
      r * sin(phase) * (1.0 - eccentricity * cos(phase * 1.3)) * 0.6
    );
    vec2 vel = vec2(-sin(phase), cos(phase)) * uOrbitalSpeed * 0.1;
    for (int j = 0; j < 12; j++) {
      float fj = float(j) / 12.0;
      float trailAlpha = 1.0 - fj * fj;
      vec2 trailPos = orbit - vel * fj * trailLen * 0.3;
      float d = length(centered - trailPos);
      float glow = 0.003 / (d * d + 0.0001);
      glow *= trailAlpha;
      float hue = fi / float(count) + fj * 0.05;
      vec3 orbColor = getPaletteColor(hue);
      col += orbColor * glow * 0.15;
    }
    float bodyDist = length(centered - orbit);
    float bodyGlow = 0.0015 / (bodyDist * bodyDist + 0.00005);
    col += getPaletteColor(fi / float(count)) * bodyGlow * 0.5;
    float gravPull = grav / (bodyDist * bodyDist + 0.001);
    float gravLine = smoothstep(0.005, 0.0, abs(length(centered) - length(orbit)) - 0.01);
  }
  float centerGlow = 0.008 / (dot(centered, centered) + 0.001);
  col += getPaletteColor(0.1) * centerGlow * (0.5 + audio * 0.5);
  return col * uOrbitalOpacity;
}`,
    mainCall: `  if (uOrbitalEnabled > 0.5) color += orbital(effectUv, uTime);
`
  },

  {
    id: 'gen-conic-gradient',
    uniforms: `uniform float uConicGradientEnabled;
uniform float uConicGradientOpacity;
uniform float uConicGradientSpeed;
uniform float uConicGradientSegments;
uniform float uConicGradientRotation;
uniform float uConicGradientSharpness;`,
    functions: `vec3 conicGradient(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float angle = atan(centered.y, centered.x) + uConicGradientRotation + t * uConicGradientSpeed * 0.5;
  float radius = length(centered);
  float segments = uConicGradientSegments;
  float audio = uRms;
  float segAngle = angle * segments / 6.2832;
  float sharpness = uConicGradientSharpness;
  float seg = fract(segAngle + t * uConicGradientSpeed * 0.1);
  float edge = abs(seg - 0.5) * 2.0;
  float gradVal = mix(seg, edge, sharpness);
  gradVal += sin(radius * 20.0 - t * uConicGradientSpeed * 2.0) * 0.15 * (1.0 - sharpness);
  gradVal = clamp(gradVal, 0.0, 1.0);
  float radialFade = smoothstep(0.55, 0.15, radius);
  float segIndex = floor(segAngle);
  float hue = segIndex / segments + t * 0.02;
  vec3 segColor1 = getPaletteColor(hue);
  vec3 segColor2 = getPaletteColor(hue + 0.5 / segments);
  vec3 col = mix(segColor1, segColor2, gradVal) * radialFade;
  col += getPaletteColor(0.3) * smoothstep(0.03, 0.0, radius) * (0.8 + audio * 0.2);
  float ring = sin(radius * 40.0 - t * 3.0) * 0.5 + 0.5;
  col *= 0.85 + ring * 0.15 * (1.0 - sharpness);
  col *= 0.7 + audio * 0.3;
  return col * uConicGradientOpacity;
}`,
    mainCall: `  if (uConicGradientEnabled > 0.5) color += conicGradient(effectUv, uTime);
`
  },

  {
    id: 'gen-barcode',
    uniforms: `uniform float uBarcodeEnabled;
uniform float uBarcodeOpacity;
uniform float uBarcodeSpeed;
uniform float uBarcodeDensity;
uniform float uBarcodeThickness;
uniform float uBarcodeMirror;`,
    functions: `vec3 barcode(vec2 uv, float t) {
  float audio = uRms;
  float peak = uPeak;
  vec2 centered = uv - 0.5;
  float density = uBarcodeDensity;
  float thickness = uBarcodeThickness;
  float x = uv.x * density + t * uBarcodeSpeed * 0.5;
  float specIdx = uv.x * 63.0;
  int idx = int(clamp(specIdx, 0.0, 63.0));
  float specVal = uSpectrum[idx];
  float barHeight = specVal * (0.3 + peak * 0.4) + 0.05;
  float thinBar = step(0.5, fract(sin(floor(x * 8.0) * 43.7585) * 234.21));
  float medBar = step(0.5, fract(sin(floor(x * 4.0) * 17.31) * 98.47));
  float wideBar = step(0.5, fract(sin(floor(x * 2.0) * 7.93) * 42.13));
  float barMask = mix(thinBar * thickness, mix(medBar, wideBar, 0.5), 0.5);
  float yDist = abs(centered.y);
  float barRegion = smoothstep(barHeight, barHeight - 0.02, yDist);
  float guardBars = smoothstep(0.01, 0.0, abs(uv.x - 0.5)) * step(0.45, yDist);
  float quietZone = smoothstep(0.05, 0.1, uv.x) * smoothstep(0.95, 0.9, uv.x);
  vec3 barColor = getPaletteColor(uv.x * 0.3 + specVal * 0.2);
  vec3 bgColor = getPaletteColor(0.7) * 0.1;
  vec3 col = mix(bgColor, barColor, barMask * barRegion * quietZone);
  col += getPaletteColor(0.9) * guardBars * 0.3;
  float mirrorX = 1.0 - uv.x;
  float mirrorMask = uBarcodeMirror;
  if (mirrorMask > 0.5) {
    float mirrorSpec = mirrorX * 63.0;
    int mIdx = int(clamp(mirrorSpec, 0.0, 63.0));
    float mSpecVal = uSpectrum[mIdx];
    float mBarHeight = mSpecVal * (0.3 + peak * 0.4) + 0.05;
    float mBarRegion = smoothstep(mBarHeight, mBarHeight - 0.02, yDist);
    vec3 mirrorCol = getPaletteColor(mirrorX * 0.3 + mSpecVal * 0.2);
    col = mix(col, mirrorCol * barMask * mBarRegion, 0.5);
  }
  col *= 0.7 + audio * 0.3;
  float scanLine = smoothstep(0.003, 0.0, abs(uv.y - fract(t * 0.3)) - 0.001);
  col += vec3(1.0, 0.2, 0.1) * scanLine * 0.3;
  return col * uBarcodeOpacity;
}`,
    mainCall: `  if (uBarcodeEnabled > 0.5) color += barcode(effectUv, uTime);
`
  },

  {
    id: 'gen-ferrofluid',
    uniforms: `uniform float uFerrofluidEnabled;
uniform float uFerrofluidOpacity;
uniform float uFerrofluidSpeed;
uniform float uFerrofluidSpikes;
uniform float uFerrofluidMagnetism;
uniform float uFerrofluidSmooth;`,
    functions: `vec3 ferrofluid(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float spikeCount = uFerrofluidSpikes;
  float magnetism = uFerrofluidMagnetism;
  float smoothness = uFerrofluidSmooth;
  float r = length(centered);
  float angle = atan(centered.y, centered.x);
  float baseR = 0.15 + audio * 0.03;
  float spike = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= int(spikeCount)) break;
    float fi = float(i);
    float spikeAngle = fi * 6.2832 / spikeCount + t * uFerrofluidSpeed * 0.2 * (0.5 + fi * 0.1);
    float alignment = cos(angle - spikeAngle);
    float spikeMag = pow(max(alignment, 0.0), 3.0 + magnetism * 5.0);
    float audioSpike = uSpectrum[int(mod(fi * 8.0, 64.0))];
    spike += spikeMag * (0.04 + magnetism * 0.08 + audioSpike * 0.04);
  }
  float surface = baseR + spike;
  float smoothSurf = mix(surface, baseR + spike * 0.3, smoothness);
  float interior = smoothstep(smoothSurf + 0.005, smoothSurf - 0.005, r);
  float edgeGlow = smoothstep(smoothSurf + 0.02, smoothSurf, r) * smoothstep(smoothSurf - 0.01, smoothSurf, r);
  float reflect = pow(max(1.0 - abs(dot(normalize(centered), vec2(cos(angle), sin(angle)))), 0.0), 8.0);
  vec3 fluidColor = getPaletteColor(0.05 + reflect * 0.15);
  vec3 spikeColor = getPaletteColor(0.4 + audio * 0.2);
  vec3 col = mix(vec3(0.0), fluidColor, interior);
  col = mix(col, spikeColor, edgeGlow * (0.8 + magnetism * 0.2));
  col += vec3(1.0) * reflect * interior * 0.3;
  float highlight = smoothstep(0.04, 0.02, length(centered - vec2(-0.04, 0.04)));
  col += vec3(1.0, 0.95, 0.9) * highlight * interior * 0.6;
  float ripple = sin(r * 60.0 - t * 4.0) * 0.5 + 0.5;
  col *= 0.9 + ripple * 0.1 * interior;
  col *= (0.7 + audio * 0.3);
  return col * uFerrofluidOpacity;
}`,
    mainCall: `  if (uFerrofluidEnabled > 0.5) color += ferrofluid(effectUv, uTime);
`
  },

  {
    id: 'gen-halftone',
    uniforms: `uniform float uHalftoneEnabled;
uniform float uHalftoneOpacity;
uniform float uHalftoneSpeed;
uniform float uHalftoneScale;
uniform float uHalftoneAngle;
uniform float uHalftoneStyle;`,
    functions: `vec3 halftone(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float scale = uHalftoneScale;
  float angle = uHalftoneAngle;
  float styleVal = uHalftoneStyle;
  float ca = cos(angle);
  float sa = sin(angle);
  vec2 rotUv = vec2(centered.x * ca - centered.y * sa, centered.x * sa + centered.y * ca);
  vec2 gridUv = rotUv * scale;
  vec2 cellId = floor(gridUv);
  vec2 cellUv = fract(gridUv) - 0.5;
  float cellHash = hash21(cellId);
  float dist = length(centered);
  float brightness = smoothstep(0.55, 0.1, dist);
  float audioMod = uSpectrum[int(abs(cellHash) * 63.0)] * 0.3;
  brightness += audioMod;
  float dotSize = brightness * 0.45;
  if (styleVal < 0.33) {
    float d = length(cellUv);
    float dot = smoothstep(dotSize, dotSize - 0.02, d);
    vec3 inkColor = getPaletteColor(cellHash * 0.3 + dist * 0.5 + t * uHalftoneSpeed * 0.02);
    vec3 paperColor = getPaletteColor(0.9) * 0.15;
    vec3 col = mix(paperColor, inkColor, dot);
    return col * uHalftoneOpacity;
  } else if (styleVal < 0.66) {
    float d = abs(cellUv.x) + abs(cellUv.y);
    float diamond = smoothstep(dotSize, dotSize - 0.02, d * 0.7);
    vec3 inkColor = getPaletteColor(cellHash * 0.4 + t * uHalftoneSpeed * 0.01);
    vec3 paperColor = getPaletteColor(0.8) * 0.12;
    vec3 col = mix(paperColor, inkColor, diamond);
    return col * uHalftoneOpacity;
  } else {
    float lineW = brightness * 0.4;
    float line = smoothstep(lineW, lineW - 0.015, abs(cellUv.y));
    vec3 inkColor = getPaletteColor(cellHash * 0.2 + dist * 0.6);
    vec3 paperColor = getPaletteColor(0.85) * 0.1;
    vec3 col = mix(paperColor, inkColor, line);
    return col * uHalftoneOpacity;
  }
}`,
    mainCall: `  if (uHalftoneEnabled > 0.5) color += halftone(effectUv, uTime);
`
  },

  {
    id: 'gen-pixel-sort',
    uniforms: `uniform float uPixelSortEnabled;
uniform float uPixelSortOpacity;
uniform float uPixelSortSpeed;
uniform float uPixelSortThreshold;
uniform float uPixelSortDirection;
uniform float uPixelSortGlitch;`,
    functions: `vec3 pixelSort(vec2 uv, float t) {
  float audio = uRms;
  float peak = uPeak;
  float threshold = uPixelSortThreshold;
  float direction = uPixelSortDirection;
  float glitch = uPixelSortGlitch;
  float sortDir = direction < 0.5 ? uv.x : uv.y;
  float sortPerp = direction < 0.5 ? uv.y : uv.x;
  float sortLen = 0.02 + glitch * 0.15 + audio * 0.08;
  int triggerBandInt = int(sortPerp * 8.0 + t * uPixelSortSpeed * 2.0) % 8;
  float triggerBand = float(triggerBandInt);
  float trigger = step(threshold, sin(triggerBand * 3.14159 + t * uPixelSortSpeed));
  float sortOffset = trigger * sortLen * sin(sortPerp * 50.0 + t * 5.0);
  float glitchBand = step(0.95, fract(sin(floor(sortPerp * 20.0 + t * uPixelSortSpeed) * 43.7) * 17.3));
  sortOffset += glitchBand * glitch * 0.2;
  vec2 sortedUv = uv;
  if (direction < 0.5) {
    sortedUv.x = fract(uv.x + sortOffset);
  } else {
    sortedUv.y = fract(uv.y + sortOffset);
  }
  vec2 centered = sortedUv - 0.5;
  float dist = length(centered);
  float angle = atan(centered.y, centered.x);
  float brightness = sin(dist * 10.0 + t * uPixelSortSpeed) * 0.5 + 0.5;
  brightness += sin(angle * 3.0 + dist * 5.0 - t * 2.0) * 0.3;
  float audioBright = uSpectrum[int(abs(angle) * 10.0) % 64] * 0.2;
  brightness += audioBright;
  vec3 col = getPaletteColor(brightness * 0.5 + dist * 0.3 + t * uPixelSortSpeed * 0.01);
  float bandIntensity = sin(sortPerp * 40.0 + t * 3.0) * 0.5 + 0.5;
  col *= 0.6 + bandIntensity * 0.4;
  float shift = glitch * 0.01 * trigger;
  vec3 colShift;
  colShift.r = getPaletteColor(brightness * 0.5 + dist * 0.3 + shift).r;
  colShift.g = col.g;
  colShift.b = getPaletteColor(brightness * 0.5 + dist * 0.3 - shift).b;
  col = mix(col, colShift, trigger * glitch);
  col *= 0.7 + peak * 0.3;
  return col * uPixelSortOpacity;
}`,
    mainCall: `  if (uPixelSortEnabled > 0.5) color += pixelSort(effectUv, uTime);
`
  },

  {
    id: 'gen-ripple-pond',
    uniforms: `uniform float uRipplePondEnabled;
uniform float uRipplePondOpacity;
uniform float uRipplePondSpeed;
uniform float uRipplePondDrops;
uniform float uRipplePondDecay;
uniform float uRipplePondRefraction;`,
    functions: `vec3 ripplePond(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float peak = uPeak;
  int dropCount = int(uRipplePondDrops + 1.0);
  float decay = uRipplePondDecay;
  float refraction = uRipplePondRefraction;
  float height = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= dropCount) break;
    float fi = float(i);
    vec2 dropPos = vec2(
      sin(fi * 1.7 + t * uRipplePondSpeed * 0.3) * 0.3,
      cos(fi * 2.3 + t * uRipplePondSpeed * 0.4) * 0.3
    );
    float dropTime = mod(t * uRipplePondSpeed + fi * 1.5, 4.0);
    float dist = length(centered - dropPos);
    float waveAge = dropTime;
    float waveRadius = waveAge * 0.3;
    float waveFront = abs(dist - waveRadius);
    float amplitude = exp(-waveAge * decay) * exp(-dist * 2.0);
    float audioAmp = uSpectrum[int(fi * 8.0) % 64] * 0.5;
    height += sin(dist * 30.0 - waveAge * 8.0) * amplitude * (0.5 + audioAmp);
    height += smoothstep(0.02, 0.0, waveFront) * amplitude * peak;
  }
  float dhdx = height - sin((length(centered - vec2(0.001, 0.0)) - dropPos) * 30.0) * 0.001;
  float dhdy = height - sin((length(centered - vec2(0.0, 0.001)) - dropPos) * 30.0) * 0.001;
  vec2 refractedUv = uv + vec2(dhdx, dhdy) * refraction * 0.1;
  float depth = length(refractedUv - 0.5);
  vec3 deepColor = getPaletteColor(0.15 + audio * 0.1);
  vec3 shallowColor = getPaletteColor(0.6);
  vec3 col = mix(shallowColor, deepColor, smoothstep(0.0, 0.4, depth));
  float caustic = pow(max(sin(height * 8.0) * 0.5 + 0.5, 0.0), 3.0);
  col += getPaletteColor(0.3) * caustic * 0.3;
  float specHighlight = pow(max(height, 0.0), 2.0) * 0.5;
  col += vec3(1.0) * specHighlight * (0.3 + peak * 0.3);
  col *= 0.7 + audio * 0.3;
  return col * uRipplePondOpacity;
}`,
    mainCall: `  if (uRipplePondEnabled > 0.5) color += ripplePond(effectUv, uTime);
`
  },

  {
    id: 'gen-hex-grid',
    uniforms: `uniform float uHexGridEnabled;
uniform float uHexGridOpacity;
uniform float uHexGridSpeed;
uniform float uHexGridScale;
uniform float uHexGridPulse;
uniform float uHexGridBorder;`,
    functions: `vec3 hexGrid(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float scale = uHexGridScale;
  float pulse = uHexGridPulse;
  float border = uHexGridBorder;
  float sq3 = 1.7320508;
  vec2 hexUv = vec2(centered.x * sq3, centered.y * 2.0) * scale;
  vec2 hexId;
  float cellType;
  vec2 rUv = vec2(hexUv.x / sq3, hexUv.y);
  vec2 rUv2 = vec2(hexUv.x / sq3 + 0.5, hexUv.y + 0.5);
  if (fract(rUv.y) > fract(rUv2.y)) {
    hexId = floor(rUv);
    cellType = 0.0;
  } else {
    hexId = floor(rUv2);
    cellType = 1.0;
  }
  vec2 cellCenter;
  if (cellType < 0.5) {
    cellCenter = (hexId + 0.5) * vec2(sq3, 1.0);
  } else {
    cellCenter = (hexId + 0.5) * vec2(sq3, 1.0) + vec2(sq3 * 0.5, 0.5);
  }
  vec2 diff = hexUv - cellCenter;
  float hexDist = max(abs(diff.x), abs(diff.y) * 0.5 + abs(diff.x) * 0.577350269);
  float hexBorder = smoothstep(0.48, 0.46, hexDist);
  float hexFill = smoothstep(0.44, 0.42, hexDist);
  float cellHash = hash21(hexId + cellType * 100.0);
  float audioCell = uSpectrum[int(abs(cellHash) * 63.0)];
  float distFromCenter = length(cellCenter / scale);
  float pulseWave = sin(distFromCenter * 10.0 - t * uHexGridSpeed * 3.0) * 0.5 + 0.5;
  float fillVal = mix(cellHash, pulseWave, pulse);
  fillVal += audioCell * 0.4;
  fillVal = clamp(fillVal, 0.0, 1.0);
  float age = mod(t * uHexGridSpeed + cellHash * 6.28, 2.0);
  float birthFade = smoothstep(0.0, 0.3, age);
  fillVal *= birthFade;
  vec3 cellColor = getPaletteColor(fillVal * 0.4 + distFromCenter * 0.3);
  vec3 borderColor = getPaletteColor(0.7) * border;
  vec3 col = mix(vec3(0.0), cellColor * fillVal, hexFill);
  col += borderColor * hexBorder * (1.0 - hexFill);
  col *= 0.7 + audio * 0.3;
  return col * uHexGridOpacity;
}`,
    mainCall: `  if (uHexGridEnabled > 0.5) color += hexGrid(effectUv, uTime);
`
  },

  {
    id: 'gen-woven',
    uniforms: `uniform float uWovenEnabled;
uniform float uWovenOpacity;
uniform float uWovenSpeed;
uniform float uWovenScale;
uniform float uWovenThreadWidth;
uniform float uWovenPattern;`,
    functions: `vec3 woven(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float scale = uWovenScale;
  float threadWidth = uWovenThreadWidth;
  float pattern = uWovenPattern;
  vec2 gridUv = centered * scale;
  vec2 cellSize = vec2(1.0);
  vec2 cellId = floor(gridUv / cellSize);
  vec2 cellUv = fract(gridUv / cellSize);
  float warpCell = hash21(cellId);
  float weftCell = hash21(cellId + 100.0);
  float warpAudio = uSpectrum[int(abs(warpCell) * 63.0)];
  float weftAudio = uSpectrum[int(abs(weftCell) * 63.0)];
  float twillShift = 0.5 * step(0.5, pattern) * step(1.0, mod(cellId.x + cellId.y, 2.0));
  float satinShift = 0.5 * step(0.66, pattern) * step(3.0, mod(cellId.x * 3.0 + cellId.y, 4.0));
  float shift = mix(0.0, mix(twillShift, satinShift, pattern), min(pattern * 2.0, 1.0));
  float warp = smoothstep(threadWidth * 0.5, threadWidth * 0.5 - 0.01, abs(cellUv.y - 0.5 + shift));
  float weft = smoothstep(threadWidth * 0.5, threadWidth * 0.5 - 0.01, abs(cellUv.x - 0.5 + shift));
  float overUnder = step(0.5, hash21(cellId * 2.0 + floor(t * uWovenSpeed * 0.5)));
  float warpVisible = mix(warp * (1.0 - weft) + warp * weft * overUnder, warp, 0.3);
  float weftVisible = mix(weft * (1.0 - warp) + weft * warp * (1.0 - overUnder), weft, 0.3);
  float warpShade = 0.8 + warpAudio * 0.2 + sin(cellUv.x * 20.0 + t * uWovenSpeed) * 0.05;
  float weftShade = 0.9 + weftAudio * 0.2 + cos(cellUv.y * 20.0 + t * uWovenSpeed * 1.3) * 0.05;
  float warpHue = warpCell * 0.4 + sin(t * uWovenSpeed * 0.3) * 0.1;
  float weftHue = weftCell * 0.4 + 0.5 + cos(t * uWovenSpeed * 0.2) * 0.1;
  vec3 warpColor = getPaletteColor(warpHue) * warpShade;
  vec3 weftColor = getPaletteColor(weftHue) * weftShade;
  vec3 bgColor = getPaletteColor(0.95) * 0.05;
  vec3 col = bgColor;
  col += warpColor * warpVisible;
  col += weftColor * weftVisible;
  float threadHighlight = sin(cellUv.x * 15.0) * 0.5 + 0.5;
  col += vec3(1.0) * threadHighlight * warpVisible * 0.05;
  float threadHighlight2 = cos(cellUv.y * 15.0) * 0.5 + 0.5;
  col += vec3(1.0) * threadHighlight2 * weftVisible * 0.05;
  col *= 0.7 + audio * 0.3;
  return col * uWovenOpacity;
}`,
    mainCall: `  if (uWovenEnabled > 0.5) color += woven(effectUv, uTime);
`
  },

  {
    id: 'gen-chromatic-aberr',
    uniforms: `uniform float uChromaticAberrEnabled;
uniform float uChromaticAberrOpacity;
uniform float uChromaticAberrSpeed;
uniform float uChromaticAberrDispersion;
uniform float uChromaticAberrRings;
uniform float uChromaticAberrIntensity;`,
    functions: `vec3 chromaticAberr(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float peak = uPeak;
  float dispersion = uChromaticAberrDispersion;
  float rings = uChromaticAberrRings;
  float intensity = uChromaticAberrIntensity;
  float dist = length(centered);
  float angle = atan(centered.y, centered.x);
  float prismAngle = t * uChromaticAberrSpeed * 0.5;
  float chromaticShift = dispersion * dist * 0.1;
  float audioShift = audio * dispersion * 0.05;
  float rShift = chromaticShift + audioShift;
  float gShift = chromaticShift * 0.5;
  float bShift = -chromaticShift - audioShift;
  float rDist = dist + rShift;
  float gDist = dist + gShift;
  float bDist = dist + bShift;
  float rRing = sin(rDist * rings * 20.0 + t * uChromaticAberrSpeed * 2.0) * 0.5 + 0.5;
  float gRing = sin(gDist * rings * 20.0 + t * uChromaticAberrSpeed * 2.0 + 0.5) * 0.5 + 0.5;
  float bRing = sin(bDist * rings * 20.0 + t * uChromaticAberrSpeed * 2.0 + 1.0) * 0.5 + 0.5;
  float specR = uSpectrum[int(mod(abs(angle) * 10.0, 64.0))];
  float specG = uSpectrum[int(mod(abs(angle) * 10.0 + 21.0, 64.0))];
  float specB = uSpectrum[int(mod(abs(angle) * 10.0 + 42.0, 64.0))];
  float rVal = rRing * (0.5 + specR * 0.5);
  float gVal = gRing * (0.5 + specG * 0.5);
  float bVal = bRing * (0.5 + specB * 0.5);
  float radialFade = smoothstep(0.55, 0.15, dist);
  float centerGlow = smoothstep(0.08, 0.0, dist);
  vec3 col = vec3(rVal, gVal, bVal) * radialFade * intensity;
  col += getPaletteColor(0.1) * centerGlow * (0.5 + peak * 0.3);
  float flareAngle = prismAngle;
  float flare1 = smoothstep(0.01, 0.0, abs(angle - flareAngle) - 0.05 * dist);
  float flare2 = smoothstep(0.01, 0.0, abs(angle - flareAngle - 2.094) - 0.05 * dist);
  float flare3 = smoothstep(0.01, 0.0, abs(angle - flareAngle + 2.094) - 0.05 * dist);
  float flareMask = (flare1 + flare2 + flare3) * radialFade;
  col += getPaletteColor(0.3) * flareMask * 0.3 * intensity;
  col *= 0.7 + audio * 0.3;
  return col * uChromaticAberrOpacity;
}`,
    mainCall: `  if (uChromaticAberrEnabled > 0.5) color += chromaticAberr(effectUv, uTime);
`
  },

  {
    id: 'gen-solar-flare',
    uniforms: `uniform float uSolarFlareEnabled;
uniform float uSolarFlareOpacity;
uniform float uSolarFlareSpeed;
uniform float uSolarFlareIntensity;
uniform float uSolarFlareProminences;
uniform float uSolarFlareCoronaSize;`,
    functions: `vec3 solarFlare(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float dist = length(centered);
  float angle = atan(centered.y, centered.x);
  float corona = uSolarFlareCoronaSize;
  float prominences = uSolarFlareProminences;
  vec3 col = vec3(0.0);
  float coreRadius = 0.08 + audio * 0.02;
  float core = smoothstep(coreRadius + 0.01, coreRadius - 0.01, dist);
  vec3 coreColor = vec3(1.0, 0.95, 0.8) * core * 2.0;
  col += coreColor;
  float coronaFalloff = exp(-dist * (3.0 / corona));
  float coronaNoise = fbm(vec2(angle * 3.0 + t * uSolarFlareSpeed * 0.2, dist * 5.0));
  vec3 coronaColor = mix(vec3(1.0, 0.4, 0.1), vec3(1.0, 0.8, 0.2), coronaNoise);
  col += coronaColor * coronaFalloff * uSolarFlareIntensity * 0.8;
  for (int i = 0; i < 6; i++) {
    if (i >= int(prominences)) break;
    float fi = float(i);
    float promAngle = fi * 1.047 + t * uSolarFlareSpeed * 0.15 + sin(fi * 2.3) * 0.5;
    float promLen = 0.15 + 0.1 * sin(t * uSolarFlareSpeed * 0.5 + fi * 1.7) + audio * 0.08;
    vec2 promDir = vec2(cos(promAngle), sin(promAngle));
    float along = dot(centered, promDir);
    float perp = length(centered - promDir * along);
    float promShape = smoothstep(0.0, promLen, along) * smoothstep(promLen + 0.02, promLen, along);
    promShape *= smoothstep(0.02 + audio * 0.01, 0.0, perp);
    float loopBack = sin(along * 8.0 + t * uSolarFlareSpeed) * 0.01;
    promShape *= smoothstep(0.02, 0.0, abs(perp - loopBack));
    col += vec3(1.0, 0.3, 0.05) * promShape * uSolarFlareIntensity;
  }
  float rays = 0.0;
  for (int i = 0; i < 12; i++) {
    float rayAngle = float(i) * 0.5236 + t * uSolarFlareSpeed * 0.05;
    float alignment = pow(max(cos(angle - rayAngle), 0.0), 16.0);
    rays += alignment * exp(-dist * 4.0);
  }
  col += vec3(1.0, 0.6, 0.2) * rays * 0.15 * uSolarFlareIntensity;
  col *= 0.7 + audio * 0.3;
  return col * uSolarFlareOpacity;
}`,
    mainCall: `  if (uSolarFlareEnabled > 0.5) color += solarFlare(effectUv, uTime);
`
  },

  {
    id: 'gen-clockwork',
    uniforms: `uniform float uClockworkEnabled;
uniform float uClockworkOpacity;
uniform float uClockworkSpeed;
uniform float uClockworkGearCount;
uniform float uClockworkDetail;
uniform float uClockworkRust;`,
    functions: `vec3 clockwork(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float aspect = uResolution.x / uResolution.y;
  centered.x *= aspect;
  int gearCount = int(uClockworkGearCount + 1.0);
  float detail = uClockworkDetail;
  float rustLevel = uClockworkRust;
  vec3 col = getPaletteColor(0.0) * 0.08;
  for (int i = 0; i < 6; i++) {
    if (i >= gearCount) break;
    float fi = float(i);
    vec2 gearPos = vec2(
      sin(fi * 2.3 + 0.5) * 0.25,
      cos(fi * 1.7 + 0.3) * 0.25
    );
    float gearRadius = 0.08 + fi * 0.015;
    int teeth = int(8.0 + fi * 4.0);
    float speed = uClockworkSpeed * (mod(fi, 2.0) < 1.0 ? 1.0 : -1.0) * (0.5 + fi * 0.2);
    float rotation = t * speed + fi * 0.5;
    vec2 rel = centered - gearPos;
    float dist = length(rel);
    float angle = atan(rel.y, rel.x) - rotation;
    float toothAngle = 6.2832 / float(teeth);
    float toothPhase = mod(angle, toothAngle) / toothAngle;
    float toothProfile = step(0.35, toothPhase) * (1.0 - step(0.65, toothPhase));
    float gearMask = smoothstep(gearRadius + 0.008, gearRadius - 0.003, dist);
    float innerHole = smoothstep(gearRadius * 0.15, gearRadius * 0.2, dist);
    float spokeMask = 0.0;
    for (int s = 0; s < 4; s++) {
      float spokeAngle = float(s) * 1.5708 + rotation;
      float spokeDist = abs(sin(angle + rotation - spokeAngle)) * dist;
      spokeMask = max(spokeMask, smoothstep(0.004, 0.0, spokeDist - 0.001) * step(gearRadius * 0.2, dist));
    }
    float audioPulse = 1.0 + audio * 0.05 * sin(fi * 2.0);
    vec3 gearBase = getPaletteColor(fi / float(gearCount) + audio * 0.1);
    vec3 brassColor = mix(gearBase, gearBase * 0.6, rustLevel * hash21(vec2(fi, fi * 3.0)));
    vec3 gearColor = brassColor * (0.8 + toothProfile * 0.2) * audioPulse;
    col = mix(col, gearColor, gearMask * innerHole);
    col += brassColor * spokeMask * 0.5;
    float hubMask = smoothstep(gearRadius * 0.2, gearRadius * 0.15, dist) * gearMask;
    col = mix(col, getPaletteColor(fi / float(gearCount) + 0.5) * 0.4, hubMask);
  }
  col *= 0.7 + audio * 0.3;
  return col * uClockworkOpacity;
}`,
    mainCall: `  if (uClockworkEnabled > 0.5) color += clockwork(effectUv, uTime);
`
  },

  {
    id: 'gen-god-rays',
    uniforms: `uniform float uGodRaysEnabled;
uniform float uGodRaysOpacity;
uniform float uGodRaysSpeed;
uniform float uGodRaysCount;
uniform float uGodRaysDensity;
uniform float uGodRaysSpread;`,
    functions: `vec3 godRays(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float count = uGodRaysCount;
  float density = uGodRaysDensity;
  float spread = uGodRaysSpread;
  vec3 col = vec3(0.0);
  vec2 lightSource = vec2(sin(t * uGodRaysSpeed * 0.1) * 0.2, 0.45);
  vec2 lightDir = lightSource - centered;
  float lightDist = length(lightDir);
  float lightAngle = atan(lightDir.y, lightDir.x);
  for (int i = 0; i < 16; i++) {
    if (i >= int(count)) break;
    float fi = float(i);
    float rayAngle = lightAngle + (hash21(vec2(fi, t * uGodRaysSpeed * 0.05)) - 0.5) * spread;
    float alignment = pow(max(dot(normalize(lightDir), vec2(cos(rayAngle), sin(rayAngle))), 0.0), 4.0 + density * 8.0);
    float rayLength = 0.3 + hash21(vec2(fi * 3.0, fi * 7.0)) * 0.5;
    float rayFade = smoothstep(rayLength, 0.0, lightDist);
    float shimmer = 0.7 + 0.3 * sin(lightDist * 15.0 - t * uGodRaysSpeed * 2.0 + fi);
    float audioRay = uSpectrum[int(mod(fi * 4.0, 64.0))] * 0.3;
    float rayIntensity = alignment * rayFade * shimmer * (0.15 + audioRay);
    vec3 rayColor = getPaletteColor(fi / count * 0.3 + 0.1);
    col += rayColor * rayIntensity;
  }
  float sourceGlow = 0.01 / (dot(centered - lightSource, centered - lightSource) + 0.001);
  col += vec3(1.0, 0.95, 0.8) * sourceGlow * 0.2;
  float fogNoise = fbm(centered * 3.0 + t * uGodRaysSpeed * 0.05);
  col *= 0.8 + fogNoise * 0.2;
  col *= 0.6 + audio * 0.4;
  return col * uGodRaysOpacity;
}`,
    mainCall: `  if (uGodRaysEnabled > 0.5) color += godRays(effectUv, uTime);
`
  },

  {
    id: 'gen-dust-storm',
    uniforms: `uniform float uDustStormEnabled;
uniform float uDustStormOpacity;
uniform float uDustStormSpeed;
uniform float uDustStormDensity;
uniform float uDustStormWindAngle;
uniform float uDustStormVisibility;`,
    functions: `vec3 dustStorm(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float density = uDustStormDensity;
  float windAngle = uDustStormWindAngle;
  float visibility = uDustStormVisibility;
  vec2 windDir = vec2(cos(windAngle), sin(windAngle));
  vec3 col = vec3(0.0);
  for (int layer = 0; layer < 4; layer++) {
    float fl = float(layer);
    float layerSpeed = uDustStormSpeed * (0.5 + fl * 0.3);
    vec2 layerUv = centered + windDir * t * layerSpeed;
    layerUv *= 3.0 + fl * 2.0;
    float noise1 = fbm(layerUv + vec2(t * uDustStormSpeed * 0.1, 0.0));
    float noise2 = fbm(layerUv * 1.5 + vec2(0.0, t * uDustStormSpeed * 0.08));
    float dust = noise1 * noise2;
    dust = smoothstep(1.0 - density, 1.0, dust + 0.3);
    float audioDust = uSpectrum[int(mod(fl * 16.0, 64.0))] * 0.2;
    dust += audioDust;
    vec3 dustColor1 = vec3(0.76, 0.6, 0.35);
    vec3 dustColor2 = vec3(0.55, 0.4, 0.2);
    vec3 layerColor = mix(dustColor2, dustColor1, noise1);
    float depth = 1.0 - fl * 0.2;
    col += layerColor * dust * depth * 0.5;
  }
  float fogDistance = length(centered);
  float fogDensity = smoothstep(visibility, 0.0, fogDistance);
  col *= fogDensity;
  vec3 skyColor = vec3(0.3, 0.25, 0.2);
  col = mix(skyColor, col, fogDensity);
  float grain = hash21(centered * 100.0 + t) * 0.03;
  col += grain;
  col *= 0.7 + audio * 0.3;
  return col * uDustStormOpacity;
}`,
    mainCall: `  if (uDustStormEnabled > 0.5) color += dustStorm(effectUv, uTime);
`
  },

  {
    id: 'gen-constellation',
    uniforms: `uniform float uConstellationEnabled;
uniform float uConstellationOpacity;
uniform float uConstellationSpeed;
uniform float uConstellationStarCount;
uniform float uConstellationConnectDist;
uniform float uConstellationTwinkle;`,
    functions: `vec3 constellation(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  int starCount = int(uConstellationStarCount + 4.0);
  float connectDist = uConstellationConnectDist;
  float twinkle = uConstellationTwinkle;
  vec3 col = vec3(0.0);
  vec2 starPositions[32];
  float starBright[32];
  for (int i = 0; i < 32; i++) {
    if (i < starCount) {
      vec2 basePos = vec2(hash21(vec2(float(i), 1.0)) - 0.5, hash21(vec2(1.0, float(i))) - 0.5);
      starPositions[i] = basePos + vec2(sin(t * uConstellationSpeed * 0.1 + float(i) * 0.7), cos(t * uConstellationSpeed * 0.13 + float(i) * 1.1)) * 0.01;
      starBright[i] = 0.5 + 0.5 * sin(t * uConstellationSpeed * twinkle + float(i) * 2.3);
      starBright[i] += uSpectrum[int(mod(float(i) * 4.0, 64.0))] * 0.3;
    } else {
      starPositions[i] = vec2(99.0);
      starBright[i] = 0.0;
    }
  }
  for (int i = 0; i < 32; i++) {
    if (i >= starCount) break;
    float d = length(centered - starPositions[i]);
    float glow = 0.0003 / (d * d + 0.00001);
    float hue = hash21(vec2(float(i), float(i) * 2.0)) * 0.3 + 0.5;
    vec3 starColor = getPaletteColor(hue) * starBright[i];
    col += starColor * glow * 0.3;
  }
  for (int i = 0; i < 32; i++) {
    if (i >= starCount) break;
    for (int j = i + 1; j < 32; j++) {
      if (j >= starCount) break;
      float starDist = length(starPositions[i] - starPositions[j]);
      if (starDist < connectDist) {
        float lineAlpha = 1.0 - starDist / connectDist;
        vec2 toPixel = centered - starPositions[i];
        vec2 lineDir = starPositions[j] - starPositions[i];
        float lineLen = length(lineDir);
        vec2 lineNorm = lineDir / max(lineLen, 0.001);
        float proj = clamp(dot(toPixel, lineNorm), 0.0, lineLen);
        float perpDist = length(toPixel - lineNorm * proj);
        float line = smoothstep(0.002, 0.0, perpDist);
        float audioLine = uSpectrum[int(mod(float(i + j) * 2.0, 64.0))] * 0.5;
        col += getPaletteColor(0.6) * line * lineAlpha * (0.15 + audioLine) * min(starBright[i], starBright[j]);
      }
    }
  }
  float nebula = fbm(centered * 2.0 + t * uConstellationSpeed * 0.02) * 0.1;
  col += getPaletteColor(0.3) * nebula;
  col *= 0.7 + audio * 0.3;
  return col * uConstellationOpacity;
}`,
    mainCall: `  if (uConstellationEnabled > 0.5) color += constellation(effectUv, uTime);
`
  },

  {
    id: 'gen-mandelbrot',
    uniforms: `uniform float uMandelbrotEnabled;
uniform float uMandelbrotOpacity;
uniform float uMandelbrotSpeed;
uniform float uMandelbrotZoom;
uniform float uMandelbrotMaxIter;
uniform float uMandelbrotColorCycle;`,
    functions: `vec3 mandelbrot(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float zoom = uMandelbrotZoom;
  float maxIter = uMandelbrotMaxIter;
  float colorCycle = uMandelbrotColorCycle;
  float aspect = uResolution.x / uResolution.y;
  vec2 c = centered * vec2(aspect, 1.0) / zoom;
  c += vec2(-0.745, 0.186) + vec2(sin(t * uMandelbrotSpeed * 0.05) * 0.01, cos(t * uMandelbrotSpeed * 0.03) * 0.01);
  vec2 z = vec2(0.0);
  float iter = 0.0;
  for (int i = 0; i < 256; i++) {
    if (i >= int(maxIter)) break;
    if (dot(z, z) > 4.0) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    iter += 1.0;
  }
  vec3 col = vec3(0.0);
  if (dot(z, z) > 4.0) {
    float smoothIter = iter - log2(log2(dot(z, z)));
    float hue = smoothIter * colorCycle / maxIter + t * uMandelbrotSpeed * 0.02;
    col = getPaletteColor(hue);
    float banding = sin(smoothIter * 0.5) * 0.5 + 0.5;
    col *= 0.7 + banding * 0.3;
    col *= 0.6 + audio * 0.4;
  }
  return col * uMandelbrotOpacity;
}`,
    mainCall: `  if (uMandelbrotEnabled > 0.5) color += mandelbrot(effectUv, uTime);
`
  },

  {
    id: 'gen-whirlpool',
    uniforms: `uniform float uWhirlpoolEnabled;
uniform float uWhirlpoolOpacity;
uniform float uWhirlpoolSpeed;
uniform float uWhirlpoolArms;
uniform float uWhirlpoolPull;
uniform float uWhirlpoolFoam;`,
    functions: `vec3 whirlpool(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float arms = uWhirlpoolArms;
  float pull = uWhirlpoolPull;
  float foam = uWhirlpoolFoam;
  float dist = length(centered);
  float angle = atan(centered.y, centered.x);
  float spiralAngle = angle + dist * pull * 10.0 - t * uWhirlpoolSpeed;
  float spiralNoise = fbm(vec2(spiralAngle * arms / 6.2832, dist * 5.0));
  float armPattern = sin(spiralAngle * arms) * 0.5 + 0.5;
  armPattern = pow(armPattern, 1.5);
  float audioSpiral = uSpectrum[int(mod(abs(angle) * 10.0, 64.0))] * 0.3;
  armPattern += audioSpiral;
  vec3 deepColor = vec3(0.0, 0.05, 0.15);
  vec3 waterColor = vec3(0.0, 0.2, 0.4);
  vec3 foamColor = vec3(0.7, 0.85, 0.95);
  vec3 col = mix(deepColor, waterColor, armPattern);
  float foamLine = smoothstep(0.6, 0.7, armPattern + spiralNoise * foam);
  col = mix(col, foamColor, foamLine * 0.5);
  float centerPull = smoothstep(0.15, 0.0, dist);
  col = mix(col, vec3(0.0), centerPull * 0.8);
  float ringHighlight = sin(dist * 40.0 - t * uWhirlpoolSpeed * 3.0) * 0.5 + 0.5;
  col += vec3(0.3, 0.5, 0.7) * ringHighlight * 0.1 * armPattern;
  float edgeWaves = sin(angle * 8.0 + dist * 20.0 - t * uWhirlpoolSpeed * 2.0) * 0.02;
  col += vec3(1.0) * smoothstep(0.01, 0.0, abs(dist - 0.35 + edgeWaves) - 0.005) * 0.3;
  col *= 0.7 + audio * 0.3;
  return col * uWhirlpoolOpacity;
}`,
    mainCall: `  if (uWhirlpoolEnabled > 0.5) color += whirlpool(effectUv, uTime);
`
  },

  {
    id: 'gen-firework',
    uniforms: `uniform float uFireworkEnabled;
uniform float uFireworkOpacity;
uniform float uFireworkSpeed;
uniform float uFireworkBurstCount;
uniform float uFireworkTrailLen;
uniform float uFireworkParticleSize;`,
    functions: `vec3 firework(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uPeak;
  int burstCount = int(uFireworkBurstCount + 1.0);
  float trailLen = uFireworkTrailLen;
  float particleSize = uFireworkParticleSize;
  vec3 col = vec3(0.0);
  for (int b = 0; b < 8; b++) {
    if (b >= burstCount) break;
    float fb = float(b);
    float burstTime = mod(t * uFireworkSpeed + fb * 2.5, 8.0);
    vec2 burstOrigin = vec2(
      hash21(vec2(fb, 1.0)) * 0.6 - 0.3,
      hash21(vec2(1.0, fb)) * 0.3 - 0.1
    );
    float launchPhase = smoothstep(0.0, 0.3, burstTime);
    vec2 launchPos = burstOrigin + vec2(0.0, launchPhase * 0.35);
    float launchGlow = smoothstep(0.3, 0.0, burstTime) * 0.005 / (length(centered - launchPos) * length(centered - launchPos) + 0.0001);
    col += vec3(1.0, 0.8, 0.4) * launchGlow * 0.3;
    if (burstTime > 0.3) {
      float explodeAge = burstTime - 0.3;
      float fade = exp(-explodeAge * 1.5);
      int particles = 20 + int(fb * 3.0);
      for (int p = 0; p < 30; p++) {
        if (p >= particles) break;
        float fp = float(p);
        float pAngle = fp * 2.399 + fb * 0.7;
        float pSpeed = (0.15 + hash21(vec2(fb, fp)) * 0.15) * fade;
        vec2 pVel = vec2(cos(pAngle), sin(pAngle)) * pSpeed;
        pVel.y -= explodeAge * 0.08;
        vec2 pPos = launchPos + pVel * explodeAge;
        float pDist = length(centered - pPos);
        float pGlow = particleSize * 0.0003 / (pDist * pDist + 0.00001);
        pGlow *= fade;
        float audioBurst = uSpectrum[int(mod(fp * 2.0, 64.0))] * 0.3;
        pGlow *= 0.7 + audioBurst;
        float hue = fb * 0.12 + fp * 0.01;
        vec3 pColor = getPaletteColor(hue);
        col += pColor * pGlow;
        if (trailLen > 0.1) {
          vec2 trailPos = pPos - pVel * 0.03 * trailLen;
          float trailDist = length(centered - trailPos);
          float trailGlow = particleSize * 0.0001 / (trailDist * trailDist + 0.00005) * fade * trailLen;
          col += pColor * trailGlow * 0.5;
        }
      }
    }
  }
  col *= 0.8 + audio * 0.2;
  return col * uFireworkOpacity;
}`,
    mainCall: `  if (uFireworkEnabled > 0.5) color += firework(effectUv, uTime);
`
  },

  {
    id: 'gen-crystal-cave',
    uniforms: `uniform float uCrystalCaveEnabled;
uniform float uCrystalCaveOpacity;
uniform float uCrystalCaveSpeed;
uniform float uCrystalCaveDensity;
uniform float uCrystalCaveGlow;
uniform float uCrystalCaveRefract;`,
    functions: `vec3 crystalCave(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float density = uCrystalCaveDensity;
  float glow = uCrystalCaveGlow;
  float refract = uCrystalCaveRefract;
  float aspect = uResolution.x / uResolution.y;
  centered.x *= aspect;
  float dist = length(centered);
  float angle = atan(centered.y, centered.x);

  float outerRadius = 0.42;
  float innerRadius = 0.12 + density * 0.08;
  float shellMask = smoothstep(outerRadius + 0.01, outerRadius - 0.02, dist);
  float cavityMask = smoothstep(innerRadius - 0.01, innerRadius + 0.02, dist);

  vec3 col = vec3(0.0);

  float agateLayers = 0.0;
  for (float i = 0.0; i < 16.0; i++) {
    if (i >= density * 16.0) break;
    float r = mix(outerRadius, innerRadius, i / (density * 16.0));
    float wobble = fbm(vec2(angle * 2.0 + i * 0.4, i * 1.7)) * 0.04;
    float band = smoothstep(0.012, 0.0, abs(dist - r - wobble));
    vec3 bandColor = getPaletteColor(i / 16.0 + fbm(vec2(i * 0.3, angle)) * 0.2);
    float bandBright = 0.4 + 0.3 * sin(i * 1.2 + angle * 3.0);
    col += bandColor * band * bandBright * cavityMask * shellMask;
  }

  float shellColor = fbm(centered * 3.0 + vec2(t * uCrystalCaveSpeed * 0.02, 0.0)) * 0.5 + 0.5;
  vec3 rockColor = getPaletteColor(0.1) * 0.15 * shellColor;
  col = mix(rockColor, col, cavityMask);

  float facetCount = 6.0 + floor(density * 6.0);
  float facetAngle = mod(angle + t * uCrystalCaveSpeed * 0.05, 6.2832 / facetCount);
  float facet = 6.2832 / facetCount;
  float facetLine = smoothstep(0.02, 0.005, abs(facetAngle - facet * 0.5));
  float cavityBright = exp(-dist * 3.0 / innerRadius) * (1.0 - cavityMask);
  vec3 facetColor = getPaletteColor(0.4 + sin(angle * facetCount * 0.5 + t * uCrystalCaveSpeed * 0.2) * 0.15);
  float shimmer = sin(dist * 40.0 - t * uCrystalCaveSpeed * 2.0 + angle * facetCount) * 0.5 + 0.5;
  float refractShift = sin(angle * facetCount + dist * 20.0 + t * uCrystalCaveSpeed) * refract * 0.02;
  vec3 crystalInner = facetColor * (0.3 + shimmer * 0.7 + cavityBright * glow * 2.0);
  crystalInner += getPaletteColor(angle / 6.28318) * facetLine * 0.5 * glow;
  crystalInner *= (0.6 + audio * 0.4);
  float specBand = abs(angle + refractShift) / 6.28318 * 63.0;
  float audioCrystal = uSpectrum[int(clamp(specBand, 0.0, 63.0))];
  crystalInner += getPaletteColor(dist * 2.0 + angle / 6.28318) * audioCrystal * glow * 0.3;
  col = mix(col, crystalInner, 1.0 - cavityMask);

  col *= shellMask;
  float rimGlow = smoothstep(outerRadius - 0.03, outerRadius - 0.08, dist) * (1.0 - smoothstep(outerRadius - 0.08, outerRadius, dist));
  col += getPaletteColor(0.8) * rimGlow * glow * 0.3 * (0.8 + audio * 0.2);
  col *= 0.7 + audio * 0.3;
  return col * uCrystalCaveOpacity;
}`,
    mainCall: `  if (uCrystalCaveEnabled > 0.5) color += crystalCave(effectUv, uTime);
`
  },

  {
    id: 'gen-volcano',
    uniforms: `uniform float uVolcanoEnabled;
uniform float uVolcanoOpacity;
uniform float uVolcanoSpeed;
uniform float uVolcanoEruption;
uniform float uVolcanoSmoke;
uniform float uVolcanoLavaFlow;`,
    functions: `vec3 volcano(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float audio = uRms;
  float peak = uPeak;
  float eruption = uVolcanoEruption;
  float smoke = uVolcanoSmoke;
  float lavaFlow = uVolcanoLavaFlow;
  vec3 col = vec3(0.0);
  float mountainWidth = 0.5;
  float mountainHeight = 0.3;
  float craterWidth = 0.06;
  float mountainSlope = mountainHeight / (mountainWidth * 0.5);
  float distFromCenter = abs(centered.x);
  float surfaceY = -0.3;
  if (distFromCenter < mountainWidth * 0.5) {
    float craterDist = abs(distFromCenter);
    if (craterDist > craterWidth) {
      surfaceY = -0.3 + (mountainWidth * 0.5 - craterDist) * mountainSlope;
    } else {
      surfaceY = -0.3 + (mountainWidth * 0.5 - craterWidth) * mountainSlope - (craterWidth - craterDist) * 0.5;
    }
  }
  float isMountain = step(centered.y, surfaceY);
  vec3 rockColor = vec3(0.15, 0.1, 0.08);
  col = rockColor * isMountain;
  if (lavaFlow > 0.1) {
    for (int l = 0; l < 6; l++) {
      float fl = float(l);
      float lavaAngle = fl * 1.047 + sin(fl * 3.0) * 0.3;
      vec2 lavaDir = vec2(cos(lavaAngle), -abs(sin(lavaAngle)));
      float lavaProgress = fract(t * uVolcanoSpeed * 0.1 + fl * 0.17) * lavaFlow;
      vec2 lavaPos = vec2(sin(fl * 2.3) * craterWidth * 0.5, -0.3 + (mountainWidth * 0.5 - craterWidth) * mountainSlope) + lavaDir * lavaProgress * 0.3;
      float lavaDist = length(centered - lavaPos);
      float lavaGlow = 0.003 / (lavaDist * lavaDist + 0.0001);
      float audioLava = uSpectrum[int(mod(fl * 10.0, 64.0))];
      col += vec3(1.0, 0.3, 0.0) * lavaGlow * (0.3 + audioLava * 0.3) * isMountain;
    }
  }
  float eruptionHeight = eruption * (0.3 + peak * 0.2);
  for (int p = 0; p < 20; p++) {
    float fp = float(p);
    float pAngle = (hash21(vec2(fp, floor(t * uVolcanoSpeed * 2.0))) - 0.5) * 1.0;
    float pSpeed = hash21(vec2(floor(t * uVolcanoSpeed * 2.0), fp)) * eruptionHeight;
    float pAge = fract(t * uVolcanoSpeed * 2.0 + fp * 0.05);
    vec2 pPos = vec2(pAngle * pAge, -0.3 + (mountainWidth * 0.5 - craterWidth) * mountainSlope + pSpeed * pAge - pAge * pAge * 0.3);
    float pDist = length(centered - pPos);
    float pGlow = 0.0005 / (pDist * pDist + 0.00001) * (1.0 - pAge);
    col += vec3(1.0, 0.5 + pAge * 0.3, 0.1) * pGlow * eruption;
  }
  if (smoke > 0.1) {
    vec2 smokeUv = vec2(centered.x, centered.y + 0.1) * vec2(1.0, 2.0);
    float smokeNoise = fbm(smokeUv * 2.0 + vec2(0.0, t * uVolcanoSpeed * 0.3));
    float smokeMask = smoothstep(-0.1, 0.15, centered.y + 0.1) * smoke * smokeNoise;
    col = mix(col, vec3(0.15, 0.12, 0.1), smokeMask * 0.6);
  }
  vec3 skyColor = vec3(0.02, 0.01, 0.03);
  col = mix(skyColor, col, step(0.01, isMountain + eruption * 0.5 + smoke * 0.3));
  col *= 0.7 + audio * 0.3;
  return col * uVolcanoOpacity;
}`,
    mainCall: `  if (uVolcanoEnabled > 0.5) color += volcano(effectUv, uTime);
`
  },

];

/** Returns the block for a given generator ID, or null if not found */
export const findGeneratorShaderBlock = (id: string): GeneratorShaderBlock | null =>
  GENERATOR_SHADER_BLOCKS.find(b => b.id === id) ?? null;

