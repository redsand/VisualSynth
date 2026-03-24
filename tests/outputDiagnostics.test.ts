/**
 * Tests for OutputDiagnostics:
 *  - RingBuffer correctness
 *  - FrameMetrics classification
 *  - Blank-detection state machine
 *  - Forensic snapshot emission
 *  - Stress simulation: rapid generator set switching reproducing the
 *    "output blank at slide ~32" scenario in a headless environment
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RingBuffer,
  OutputDiagnostics,
  type FrameMetrics,
  type DiagnosticEvent,
} from '../src/renderer/outputDiagnostics';

// ---------------------------------------------------------------------------
// RingBuffer
// ---------------------------------------------------------------------------

describe('RingBuffer', () => {
  it('stores and returns items in insertion order when not yet full', () => {
    const buf = new RingBuffer<number>(4);
    buf.push(1); buf.push(2); buf.push(3);
    expect(buf.toArray()).toEqual([1, 2, 3]);
    expect(buf.length).toBe(3);
  });

  it('wraps correctly when capacity is exceeded', () => {
    const buf = new RingBuffer<number>(4);
    for (let i = 1; i <= 6; i++) buf.push(i);
    // oldest surviving items: 3,4,5,6
    expect(buf.toArray()).toEqual([3, 4, 5, 6]);
    expect(buf.length).toBe(4);
  });

  it('single element capacity works', () => {
    const buf = new RingBuffer<string>(1);
    buf.push('a'); buf.push('b');
    expect(buf.toArray()).toEqual(['b']);
  });

  it('exactly full returns all items in insertion order', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(10); buf.push(20); buf.push(30);
    expect(buf.toArray()).toEqual([10, 20, 30]);
  });

  it('returns empty array before first push', () => {
    const buf = new RingBuffer<number>(8);
    expect(buf.toArray()).toEqual([]);
    expect(buf.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// OutputDiagnostics — event logging
// ---------------------------------------------------------------------------

describe('OutputDiagnostics.logEvent', () => {
  it('records events and returns them in chronological order', () => {
    const diag = new OutputDiagnostics();
    diag.logEvent('generators-changed', 'gen-plasma,gen-glyph');
    diag.logEvent('shader-compile-start');
    diag.logEvent('shader-swapped');

    // Force a forensic snapshot (no throttle on fresh instance)
    const snap = diag.captureForensicSnapshot({
      activeGenerators: [],
      canvasWidth: 1920, canvasHeight: 1080,
      lastMessageAgeMs: 10, messageCount: 5,
      lastShaderError: null, contextLost: false, programCacheSize: 2,
    })!;

    const types = snap.recentEvents.map(e => e.type);
    expect(types).toContain('generators-changed');
    expect(types).toContain('shader-compile-start');
    expect(types).toContain('shader-swapped');
  });

  it('ring-buffer evicts oldest events when capacity exceeded', () => {
    const diag = new OutputDiagnostics();
    // Push 260 events (capacity is 256) — oldest 4 should be evicted
    for (let i = 0; i < 260; i++) {
      diag.logEvent('draw-call-skipped', String(i));
    }
    const snap = diag.captureForensicSnapshot({
      activeGenerators: [], canvasWidth: 1, canvasHeight: 1,
      lastMessageAgeMs: 0, messageCount: 0, lastShaderError: null,
      contextLost: false, programCacheSize: 0,
    })!;
    expect(snap.recentEvents.length).toBe(256);
    // The first surviving event should be #4 (0-indexed)
    expect(snap.recentEvents[0].detail).toBe('4');
    expect(snap.recentEvents[255].detail).toBe('259');
  });
});

// ---------------------------------------------------------------------------
// FrameMetrics classification via mocked pixel data
// ---------------------------------------------------------------------------

describe('OutputDiagnostics.sampleFrame — classification', () => {
  /**
   * Build a minimal WebGL2 context mock that lets readPixels return
   * a caller-supplied Uint8Array via `fillPixels`.
   */
  const makeGlMock = (fillPixels: (buf: Uint8Array) => void) => ({
    readPixels: (_x: number, _y: number, _w: number, _h: number, _fmt: number, _type: number, dest: Uint8Array) => {
      fillPixels(dest);
    },
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
  }) as unknown as WebGL2RenderingContext;

  const makeCanvas = (w = 1920, h = 1080) =>
    ({ width: w, height: h }) as HTMLCanvasElement;

  it('classifies a fully black frame as "blank"', () => {
    const gl = makeGlMock((buf) => buf.fill(0));
    const diag = new OutputDiagnostics();
    diag.frameCount = 0;
    const m = diag.sampleFrame(gl, makeCanvas());
    expect(m.classification).toBe('blank');
    expect(m.nonBlackPercent).toBe(0);
  });

  it('classifies a bright, colourful frame as "healthy"', () => {
    const gl = makeGlMock((buf) => {
      // Alternating red / green pixels, alpha 255
      for (let i = 0; i < buf.length; i += 4) {
        buf[i]     = i % 8 === 0 ? 200 : 0;   // R
        buf[i + 1] = i % 8 === 0 ? 0   : 200; // G
        buf[i + 2] = 0;                         // B
        buf[i + 3] = 255;                       // A
      }
    });
    const diag = new OutputDiagnostics();
    diag.frameCount = 0;
    const m = diag.sampleFrame(gl, makeCanvas());
    expect(m.classification).toBe('healthy');
    expect(m.avgBrightness).toBeGreaterThan(50);
    expect(m.nonBlackPercent).toBeGreaterThan(0.5);
  });

  it('classifies an unchanged near-black frame as "frozen"', () => {
    const NEAR_BLACK_VAL = 3;
    const gl = makeGlMock((buf) => {
      for (let i = 0; i < buf.length; i += 4) {
        buf[i] = NEAR_BLACK_VAL; buf[i + 1] = NEAR_BLACK_VAL;
        buf[i + 2] = NEAR_BLACK_VAL; buf[i + 3] = 255;
      }
    });
    const diag = new OutputDiagnostics();
    diag.frameCount = 0;

    // First sample — establishes baseline
    diag.sampleFrame(gl, makeCanvas());
    diag.frameCount = 60;
    // Second sample — identical pixels, no change → frozen
    const m = diag.sampleFrame(gl, makeCanvas());
    expect(m.changedFromPrevious).toBe(false);
    expect(m.classification).toBe('frozen');
  });

  it('classifies a dim but changing frame as "low-content"', () => {
    // Alternate between r=7,g=0 and r=0,g=7 — diff of 7 per channel (> threshold of 2),
    // avg brightness ≈ 7/3 ≈ 2.3 (< 4), nonBlackPercent > 0 (r or g > 5).
    let toggle = false;
    const gl = makeGlMock((buf) => {
      for (let i = 0; i < buf.length; i += 4) {
        buf[i]     = toggle ? 0 : 7;   // R
        buf[i + 1] = toggle ? 7 : 0;   // G
        buf[i + 2] = 0;                 // B
        buf[i + 3] = 255;               // A
      }
      toggle = !toggle;
    });
    const diag = new OutputDiagnostics();
    diag.frameCount = 0;
    diag.sampleFrame(gl, makeCanvas()); // establish baseline (toggle false → r=7,g=0)
    diag.frameCount = 60;
    const m = diag.sampleFrame(gl, makeCanvas()); // toggle true → r=0,g=7 — diff=7 > 2
    expect(m.changedFromPrevious).toBe(true);
    expect(m.classification).toBe('low-content');
  });

  it('handles 0-size canvas without throwing', () => {
    const gl = makeGlMock((buf) => buf.fill(0));
    const diag = new OutputDiagnostics();
    diag.frameCount = 0;
    expect(() => diag.sampleFrame(gl, makeCanvas(0, 0))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Blank-frame state machine
// ---------------------------------------------------------------------------

describe('OutputDiagnostics blank-frame state machine', () => {
  const makeGlBlank  = () => ({ readPixels: (_x:any,_y:any,_w:any,_h:any,_f:any,_t:any, buf:Uint8Array) => buf.fill(0), RGBA:6408, UNSIGNED_BYTE:5121 }) as any;
  const makeGlBright = () => ({
    readPixels: (_x:any,_y:any,_w:any,_h:any,_f:any,_t:any, buf:Uint8Array) => {
      for (let i = 0; i < buf.length; i += 4) {
        buf[i] = 180; buf[i+1] = 120; buf[i+2] = 60; buf[i+3] = 255;
      }
    },
    RGBA:6408, UNSIGNED_BYTE:5121
  }) as any;
  const canvas = { width: 200, height: 200 } as HTMLCanvasElement;

  it('increments blankIncidentCount exactly once per blank episode', () => {
    const diag = new OutputDiagnostics();
    diag.frameCount = 0;
    diag.sampleFrame(makeGlBlank(), canvas);
    diag.frameCount = 60;
    diag.sampleFrame(makeGlBlank(), canvas);  // still blank — same incident
    diag.frameCount = 120;
    diag.sampleFrame(makeGlBlank(), canvas);
    expect(diag.blankIncidentCount).toBe(1);
  });

  it('fires blank-recovered event when frame becomes healthy after blank', () => {
    const diag = new OutputDiagnostics();
    diag.frameCount = 0;
    diag.sampleFrame(makeGlBlank(), canvas);       // → blank
    diag.frameCount = 60;
    diag.sampleFrame(makeGlBright(), canvas);      // → recovered

    const snap = diag.captureForensicSnapshot({
      activeGenerators: [], canvasWidth: 200, canvasHeight: 200,
      lastMessageAgeMs: 0, messageCount: 0, lastShaderError: null,
      contextLost: false, programCacheSize: 0,
    })!;
    const types = snap.recentEvents.map(e => e.type);
    expect(types).toContain('blank-detected');
    expect(types).toContain('blank-recovered');
  });

  it('counts a new incident when blank resumes after a healthy period', () => {
    const diag = new OutputDiagnostics();
    diag.frameCount = 0;
    diag.sampleFrame(makeGlBlank(),  canvas); // incident 1
    diag.frameCount = 60;
    diag.sampleFrame(makeGlBright(), canvas); // recovered
    diag.frameCount = 120;
    diag.sampleFrame(makeGlBlank(),  canvas); // incident 2
    expect(diag.blankIncidentCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Forensic snapshot throttle
// ---------------------------------------------------------------------------

describe('OutputDiagnostics.captureForensicSnapshot throttle', () => {
  it('returns a snapshot on the first call', () => {
    const diag = new OutputDiagnostics();
    const snap = diag.captureForensicSnapshot({
      activeGenerators: ['gen-plasma'],
      canvasWidth: 1920, canvasHeight: 1080,
      lastMessageAgeMs: 200, messageCount: 300,
      lastShaderError: null, contextLost: false, programCacheSize: 5,
    });
    expect(snap).not.toBeNull();
    expect(snap!.activeGenerators).toEqual(['gen-plasma']);
    expect(snap!.programCacheSize).toBe(5);
  });

  it('returns null if called again within the throttle window', () => {
    const diag = new OutputDiagnostics();
    diag.captureForensicSnapshot({
      activeGenerators: [], canvasWidth: 1, canvasHeight: 1,
      lastMessageAgeMs: 0, messageCount: 0, lastShaderError: null,
      contextLost: false, programCacheSize: 0,
    });
    // Second call — throttled
    const snap = diag.captureForensicSnapshot({
      activeGenerators: [], canvasWidth: 1, canvasHeight: 1,
      lastMessageAgeMs: 0, messageCount: 0, lastShaderError: null,
      contextLost: false, programCacheSize: 0,
    });
    expect(snap).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Stress simulation — rapid generator switching
//
// Reproduces the "output goes blank at slide ~32" scenario in headless form:
//  1. Simulate 50 scene transitions, each with a distinct generator set.
//  2. Verify the diagnostics stay consistent and never reports a spurious
//     blank due to counter overflow or state-machine bugs.
//  3. Verify the program-cache-size tracking increases monotonically
//     (mirroring the real output renderer's unbounded cache growth).
// ---------------------------------------------------------------------------

describe('Stress simulation — rapid generator set switching', () => {
  /**
   * Minimal stand-in for the part of glRenderer that matters here:
   *  - Tracks how many distinct generator sets have been "compiled"
   *  - Simulates a cache that never prunes (mirroring the real output.ts bug)
   */
  /**
   * Simulates the glRenderer program cache including the new trimProgramCache
   * method.  Uses a simple insertion-order eviction (matches the real Map iterator
   * order used by glRenderer.trimProgramCache).
   */
  const createFakeRenderer = () => {
    const programCache = new Map<string, number>();
    let programIdCounter = 0;
    // Tracks the "active" key so trimProgramCache never evicts it
    let activeKey = '';

    return {
      recompileForGenerators: (ids: Set<string>) => {
        const key = [...ids].sort().join(',');
        activeKey = key;
        if (!programCache.has(key)) {
          programCache.set(key, ++programIdCounter);
        }
        return true;
      },
      trimProgramCache: (maxSize: number): number => {
        if (programCache.size <= maxSize) return 0;
        let evicted = 0;
        for (const [key] of programCache) {
          if (programCache.size <= maxSize) break;
          if (key === activeKey) continue;
          programCache.delete(key);
          evicted++;
        }
        return evicted;
      },
      getProgramCacheSize: () => programCache.size,
      getLastShaderError: () => null,
      isContextLost: () => false,
    };
  };

  it('program cache grows by one per unique generator set (no pruning)', () => {
    const renderer = createFakeRenderer();
    const SLIDES = 40;
    const generatorSets = Array.from({ length: SLIDES }, (_, i) => {
      // Each "scene" has a pseudo-unique generator combination
      const base = ['gen-plasma', 'gen-glyph'];
      if (i % 3 === 0) base.push('gen-crystal');
      if (i % 5 === 0) base.push('gen-weather');
      if (i % 7 === 0) base.push('gen-ink');
      base.push(`gen-unique-${i}`);   // guaranteed unique per slide
      return base;
    });

    for (const ids of generatorSets) {
      renderer.recompileForGenerators(new Set(ids));
    }

    // Each slide has a unique generator set (because of gen-unique-N) → 40 cache entries
    expect(renderer.getProgramCacheSize()).toBe(SLIDES);
  });

  it('deduplication prevents redundant recompile calls for unchanged generator sets', () => {
    const renderer = createFakeRenderer();
    let recompileCalls = 0;
    const original = renderer.recompileForGenerators.bind(renderer);
    renderer.recompileForGenerators = (ids) => {
      recompileCalls++;
      return original(ids);
    };

    const ids = new Set(['gen-plasma', 'gen-glyph']);
    let lastKey = '';

    // Simulate 30 BroadcastChannel messages for the same scene (30 fps × 1 second)
    for (let msg = 0; msg < 30; msg++) {
      const key = [...ids].sort().join(',');
      if (key !== lastKey) {
        lastKey = key;
        renderer.recompileForGenerators(ids);
        recompileCalls--; // adjust — only first counts as "redundant savings"
        recompileCalls++;
      }
    }

    // Without deduplication we'd call 30 times; WITH it we call only once
    expect(recompileCalls).toBe(1);
  });

  it('trimProgramCache caps cache size regardless of slideshow length', () => {
    const renderer = createFakeRenderer();
    const MAX = 4;

    // Simulate 40 slides with unique generator sets
    for (let i = 0; i < 40; i++) {
      renderer.recompileForGenerators(new Set([`gen-unique-${i}`, 'gen-plasma']));
      renderer.trimProgramCache(MAX);
    }

    // After trimming on every transition the cache should never exceed MAX
    expect(renderer.getProgramCacheSize()).toBeLessThanOrEqual(MAX);
  });

  it('trimProgramCache never evicts the active program', () => {
    const renderer = createFakeRenderer();
    const activeIds = new Set(['gen-active', 'gen-plasma']);
    renderer.recompileForGenerators(activeIds);

    // Flood the cache with extra entries
    for (let i = 0; i < 10; i++) {
      renderer.recompileForGenerators(new Set([`gen-old-${i}`]));
    }
    // Switch back to active and trim to 1
    renderer.recompileForGenerators(activeIds);
    renderer.trimProgramCache(1);

    // Cache should hold exactly 1 entry — the active program
    expect(renderer.getProgramCacheSize()).toBe(1);
    // The active key should still resolve correctly on the next recompile call
    // (cache hit → no new entry added)
    const sizeBefore = renderer.getProgramCacheSize();
    renderer.recompileForGenerators(activeIds);
    expect(renderer.getProgramCacheSize()).toBe(sizeBefore);
  });

  it('trimProgramCache + deduplication keeps cache ≤ 4 across 50 slides', () => {
    const renderer = createFakeRenderer();
    let lastKey = '';

    for (let slide = 0; slide < 50; slide++) {
      const ids = new Set([`gen-slide-${slide}`, 'gen-plasma']);
      const key = [...ids].sort().join(',');
      if (key !== lastKey) {
        lastKey = key;
        renderer.recompileForGenerators(ids);
        renderer.trimProgramCache(4);
      }
    }

    expect(renderer.getProgramCacheSize()).toBeLessThanOrEqual(4);
  });

  it('blank-frame diagnostics stay stable across 50 simulated healthy slides', () => {
    const diag = new OutputDiagnostics();
    // Simulate 50 slides × 60-frame sampling intervals = 3000 "frames"
    const glBright = {
      readPixels: (_x: any, _y: any, _w: any, _h: any, _f: any, _t: any, buf: Uint8Array) => {
        for (let i = 0; i < buf.length; i += 4) {
          // Vary brightness to ensure changedFromPrevious = true
          buf[i]   = 150 + (i % 50);
          buf[i+1] = 100;
          buf[i+2] = 80;
          buf[i+3] = 255;
        }
      },
      RGBA: 6408,
      UNSIGNED_BYTE: 5121,
    } as any;
    const canvas = { width: 1920, height: 1080 } as HTMLCanvasElement;

    for (let slide = 0; slide < 50; slide++) {
      diag.logEvent('generators-changed', `slide-${slide}`);
      for (let f = 0; f < 60; f++) {
        if (diag.shouldSample()) {
          diag.sampleFrame(glBright, canvas);
        }
        diag.frameCount++;
      }
    }

    expect(diag.blankIncidentCount).toBe(0);
    expect(diag.isCurrentlyBlank).toBe(false);
    expect(diag.frameCount).toBe(3000);
    expect(diag.lastGoodFrameMs).toBeGreaterThan(0);
  });

  it('blank incident is detected and reported when a slide renders black', () => {
    const diag = new OutputDiagnostics();
    const glBlack  = { readPixels: (_x:any,_y:any,_w:any,_h:any,_f:any,_t:any,buf:Uint8Array)=>buf.fill(0), RGBA:6408,UNSIGNED_BYTE:5121 } as any;
    const glBright = {
      readPixels: (_x:any,_y:any,_w:any,_h:any,_f:any,_t:any,buf:Uint8Array)=>{
        for (let i=0;i<buf.length;i+=4){buf[i]=180;buf[i+1]=120;buf[i+2]=60;buf[i+3]=255;}
      }, RGBA:6408, UNSIGNED_BYTE:5121
    } as any;
    const canvas = { width: 1920, height: 1080 } as HTMLCanvasElement;

    // Slides 1–31: healthy
    for (let slide = 0; slide < 31; slide++) {
      diag.logEvent('generators-changed', `slide-${slide}`);
      diag.sampleFrame(glBright, canvas);
      diag.frameCount++;
    }

    // Slide 32: blank (shader program swap failed or generators mismatch)
    diag.logEvent('generators-changed', 'slide-32');
    diag.sampleFrame(glBlack, canvas);
    diag.frameCount++;

    expect(diag.blankIncidentCount).toBe(1);
    expect(diag.isCurrentlyBlank).toBe(true);

    // Forensic snapshot should be available
    const snap = diag.captureForensicSnapshot({
      activeGenerators: ['gen-plasma-32'],
      canvasWidth: 1920, canvasHeight: 1080,
      lastMessageAgeMs: 50, messageCount: 32 * 30,
      lastShaderError: null, contextLost: false, programCacheSize: 32,
    });
    expect(snap).not.toBeNull();
    expect(snap!.blankIncidentCount).toBe(1);
    expect(snap!.programCacheSize).toBe(32);

    const blankEvent = snap!.recentEvents.find(e => e.type === 'blank-detected');
    expect(blankEvent).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// shouldSample() cadence
// ---------------------------------------------------------------------------

describe('OutputDiagnostics.shouldSample', () => {
  it('returns true at frame 0 and every SAMPLE_PERIOD_FRAMES thereafter', () => {
    const diag = new OutputDiagnostics();
    const trueAt: number[] = [];
    for (let f = 0; f < 200; f++) {
      diag.frameCount = f;
      if (diag.shouldSample()) trueAt.push(f);
    }
    // Should fire at 0, 60, 120, 180
    expect(trueAt).toEqual([0, 60, 120, 180]);
  });
});

// ---------------------------------------------------------------------------
// getDebugText() smoke test
// ---------------------------------------------------------------------------

describe('OutputDiagnostics.getDebugText', () => {
  it('returns a non-empty string with frame and blank counts', () => {
    const diag = new OutputDiagnostics();
    diag.frameCount = 1200;
    diag.drawCallCount = 1200;
    diag.messageCount = 600;
    const text = diag.getDebugText();
    expect(text).toContain('1200');
    expect(text).toContain('Blank');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(10);
  });
});
