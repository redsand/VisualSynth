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

const DEBUG_OVERLAY_BUILD = '2026-02-05T18:00:00Z';

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

  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy';
  copyButton.style.fontSize = '11px';
  copyButton.style.padding = '2px 6px';
  copyButton.style.borderRadius = '4px';
  copyButton.style.border = '1px solid rgba(255,255,255,0.2)';
  copyButton.style.background = 'rgba(255,255,255,0.08)';
  copyButton.style.color = 'inherit';
  copyButton.style.cursor = 'pointer';
  header.appendChild(copyButton);

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
  body.textContent = 'Waiting for render debug...';

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
  copyButton.addEventListener('click', async () => {
    const text = body.textContent ?? '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = 'Copied';
      window.setTimeout(() => {
        copyButton.textContent = 'Copy';
      }, 1200);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(body);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      document.execCommand('copy');
      if (selection) selection.removeAllRanges();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'd') return;
    enabled = !enabled;
    overlay.style.display = enabled ? 'block' : 'none';
    if (enabled && !body.textContent) {
      body.textContent = 'Waiting for render debug...';
    }
  });

  const update = (state: RenderDebugState, fps: number) => {
    if (!enabled) return;
    const now = performance.now();
    if (now - lastUpdate < 120) return;
    lastUpdate = now;
    const lines: string[] = [];
    lines.push(`FPS: ${fps} | DebugBuild: ${DEBUG_OVERLAY_BUILD}`);
    lines.push(`Scene: ${state.activeSceneName} (${state.activeSceneId || '—'})`);
    lines.push(`Mode: ${state.activeModeId || '—'}`);
    lines.push(`Engine: ${state.activeEngineId || '—'}`);
    lines.push(`Palette: ${state.activePaletteId || '—'}`);
    const laser = state.laser ?? {
      enabled: false,
      opacity: 0,
      beamCount: 0,
      beamWidth: 0,
      beamLength: 0,
      glow: 0
    };
    lines.push(
      `Laser: ${laser.enabled ? 'on' : 'off'} | op=${laser.opacity.toFixed(2)} | ` +
        `count=${laser.beamCount} | width=${laser.beamWidth.toFixed(3)} | ` +
        `len=${laser.beamLength.toFixed(2)} | glow=${laser.glow.toFixed(2)} | ` +
        `scene=${laser.present ? 'present' : 'missing'} (${laser.enabledInScene ? 'on' : 'off'})`
    );
    if (laser.idRaw || laser.idBytes) {
      lines.push(`Laser ID raw: "${laser.idRaw}"`);
      lines.push(`Laser ID bytes: ${laser.idBytes || '—'}`);
      lines.push(`Laser ID norm: "${laser.matchNormalized}" vs target "${laser.matchTarget}"`);
    } else {
      lines.push(`Laser ID norm: "—" vs target "${laser.matchTarget}"`);
    }
    lines.push(`Layers: ${state.layerCount}`);
    state.layers.forEach((layer) => {
      const flags = `${layer.enabled ? 'on' : 'off'} | op=${layer.opacity.toFixed(2)} | ${layer.blendMode}`;
      const fbo = `${layer.fboSize} | last=${layer.lastRenderedFrameId}`;
      const nonEmpty = layer.nonEmpty ? 'nonempty' : 'empty';
      const extra = layer.generatorId
        ? ` | gen=${layer.generatorId}`
        : layer.idRaw && layer.idRaw !== layer.id
          ? ` | idRaw=${layer.idRaw}`
          : '';
      lines.push(`- ${layer.name} [${layer.id}]: ${flags} | ${nonEmpty} | ${fbo}${extra}`);
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
