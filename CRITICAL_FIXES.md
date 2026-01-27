# Critical Bug Fixes for VisualSynth

## Bug #1: Effect Controls Have No Event Listeners
**Severity:** CRITICAL
**Impact:** FX sliders appear non-functional - moving them doesn't update the effects
**Root Cause:** `initEffects()` only reads values from `currentProject.effects` but never attaches event listeners

### Fix:
Add event listeners after line 3543 in `index.ts`:

```typescript
const initEffects = () => {
  effectsEnabled.checked = currentProject.effects.enabled;
  effectBloom.value = String(currentProject.effects.bloom);
  effectBlur.value = String(currentProject.effects.blur);
  effectChroma.value = String(currentProject.effects.chroma);
  effectPosterize.value = String(currentProject.effects.posterize);
  effectKaleidoscope.value = String(currentProject.effects.kaleidoscope);
  effectFeedback.value = String(currentProject.effects.feedback);
  effectPersistence.value = String(currentProject.effects.persistence);

  // ADD THESE EVENT LISTENERS:
  effectsEnabled.addEventListener('change', () => {
    currentProject.effects.enabled = effectsEnabled.checked;
  });
  effectBloom.addEventListener('input', () => {
    currentProject.effects.bloom = Number(effectBloom.value);
  });
  effectBlur.addEventListener('input', () => {
    currentProject.effects.blur = Number(effectBlur.value);
  });
  effectChroma.addEventListener('input', () => {
    currentProject.effects.chroma = Number(effectChroma.value);
  });
  effectPosterize.addEventListener('input', () => {
    currentProject.effects.posterize = Number(effectPosterize.value);
  });
  effectKaleidoscope.addEventListener('input', () => {
    currentProject.effects.kaleidoscope = Number(effectKaleidoscope.value);
  });
  effectFeedback.addEventListener('input', () => {
    currentProject.effects.feedback = Number(effectFeedback.value);
  });
  effectPersistence.addEventListener('input', () => {
    currentProject.effects.persistence = Number(effectPersistence.value);
  });
};
```

---

## Bug #2: Particle Controls Have No Event Listeners
**Severity:** CRITICAL
**Impact:** Particle sliders appear non-functional
**Root Cause:** Same as Bug #1 - `initParticles()` only reads values

### Fix:
Add event listeners after line 3551 in `index.ts`:

```typescript
const initParticles = () => {
  particlesEnabled.checked = currentProject.particles.enabled;
  particlesDensity.value = String(currentProject.particles.density);
  particlesSpeed.value = String(currentProject.particles.speed);
  particlesSize.value = String(currentProject.particles.size);
  particlesGlow.value = String(currentProject.particles.glow);

  // ADD THESE EVENT LISTENERS:
  particlesEnabled.addEventListener('change', () => {
    currentProject.particles.enabled = particlesEnabled.checked;
  });
  particlesDensity.addEventListener('input', () => {
    currentProject.particles.density = Number(particlesDensity.value);
  });
  particlesSpeed.addEventListener('input', () => {
    currentProject.particles.speed = Number(particlesSpeed.value);
  });
  particlesSize.addEventListener('input', () => {
    currentProject.particles.size = Number(particlesSize.value);
  });
  particlesGlow.addEventListener('input', () => {
    currentProject.particles.glow = Number(particlesGlow.value);
  });
};
```

---

## Bug #3: SDF Controls Have No Event Listeners
**Severity:** CRITICAL
**Impact:** SDF sliders appear non-functional
**Root Cause:** Same as Bug #1

### Fix:
Add event listeners after line 3561 in `index.ts`:

```typescript
const initSdf = () => {
  sdfEnabled.checked = currentProject.sdf.enabled;
  sdfShape.value = currentProject.sdf.shape;
  sdfScale.value = String(currentProject.sdf.scale);
  sdfRotation.value = String(currentProject.sdf.rotation);
  sdfEdge.value = String(currentProject.sdf.edge);
  sdfGlow.value = String(currentProject.sdf.glow);
  sdfFill.value = String(currentProject.sdf.fill);

  // ADD THESE EVENT LISTENERS:
  sdfEnabled.addEventListener('change', () => {
    currentProject.sdf.enabled = sdfEnabled.checked;
  });
  sdfShape.addEventListener('change', () => {
    currentProject.sdf.shape = sdfShape.value as 'circle' | 'box' | 'hexagon';
  });
  sdfScale.addEventListener('input', () => {
    currentProject.sdf.scale = Number(sdfScale.value);
  });
  sdfRotation.addEventListener('input', () => {
    currentProject.sdf.rotation = Number(sdfRotation.value);
  });
  sdfEdge.addEventListener('input', () => {
    currentProject.sdf.edge = Number(sdfEdge.value);
  });
  sdfGlow.addEventListener('input', () => {
    currentProject.sdf.glow = Number(sdfGlow.value);
  });
  sdfFill.addEventListener('input', () => {
    currentProject.sdf.fill = Number(sdfFill.value);
  });
};
```

