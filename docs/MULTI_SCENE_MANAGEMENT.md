# Multi-Scene Management System

VisualSynth now supports intuitive multi-scene management with modulation-based scene switching. This document explains how to use the new features.

## Overview

The multi-scene system allows you to:
1. **Create scenes from templates** - Pre-configured scene setups for common performance patterns
2. **Duplicate existing scenes** - Quick copy of scene configurations
3. **Assign layers to roles** - Move layers between core, support, and atmosphere roles
4. **Modulate scene transitions** - Use audio, MIDI, or LFOs to trigger scene changes

## Scene Templates

Templates are pre-configured scene setups designed for common EDM performance patterns:

### Available Templates

| Template ID | Name | Category | Intent | Use Case |
|-------------|------|----------|--------|----------|
| `ambient-base` | Ambient Base | ambient-to-drop | ambient | Starting ambient scene, ready for drop transition |
| `drop-scene` | Drop Impact | ambient-to-drop | chaos | High-impact drop scene with aggressive layers |
| `calm-scene` | Calm Minimal | calm-to-chaos | calm | Minimal calm scene for breakdowns |
| `chaos-scene` | Chaos Mode | calm-to-chaos | chaos | Full chaos scene with maximum visual impact |
| `build-scene` | Building Tension | build-to-climax | build | Progressive build scene that increases intensity |
| `climax-scene` | Climax Peak | build-to-climax | pulse | Peak intensity scene with all layers active |

### Scene Pair Templates

For quick two-scene setups:

| Pair ID | Scenes | Description |
|---------|--------|-------------|
| `ambient-drop` | Ambient Base → Drop Impact | Classic EDM structure |
| `calm-chaos` | Calm Minimal → Chaos Mode | Breakdown to full transition |
| `build-climax` | Building Tension → Climax Peak | Progressive build reaching climax |

## Using the API

### Creating Scenes from Templates

```typescript
import { createSceneFromTemplate, SCENE_TEMPLATES } from './shared/sceneTemplates';

// Get a specific template
const template = SCENE_TEMPLATES.find(t => t.id === 'drop-scene');

// Create a scene with custom overrides
const newScene = createSceneFromTemplate(template, {
  name: 'My Custom Drop',
  intent: 'chaos'
});

// Add to project
project.scenes.push(newScene);
```

### Creating Scene Pairs

```typescript
import { createScenePairFromTemplate, SCENE_PAIR_TEMPLATES } from './shared/sceneTemplates';

const pair = SCENE_PAIR_TEMPLATES.find(t => t.id === 'ambient-drop');
const { sceneA, sceneB, modulations } = createScenePairFromTemplate(pair);

project.scenes.push(sceneA, sceneB);
modulations.forEach(mod => project.modMatrix.push(mod));
```

### Scene Modulation Targets

Add scene targets to your modulation matrix:

```typescript
import { createSceneSwitchModulation, SCENE_MODULATION_TARGETS } from './shared/sceneModulation';

// Create a modulation that triggers scene switch on audio peak
const mod = createSceneSwitchModulation('audio.peak', 'scene.next', {
  amount: 0.75,  // Trigger threshold
  enabled: true
});

project.modMatrix.push(mod);
```

### Available Modulation Targets

| Target | Description | Range |
|--------|-------------|-------|
| `scene.next` | Trigger transition to next scene | 0-1 (threshold) |
| `scene.prev` | Trigger transition to previous scene | 0-1 (threshold) |
| `scene.mix` | Crossfade between scenes | 0=scene A, 1=scene B |
| `scene.transition.duration` | Modulate transition speed | 100-3000ms |
| `scene.intent.intensity` | Drive intent-based modulations | 0-1 |

## Scene Panel UI

### Programmatic Usage

