export type TransitionSource = 'manual' | 'slideshow' | 'auto' | 'preview' | 'recover';

export interface TransitionStepFlags {
  sceneStateSwapped: boolean;
  generatorInitStarted: boolean;
  generatorInitSync: boolean;
  layerStateApplied: boolean;
  shaderProgramSelected: boolean;
  framebufferAllocated: boolean;
  fxGraphRebuilt: boolean;
  uniformsApplied: boolean;
  compositeAttached: boolean;
}

export interface TransitionFrameSample {
  frameIndex: number;
  frameTimestampMs: number;
  drawCallCount: number;
  avgBrightness: number;
  nonBlackRatio: number;
  activeGenerators: string[];
  activeFx: string[];
  asyncPending: boolean;
  pendingGenerators: string[] | null;
  currentProgramGenerators: string[] | null;
}

export interface TransitionRecord {
  seq: number;
  prevSceneId: string | null;
  prevSceneName: string | null;
  nextSceneId: string;
  nextSceneName: string;
  source: TransitionSource;
  timestamp: number;
  steps: TransitionStepFlags;
  frameSamples: TransitionFrameSample[];
  flaggedBlack: boolean;
  fromGenerators: string[];
  toGenerators: string[];
  compilePendingGenerators: string[] | null;
  wasCacheHit: boolean;
  wasAsync: boolean;
  blendTransitionStarted: boolean;
  customBlocksChanged: boolean;
  brightnessRecoveryFrame: number | null;
}

export interface SceneComparisonEntry {
  seq: number;
  source: TransitionSource;
  flaggedBlack: boolean;
  wasCacheHit: boolean;
  wasAsync: boolean;
  blendTransitionStarted: boolean;
  customBlocksChanged: boolean;
  generatorsDiff: string[];
  stepsDiff: string[];
}

export interface SuccessVsFailAnalysis {
  targetSceneId: string;
  targetSceneName: string;
  successCount: number;
  failCount: number;
  differingSteps: string[];
  successSample: SceneComparisonEntry | null;
  failSample: SceneComparisonEntry | null;
}

export interface TransitionDump {
  recentTransitions: TransitionRecord[];
  totalTransitions: number;
  flaggedBlackCount: number;
  lastBlackTransitionSeq: number | null;
  firstBlackPass: number | null;
  lastNonBlackPass: number | null;
  programCacheSize: number;
  asyncCompilationSupported: boolean;
  successVsFailAnalysis: SuccessVsFailAnalysis[];
}

export interface TransitionTracerState {
  programCacheSize: number;
  asyncCompilationSupported: boolean;
}

export interface TransitionTracer {
  beginTransition(params: {
    prevSceneId: string | null;
    prevSceneName: string | null;
    nextSceneId: string;
    nextSceneName: string;
    source: TransitionSource;
    fromGenerators?: string[];
    toGenerators?: string[];
    blendTransitionStarted?: boolean;
    customBlocksChanged?: boolean;
    compilePendingGenerators?: string[] | null;
  }): number;
  recordStep(seq: number, step: keyof TransitionStepFlags, value?: boolean): void;
  recordCompileResult(seq: number, wasCacheHit: boolean, wasAsync: boolean): void;
  setBlendTransitionStarted(seq: number): void;
  recordFrameSample(
    seq: number,
    sample: Omit<TransitionFrameSample, 'frameIndex' | 'frameTimestampMs'> & { asyncPending?: boolean; pendingGenerators?: string[] | null; currentProgramGenerators?: string[] | null }
  ): void;
  getCurrentSeq(): number | null;
  getRecentTransitions(n?: number): TransitionRecord[];
  getDump(state?: TransitionTracerState): TransitionDump;
}

const makeDefaultSteps = (): TransitionStepFlags => ({
  sceneStateSwapped: false,
  generatorInitStarted: false,
  generatorInitSync: false,
  layerStateApplied: false,
  shaderProgramSelected: false,
  framebufferAllocated: false,
  fxGraphRebuilt: false,
  uniformsApplied: false,
  compositeAttached: false
});

const stepsToArray = (steps: TransitionStepFlags): string[] =>
  (Object.keys(steps) as (keyof TransitionStepFlags)[]).filter(k => steps[k]);

const diffSteps = (a: TransitionStepFlags, b: TransitionStepFlags): string[] =>
  (Object.keys(a) as (keyof TransitionStepFlags)[]).filter(k => a[k] !== b[k]);

const buildComparison = (r: TransitionRecord): SceneComparisonEntry => ({
  seq: r.seq,
  source: r.source,
  flaggedBlack: r.flaggedBlack,
  wasCacheHit: r.wasCacheHit,
  wasAsync: r.wasAsync,
  blendTransitionStarted: r.blendTransitionStarted,
  customBlocksChanged: r.customBlocksChanged,
  generatorsDiff: r.toGenerators.filter(g => !r.fromGenerators.includes(g)),
  stepsDiff: stepsToArray(r.steps)
});