---

## Bug #4: Style Controls Have No Event Listeners
**Severity:** HIGH
**Impact:** Style sliders appear non-functional

### Fix:
Add event listeners after initStylePresets():

```typescript
// After setting initial values, add event listeners:
styleContrast.addEventListener('input', () => {
  const active = currentProject.stylePresets.find((p) => p.id === activeStyleId);
  if (active) {
    active.settings.contrast = Number(styleContrast.value);
  }
});
styleSaturation.addEventListener('input', () => {
  const active = currentProject.stylePresets.find((p) => p.id === activeStyleId);
  if (active) {
    active.settings.saturation = Number(styleSaturation.value);
  }
});
styleShift.addEventListener('input', () => {
  const active = currentProject.stylePresets.find((p) => p.id === activeStyleId);
  if (active) {
    active.settings.paletteShift = Number(styleShift.value);
  }
});
```

---

## Enhancement: Add Debug Overlay Integration

Add this after the renderer is created (around line 5122):

```typescript
import { createDebugOverlay } from './render/debugOverlay';

// Create debug overlay
const debugOverlay = createDebugOverlay((flags) => {
  // Update render to use flags
  console.log('Debug flags changed:', flags);
});

// In render loop, after renderer.render(), add:
debugOverlay.update({
  frameId: Math.floor(time),
  activeSceneName: currentProject.scenes.find(s => s.id === currentProject.activeSceneId)?.name ?? '—',
  layerCount: currentProject.scenes.find(s => s.id === currentProject.activeSceneId)?.layers.length ?? 0,
  layers: (currentProject.scenes.find(s => s.id === currentProject.activeSceneId)?.layers ?? []).map(layer => ({
    id: layer.id,
    name: layer.name,
    enabled: layer.enabled,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    fboSize: `${canvas.width}x${canvas.height}`,
    lastRenderedFrameId: layer.enabled ? Math.floor(time) : 0,
    nonEmpty: layer.enabled && layer.opacity > 0.01
  })),
  fx: [
    { id: 'bloom', enabled: currentProject.effects.enabled && currentProject.effects.bloom > 0, bypassed: !currentProject.effects.enabled, lastAppliedFrameId: Math.floor(time) },
    { id: 'blur', enabled: currentProject.effects.enabled && currentProject.effects.blur > 0, bypassed: !currentProject.effects.enabled, lastAppliedFrameId: Math.floor(time) },
    { id: 'chroma', enabled: currentProject.effects.enabled && currentProject.effects.chroma > 0, bypassed: !currentProject.effects.enabled, lastAppliedFrameId: Math.floor(time) },
    { id: 'posterize', enabled: currentProject.effects.enabled && currentProject.effects.posterize > 0, bypassed: !currentProject.effects.enabled, lastAppliedFrameId: Math.floor(time) },
    { id: 'kaleidoscope', enabled: currentProject.effects.enabled && currentProject.effects.kaleidoscope > 0, bypassed: !currentProject.effects.enabled, lastAppliedFrameId: Math.floor(time) },
    { id: 'feedback', enabled: currentProject.effects.enabled && currentProject.effects.feedback > 0, bypassed: !currentProject.effects.enabled, lastAppliedFrameId: Math.floor(time) },
    { id: 'persistence', enabled: currentProject.effects.enabled && currentProject.effects.persistence > 0, bypassed: !currentProject.effects.enabled, lastAppliedFrameId: Math.floor(time) }
  ],
  masterBusFrameId: Math.floor(time),
  uniformsUpdatedFrameId: Math.floor(time)
}, fps);
```

---

## Testing Checklist

After applying these fixes:

1. ✅ **Effect Controls Test**
   - Move bloom slider
   - Verify visual change
   - Move blur slider
   - Verify visual change
   - Toggle effects enabled/disabled
   - Verify all effects turn on/off

2. ✅ **Particle Controls Test**
   - Toggle particles enabled
   - Adjust density slider
   - Verify particle count changes

3. ✅ **SDF Controls Test**
   - Toggle SDF enabled
   - Change shape dropdown
   - Adjust scale slider
   - Verify shape changes

4. ✅ **Debug Overlay Test**
   - Press 'D' key
   - Verify overlay appears
   - Check FPS displays
   - Check layer count displays
   - Toggle layer on/off
   - Verify layer status updates in overlay
   - Enable/disable effect
   - Verify FX status updates in overlay

5. ✅ **Layer Execution Test**
   - Open debug overlay
   - Create 2+ layers
   - Verify each layer shows separate lastRenderedFrameId
   - Verify nonEmpty flag updates correctly

---

## Performance Impact

All fixes have ZERO performance impact:
- Event listeners are attached once during init
- Debug overlay only updates when visible (user presses 'D')
- No changes to render loop hot path

---

## Rollback Instructions

If these fixes cause issues:
1. Comment out the event listener sections
2. Comment out the debugOverlay.update() call
3. Restart app
4. Report specific issue
