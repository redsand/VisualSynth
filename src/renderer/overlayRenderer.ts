/**
 * Overlay Renderer: draws image/text overlays on a 2D canvas
 * and handles drag/resize interaction in Design mode.
 */
import type { OverlayConfig } from '../shared/project';

export interface OverlayRendererOptions {
  canvas: HTMLCanvasElement;
  getOverlays: () => OverlayConfig[];
  onOverlayUpdate: (id: string, changes: Partial<OverlayConfig>) => void;
  onSelect: (id: string | null) => void;
  isDesignMode: () => boolean;
}

interface LoadedImage {
  img: HTMLImageElement;
  path: string;
}

const imageCache = new Map<string, LoadedImage>();

const loadImage = (path: string): HTMLImageElement | null => {
  const cached = imageCache.get(path);
  if (cached && cached.path === path) return cached.img;
  const img = new Image();
  img.src = (path.startsWith('file:') || path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http'))
    ? path
    : `file:///${path.replace(/\\/g, '/')}`;
  img.onload = () => imageCache.set(path, { img, path });
  img.onerror = () => console.warn('[Overlay] Failed to load image:', path);
  imageCache.set(path, { img, path });
  return img;
};

/**
 * Font sizes are authored against the 1280 px reference output width and
 * scaled to whatever canvas they are drawn on. Fixed pixel sizes made text
 * relatively huge on the preview (and clipped in its box) yet small on a
 * 2560 px Retina/fullscreen output — the two windows never matched.
 */
const TEXT_REFERENCE_WIDTH = 1280;

const renderTextCanvas = (overlay: OverlayConfig, w: number, h: number, scale = 1): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const weight = overlay.fontWeight === 'bold' ? 'bold' : 'normal';
  const family = overlay.fontFamily ?? 'sans-serif';
  const text = overlay.text ?? '';
  const lines = text.split('\n');
  // Shrink-to-fit: long now-playing titles/albums must stay inside the box.
  let fontSize = (overlay.fontSize ?? 24) * scale;
  ctx.font = `${weight} ${fontSize}px ${family}`;
  const widest = Math.max(1, ...lines.map((line) => ctx.measureText(line).width));
  const fit = Math.min(1, (w - 8) / widest, (h - 8) / (lines.length * fontSize * 1.2));
  if (fit < 1) {
    fontSize = Math.max(6, fontSize * fit);
    ctx.font = `${weight} ${fontSize}px ${family}`;
  }
  ctx.fillStyle = overlay.fontColor ?? '#ffffff';
  ctx.textBaseline = 'top';
  if (overlay.textShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
  }
  const lineHeight = fontSize * 1.2;
  lines.forEach((line, i) => {
    ctx.fillText(line, 4, 4 + i * lineHeight);
  });
  return c;
};

