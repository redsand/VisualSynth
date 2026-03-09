
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
    float segment = 6.28318 / floor(2.0 + uKaleidoscope * 6.0);
    angle = mod(angle, segment);
    effectUv = vec2(cos(angle), sin(angle)) * radius * 0.5 + 0.5;
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

  /* @@GENERATOR_CALLS */

  // Apply Chemistry Palette Shift
  if (uChemistryMode > 0.5) {
    float chemShift = sin(uTime * 0.1 + uv.x * 3.0 + uv.y * 2.0) * 0.1;
    if (uChemistryMode > 1.5 && uChemistryMode < 2.5) { // Triadic
      chemShift += 0.333;
    } else if (uChemistryMode > 2.5 && uChemistryMode < 3.5) { // Complementary
      chemShift += 0.5;
    }
    color = palette(fract(chemShift + dot(color, vec3(0.299, 0.587, 0.114)))) * length(color);
  }

  // Apply Expressive Features
  if (uExpressiveEnergyBloom > 0.01) {
    float energy = dot(color, vec3(0.299, 0.587, 0.114));
    float threshold = uExpressiveEnergyThreshold;
    float bloom = smoothstep(threshold, threshold + 0.2, energy);
    color += color * bloom * uExpressiveEnergyBloom * (1.0 + uExpressiveEnergyAccumulation * 2.0);
  }

  if (uExpressiveMotionEcho > 0.01) {
    vec2 motionUv = effectUv + vec2(sin(uv.y * 10.0 + uTime * 2.0), cos(uv.x * 10.0 + uTime * 2.0)) * uExpressiveMotionEcho * 0.05;
    float echo = texture(uPreviousFrame, motionUv).r * uExpressiveMotionEchoDecay;
    color += vec3(echo) * uExpressiveMotionEcho;
  }

  if (uExpressiveSpectralSmear > 0.01) {
    float spectral = uSpectrum[int(clamp(uv.x * 64.0, 0.0, 63.0))];
    vec2 smearUv = uv + vec2((spectral - 0.5) * uExpressiveSpectralMix, 0.0);
    color = mix(color, texture(uPreviousFrame, smearUv).rgb, uExpressiveSpectralSmear);
  }

  // Apply Contrast & Saturation
  color = mix(vec3(0.5), color, 1.0 + uContrast);
  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(gray), color, 1.0 + uSaturation);

  // Apply Strobe
  if (uStrobe > 0.01) {
    float strobePulse = step(0.5, fract(uTime * uStrobe));
    color *= (0.4 + 0.6 * strobePulse);
  }

  // Apply Posterize
  if (uPosterize > 0.01) {
    float levels = 2.0 + floor(uPosterize * 6.0);
    color = floor(color * levels) / levels;
  }

  // Apply Chromatic Aberration
  if (uChroma > 0.01) {
    float chromaAmount = uChroma * 0.01;
    vec2 chromaOffset = vec2(chromaAmount, 0.0);
    float r = texture(uPreviousFrame, uv - chromaOffset).r;
    float g = texture(uPreviousFrame, uv).g;
    float b = texture(uPreviousFrame, uv + chromaOffset).b;
    color = vec3(r, g, b);
  }

  // Apply Blur
  if (uBlur > 0.01) {
    vec2 blurOffset = pixel * uBlur * 2.0;
    vec3 blurColor = vec3(0.0);
    blurColor += texture(uPreviousFrame, uv + blurOffset * vec2(-1, -1)).rgb;
    blurColor += texture(uPreviousFrame, uv + blurOffset * vec2( 1, -1)).rgb;
    blurColor += texture(uPreviousFrame, uv + blurOffset * vec2(-1,  1)).rgb;
    blurColor += texture(uPreviousFrame, uv + blurOffset * vec2( 1,  1)).rgb;
    blurColor *= 0.25;
    color = mix(color, blurColor, uBlur);
  }

  // Apply Bloom
  if (uBloom > 0.01) {
    float brightness = dot(color, vec3(0.299, 0.587, 0.114));
    float bloom = smoothstep(0.7, 1.0, brightness);
    color += color * bloom * uBloom;
  }

  // Engine Grain
  if (uEngineGrain > 0.01) {
    float noise = hash21(uv * uResolution + floor(uTime * 2.0));
    color += (noise - 0.5) * uEngineGrain * 0.1;
  }

  // Engine Vignette
  if (uEngineVignette > 0.01) {
    vec2 centered = uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(centered, centered) * 0.3;
    color *= pow(vignette, 1.0 + uEngineVignette * 2.0);
  }

  // Engine CA (Color Aberration at edges)
  if (uEngineCA > 0.01) {
    vec2 centered = uv * 2.0 - 1.0;
    float edge = length(centered);
    vec2 caOffset = normalize(centered) * uEngineCA * 0.01 * edge;
    color.r = texture(uPreviousFrame, uv + caOffset).r;
    color.b = texture(uPreviousFrame, uv - caOffset).b;
  }

  // Signature Watermark (very subtle)
  if (uEngineSignature > 0.01) {
    vec2 sigUv = uv * 20.0;
    float sig = sin(sigUv.x) * sin(sigUv.y);
    color += vec3(sig * sig * sig * uEngineSignature * 0.02);
  }

  // Apply Persistence/Trails
  if (uPersistence > 0.01) {
    vec3 trailColor = texture(uPreviousFrame, uv).rgb;
    color = mix(color, trailColor, uPersistence);
  }

  // Strobe Pattern Overlay
  if (uStrobeEnabled > 0.5) {
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
  if (uVhsScanlineEnabled > 0.5 && uVhsScanlineMode > 0.5) {
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

  // Final Safety Check: Prevent retina-burning white-out
  float totalLuma = dot(color, vec3(0.299, 0.587, 0.114));
  if (totalLuma > 0.92) {
      color *= (0.92 / totalLuma);
  }

  if (uDebugTint > 0.5) color += vec3(0.02, 0.0, 0.0);
  outColor = vec4(color, 1.0);
}