```typescript
const scenePanel = createScenePanel({
  store,
  loadPreset: async (path) => { /* ... */ },
  applyScene: (id) => { /* ... */ },
  onSceneCreated: (scene) => {
    console.log('Created scene:', scene.name);
  },
  onScenesUpdated: () => {
    // Refresh UI or save project
  }
});

// Create from template
scenePanel.createSceneFromTemplate('drop-scene');

// Create a scene pair (2 scenes with modulations)
scenePanel.createScenePair('ambient-drop');

// Duplicate existing scene
scenePanel.duplicateScene('scene-1');

// Delete scene
scenePanel.deleteScene('scene-2');

// Move layer to different role
scenePanel.assignLayerToRole('scene-1', 'layer-xyz', 'core');
```

## Modulation Matrix Integration

### Adding Scene Modulations

```typescript
const modPanel = createModulationPanel({
  store,
  armMidiLearn: (target, label) => { /* ... */ }
});

// Add a scene switch modulation
modPanel.addSceneModulation('audio.peak', 'scene.next');

// Add a scene crossfade modulation  
modPanel.addSceneModulation('lfo-1.rate', 'scene.mix');
```

### Common Patterns

#### Audio-Reactive Scene Switching
```typescript
// Switch to next scene on loud audio
modMatrix.push({
  source: 'audio.peak',
  target: 'scene.next',
  amount: 0.7,         // Trigger at 70% audio level
  curve: 'linear',
  smoothing: 0.2,      // Debounce
  min: 0,
  max: 1,
  enabled: true
});
```

#### LFO Scene Crossfade
```typescript
// Smoothly crossfade between scenes with LFO
modMatrix.push({
  source: 'lfo-1.rate',
  target: 'scene.mix',
  amount: 0.5,
  curve: 'linear',
  smoothing: 0,
  bipolar: true,       // -1 to 1 range
  min: 0,
  max: 1,
  enabled: true
});
```

#### Macro-Controlled Scene Blend
```typescript
// Manual control via macro knob
modMatrix.push({
  source: 'macro-1.value',
  target: 'scene.mix',
  amount: 1,
  curve: 'linear',
  smoothing: 0.1,
  min: 0,
  max: 1,
  enabled: true
});
```

## Layer Role Management

Each scene has three layer roles:

- **Core** - Primary visual content (opacity: 1, blendMode: normal)
- **Support** - Secondary elements that enhance core
- **Atmosphere** - Background/subtle effects

### Assigning Layers

```typescript
// Move layer from support to core
scenePanel.assignLayerToRole('scene-1', 'layer-xyz', 'core');

// Move layer to atmosphere
scenePanel.assignLayerToRole('scene-1', 'layer-abc', 'atmosphere');
```

### Layer Role Recommendations

| Role | Opacity | BlendMode | Use Case |
|------|---------|-----------|----------|
| Core | 1.0 | normal | Main visual content, SDF shapes |
| Support | 0.6-0.95 | screen/add | Spectrum bars, reactive elements |
| Atmosphere | 0.3-0.7 | screen/multiply | Background effects, subtle overlays |

## Scene Transitions

### Transition Types

Each scene has transition configuration:

```typescript
scene.transition_in = {
  durationMs: 600,
  curve: 'easeInOut'
};

scene.transition_out = {
  durationMs: 800,
  curve: 'linear'
};
```

### Trigger Types

```typescript
// Manual switching (default)
scene.trigger = { type: 'manual' };

// Time-based auto-switch
scene.trigger = { type: 'time' };
scene.duration = 30000; // 30 seconds

// Audio-triggered switching
scene.trigger = { 
  type: 'audio',
  threshold: 0.7,      // Trigger at 70% audio level
  minIntervalMs: 1200  // Minimum 1.2s between triggers
};
```

## Best Practices

1. **Use Templates for Quick Setup** - Start with pre-built templates and customize
2. **Layer Roles Matter** - Core layers should use `normal` blend mode at full opacity
3. **Scene Pairs for Performance** - Use scene pairs for drop/calm transitions
4. **Modulation Debouncing** - Add smoothing to audio-triggered scene switches
5. **Test Transitions** - Verify transition timing feels natural before performance