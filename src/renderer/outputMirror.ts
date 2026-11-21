// Output MIRROR window.
//
// The output used to be a separate BrowserWindow (output.html) running its own
// full copy of the render pipeline from 18Hz BroadcastChannel state. It could
// never stay in sync: MilkDrop presets advance per rendered frame, so the two
// simulations drifted apart, each cut had to compile shaders a second time
// (~1s output freeze), and the GPU rendered the show twice next to Serato DJ
// (2026-11-20: output seconds behind the preview, "randomly catching up").
//
// The mirror renders the show ONCE. The preview window opens a same-process
// child window (window.open → main's setWindowOpenHandler allows it) and, every
// frame, copies its finished frame (WebGL canvas + overlays) into the child's
// 2D canvas — a GPU-side copy, the same frame on both screens.

import { createOverlayRenderer } from './overlayRenderer';
import type { OverlayConfig } from '../shared/project';

export const OUTPUT_MIRROR_FRAME_NAME = 'visualsynth-output-mirror';
/** Largest output render width the mirror asks the show to render at. */
export const OUTPUT_MIRROR_MAX_RENDER_WIDTH = 1920;

export interface OutputMirror {
  /** Copy the current frame to the output. Returns false once the window closed. */
  present: (source: HTMLCanvasElement) => boolean;
  /** Output drawing-buffer width in device pixels (capped), for render sizing. */
  targetWidth: () => number;
  isOpen: () => boolean;
  close: () => void;
}

export const openOutputMirror = (opts: {
  width: number;
  height: number;
  getOverlays: () => OverlayConfig[];
}): OutputMirror | null => {
  const child = window.open('about:blank', OUTPUT_MIRROR_FRAME_NAME, `width=${opts.width},height=${opts.height}`);
  if (!child) return null;
  let doc: Document;
  try {
    doc = child.document;
  } catch {
    // Not same-origin / not same-process: cannot mirror.
    try { child.close(); } catch { /* ignore */ }
    return null;
  }

  doc.title = 'VisualSynth Output';
  doc.body.style.cssText = 'margin:0;background:#000;overflow:hidden;cursor:none;';
  const frame = doc.createElement('canvas');
  frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;';
  const overlay = doc.createElement('canvas');
  overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;pointer-events:none;';
  doc.body.append(frame, overlay);
  const ctx = frame.getContext('2d', { alpha: false });
  if (!ctx) {
    try { child.close(); } catch { /* ignore */ }
    return null;
  }
  ctx.imageSmoothingQuality = 'high';

  // Overlays are drawn natively at output resolution (crisp text), from the
  // same overlay list the preview draws — never stretched from the preview.
  const overlayRenderer = createOverlayRenderer({
    canvas: overlay,
    getOverlays: opts.getOverlays,
    onOverlayUpdate: () => {},
    onSelect: () => {},
    isDesignMode: () => false
  });

  // F toggles fullscreen from the output window itself (projector use).
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'f' || event.key === 'F') {
      if (doc.fullscreenElement) void doc.exitFullscreen();
      else void doc.documentElement.requestFullscreen?.();
    }
  });

  let closed = false;
  const isOpen = () => !closed && !child.closed;

  const deviceSize = () => {
    const dpr = child.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(child.innerWidth * dpr));
    const h = Math.max(1, Math.floor(child.innerHeight * dpr));
    const scale = w > OUTPUT_MIRROR_MAX_RENDER_WIDTH ? OUTPUT_MIRROR_MAX_RENDER_WIDTH / w : 1;
    return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
  };

  const present = (source: HTMLCanvasElement): boolean => {
    if (!isOpen()) return false;
    const { w, h } = deviceSize();
    if (frame.width !== w || frame.height !== h) {
      frame.width = w;
      frame.height = h;
    }
    // "Cover" fit: fill the output with no bars; crop the excess of whichever
    // axis overflows (preview and output are both ~16:9, so this is ~0).
    const sw = source.width;
    const sh = source.height;
    if (sw > 0 && sh > 0) {
      const scale = Math.max(w / sw, h / sh);
      const cw = w / scale;
      const ch = h / scale;
      ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
    }
    overlayRenderer.draw();
    return true;
  };

  return {
    present,
    targetWidth: () => deviceSize().w,
    isOpen,
    close: () => {
      closed = true;
      overlayRenderer.destroy?.();
      try { child.close(); } catch { /* ignore */ }
    }
  };
};