export const createOverlayRenderer = (opts: OverlayRendererOptions) => {
  const { canvas, getOverlays, onOverlayUpdate, onSelect, isDesignMode } = opts;
  const ctx = canvas.getContext('2d')!;

  let selectedId: string | null = null;
  let dragState: {
    id: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null = null;

  const toCanvas = (nx: number, ny: number) => ({
    cx: nx * canvas.width,
    cy: ny * canvas.height
  });

  const toNorm = (cx: number, cy: number) => ({
    nx: cx / canvas.width,
    ny: cy / canvas.height
  });

  const getOverlayRect = (o: OverlayConfig) => {
    const { cx, cy } = toCanvas(o.x, o.y);
    const w = o.width * canvas.width;
    const h = o.height * canvas.height;
    return { x: cx, y: cy, w, h };
  };

  const hitTest = (mx: number, my: number): { id: string; mode: 'move' | 'resize' } | null => {
    const overlays = getOverlays();
    // Test in reverse order (topmost first)
    for (let i = overlays.length - 1; i >= 0; i--) {
      const o = overlays[i];
      if (!o.enabled) continue;
      const r = getOverlayRect(o);
      // Check resize handle (bottom-right corner, 14px)
      const handleSize = 14;
      if (mx >= r.x + r.w - handleSize && mx <= r.x + r.w + 4 &&
          my >= r.y + r.h - handleSize && my <= r.y + r.h + 4) {
        return { id: o.id, mode: 'resize' };
      }
      // Check body
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        return { id: o.id, mode: 'move' };
      }
    }
    return null;
  };

  const onMouseDown = (e: MouseEvent) => {
    if (!isDesignMode()) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const hit = hitTest(mx, my);
    if (hit) {
      const overlay = getOverlays().find(o => o.id === hit.id);
      if (!overlay) return;
      selectedId = hit.id;
      onSelect(hit.id);
      dragState = {
        id: hit.id,
        mode: hit.mode,
        startX: mx,
        startY: my,
        origX: overlay.x,
        origY: overlay.y,
        origW: overlay.width,
        origH: overlay.height
      };
      e.preventDefault();
    } else {
      selectedId = null;
      onSelect(null);
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragState) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const dx = mx - dragState.startX;
    const dy = my - dragState.startY;

    if (dragState.mode === 'move') {
      const nx = Math.max(0, Math.min(1, dragState.origX + dx / canvas.width));
      const ny = Math.max(0, Math.min(1, dragState.origY + dy / canvas.height));
      onOverlayUpdate(dragState.id, { x: nx, y: ny });
    } else {
      const nw = Math.max(0.02, dragState.origW + dx / canvas.width);
      const nh = Math.max(0.02, dragState.origH + dy / canvas.height);
      onOverlayUpdate(dragState.id, { width: nw, height: nh });
    }
  };

  const onMouseUp = () => {
    if (dragState) {
      canvas.style.cursor = 'default';
      dragState = null;
    }
  };

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  // Update cursor on hover in design mode
  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDesignMode() || dragState) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const hit = hitTest(mx, my);
    if (hit?.mode === 'resize') canvas.style.cursor = 'nwse-resize';
    else if (hit?.mode === 'move') canvas.style.cursor = 'grab';
    else canvas.style.cursor = 'default';
  });

  // Per-frame cost matters here — draw() runs every frame in both windows.
  // Assigning canvas.width/height (even to the same value) reallocates the
  // GPU backing store, and the text path used to build a fresh canvas per
  // overlay per frame; both were measurable with the output at 2560x1440.
  let drewSomethingLastFrame = true;
  const textCache = new Map<string, HTMLCanvasElement>();
  const cachedTextCanvas = (o: OverlayConfig, w: number, h: number) => {
    const scale = canvas.width / TEXT_REFERENCE_WIDTH;
    const key = [o.id, o.text, o.fontSize, o.fontWeight, o.fontFamily, o.fontColor, o.textShadow, w, h, scale.toFixed(3)].join('|');
    let c = textCache.get(key);
    if (!c) {
      for (const k of textCache.keys()) if (k.startsWith(`${o.id}|`)) textCache.delete(k);
      c = renderTextCanvas(o, w, h, scale);
      textCache.set(key, c);
    }
    return c;
  };

  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const targetH = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    const resized = canvas.width !== targetW || canvas.height !== targetH;
    if (resized) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const overlays = getOverlays();
    const anyEnabled = overlays.some((o) => o.enabled);
    if (!anyEnabled && !drewSomethingLastFrame && !resized) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drewSomethingLastFrame = anyEnabled;

    for (const o of overlays) {
      if (!o.enabled) continue;
      // Skip FX-included overlays from this canvas (they'd be in the GL pipeline)
      // For now, render all on the 2D canvas (FX inclusion is a future enhancement)
      const r = getOverlayRect(o);

      ctx.save();
      ctx.globalAlpha = o.opacity;

      if (o.rotation) {
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
        ctx.rotate(o.rotation * Math.PI / 180);
        ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
      }

      if (o.type === 'image' && o.assetPath) {
        const img = loadImage(o.assetPath);
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, r.x, r.y, r.w, r.h);
        }
      } else if (o.type === 'text' && o.text) {
        const textCanvas = cachedTextCanvas(o, Math.max(1, Math.round(r.w)), Math.max(1, Math.round(r.h)));
        ctx.drawImage(textCanvas, r.x, r.y, r.w, r.h);
      }

      ctx.restore();

      // Draw selection handles in design mode
      if (isDesignMode() && o.id === selectedId) {
        ctx.strokeStyle = '#8fd6ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.setLineDash([]);

        // Resize handle bottom-right
        const hs = 10;
        ctx.fillStyle = '#8fd6ff';
        ctx.fillRect(r.x + r.w - hs, r.y + r.h - hs, hs, hs);
      }
    }
  };

  const setSelected = (id: string | null) => {
    selectedId = id;
  };

  const destroy = () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  return { draw, setSelected, destroy };
};
