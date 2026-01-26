# VisualSynth FX System Specification

## Objective
Define a production-grade, realtime-safe, GPU-first FX/content system for VisualSynth. This spec targets live performance, music visualization, installations, generative art, and realtime video synthesis. It emphasizes modularity, deterministic/generative modes, and future automation (MIDI/OSC).

## Core Principles
- Realtime-safe (60–120 FPS target)
- GPU-first architecture
- Modular FX graph / node-based thinking
- Audio-reactive by default (optional per node)
- Deterministic + generative modes
- Performance-safe defaults and quality tiers

## Node Model
Each FX/Generator node is defined by:
- id, name, category, type (generator|effect|compositor|utility)
- inputs (textures, buffers, audio bands, parameters)
- outputs (texture, mask, depth, data)
- parameters (name, type, range, default)
- audio modulation slots (source, depth, smoothing)
- performance hints (cost tier, sample count, buffer requirements)

## Execution Model
- Directed acyclic graph (DAG) for safety; feedback handled via explicit Feedback nodes.
- Render targets are ping-ponged to avoid GPU stalls.
- Each node declares buffer requirements (resolution scale, history length).

## Determinism
- Per scene seed (uint32) controls any stochastic nodes.
- Deterministic mode locks seed and temporal sources; generative mode mutates seeds on beat/bar/marker.

## Serialization
- Presets store the node graph + parameters + seed + routing.
- Scenes reference a preset and override parameters.

## FX Catalog Summary (Implementation-Ready)
Categories include:
- Image Manipulation: warp, displacement, chroma, posterize, pixelate, vignette, blur
- Video Manipulation: time stretch, frame blend, datamosh-lite, motion mask
- Procedural: noise fields, SDF worlds, fractals, particle fields
- Geometry/Space: point cloud, raymarch, parallax planes
- Audio Systems: beat LFO, envelope follower, band router
- Feedback/Temporal: multi-tap feedback, directional feedback
- Compositing: blend modes, masking, depth composite
- Generative Content: rule-based, seeded mutation
- ML (optional): optical flow, content-aware distort (disabled by default)

## Performance Tiers
- Low: single-pass, minimal sampling
- Mid: 2-4 samples or 1 history buffer
- High: multi-pass, multiple history buffers, motion fields

## Plugin Integration
Plugins declare their nodes via manifest and can expose multiple nodes.

See docs/FX_SCHEMA.json and docs/PLUGIN_MANIFEST.json for schema references.