export const createTransitionTracer = (maxHistory = 20): TransitionTracer => {
  let globalSeq = 0;
  const history: TransitionRecord[] = [];
  let currentSeq: number | null = null;

  let firstBlackPass: number | null = null;
  let lastNonBlackPass: number | null = null;

  const findRecord = (seq: number): TransitionRecord | undefined =>
    history.find(r => r.seq === seq);

  return {
    beginTransition({
      prevSceneId, prevSceneName, nextSceneId, nextSceneName, source,
      fromGenerators = [], toGenerators = [], blendTransitionStarted = false,
      customBlocksChanged = false, compilePendingGenerators = null
    }) {
      globalSeq++;
      const record: TransitionRecord = {
        seq: globalSeq,
        prevSceneId,
        prevSceneName,
        nextSceneId,
        nextSceneName,
        source,
        timestamp: Date.now(),
        steps: makeDefaultSteps(),
        frameSamples: [],
        flaggedBlack: false,
        fromGenerators,
        toGenerators,
        compilePendingGenerators,
        wasCacheHit: false,
        wasAsync: false,
        blendTransitionStarted,
        customBlocksChanged,
        brightnessRecoveryFrame: null
      };
      history.push(record);
      if (history.length > maxHistory) {
        history.shift();
      }
      currentSeq = globalSeq;
      return globalSeq;
    },

    recordStep(seq, step, value = true) {
      const record = findRecord(seq);
      if (record) {
        (record.steps as Record<string, boolean>)[step] = value;
      }
    },

    setBlendTransitionStarted(seq) {
      const record = findRecord(seq);
      if (record) record.blendTransitionStarted = true;
    },

    recordCompileResult(seq, wasCacheHit, wasAsync) {
      const record = findRecord(seq);
      if (record) {
        record.wasCacheHit = wasCacheHit;
        record.wasAsync = wasAsync;
        if (wasCacheHit) {
          record.steps.generatorInitSync = true;
        } else {
          record.steps.generatorInitSync = !wasAsync;
        }
      }
    },

    recordFrameSample(seq, sample) {
      const record = findRecord(seq);
      if (!record) return;
      const frameIndex = record.frameSamples.length;
      record.frameSamples.push({
        frameIndex,
        frameTimestampMs: Date.now(),
        asyncPending: false,
        pendingGenerators: null,
        currentProgramGenerators: null,
        ...sample
      });

      if (record.brightnessRecoveryFrame === null && sample.avgBrightness >= 0.01 && frameIndex > 0) {
        record.brightnessRecoveryFrame = frameIndex;
      }

      if (sample.avgBrightness < 0.01) {
        if (firstBlackPass === null) firstBlackPass = seq;
      } else {
        lastNonBlackPass = seq;
      }

      if (
        record.steps.generatorInitStarted &&
        record.steps.sceneStateSwapped &&
        sample.drawCallCount > 0 &&
        sample.avgBrightness < 0.01
      ) {
        const blackFrames = record.frameSamples.filter(s => s.avgBrightness < 0.01).length;
        if (blackFrames >= 3) {
          if (!record.flaggedBlack) {
            record.flaggedBlack = true;
            console.warn(
              `[TransitionTracer] Black-output detected on transition #${seq}: ` +
              `${record.prevSceneName ?? 'null'} → ${record.nextSceneName} ` +
              `(source: ${record.source}, cacheHit: ${record.wasCacheHit}, ` +
              `async: ${record.wasAsync}, asyncPending@frame: ${sample.asyncPending ?? false}, ` +
              `pendingGens: [${(sample.pendingGenerators ?? []).join(', ')}], ` +
              `newGens: [${record.toGenerators.filter(g => !record.fromGenerators.includes(g)).join(', ')}])`
            );
          }
        }
      }
    },

    getCurrentSeq() {
      return currentSeq;
    },

    getRecentTransitions(n = 10) {
      return history.slice(-Math.max(1, n));
    },

    getDump(state) {
      const flaggedBlackCount = history.filter(r => r.flaggedBlack).length;
      const lastBlack = [...history].reverse().find(r => r.flaggedBlack);

      const byScene = new Map<string, { name: string; success: TransitionRecord[]; failed: TransitionRecord[] }>();
      for (const r of history) {
        if (!byScene.has(r.nextSceneId)) {
          byScene.set(r.nextSceneId, { name: r.nextSceneName, success: [], failed: [] });
        }
        const bucket = byScene.get(r.nextSceneId)!;
        if (r.flaggedBlack) bucket.failed.push(r);
        else bucket.success.push(r);
      }

      const successVsFailAnalysis: SuccessVsFailAnalysis[] = [];
      for (const [sceneId, { name, success, failed }] of byScene) {
        if (failed.length === 0) continue;
        const successSample = success.length > 0 ? success[success.length - 1] : null;
        const failSample = failed[failed.length - 1];
        const differingSteps = successSample
          ? diffSteps(successSample.steps, failSample.steps)
          : [];
        successVsFailAnalysis.push({
          targetSceneId: sceneId,
          targetSceneName: name,
          successCount: success.length,
          failCount: failed.length,
          differingSteps,
          successSample: successSample ? buildComparison(successSample) : null,
          failSample: buildComparison(failSample)
        });
      }

      return {
        recentTransitions: history.slice(-20),
        totalTransitions: globalSeq,
        flaggedBlackCount,
        lastBlackTransitionSeq: lastBlack?.seq ?? null,
        firstBlackPass,
        lastNonBlackPass,
        programCacheSize: state?.programCacheSize ?? -1,
        asyncCompilationSupported: state?.asyncCompilationSupported ?? false,
        successVsFailAnalysis
      };
    }
  };
};
