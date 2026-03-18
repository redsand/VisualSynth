
/* @@PLASMA_DEFINE */
/* @@PLASMA_SOURCE */

void main() {
  vec2 uv = vUv;
  float low = 0.0;
  for (float i = 0.0; i < 8.0; i += 1.0) { low += uSpectrum[int(i)]; }
  low /= 8.0;
  float mid = 0.0;
  for (float i = 8.0; i < 24.0; i += 1.0) { mid += uSpectrum[int(i)]; }
  mid /= 16.0;
  float high = 0.0;
  for (float i = 24.0; i < 64.0; i += 1.0) { high += uSpectrum[int(i)]; }
  high /= 40.0;
  low = pow(low, 1.2);
  mid = pow(mid, 1.1);
  high = pow(high, 1.0);
  vec2 pixel = 1.0 / max(uResolution, vec2(1.0));
  float dither = hash21(floor(uv / pixel));

  // Apply Motion Template Distortion
  if (uMotionTemplate > 0.5 && uMotionTemplate < 1.5) { // Radial
      vec2 centered = uv * 2.0 - 1.0;
      float r = length(centered);
      float a = atan(centered.y, centered.x);

      // Radial Core Semantic: Kick drives compression
      if (uMotionTemplate > 0.9 && uMotionTemplate < 1.1) {
          r *= (1.0 + low * 0.4); // Push outward on kick
      }

      uv = vec2(r, a / 6.2831 + 0.5);
  } else if (uMotionTemplate > 1.5 && uMotionTemplate < 2.5) { // Vortex
      vec2 centered = uv * 2.0 - 1.0;
      float r = length(centered);
      float torque = uTime * 0.2 + mid * 2.5; // Torque driven by mids
      float a = atan(centered.y, centered.x) + r * 3.1415 * (1.0 + sin(torque));
      uv = vec2(cos(a), sin(a)) * r * 0.5 + 0.5;
  } else if (uMotionTemplate > 4.5 && uMotionTemplate < 5.5) { // Organic
      vec2 noiseOffset = vec2(fbm(uv * 2.5 + uTime * 0.15), fbm(uv * 3.0 - uTime * 0.1));
      uv += (noiseOffset - 0.5) * 0.12;
  } else if (uMotionTemplate > 7.5) { // Vapor
      uv.y = 1.0 / (uv.y + 0.5);
      uv.x = (uv.x - 0.5) * uv.y + 0.5;
      uv.y += uTime * 0.05; // Scents of movement
  }

  // Apply Transition Distortion
  if (uTransitionAmount > 0.01) {
    if (uTransitionType > 1.5 && uTransitionType < 2.5) { // Warp
      vec2 centered = uv * 2.0 - 1.0;
      float dist = length(centered);
      float warp = sin(dist * 8.0 - uTime * 2.0) * uTransitionAmount * 0.15;
      uv = (centered * (1.0 + warp)) * 0.5 + 0.5;
    } else if (uTransitionType > 2.5 && uTransitionType < 3.5) { // Glitch
      float glitch = step(0.97, hash21(vec2(floor(uv.y * 50.0), floor(uTime * 5.0))));
      uv.x += glitch * (hash21(vec2(uv.y, uTime)) - 0.5) * uTransitionAmount * 0.1;
    } else if (uTransitionType > 3.5 && uTransitionType < 4.5) { // Dissolve
      float dissolve = hash21(uv + vec2(uTime * 0.5, 0.0));
      uv = mix(uv, hash22(uv + uTime).xy, step(dissolve, uTransitionAmount * 0.8));
    }
  }

  vec2 effectUv = uv;

  // Apply Kaleidoscope
  if (uKaleidoscope > 0.01) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float angle = atan(centered.y, centered.x) + uKaleidoscopeRotation;
    float radius = length(centered);
    float slices = mix(1.0, 8.0, uKaleidoscope);
    float slice = 6.28318 / slices;
    angle = mod(angle, slice);
    angle = abs(angle - slice * 0.5);
    vec2 rotated = vec2(cos(angle), sin(angle)) * radius;
    effectUv = rotated * 0.5 + 0.5;
  }

  // Apply Feedback
  if (uFeedback > 0.01) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float radius = length(centered);
    float angle = atan(centered.y, centered.x);

    angle += uFeedback * radius * 2.0;

    // Explicit rotation
    angle += uFeedbackRotation;

    // Zoom/Scale (Zoom in if zoom > 0)
    float zoomFactor = 1.0 - uFeedbackZoom * 0.5;
    float stretch = 1.0 + uFeedback * 0.5;
    float newRadius = pow(radius * zoomFactor, stretch);

    effectUv = vec2(cos(angle), sin(angle)) * newRadius * 0.5 + 0.5;
  }
  float gravityLens = 0.0;
  float gravityRing = 0.0;
  if (uGravityActive[0] > 0.5 || uGravityActive[1] > 0.5 || uGravityActive[2] > 0.5 || uGravityActive[3] > 0.5 ||
      uGravityActive[4] > 0.5 || uGravityActive[5] > 0.5 || uGravityActive[6] > 0.5 || uGravityActive[7] > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    vec2 warp = vec2(0.0);
    float ringAcc = 0.0;
    float lens = 0.0;
    float tWarp = uTime * (1.0 - clamp(low, 0.0, 1.0) * 0.25);
    for (int i = 0; i < 8; i += 1) {
      if (uGravityActive[i] < 0.5) continue;
      vec2 well = uGravityPos[i];
      vec2 toWell = centered - well;
      float dist = length(toWell) + 1e-4;
      float inv = uGravityStrength[i] / (dist * dist + 0.12);
      float polarity = uGravityPolarity[i];
      vec2 tang = vec2(-toWell.y, toWell.x) / dist;
      warp += (-toWell / dist) * inv * polarity * 0.35;
      warp += tang * inv * (1.0 - abs(polarity)) * 0.15 * sin(tWarp + float(i));
      lens += inv * (0.18 + 0.12 * low);
      ringAcc += smoothstep(0.35, 0.0, abs(dist - 0.45)) * inv;
    }
    warp *= (1.0 + uGravityCollapse * 0.8);
    effectUv = clamp(effectUv + warp * 0.5, 0.0, 1.0);
    gravityLens = lens;
    gravityRing = ringAcc;
  }
  if (uExpressiveRadialGravity > 0.01) {
    vec2 focus = vec2(uExpressiveRadialFocusX, uExpressiveRadialFocusY);
    vec2 toFocus = focus - effectUv;
    float dist = length(toFocus);
    float radius = mix(0.1, 1.2, clamp(uExpressiveRadialRadius, 0.0, 1.0));
    float strength = uExpressiveRadialGravity * clamp(uExpressiveRadialStrength, 0.0, 1.0);
    float falloff = smoothstep(radius, 0.0, dist);
    vec2 pull = normalize(toFocus + 0.0001) * strength * falloff * 0.12;
    effectUv = clamp(effectUv + pull, 0.0, 1.0);
  }
  vec3 color = vec3(0.0);

  // Keep all uPalette uniforms active — GLSL compilers may DCE palette() if only referenced
  // in generator functions. This unconditional write (< 1/1,000,000 contribution) prevents that.
  color += (uPalette[0] + uPalette[1] + uPalette[2] + uPalette[3] + uPalette[4]) * 1e-7;

  /* @@GENERATOR_CALLS */

  if (gravityLens > 0.0 || gravityRing > 0.0) {
    color += vec3(0.08, 0.12, 0.2) * gravityLens + vec3(0.2, 0.35, 0.5) * gravityRing * (0.4 + high);
  }

  float sceneColorEnergy = dot(color, vec3(0.299, 0.587, 0.114));

  // Apply Expressive Features
  if (sceneColorEnergy > 0.001 && uExpressiveEnergyBloom > 0.01) {
    float energy = dot(color, vec3(0.299, 0.587, 0.114));
    float threshold = uExpressiveEnergyThreshold;
    float bloom = smoothstep(threshold, threshold + 0.2, energy);
    color += color * bloom * uExpressiveEnergyBloom * (1.0 + uExpressiveEnergyAccumulation * 2.0);
  }

  if (sceneColorEnergy > 0.001 && uExpressiveMotionEcho > 0.01) {
    vec2 motionUv = effectUv + vec2(sin(uv.y * 10.0 + uTime * 2.0), cos(uv.x * 10.0 + uTime * 2.0)) * uExpressiveMotionEcho * 0.05;
    float echo = texture(uPreviousFrame, motionUv).r * uExpressiveMotionEchoDecay;
    color += vec3(echo) * uExpressiveMotionEcho;
  }

  if (sceneColorEnergy > 0.001 && uExpressiveSpectralSmear > 0.01) {
    float spectral = uSpectrum[int(clamp(uv.x * 64.0, 0.0, 63.0))];
    vec2 smearUv = uv + vec2((spectral - 0.5) * uExpressiveSpectralMix, 0.0);
    color = mix(color, texture(uPreviousFrame, smearUv).rgb, uExpressiveSpectralSmear);
  }

  sceneColorEnergy = dot(color, vec3(0.299, 0.587, 0.114));
  if (sceneColorEnergy > 0.001) {
    color += vec3(uStrobe * 1.5);
    // Audio-reactive tint: scale by existing color so it tints rather than overwrites palette
    color += color * vec3(uPeak * 0.3, uRms * 0.15, uRms * 0.15);
  }

  if (sceneColorEnergy > 0.001 && uEffectsEnabled > 0.5) {
    color += pow(color, vec3(2.0)) * uBloom;
    color = posterize(color, uPosterize);
  }

  if (sceneColorEnergy > 0.001 && uEffectsEnabled > 0.5 && uChroma > 0.01) {
    color = mix(color, vec3(color.r + uChroma * 0.02, color.g, color.b - uChroma * 0.02), 0.3);
  }

  if (sceneColorEnergy > 0.001 && uEffectsEnabled > 0.5 && uBlur > 0.01) {
    color = mix(color, vec3((color.r + color.g + color.b) / 3.0), uBlur * 0.3);
  }

  // Engine Grain
  if (sceneColorEnergy > 0.001 && uEngineGrain > 0.01) {
    float noise = hash21(uv * uResolution + floor(uTime * 2.0));
    color += (noise - 0.5) * uEngineGrain * 0.1;
  }

  // Engine Vignette
  if (sceneColorEnergy > 0.001 && uEngineVignette > 0.01) {
    vec2 centered = uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(centered, centered) * 0.3;
    color *= pow(vignette, 1.0 + uEngineVignette * 2.0);
  }

  // Engine CA (Color Aberration at edges) — blend with current color to preserve palette
  if (sceneColorEnergy > 0.001 && uEngineCA > 0.01) {
    vec2 centered = uv * 2.0 - 1.0;
    float edge = length(centered);
    vec2 caOffset = normalize(centered) * uEngineCA * 0.01 * edge;
    float caBlend = clamp(uEngineCA, 0.0, 1.0);
    color.r = mix(color.r, texture(uPreviousFrame, uv + caOffset).r, caBlend * 0.5);
    color.b = mix(color.b, texture(uPreviousFrame, uv - caOffset).b, caBlend * 0.5);
  }

  // (Engine signature removed — caused visible dot grid on black canvas)

  // Strobe Pattern Overlay
  if (sceneColorEnergy > 0.001 && uStrobeEnabled > 0.5) {
    float strobePhase = fract(uTime * uStrobeRate);
    float strobeWindow = step(strobePhase, uStrobeDutyCycle);
    float audioGate = step(uStrobeThreshold, low);
    if (uStrobeAudioTrigger > 0.5) {
      strobeWindow *= audioGate;
    }
    float strobeBrightness = 1.0 - (strobeWindow * uStrobeOpacity * uStrobeFadeOut);
    if (uStrobeMode > 0.5 && uStrobeMode < 1.5) {
      color *= strobeBrightness;
    } else if (uStrobeMode > 1.5 && uStrobeMode < 2.5) {
      color = mix(color, vec3(1.0), 1.0 - strobeBrightness);
    } else {
      color += (1.0 - strobeBrightness) * 0.5;
    }
    if (uStrobePattern > 0.5) {
      float pattern = step(0.5, sin(uv.x * 20.0 + uTime));
      strobeBrightness = mix(strobeBrightness, 1.0, pattern);
    }
  }

  // Apply VHS Scanline Effect
  if (sceneColorEnergy > 0.001 && uVhsScanlineEnabled > 0.5 && uVhsScanlineMode > 0.5) {
    float scanline = sin(uv.y * uVhsScanlineFrequency * 400.0 + uTime * uVhsScanlineSpeed) * 0.5 + 0.5;
    float scanIntensity = uVhsScanlineIntensity * (0.5 + low * 0.5);
    if (uVhsScanlineMode < 1.5) {
      color *= 1.0 - scanline * scanIntensity;
    } else if (uVhsScanlineMode < 2.5) {
      color += vec3(scanline * scanIntensity * 0.3);
    } else {
      color.r *= 1.0 - scanline * scanIntensity * 0.7;
      color.g *= 1.0 - scanline * scanIntensity * 0.5;
      color.b *= 1.0 - scanline * scanIntensity * 0.3;
    }
    if (uVhsScanlineWarp > 0.01) {
      float warp = sin(uv.y * 100.0 + uTime) * uVhsScanlineWarp * 0.02;
      uv.x += warp;
    }
  }

   // uPalette keep-alive handled by unconditional tiny contribution near line 139.

   // Only apply shiftPalette when NOT in analog mode AND shift is meaningful
   if (uChemistryMode > 0.5 && abs(uPaletteShift) > 0.01) {
     color = shiftPalette(color, uPaletteShift);
   }

   color = applySaturation(color, uSaturation);
   color = applyContrast(color, uContrast);

   // Soft clamp: values ≤ 1 pass through unchanged; HDR values compress smoothly.
   color = color / max(vec3(1.0), color + vec3(0.001));

   color = pow(color, vec3(1.0 / 1.35));

   color *= uGlobalColor;

  if (uDebugTint > 0.5) color += vec3(0.02, 0.0, 0.0);
  outColor = vec4(color, 1.0);
}
