# VisualSynth User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Interface Overview](#user-interface-overview)
4. [UI Modes](#ui-modes)
5. [Visual Generators](#visual-generators)
6. [Effects & Post-Processing](#effects--post-processing)
7. [Modulation & Automation](#modulation--automation)
8. [MIDI Integration](#midi-integration)
9. [Presets & Templates](#presets--templates)
10. [Output & Recording](#output--recording)
11. [Performance & Diagnostics](#performance--diagnostics)
12. [Troubleshooting](#troubleshooting)
13. [Tutorials](#tutorials)

---

## Introduction

**VisualSynth** is a real-time audio-reactive visual synthesizer designed for live performance, VJing, and creative coding. It responds to audio input and MIDI controllers to generate stunning visual effects synchronized to your music or live sound.

### Key Features
- **GPU-Accelerated Rendering**: WebGL2-based renderer for smooth 60 FPS visuals
- **Audio-Reactive Layers**: Multiple procedural generators that react to sound
- **MIDI Control**: Full support for MIDI controllers with learn mode
- **64-Pad Performance Grid**: Trigger effects and switch scenes on-the-fly
- **Preset Library**: 100+ curated presets covering various musical styles
- **Dual Output**: Preview window and dedicated output for projectors
- **Recording**: Capture your visuals to video files
- **Modulation Matrix**: Route LFOs, envelopes, and audio to any parameter

### System Requirements
- Windows 10/11
- Graphics card supporting WebGL2
- Audio input device (microphone, line-in, or virtual audio)
- MIDI controller (optional but recommended)
- 4GB RAM minimum, 8GB recommended

---

## Getting Started

### Installation
1. Download the VisualSynth installer (`.exe`)
2. Run the installer and follow the prompts
3. Launch VisualSynth from the Start menu

### First Launch
1. **Select Audio Input**: Choose your audio input device from the dropdown in System mode
   - Options: Microphone, Line-in, Virtual Audio Cable (for routing DAW output)
2. **Select MIDI Device**: Connect your MIDI controller and select it from the dropdown
3. **Click "Enable MIDI"** to activate MIDI input
4. **Choose a Preset**: Browse the preset library and click "Add Preset as Scene"

### Quick Start Tutorial
1. Start playing audio on your computer or connect an instrument
2. Load the "Cosmic Plasma" preset
3. Watch the visual output respond to the music
4. Try triggering strobe with pad 32-63 (bank A)
5. Switch to Scene mode to add more layers
6. Experiment with the macros in the right panel

---

## User Interface Overview

### Layout
VisualSynth uses a three-panel layout:

```
+----------------------+--------------------------+----------------------+
|      LEFT PANEL      |       CENTER PANEL       |      RIGHT PANEL     |
|  (Mode-specific)     |   (Canvas + Preview)     |  (Mode-specific)    |
|                      |                          |                      |
| - Scene Strip        |                          | - Macros            |
| - Layers/Generators  |   [Visual Output Here]   | - Presets/Effects   |
| - Effects Controls   |                          | - Recording/Export  |
| - System Settings    |                          | - Modulators        |
+----------------------+--------------------------+----------------------+

TOP BAR:
[Logo] [Performance|Scene|Design|Matrix|System] [BPM] [Transport] [Output] [Health]

STATUS BAR:
Ready | Space: pause | F: fullscreen | R: record | P: screenshot | Ctrl+S save | Ctrl+O open
```

### Top Bar Controls
- **Mode Switcher**: Toggle between Performance, Scene, Design, Matrix, and System modes
- **BPM**: Set or detect tempo (40-240 BPM)
- **Tap**: Tap tempo button for manual BPM entry
- **Pause**: Stop/pause the engine
- **Output**: Switch between Preview and Output window
- **Health Strip**: FPS, Latency, and Watchdog status
- **Summary Chips**: Quick status of mods, FX, and auto features

---

## UI Modes

### Performance Mode

**Purpose**: Live performance with quick access to scenes and pads

**Left Panel Features**:
- **Scene Strip**: View and switch between scenes (Cards or List view)
- **Active Scene Dropdown**: Select the current scene
- **Quantize**: Set scene switch timing (1/4, 1/2, 1 Bar)
- **Queue/Activate Buttons**: Queue scene changes or activate immediately
- **Preset Explorer**: Browse and add presets as scenes

**Right Panel Features**:
- **Macros**: 8 macro controls for real-time parameter manipulation
- **Preset Playlist**: Create and play sequences of presets

**64-Pad Grid**:
- **Bank A (Pads 0-31)**: Toggle Plasma layer on/off
- **Bank A (Pads 32-63)**: Trigger strobe effect
- **Banks B/C/D**: Customizable via Pad Mapping in Design mode

### Scene Mode

**Purpose**: Manage layers and configure scene settings

**Left Panel Features**:
- **Layers List**: Add, remove, reorder, and configure layers
- **Generator Library**: Add new visual generators to the scene

**Right Panel Features**:
- **Style Presets**: Apply color grading presets
- **Visualizers**: Enable audio visualizers (Spectrum, Waveform, Oscilloscope)
- **Capture**: Screenshots and recording
- **Automation Clips**: Add timeline markers

### Design Mode

**Purpose**: Configure global effects, particles, SDF shapes, and assets

**Left Panel Features**:
- **Layer Effects**: Bloom, Blur, Chromatic, Posterize, Kaleidoscope, Feedback, Persistence
- **Color Palette**: Select and apply color palettes
- **Particle Field**: Configure particle density, speed, size, and glow
- **SDF Shapes**: Configure simple and advanced SDF shapes

**Right Panel Features**:
- **Assets**: Import textures, videos, shaders, and add text layers
- **Render Graph**: Visual routing of generators and effects
- **Shader Editor**: Edit GLSL shaders for custom effects
- **Parameter Search**: Find parameters quickly
- **Pad Mapping**: Configure pad actions for each bank

### Matrix Mode

**Purpose**: Set up modulation and MIDI mappings

**Center Panel Features**:
- **Mod Matrix**: Create modulation routings
- **MIDI Mapping**: Map MIDI messages to parameters

**Right Panel Features**:
- **Modulators**: LFOs, Envelopes, Sample & Hold

### System Mode

**Purpose**: Configure devices, project settings, and diagnostics

**Left Panel Features**:
- **Devices**: Audio input and MIDI device selection
- **Project**: Save/load projects and templates
- **Clock**: BPM source, range, and network settings

**Right Panel Features**:
- **Latency Dashboard**: Audio, output, and MIDI latency
- **Performance Guardrails**: Monitor performance status
- **Diagnostics**: FPS, GPU, latency information
- **Output**: Configure output window and resolution
- **Plugins**: Import and manage plugins
- **Project Diff/Merge**: Compare and merge projects

---

## Visual Generators

### Layer Generators

These are the visual layers that compose your scenes:

| Generator ID | Name | Description |
|--------------|------|-------------|
| `layer-plasma` | Shader Plasma | Fluid, organic color patterns |
| `layer-spectrum` | Spectrum Bars | Audio spectrum visualization as bars |
| `layer-origami` | Origami Fold | Paper-fold style geometric patterns |
| `layer-glyph` | Glyph Language | Procedural symbols and characters |
| `layer-crystal` | Crystal Harmonics | Crystal/glass-like formations |
| `layer-inkflow` | Ink Flow | Brush-stroke style ink effects |
| `layer-topo` | Topo Terrain | Topographic map-like terrain |
| `layer-weather` | Audio Weather | Weather effects (rain, snow, clouds) |
| `layer-portal` | Wormhole Portal | Portal/wormhole distortions |
| `layer-oscillo` | Sacred Oscilloscope | Circular oscilloscope patterns |

### Additional Generators

| Generator ID | Name | Description |
|--------------|------|-------------|
| `gen-particles` | Particle Field | GPU-accelerated particle system |
| `gen-sdf` | SDF Shapes (Simple) | Simple SDF shapes (circle, box, triangle) |
| `gen-sdf-scene` | SDF Scene (Advanced) | Advanced SDF scene composition |

### Visualizer Overlays

| Generator ID | Name | Description |
|--------------|------|-------------|
| `viz-off` | Visualizer: Off | No visualizer overlay |
| `viz-spectrum` | Visualizer: Spectrum | Spectrum analyzer overlay |
| `viz-waveform` | Visualizer: Waveform | Waveform display overlay |
| `viz-oscilloscope` | Visualizer: Oscilloscope | Oscilloscope display overlay |

### Adding a Generator

1. Switch to **Scene Mode**
2. In the left panel, find "Generator Library"
3. Select a generator from the dropdown
4. Click "Add Generator"
5. The new layer appears in the Layers list

### Layer Controls

Each layer has the following controls:
- **Enabled Toggle**: Turn layer on/off
- **Opacity**: Layer opacity (0-1)
- **Blend Mode**: How the layer blends with layers below
  - Normal, Add, Multiply, Screen, Overlay, Difference
- **Transform**: Position (X, Y), Scale, Rotation

---

## Effects & Post-Processing

### Layer Effects

These effects are applied globally to all layers:

| Effect | Description | Parameters |
|--------|-------------|------------|
| **Bloom** | Adds glowing highlights | Intensity (0-1) |
| **Blur** | Softens the image | Amount (0-1) |
| **Chroma** | Chromatic aberration (color fringing) | Amount (0-0.5) |
| **Posterize** | Reduces color palette | Amount (0-1) |
| **Kaleidoscope** | Mirrors the image | Amount (0-1), Rotation |
| **Feedback** | Trails from previous frames | Amount (0-1) |
| **Persistence** | Trail decay rate | Amount (0-1) |

### Effect Controls

Access effects in **Design Mode** (left panel):

1. Toggle "Enable Effects" to apply effects
2. Adjust each effect slider in real-time
3. Effects stack in the order listed

### Using Effects Creatively

- **Bloom**: Use for glowing lights, neon effects, dreamy look
- **Blur**: Create depth of field, soft backgrounds
- **Chroma**: Add RGB splitting for glitch effects
- **Posterize**: Create retro/8-bit style visuals
- **Kaleidoscope**: Create symmetric, mandala-like patterns
- **Feedback + Persistence**: Create trails, echo effects
- **Combination**: Stack effects for unique results

---

## Modulation & Automation

### Modulation Sources

#### Audio Sources
- `audio.rms`: Root Mean Square (overall volume)
- `audio.peak`: Peak level
- `audio.low`, `audio.mid`, `audio.high`: Frequency band levels
- `audio.onset`: Beat/onset detection

#### LFOs (Low Frequency Oscillators)
- Waveforms: Sine, Triangle, Saw, Square
- Rate: Speed of oscillation
- Sync: Sync to tempo or free-running
- Phase: Starting phase

#### Envelopes (ADSR)
- Attack: Time to reach maximum
- Decay: Time to decay to sustain
- Sustain: Sustain level
- Release: Time to fade out
- Hold: Hold time before decay
- Trigger: What triggers the envelope (audio.peak, strobe, manual)

#### Sample & Hold
- Rate: How often to sample
- Sync: Sync to tempo
- Smooth: Smoothing between samples

### Mod Matrix

**Location**: Matrix Mode → Center Panel → Mod Matrix

**Creating a Modulation**:
1. Click "Add Mod"
2. Select **Source**: LFO, envelope, audio, etc.
3. Select **Target**: Any parameter (e.g., layer-plasma.speed)
4. Set **Amount**: How much the source affects the target
5. Set **Curve**: Linear, Exponential, or Logarithmic
6. Set **Smoothing**: Smoothness of modulation
7. Set **Min/Max**: Clamp the output range
8. Toggle **Bipolar** to allow negative modulation

**Example Modulations**:
- LFO 1 → Kaleidoscope Rotation
- Audio Peak → Bloom Intensity
- Envelope 1 → Particle Speed
- Audio RMS → Plasma Scale

---

## MIDI Integration

### MIDI Device Setup

1. Switch to **System Mode**
2. Select your MIDI device from the dropdown
3. Click "Enable MIDI"
4. Visual feedback shows MIDI activity

### MIDI Mapping

**Location**: Matrix Mode → Center Panel → MIDI Mapping

**Creating a MIDI Mapping**:
1. Click "Add Mapping"
2. Configure the mapping:
   - **Message**: Note, CC, Aftertouch, Pitchbend
   - **Channel**: MIDI channel (1-16)
   - **Control**: Note number or CC number
   - **Target**: Parameter to control
   - **Mode**: Toggle (on/off), Momentary (while held), Trigger (on press)

### Learn Mode

**Quick MIDI Mapping**:
1. Click any parameter with a `data-learn-target` attribute
2. Move a MIDI control
3. Mapping is created automatically

### Pad Actions

**Location**: Design Mode → Right Panel → Pad Mapping

**Configure Pad Actions**:
1. Select a Bank (A/B/C/D)
2. Click on a pad in the grid
3. Cycle through available actions
4. Save your configuration

**Available Pad Actions**:
- `toggle-plasma` / `toggle-spectrum`: Toggle layers
- `origami-mountain/valley/collapse/explode`: Origami effects
- `gravity-spawn-fixed/audio`: Spawn gravity wells
- `glyph-stack/orbit/explode/sentence`: Glyph effects
- `crystal-seed/grow/fracture/melt`: Crystal effects
- `ink-fine/dry/neon`: Ink effects
- `weather-storm/fog/calm/hurricane`: Weather effects
- `portal-spawn/collapse/transition`: Portal effects
- `oscillo-capture/freeze/rotate`: Oscilloscope effects
- `strobe`: Flash white
- `scene-next/scene-prev`: Switch scenes
- `macro-1` through `macro-8`: Control macros

---

## Presets & Templates

### Preset Categories

VisualSynth includes 100+ presets organized into categories:

- **Essentials** (1-10): Basic, versatile presets
- **VisualSynth DNA** (11-29): Signature looks and effects
- **Generators** (30-44): Single-generator demonstrations
- **SDF Shapes** (100-109): SDF-based presets
- **Advanced** (various): Complex multi-layer scenes

### Using Presets

**Load a Preset**:
1. In Performance mode, find "Preset Explorer"
2. Select a category (optional)
3. Browse the preset list
4. Click "Add Preset as Scene" to add as a new scene

**Preset Navigation**:
- Use "Previous" and "Next" buttons
- Use "Shuffle" for random presets

### Preset Exchange

**Export a Scene**:
1. Switch to Scene mode
2. Click "Export Scene"
3. Save to a `.json` file

**Import a Scene**:
1. Click "Import Scene"
2. Select a `.json` file
3. The scene is added to your project

### Templates

Templates are genre-focused starting points:

- **Ambient**: Slow, atmospheric visuals
- **Cinematic**: Film-like, dramatic visuals
- **Downtempo**: Chill, relaxed visuals
- **Dubstep**: Aggressive, bass-focused
- **Experimental**: Avant-garde, unusual
- **House**: House music oriented
- **Industrial**: Dark, mechanical
- **Psytrance**: Psychedelic, trippy
- **Sunset**: Warm, colorful
- **Techno**: Minimal, repetitive
- **Trance**: Ethereal, uplifting

**Apply a Template**:
1. Switch to System mode
2. Select a template from the dropdown
3. Click "Apply Template"
4. A new project is created based on the template

---

## Output & Recording

### Output Window

**Open Output Window**:
1. Switch to System mode
2. Click "Open Output"
3. Select resolution scale (100%, 75%, 50%, 25%)
4. Toggle "Fullscreen" if needed

**Output Resolution**:
- Default: 1280 x 720
- Scales based on the resolution scale setting
- Can be adjusted for performance

### Recording

**Record Video**:
1. Switch to Scene mode → Right Panel → Capture
2. Select format: WebM or MP4
3. Select FPS: 24, 30, or 60
4. Click "Start Recording"
5. Click "Stop Recording" when done
6. File is saved to your chosen location

**Screenshot**:
1. Click "Screenshot" button
2. Or press `P` key
3. PNG file is saved to your chosen location

### Capture Status

The capture status area shows:
- **Idle**: Not recording
- **Recording**: Currently recording
- **Elapsed time**: Time since recording started

---

## Performance & Diagnostics

### Health Strip

Located in the top bar:
- **FPS**: Current frames per second (target: 60)
- **Latency**: Audio input latency
- **Watchdog**: Performance monitoring status

### Latency Dashboard

**Location**: System Mode → Right Panel → Latency Dashboard

Shows:
- Audio latency from input device
- Output latency to output window
- MIDI event latency

### Performance Guardrails

**Location**: System Mode → Right Panel → Performance Guardrails

Monitors:
- Frame drops
- GPU performance
- Suggests resolution scaling if needed

### Diagnostics Panel

**Location**: System Mode → Right Panel → Diagnostics

Shows:
- FPS: Current frames per second
- GPU: WebGL2 status
- Audio Latency: Input latency
- Output Latency: Output window latency
- MIDI Latency: MIDI event latency
- Watchdog: System health status
- WebGL Diagnostics: GPU information (click to copy)

### Performance Tips

1. **Use Output Scaling**: Lower output resolution if FPS drops
2. **Disable Unnecessary Effects**: Turn off heavy effects like bloom
3. **Reduce Particle Count**: Lower particle density
4. **Use Dedicated Audio**: Use ASIO drivers on Windows for lower latency
5. **Close Background Apps**: Free up GPU and CPU resources
6. **Use Wired Connections**: Avoid Bluetooth MIDI/audio if possible

---

## Troubleshooting

### Common Issues

#### No Audio Response
**Symptom**: Visuals not reacting to audio

**Solutions**:
1. Check audio input is selected in System mode
2. Verify audio is playing on the selected device
3. Check volume levels
4. Try a different audio input device
5. Check if Spectrum toggle is enabled (Performance mode)

#### Low FPS
**Symptom**: Visuals are choppy or slow

**Solutions**:
1. Lower output resolution scale (System mode)
2. Disable bloom and other heavy effects
3. Reduce particle density
4. Close other applications
5. Update graphics drivers

#### MIDI Not Working
**Symptom**: MIDI controller not responding

**Solutions**:
1. Check MIDI device is selected in System mode
2. Click "Enable MIDI"
3. Verify MIDI controller is connected
4. Check MIDI mappings in Matrix mode
5. Try a different USB port

#### Black Screen
**Symptom**: Canvas is completely black

**Solutions**:
1. Check if layers are enabled
2. Check if effect opacity is non-zero
3. Try loading a different preset
4. Check WebGL2 support in Diagnostics
5. Restart the application

#### Recording Issues
**Symptom**: Recording fails or creates invalid files

**Solutions**:
1. Check output folder permissions
2. Try WebM format instead of MP4
3. Lower FPS to 24 or 30
4. Ensure enough disk space
5. Close other recording applications

### Safe Mode

If VisualSynth detects issues, it enters Safe Mode:
- A banner appears at the top
- Effects are disabled
- Basic rendering is maintained
- Check Diagnostics for the specific issue

### Recovery

VisualSynth auto-saves recovery snapshots:
- Every 2 minutes during use
- On boot, checks for recovery file
- Prompts to restore if available

---

## Tutorials

### Tutorial 1: Your First Scene

**Goal**: Create a simple audio-reactive scene from scratch

**Steps**:
1. **Launch VisualSynth** and select your audio input
2. **Create a new blank scene**:
   - Go to Performance mode
   - Click "New Blank Scene"
3. **Add a plasma layer**:
   - Switch to Scene mode
   - In "Generator Library", select "Shader Plasma"
   - Click "Add Generator"
4. **Add a spectrum layer**:
   - Select "Spectrum Bars"
   - Click "Add Generator"
5. **Play some music** and watch the visuals react
6. **Adjust layer opacity**:
   - In the Layers list, adjust opacity sliders
7. **Save your project**:
   - Go to System mode
   - Click "Save"

**Expected Result**: A scene with fluid plasma colors and animated spectrum bars responding to the music.

---

### Tutorial 2: Using Macros

**Goal**: Map a macro to control multiple parameters

**Steps**:
1. **Load the "Cosmic Plasma" preset**
2. **Go to Performance mode** and look at the Macros panel
3. **Adjust Macro 1**:
   - You'll see plasma speed changing
4. **Configure a new macro**:
   - Switch to Scene mode
   - Find the Macros panel in the right panel
   - Click on Macro 5
5. **Add targets to Macro 5**:
   - Click "Add Target"
   - Select `layer-plasma.opacity` as target
   - Set amount to 1
   - Click "Add Target" again
   - Select `layer-spectrum.opacity` as target
   - Set amount to 1
6. **Go back to Performance mode**
7. **Adjust Macro 5**:
   - Both plasma and spectrum opacity should change together

**Expected Result**: A single macro controlling the opacity of both plasma and spectrum layers.

---

### Tutorial 3: Creating a Modulation

**Goal**: Create an LFO that modulates kaleidoscope rotation

**Steps**:
1. **Load a preset with kaleidoscope enabled** (e.g., "Kaleido Shapes")
2. **Switch to Matrix mode**
3. **Configure an LFO**:
   - In the right panel, find LFO 1
   - Set shape to "Sine"
   - Set rate to 0.5
   - Enable "Sync" to BPM
4. **Create a modulation routing**:
   - In the center panel, click "Add Mod"
   - Set Source to "lfo-1"
   - Set Target to "effects.kaleidoscopeRotation"
   - Set Amount to 3.14 (full rotation)
   - Leave other settings as default
5. **Play music** and watch the kaleidoscope rotate smoothly

**Expected Result**: The kaleidoscope automatically rotates in a sine wave pattern, synced to the BPM.

---

### Tutorial 4: MIDI Pad Mapping

**Goal**: Map pads to trigger different effects

**Steps**:
1. **Connect your MIDI controller** and enable MIDI in System mode
2. **Switch to Design mode**
3. **Go to Pad Mapping** (right panel)
4. **Select Bank A**
5. **Click on pad 64** (first pad of Bank B in the grid)
6. **Cycle through actions** until you see "origami-mountain"
7. **Click pad 65** and set to "origami-valley"
8. **Click pad 66** and set to "gravity-spawn-fixed"
9. **Go to Performance mode**
10. **Press the mapped pads** and watch the effects trigger

**Expected Result**: Pressing pad 64 creates mountain folds, pad 65 creates valley folds, and pad 66 spawns a gravity well.

---

### Tutorial 5: Recording Your Visuals

**Goal**: Record a video of your visuals

**Steps**:
1. **Set up your scene** with desired effects
2. **Play your music**
3. **Switch to Scene mode**
4. **Go to Capture panel** (right panel)
5. **Configure recording**:
   - Format: WebM
   - FPS: 30
6. **Click "Start Recording"**
7. **Perform** - switch scenes, trigger effects, etc.
8. **Click "Stop Recording"**
9. **Find your video** in the save location

**Expected Result**: A WebM video file showing your visual performance.

---

### Tutorial 6: Advanced SDF Scene

**Goal**: Create a simple advanced SDF scene

**Steps**:
1. **Switch to Design mode**
2. **Enable SDF Advanced**:
   - Check "Use Advanced Node Scene" in SDF Shapes panel
3. **Click on the SDF Editor** area
4. **Add nodes** (the editor UI will show available nodes):
   - Add a "Circle" node
   - Add a "Box" node
5. **Connect nodes** to combine shapes
6. **Adjust parameters** for each node:
   - Circle radius
   - Box dimensions
   - Position offsets
7. **Go to Performance mode** and see your custom SDF shape

**Expected Result**: A custom SDF shape composed of combined primitives, rendered with full 3D lighting.

---

### Tutorial 7: Creating a Visualizer Set

**Goal**: Set up a playlist of presets for a performance

**Steps**:
1. **Go to Performance mode**
2. **Browse presets** in the Preset Explorer
3. **Add presets to playlist**:
   - Select a preset
   - Click "Add Selected"
   - Repeat for desired presets
4. **Configure playlist**:
   - Set "Slot Sec" to 16 (16 seconds per preset)
   - Set "Fade Sec" to 2 (2 second crossfade)
5. **Start the playlist**:
   - Click "Play"
   - Watch presets cycle automatically
6. **Stop the playlist** when done

**Expected Result**: An automated set that cycles through presets with smooth crossfades.

---

### Tutorial 8: Audio Weather Effects

**Goal**: Create weather that reacts to music intensity

**Steps**:
1. **Load the "Audio Weather" preset**
2. **Switch to Scene mode**
3. **Enable the Weather layer**:
   - Find "Audio Weather" in the Layers list
   - Check the enabled toggle
4. **Switch to Design mode**
5. **Adjust weather parameters**:
   - Mode: "Storm" (rain with lightning)
   - Intensity: 0.7
   - Speed: 1.0
6. **Play bass-heavy music**:
   - Watch rain intensify on bass hits
   - Lightning flashes on peaks
7. **Experiment with other modes**:
   - "Fog" for subtle mist
   - "Calm" for gentle snow
   - "Hurricane" for intense storms

**Expected Result**: Weather effects that dramatically respond to different parts of your music.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Pause/Resume |
| `F` | Toggle fullscreen (output window) |
| `R` | Toggle recording |
| `P` | Take screenshot |
| `Ctrl+S` | Save project |
| `Ctrl+O` | Open project |
| `1-5` | Switch modes (Performance, Scene, Design, Matrix, System) |
| `A/B/C/D` | Switch pad banks |

---

## Tips for Live Performance

1. **Rehearse with your preset playlist** before the show
2. **Use quantization** for scene switches to stay on beat
3. **Map your most-used parameters** to MIDI knobs
4. **Keep backup presets** in case of crashes
5. **Monitor FPS** and be prepared to reduce effects if needed
6. **Use the output window** on a projector or external display
7. **Record your performance** for later review

---

## Further Resources

- **Project Format**: See `src/shared/projectSchema.ts` for technical details
- **Generator Library**: See `src/shared/generatorLibrary.ts` for available generators
- **FX System**: See `docs/FX_SYSTEM.md` for effect system documentation
- **UX Design**: See `docs/UX_REIMAGINE.md` for design philosophy

---

## Getting Help

If you encounter issues not covered in this guide:
1. Check the Diagnostics panel for error information
2. Review the Troubleshooting section
3. Check for Safe Mode banners
4. Try loading a different preset to isolate the issue
5. Restart the application if needed

---

**Version**: 2.0
**Last Updated**: 2026-01-27