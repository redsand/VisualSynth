import type { RenderDebugState } from './RenderGraph';

export interface DebugOverlayFlags {
  tintLayers: boolean;
  fxDelta: boolean;
}

export interface DebugOverlay {
  isEnabled: () => boolean;
  getFlags: () => DebugOverlayFlags;
  update: (state: RenderDebugState, fps: number) => void;
}

export const createDebugOverlay = (onFlagsChange: (flags: DebugOverlayFlags) => void): DebugOverlay => {
  const overlay = document.createElement('div');
  overlay.id = 'debug-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '12px';
  overlay.style.right = '12px';
  overlay.style.width = '340px';
  overlay.style.maxHeight = '80vh';
  overlay.style.overflow = 'auto';
  overlay.style.background = 'rgba(10, 12, 18, 0.9)';
  overlay.style.color = '#e6edf3';
  overlay.style.fontFamily = 'Consolas, Menlo, monospace';
  overlay.style.fontSize = '11px';
  overlay.style.padding = '10px';
  overlay.style.border = '1px solid rgba(255,255,255,0.1)';
  overlay.style.borderRadius = '6px';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'none';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '8px';
  header.textContent = 'Debug Overlay';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '8px';
  controls.style.margin = '6px 0 10px';

  const tintToggle = document.createElement('input');
  tintToggle.type = 'checkbox';
  const tintLabel = document.createElement('label');
  tintLabel.style.display = 'flex';
  tintLabel.style.alignItems = 'center';
  tintLabel.style.gap = '4px';
  tintLabel.appendChild(tintToggle);
  tintLabel.appendChild(document.createTextNode('Layer Tint'));

  const fxToggle = document.createElement('input');
  fxToggle.type = 'checkbox';
  const fxLabel = document.createElement('label');
  fxLabel.style.display = 'flex';
  fxLabel.style.alignItems = 'center';
  fxLabel.style.gap = '4px';
  fxLabel.appendChild(fxToggle);
  fxLabel.appendChild(document.createTextNode('FX Delta'));

  controls.appendChild(tintLabel);
  controls.appendChild(fxLabel);

  const body = document.createElement('pre');
  body.style.whiteSpace = 'pre-wrap';
  body.style.margin = '0';

  overlay.appendChild(header);
  overlay.appendChild(controls);
  overlay.appendChild(body);
  document.body.appendChild(overlay);

  let enabled = false;
  const flags: DebugOverlayFlags = { tintLayers: false, fxDelta: false };
  let lastUpdate = 0;

  const applyFlags = () => {
    flags.tintLayers = tintToggle.checked;
    flags.fxDelta = fxToggle.checked;
    onFlagsChange({ ...flags });
  };

  tintToggle.addEventListener('change', applyFlags);
  fxToggle.addEventListener('change', applyFlags);

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'd') return;
    enabled = !enabled;
    overlay.style.display = enabled ? 'block' : 'none';
  });

  const update = (state: RenderDebugState, fps: number) => {
    if (!enabled) return;
    const now = performance.now();
    if (now - lastUpdate < 120) return;
    lastUpdate = now;
    const lines: string[] = [];
    lines.push(`FPS: ${fps}`);
    lines.push(`Scene: ${state.activeSceneName}`);
    lines.push(`Layers: ${state.layerCount}`);
    state.layers.forEach((layer) => {
      const flags = `${layer.enabled ? 'on' : 'off'} | op=${layer.opacity.toFixed(2)} | ${layer.blendMode}`;
      const fbo = `${layer.fboSize} | last=${layer.lastRenderedFrameId}`;
      const nonEmpty = layer.nonEmpty ? 'nonempty' : 'empty';
      lines.push(`- ${layer.name}: ${flags} | ${nonEmpty} | ${fbo}`);
    });
    lines.push('FX:');
    state.fx.forEach((fx) => {
      const status = fx.enabled ? 'on' : fx.bypassed ? 'bypass' : 'off';
      lines.push(`- ${fx.id}: ${status} | last=${fx.lastAppliedFrameId}`);
    });
    lines.push(`Master: ${state.masterBusFrameId}`);
    lines.push(`Uniforms: ${state.uniformsUpdatedFrameId}`);
    body.textContent = lines.join('\n');
  };

  return {
    isEnabled: () => enabled,
    getFlags: () => ({ ...flags }),
    update
  };
};
