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
  };

  return { syncFromProject };
};
