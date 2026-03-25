import { describe, expect, it } from 'vitest';
import { createTransitionTracer } from '../src/renderer/render/transitionTracer';

describe('TransitionTracer', () => {
  it('records a transition with correct metadata', () => {
    const tracer = createTransitionTracer();
    const seq = tracer.beginTransition({
      prevSceneId: 'scene-a',
      prevSceneName: 'Scene A',
      nextSceneId: 'scene-b',
      nextSceneName: 'Scene B',
      source: 'manual'
    });
    expect(seq).toBe(1);
    const recent = tracer.getRecentTransitions(1);
    expect(recent).toHaveLength(1);
    expect(recent[0].seq).toBe(1);
    expect(recent[0].prevSceneId).toBe('scene-a');
    expect(recent[0].nextSceneId).toBe('scene-b');
    expect(recent[0].source).toBe('manual');
  });

  it('records per-step flags', () => {
    const tracer = createTransitionTracer();
    const seq = tracer.beginTransition({
      prevSceneId: null,
      prevSceneName: null,
      nextSceneId: 'scene-1',
      nextSceneName: 'S1',
      source: 'slideshow'
    });
    tracer.recordStep(seq, 'sceneStateSwapped');
    tracer.recordStep(seq, 'generatorInitStarted');
    tracer.recordStep(seq, 'shaderProgramSelected');

    const record = tracer.getRecentTransitions(1)[0];
    expect(record.steps.sceneStateSwapped).toBe(true);
    expect(record.steps.generatorInitStarted).toBe(true);
    expect(record.steps.shaderProgramSelected).toBe(true);
    expect(record.steps.uniformsApplied).toBe(false);
  });

  it('does not flag bright frames as black', () => {
    const tracer = createTransitionTracer();
    const seq = tracer.beginTransition({
      prevSceneId: 'a',
      prevSceneName: 'A',
      nextSceneId: 'b',
      nextSceneName: 'B',
      source: 'auto'
    });
    tracer.recordStep(seq, 'sceneStateSwapped');
    tracer.recordStep(seq, 'generatorInitStarted');
    for (let i = 0; i < 5; i++) {
      tracer.recordFrameSample(seq, {
        drawCallCount: 1,
        avgBrightness: 0.35,
        nonBlackRatio: 0.8,
        activeGenerators: ['gen-plasma'],
        activeFx: ['bloom']
      });
    }
    const record = tracer.getRecentTransitions(1)[0];
    expect(record.flaggedBlack).toBe(false);
    expect(record.frameSamples).toHaveLength(5);
  });

  it('flags transitions with 3+ black frames as black-output bug', () => {
    const tracer = createTransitionTracer();
    const seq = tracer.beginTransition({
      prevSceneId: 'a',
      prevSceneName: 'A',
      nextSceneId: 'b',
      nextSceneName: 'B',
      source: 'manual'
    });
    tracer.recordStep(seq, 'sceneStateSwapped');
    tracer.recordStep(seq, 'generatorInitStarted');
    for (let i = 0; i < 3; i++) {
      tracer.recordFrameSample(seq, {
        drawCallCount: 1,
        avgBrightness: 0.0,
        nonBlackRatio: 0.0,
        activeGenerators: ['gen-lightning'],
        activeFx: []
      });
    }
    const record = tracer.getRecentTransitions(1)[0];
    expect(record.flaggedBlack).toBe(true);
  });

  it('does not flag if init steps are missing (no draw calls = different failure mode)', () => {
    const tracer = createTransitionTracer();
    const seq = tracer.beginTransition({
      prevSceneId: 'a',
      prevSceneName: 'A',
      nextSceneId: 'b',
      nextSceneName: 'B',
      source: 'recover'
    });
    for (let i = 0; i < 5; i++) {
      tracer.recordFrameSample(seq, {
        drawCallCount: 0,
        avgBrightness: 0.0,
        nonBlackRatio: 0.0,
        activeGenerators: [],
        activeFx: []
      });
    }
    const record = tracer.getRecentTransitions(1)[0];
    expect(record.flaggedBlack).toBe(false);
  });

  it('keeps only the last maxHistory transitions', () => {
    const tracer = createTransitionTracer(3);
    for (let i = 0; i < 5; i++) {
      tracer.beginTransition({
        prevSceneId: null,
        prevSceneName: null,
        nextSceneId: `scene-${i}`,
        nextSceneName: `Scene ${i}`,
        source: 'manual'
      });
    }
    const recent = tracer.getRecentTransitions(10);
    expect(recent).toHaveLength(3);
    expect(recent[0].nextSceneId).toBe('scene-2');
    expect(recent[2].nextSceneId).toBe('scene-4');
  });

  it('getDump returns correct counts', () => {
    const tracer = createTransitionTracer();

    const seq1 = tracer.beginTransition({
      prevSceneId: null,
      prevSceneName: null,
      nextSceneId: 'scene-1',
      nextSceneName: 'Scene 1',
      source: 'manual'
    });
    tracer.recordStep(seq1, 'sceneStateSwapped');
    tracer.recordStep(seq1, 'generatorInitStarted');
    for (let i = 0; i < 3; i++) {
      tracer.recordFrameSample(seq1, { drawCallCount: 1, avgBrightness: 0, nonBlackRatio: 0, activeGenerators: [], activeFx: [] });
    }

    const seq2 = tracer.beginTransition({
      prevSceneId: 'scene-1',
      prevSceneName: 'Scene 1',
      nextSceneId: 'scene-2',
      nextSceneName: 'Scene 2',
      source: 'slideshow'
    });
    tracer.recordStep(seq2, 'sceneStateSwapped');
    tracer.recordStep(seq2, 'generatorInitStarted');
    for (let i = 0; i < 5; i++) {
      tracer.recordFrameSample(seq2, { drawCallCount: 1, avgBrightness: 0.5, nonBlackRatio: 0.9, activeGenerators: [], activeFx: [] });
    }

    const dump = tracer.getDump();
    expect(dump.totalTransitions).toBe(2);
    expect(dump.flaggedBlackCount).toBe(1);
    expect(dump.lastBlackTransitionSeq).toBe(seq1);
    expect(dump.recentTransitions).toHaveLength(2);
  });

  it('getCurrentSeq returns the latest transition seq', () => {
    const tracer = createTransitionTracer();
    expect(tracer.getCurrentSeq()).toBeNull();
    const seq = tracer.beginTransition({
      prevSceneId: null,
      prevSceneName: null,
      nextSceneId: 'x',
      nextSceneName: 'X',
      source: 'preview'
    });
    expect(tracer.getCurrentSeq()).toBe(seq);
  });

  it('captures shader variant mismatch as the differing init step for black output', () => {
    const tracer = createTransitionTracer();
    const seq = tracer.beginTransition({
      prevSceneId: 'scene-a',
      prevSceneName: 'Scene A',
      nextSceneId: 'scene-b',
      nextSceneName: 'Scene B',
      source: 'slideshow',
      expectedShaderVariantKey: 'scene-b::expected'
    });
    tracer.recordStep(seq, 'sceneStateSwapped');
    tracer.recordStep(seq, 'generatorInitStarted');
    tracer.recordStep(seq, 'shaderProgramSelected');
    for (let i = 0; i < 3; i++) {
      tracer.recordFrameSample(seq, {
        drawCallCount: 1,
        avgBrightness: 0,
        nonBlackRatio: 0,
        activeGenerators: ['gen-plasma'],
        activeFx: ['bloom'],
        currentShaderVariantKey: 'scene-a::stale'
      });
    }

    const dump = tracer.getDump();
    expect(dump.flaggedBlackCount).toBe(1);
    expect(dump.successVsFailAnalysis[0]?.failSample?.suspectedDifferingInitStep).toBe('shaderProgramSelected');
  });
});
