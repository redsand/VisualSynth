# VisualSynth Documentation

## Table of Contents

This directory contains all VisualSynth documentation.

---

## User Documentation

### [User Guide](USER_GUIDE.md)
**Comprehensive guide for users**

Covers everything you need to know about using VisualSynth:
- Getting started and installation
- User interface overview
- All five UI modes explained
- Visual generators (10+ layers)
- Effects and post-processing
- Modulation and automation
- MIDI integration
- Presets and templates
- Output and recording
- Performance and diagnostics
- Troubleshooting
- 8 step-by-step tutorials

**Best for**: New users learning the software, or anyone wanting a complete reference.

---

### [Quick Reference](QUICK_REFERENCE.md)
**At-a-glance reference**

Quick lookup tables for:
- Keyboard shortcuts
- UI modes summary
- All visual generators
- All effects
- Modulation sources
- Preset categories
- Pad actions
- MIDI message types
- Blend modes
- Common troubleshooting

**Best for**: Experienced users who need quick reminders, or printing as a cheat sheet.

---

### [Visual Verification Guide](VISUAL_VERIFICATION_GUIDE.md)
**Feature testing and validation**

Step-by-step verification of every major feature:
- 22 verification sections with 80+ checkpoints
- Screenshot placeholders for each verification
- Expected visual descriptions
- Troubleshooting guidance
- Summary checklist

**Best for**: Testing that VisualSynth is working correctly, verifying updates, or creating screenshot documentation.

---

## Developer Documentation

### [FX System](FX_SYSTEM.md)
**Effect system architecture**

Technical documentation for the effect system:
- Visual Node API
- FX catalog standard
- Generator/Effect/Compositor model
- Resource lifecycle requirements
- Modulation targets
- GPU cost tiers

**Best for**: Developers working on effects, or contributors adding new visual generators.

---

### [UX Reimagination](UX_REIMAGINE.md)
**Product design philosophy**

Design documentation:
- Four-mode architecture rationale
- Product principles
- User experience decisions
- UX screen maps
- Implementation plan

**Best for**: Understanding the design decisions behind VisualSynth, or contributing to UX improvements.

---

### [UX Screen Maps](UX_SCREEN_MAPS.md)
**Detailed UI specifications**

Screen-by-screen UI documentation:
- Each mode's screen layout
- Component specifications
- Interaction patterns
- Visual hierarchy

**Best for**: Implementing new UI features, or understanding existing UI structure.

---

### [UX Implementation Plan](UX_IMPLEMENTATION_PLAN.md)
**Feature implementation roadmap**

Detailed implementation plans for:
- Milestone 1: Core features (completed)
- Milestone 2: Visual system expansion (completed)
- Milestone 3: Modulation & MIDI depth (completed)
- Milestone 4: Output & recording (completed)
- Milestone 5: Collaboration & pro toolkit (completed)

**Best for**: Developers planning new features or understanding the codebase architecture.

---

## JSON Schemas

### [FX Schema](FX_SCHEMA.json)
**Effect system JSON schema**

Defines the structure for:
- Visual nodes
- Parameters
- Connections
- Modulation targets
- GPU cost tiers

**Best for**: Plugin developers creating custom effects.

---

### [Plugin Manifest](PLUGIN_MANIFEST.json)
**Plugin system JSON schema**

Defines the structure for:
- Plugin metadata
- Capabilities
- Entry points
- Asset access rules

**Best for**: Plugin developers creating generators or effects.

---

## Quick Start

**For New Users:**
1. Read [Getting Started](USER_GUIDE.md#getting-started) in the User Guide
2. Try Tutorial 1: Your First Scene
3. Explore presets in Performance mode
4. Use [Quick Reference](QUICK_REFERENCE.md) for keyboard shortcuts

**For Developers:**
1. Read [FX System](FX_SYSTEM.md) for effect architecture
2. Review [UX Implementation Plan](UX_IMPLEMENTATION_PLAN.md) for roadmap
3. Check [projectSchema.ts](../src/shared/projectSchema.ts) for data structures
4. Run tests with `npm test`

---

## Documentation Maintenance

When updating VisualSynth features:

1. **Update the User Guide** if feature usage changes
2. **Update Quick Reference** if shortcuts or controls change
3. **Update Visual Verification Guide** if new features are added
4. **Update FX Schema** if effect system changes
5. **Update this index** if new documentation is added

---

## Contributing

To contribute documentation:

1. Follow existing documentation style
2. Use clear headings and formatting
3. Include code examples where applicable
4. Add screenshots where helpful
5. Update this index when adding new docs

---

**Version**: 2.0
**Last Updated**: 2026-01-27