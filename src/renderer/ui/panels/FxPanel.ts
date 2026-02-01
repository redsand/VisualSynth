import type { Store } from '../../state/store';
import { actions } from '../../state/actions';

export interface FxPanelApi {
  syncFromProject: () => void;
}

export interface FxPanelDeps {
  store: Store;
  armFxDelta: (id: 'bloom' | 'blur' | 'chroma' | 'posterize' | 'kaleidoscope' | 'feedback' | 'persistence') => void;
}

export const createFxPanel = ({ store, armFxDelta }: FxPanelDeps): FxPanelApi => {
  const effectsEnabled = document.getElementById('effects-enabled') as HTMLInputElement;
  const effectBloom = document.getElementById('effect-bloom') as HTMLInputElement;
  const effectBlur = document.getElementById('effect-blur') as HTMLInputElement;
  const effectChroma = document.getElementById('effect-chroma') as HTMLInputElement;
  const effectPosterize = document.getElementById('effect-posterize') as HTMLInputElement;
  const effectKaleidoscope = document.getElementById('effect-kaleidoscope') as HTMLInputElement;
  const effectFeedback = document.getElementById('effect-feedback') as HTMLInputElement;
  const effectPersistence = document.getElementById('effect-persistence') as HTMLInputElement;
  const expressiveEnergyEnabled = document.getElementById('expressive-energy-enabled') as HTMLInputElement;
  const expressiveEnergyMacro = document.getElementById('expressive-energy-macro') as HTMLInputElement;
  const expressiveEnergyIntentEnabled = document.getElementById('expressive-energy-intent-enabled') as HTMLInputElement;
  const expressiveEnergyIntent = document.getElementById('expressive-energy-intent') as HTMLSelectElement;
  const expressiveEnergyIntentAmount = document.getElementById('expressive-energy-intent-amount') as HTMLInputElement;
  const expressiveEnergyThreshold = document.getElementById('expressive-energy-threshold') as HTMLInputElement;
  const expressiveEnergyAccumulation = document.getElementById('expressive-energy-accumulation') as HTMLInputElement;
  const expressiveRadialEnabled = document.getElementById('expressive-radial-enabled') as HTMLInputElement;
  const expressiveRadialMacro = document.getElementById('expressive-radial-macro') as HTMLInputElement;
  const expressiveRadialIntentEnabled = document.getElementById('expressive-radial-intent-enabled') as HTMLInputElement;
  const expressiveRadialIntent = document.getElementById('expressive-radial-intent') as HTMLSelectElement;
  const expressiveRadialIntentAmount = document.getElementById('expressive-radial-intent-amount') as HTMLInputElement;
  const expressiveRadialStrength = document.getElementById('expressive-radial-strength') as HTMLInputElement;
  const expressiveRadialRadius = document.getElementById('expressive-radial-radius') as HTMLInputElement;
  const expressiveRadialFocusX = document.getElementById('expressive-radial-focus-x') as HTMLInputElement;
  const expressiveRadialFocusY = document.getElementById('expressive-radial-focus-y') as HTMLInputElement;
  const expressiveEchoEnabled = document.getElementById('expressive-echo-enabled') as HTMLInputElement;
  const expressiveEchoMacro = document.getElementById('expressive-echo-macro') as HTMLInputElement;
  const expressiveEchoIntentEnabled = document.getElementById('expressive-echo-intent-enabled') as HTMLInputElement;
  const expressiveEchoIntent = document.getElementById('expressive-echo-intent') as HTMLSelectElement;
  const expressiveEchoIntentAmount = document.getElementById('expressive-echo-intent-amount') as HTMLInputElement;
  const expressiveEchoDecay = document.getElementById('expressive-echo-decay') as HTMLInputElement;
  const expressiveEchoWarp = document.getElementById('expressive-echo-warp') as HTMLInputElement;
  const expressiveSmearEnabled = document.getElementById('expressive-smear-enabled') as HTMLInputElement;
  const expressiveSmearMacro = document.getElementById('expressive-smear-macro') as HTMLInputElement;
  const expressiveSmearIntentEnabled = document.getElementById('expressive-smear-intent-enabled') as HTMLInputElement;
  const expressiveSmearIntent = document.getElementById('expressive-smear-intent') as HTMLSelectElement;
  const expressiveSmearIntentAmount = document.getElementById('expressive-smear-intent-amount') as HTMLInputElement;
  const expressiveSmearOffset = document.getElementById('expressive-smear-offset') as HTMLInputElement;
  const expressiveSmearMix = document.getElementById('expressive-smear-mix') as HTMLInputElement;

  const particlesEnabled = document.getElementById('particles-enabled') as HTMLInputElement;
  const particlesDensity = document.getElementById('particles-density') as HTMLInputElement;
  const particlesSpeed = document.getElementById('particles-speed') as HTMLInputElement;
  const particlesSize = document.getElementById('particles-size') as HTMLInputElement;
  const particlesGlow = document.getElementById('particles-glow') as HTMLInputElement;

  const sdfEnabled = document.getElementById('sdf-enabled') as HTMLInputElement;
  const sdfShape = document.getElementById('sdf-shape') as HTMLSelectElement;
  const sdfScale = document.getElementById('sdf-scale') as HTMLInputElement;
  const sdfRotation = document.getElementById('sdf-rotation') as HTMLInputElement;
  const sdfEdge = document.getElementById('sdf-edge') as HTMLInputElement;
  const sdfGlow = document.getElementById('sdf-glow') as HTMLInputElement;
  const sdfFill = document.getElementById('sdf-fill') as HTMLInputElement;

  const applyEffectControls = (trigger?: keyof typeof fxControlMap) => {
    actions.mutateProject(store, (project) => {
      project.effects = {
        enabled: effectsEnabled.checked,
        bloom: Number(effectBloom.value),
        blur: Number(effectBlur.value),
        chroma: Number(effectChroma.value),
        posterize: Number(effectPosterize.value),
        kaleidoscope: Number(effectKaleidoscope.value),
        feedback: Number(effectFeedback.value),
        persistence: Number(effectPersistence.value)
      };
    }, false);
    if (trigger) armFxDelta(trigger);
  };

  const applyParticleControls = () => {
    actions.mutateProject(store, (project) => {
      project.particles = {
        enabled: particlesEnabled.checked,
        density: Number(particlesDensity.value),
        speed: Number(particlesSpeed.value),
        size: Number(particlesSize.value),
        glow: Number(particlesGlow.value)
      };
    }, false);
  };

  const applyExpressiveControls = () => {
    actions.mutateProject(store, (project) => {
      project.expressiveFx = {
        energyBloom: {
          enabled: expressiveEnergyEnabled.checked,
          macro: Number(expressiveEnergyMacro.value),
          intentBinding: {
            enabled: expressiveEnergyIntentEnabled.checked,
            intent: expressiveEnergyIntent.value as typeof project.scenes[number]['intent'],
            amount: Number(expressiveEnergyIntentAmount.value)
          },
          expert: {
            threshold: Number(expressiveEnergyThreshold.value),
            accumulation: Number(expressiveEnergyAccumulation.value)
          }
        },
        radialGravity: {
          enabled: expressiveRadialEnabled.checked,
          macro: Number(expressiveRadialMacro.value),
          intentBinding: {
            enabled: expressiveRadialIntentEnabled.checked,
            intent: expressiveRadialIntent.value as typeof project.scenes[number]['intent'],
            amount: Number(expressiveRadialIntentAmount.value)
          },
          expert: {
            strength: Number(expressiveRadialStrength.value),
            radius: Number(expressiveRadialRadius.value),
            focusX: Number(expressiveRadialFocusX.value),
            focusY: Number(expressiveRadialFocusY.value)
          }
        },
        motionEcho: {
          enabled: expressiveEchoEnabled.checked,
          macro: Number(expressiveEchoMacro.value),
          intentBinding: {
            enabled: expressiveEchoIntentEnabled.checked,
            intent: expressiveEchoIntent.value as typeof project.scenes[number]['intent'],
            amount: Number(expressiveEchoIntentAmount.value)
          },
          expert: {
            decay: Number(expressiveEchoDecay.value),
            warp: Number(expressiveEchoWarp.value)
          }
        },
        spectralSmear: {
          enabled: expressiveSmearEnabled.checked,
          macro: Number(expressiveSmearMacro.value),
          intentBinding: {
            enabled: expressiveSmearIntentEnabled.checked,
            intent: expressiveSmearIntent.value as typeof project.scenes[number]['intent'],
            amount: Number(expressiveSmearIntentAmount.value)
          },
          expert: {
            offset: Number(expressiveSmearOffset.value),
            mix: Number(expressiveSmearMix.value)
          }
        }
      };
    }, false);
  };

  const applySdfControls = () => {
    actions.mutateProject(store, (project) => {
      project.sdf = {
        enabled: sdfEnabled.checked,
        shape: sdfShape.value as typeof project.sdf.shape,
        scale: Number(sdfScale.value),
        rotation: Number(sdfRotation.value),
        edge: Number(sdfEdge.value),
        glow: Number(sdfGlow.value),
        fill: Number(sdfFill.value)
      };
    }, false);
  };

  const fxControlMap = {
    bloom: effectBloom,
    blur: effectBlur,
    chroma: effectChroma,
    posterize: effectPosterize,
    kaleidoscope: effectKaleidoscope,
    feedback: effectFeedback,
    persistence: effectPersistence
  } as const;

  effectsEnabled.addEventListener('input', () => applyEffectControls());
  (Object.keys(fxControlMap) as (keyof typeof fxControlMap)[]).forEach((key) => {
    fxControlMap[key].addEventListener('input', () => applyEffectControls(key));
  });

  [particlesEnabled, particlesDensity, particlesSpeed, particlesSize, particlesGlow].forEach((control) => {
    control.addEventListener('input', () => applyParticleControls());
  });

  [
    expressiveEnergyEnabled,
    expressiveEnergyMacro,
    expressiveEnergyIntentEnabled,
    expressiveEnergyIntentAmount,
    expressiveEnergyThreshold,
    expressiveEnergyAccumulation,
    expressiveRadialEnabled,
    expressiveRadialMacro,
    expressiveRadialIntentEnabled,
    expressiveRadialIntentAmount,
    expressiveRadialStrength,
    expressiveRadialRadius,
    expressiveRadialFocusX,
    expressiveRadialFocusY,
    expressiveEchoEnabled,
    expressiveEchoMacro,
    expressiveEchoIntentEnabled,
    expressiveEchoIntentAmount,
    expressiveEchoDecay,
    expressiveEchoWarp,
    expressiveSmearEnabled,
    expressiveSmearMacro,
    expressiveSmearIntentEnabled,
    expressiveSmearIntentAmount,
    expressiveSmearOffset,
    expressiveSmearMix
  ].forEach((control) => {
    control.addEventListener('input', () => applyExpressiveControls());
  });
  [expressiveEnergyIntent, expressiveRadialIntent, expressiveEchoIntent, expressiveSmearIntent].forEach((control) => {
    control.addEventListener('change', () => applyExpressiveControls());
  });

  [sdfEnabled, sdfScale, sdfRotation, sdfEdge, sdfGlow, sdfFill].forEach((control) => {
    control.addEventListener('input', () => applySdfControls());
  });
  sdfShape.addEventListener('change', () => applySdfControls());

  const syncFromProject = () => {
    const project = store.getState().project;
    effectsEnabled.checked = project.effects.enabled;
    effectBloom.value = String(project.effects.bloom);
    effectBlur.value = String(project.effects.blur);
    effectChroma.value = String(project.effects.chroma);
    effectPosterize.value = String(project.effects.posterize);
    effectKaleidoscope.value = String(project.effects.kaleidoscope);
    effectFeedback.value = String(project.effects.feedback);
    effectPersistence.value = String(project.effects.persistence);

    particlesEnabled.checked = project.particles.enabled;
    particlesDensity.value = String(project.particles.density);
    particlesSpeed.value = String(project.particles.speed);
    particlesSize.value = String(project.particles.size);
    particlesGlow.value = String(project.particles.glow);

    sdfEnabled.checked = project.sdf.enabled;
    sdfShape.value = project.sdf.shape;
    sdfScale.value = String(project.sdf.scale);
    sdfRotation.value = String(project.sdf.rotation);
    sdfEdge.value = String(project.sdf.edge);
    sdfGlow.value = String(project.sdf.glow);
    sdfFill.value = String(project.sdf.fill);

    const expressive = project.expressiveFx;
    expressiveEnergyEnabled.checked = expressive.energyBloom.enabled;
    expressiveEnergyMacro.value = String(expressive.energyBloom.macro);
    expressiveEnergyIntentEnabled.checked = expressive.energyBloom.intentBinding.enabled;
    expressiveEnergyIntent.value = expressive.energyBloom.intentBinding.intent;
    expressiveEnergyIntentAmount.value = String(expressive.energyBloom.intentBinding.amount);
    expressiveEnergyThreshold.value = String(expressive.energyBloom.expert.threshold);
    expressiveEnergyAccumulation.value = String(expressive.energyBloom.expert.accumulation);

    expressiveRadialEnabled.checked = expressive.radialGravity.enabled;
    expressiveRadialMacro.value = String(expressive.radialGravity.macro);
    expressiveRadialIntentEnabled.checked = expressive.radialGravity.intentBinding.enabled;
    expressiveRadialIntent.value = expressive.radialGravity.intentBinding.intent;
    expressiveRadialIntentAmount.value = String(expressive.radialGravity.intentBinding.amount);
    expressiveRadialStrength.value = String(expressive.radialGravity.expert.strength);
    expressiveRadialRadius.value = String(expressive.radialGravity.expert.radius);
    expressiveRadialFocusX.value = String(expressive.radialGravity.expert.focusX);
    expressiveRadialFocusY.value = String(expressive.radialGravity.expert.focusY);

    expressiveEchoEnabled.checked = expressive.motionEcho.enabled;
    expressiveEchoMacro.value = String(expressive.motionEcho.macro);
    expressiveEchoIntentEnabled.checked = expressive.motionEcho.intentBinding.enabled;
    expressiveEchoIntent.value = expressive.motionEcho.intentBinding.intent;
    expressiveEchoIntentAmount.value = String(expressive.motionEcho.intentBinding.amount);
    expressiveEchoDecay.value = String(expressive.motionEcho.expert.decay);
    expressiveEchoWarp.value = String(expressive.motionEcho.expert.warp);

    expressiveSmearEnabled.checked = expressive.spectralSmear.enabled;
    expressiveSmearMacro.value = String(expressive.spectralSmear.macro);
    expressiveSmearIntentEnabled.checked = expressive.spectralSmear.intentBinding.enabled;
    expressiveSmearIntent.value = expressive.spectralSmear.intentBinding.intent;
    expressiveSmearIntentAmount.value = String(expressive.spectralSmear.intentBinding.amount);
    expressiveSmearOffset.value = String(expressive.spectralSmear.expert.offset);
    expressiveSmearMix.value = String(expressive.spectralSmear.expert.mix);
  };

  return { syncFromProject };
};
