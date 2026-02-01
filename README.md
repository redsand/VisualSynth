# VisualSynth

Realtime audio + MIDI reactive visual synthesizer for live performance and creative coding.

## LLM Implementation Prompt (Keep at Top)
You are the VisualSynth implementation assistant. Build features in small, shippable increments with test coverage where practical. Follow the product principles (one-screen launch, safe defaults, muscle memory, clear feedback, progressive disclosure) and keep performance-first constraints (GPU-first rendering, 60 FPS target, low-latency audio/MIDI). For each feature, produce a clear plan, update documentation, and add or update tests when possible. Avoid breaking the installer pipeline or project format. Prefer deterministic, testable code paths and document any known tradeoffs or limitations.

---

## Overview
VisualSynth is a high-performance visual engine designed for VJs, musicians, and digital artists. It converts audio and MIDI into immersive visual narratives through a multi-layered GPU renderer.

## Core Concepts

### 1. The Scene/Mode System
Visuals are organized into **Scenes**. A Scene represents a specific visual state, including:
- **Layer Stack:** Reorderable generators (Plasma, Spectrum, Origami, etc.).
- **Visual Look:** Specific post-processing effects, particle density, and SDF settings.
- **Macros & Modulation:** Scene-specific control mappings.

**Modes** (Current Architecture) provide high-level visual expressions:
- **Motion Templates:** Pre-defined animation paths (Orbital, Linear, Vortex).
- **Color Palettes:** Curated color schemes applied globally or per scene.
- **Audio Mapping Defaults:** Intelligent defaults for how visuals respond to bass, mids, and highs.
- **Transition Logic:** Seamless switching between expressions via Fades, Crossfades, or Warps.

### 2. Preset System (Version 4)
Presets in VisualSynth represent complete **Performances** or **Scenes**.
- **Performances:** A collection of scenes with narrative structure and playlist sequencing.
- **Scenes:** A single ready-to-perform visual state.
- **Metadata:** Every preset includes intended music styles (e.g., Techno, Ambient) and visual intent tags.

## UI Architecture
The interface is divided into five specialized tabs for progressive disclosure of control:

- **Performance:** Live execution view. Macro-hero controls, 64-pad grid, and scene sequencing.
- **Scene:** Layer management and Scene Inspector. Define the "Look" and automation clips.
- **Design:** The creative lab. Asset management, Shader Editor, and Parameter Search.
- **Matrix:** Modulation Matrix and MIDI Mapping. Connect any source to any target.
- **System:** Device configuration, Project I/O, and Performance Diagnostics.

## Key Features
- **Dual Output Pipeline:** Separate preview operator UI from the dedicated projector output.
- **Low-Latency Audio/MIDI:** Realtime reactivity with built-in latency dashboards.
- **Safe Mode Boot:** Fallback rendering if GPU or audio drivers fail.
- **VisualSynth DNA:** Signature shader generators included by default.

## Getting Started

### Development
```bash
npm install
npm run dev
```

### Build & Distribution
```bash
npm run build   # Compile all assets
npm run dist    # Create Windows NSIS installer
```

## Documentation
- **[Full User Guide](docs/USER_GUIDE.md)**
- **[Quick Reference](docs/QUICK_REFERENCE.md)**
- **[Visual Verification Guide](docs/VISUAL_VERIFICATION_GUIDE.md)**
- **[FX & Shader System](docs/FX_SYSTEM.md)**

---
*VisualSynth is built with Electron, TypeScript, and WebGL2.*