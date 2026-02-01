/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { createFxPanel } from '../src/renderer/ui/panels/FxPanel';
import { createInitialState, createStore } from '../src/renderer/state/store';

const INTENTS = ['calm', 'pulse', 'build', 'chaos', 'ambient'];

const addInput = (id: string, type = 'range', value = '0') => {
  const input = document.createElement('input');
  input.id = id;
  input.type = type;
  if (type === 'checkbox') {
    input.checked = value === '1';
  } else {
    input.value = value;
  }
  document.body.appendChild(input);
  return input;
};

const addSelect = (id: string, options: string[], value?: string) => {
  const select = document.createElement('select');
  select.id = id;
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    select.appendChild(option);
  });
  if (value) select.value = value;
  document.body.appendChild(select);
  return select;
};

const buildFxDom = () => {
  addInput('effects-enabled', 'checkbox', '1');
  addInput('effect-bloom');
  addInput('effect-blur');
  addInput('effect-chroma');
  addInput('effect-posterize');
  addInput('effect-kaleidoscope');
  addInput('effect-feedback');
  addInput('effect-persistence');

  addInput('expressive-energy-enabled', 'checkbox');
  addInput('expressive-energy-macro');
  addInput('expressive-energy-intent-enabled', 'checkbox');
  addSelect('expressive-energy-intent', INTENTS, 'ambient');
  addInput('expressive-energy-intent-amount');
  addInput('expressive-energy-threshold');
  addInput('expressive-energy-accumulation');

  addInput('expressive-radial-enabled', 'checkbox');
  addInput('expressive-radial-macro');
  addInput('expressive-radial-intent-enabled', 'checkbox');
  addSelect('expressive-radial-intent', INTENTS, 'ambient');
  addInput('expressive-radial-intent-amount');
  addInput('expressive-radial-strength');
  addInput('expressive-radial-radius');
  addInput('expressive-radial-focus-x');
  addInput('expressive-radial-focus-y');

  addInput('expressive-echo-enabled', 'checkbox');
  addInput('expressive-echo-macro');
  addInput('expressive-echo-intent-enabled', 'checkbox');
  addSelect('expressive-echo-intent', INTENTS, 'ambient');
  addInput('expressive-echo-intent-amount');
  addInput('expressive-echo-decay');
  addInput('expressive-echo-warp');

  addInput('expressive-smear-enabled', 'checkbox');
  addInput('expressive-smear-macro');
  addInput('expressive-smear-intent-enabled', 'checkbox');
  addSelect('expressive-smear-intent', INTENTS, 'ambient');
  addInput('expressive-smear-intent-amount');
  addInput('expressive-smear-offset');
  addInput('expressive-smear-mix');

  addInput('particles-enabled', 'checkbox', '1');
  addInput('particles-density');
  addInput('particles-speed');
  addInput('particles-size');
  addInput('particles-glow');

  addInput('sdf-enabled', 'checkbox', '1');
  addSelect('sdf-shape', ['circle', 'box', 'triangle'], 'circle');
  addInput('sdf-scale');
  addInput('sdf-rotation');
  addInput('sdf-edge');
  addInput('sdf-glow');
  addInput('sdf-fill');
};

const fireInput = (el: HTMLElement) =>
  el.dispatchEvent(new Event('input', { bubbles: true }));
const fireChange = (el: HTMLElement) =>
  el.dispatchEvent(new Event('change', { bubbles: true }));

describe('Expressive FX DOM wiring', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    buildFxDom();
  });

  it('updates project state from Radial Gravity controls', () => {
    const store = createStore(createInitialState());
    createFxPanel({ store, armFxDelta: () => {} });

    const enabled = document.getElementById('expressive-radial-enabled') as HTMLInputElement;
    const macro = document.getElementById('expressive-radial-macro') as HTMLInputElement;
    const intentEnabled = document.getElementById('expressive-radial-intent-enabled') as HTMLInputElement;
    const intent = document.getElementById('expressive-radial-intent') as HTMLSelectElement;
    const intentAmount = document.getElementById('expressive-radial-intent-amount') as HTMLInputElement;
    const strength = document.getElementById('expressive-radial-strength') as HTMLInputElement;
    const radius = document.getElementById('expressive-radial-radius') as HTMLInputElement;
    const focusX = document.getElementById('expressive-radial-focus-x') as HTMLInputElement;
    const focusY = document.getElementById('expressive-radial-focus-y') as HTMLInputElement;

    enabled.checked = true;
    macro.value = '0.8';
    intentEnabled.checked = true;
    intent.value = 'pulse';
    intentAmount.value = '0.25';
    strength.value = '0.7';
    radius.value = '0.55';
    focusX.value = '0.2';
    focusY.value = '0.9';

    [enabled, macro, intentEnabled, intentAmount, strength, radius, focusX, focusY].forEach((el) =>
      fireInput(el)
    );
    fireChange(intent);

    const radial = store.getState().project.expressiveFx.radialGravity;
    expect(radial.enabled).toBe(true);
    expect(radial.macro).toBeCloseTo(0.8, 5);
    expect(radial.intentBinding.enabled).toBe(true);
    expect(radial.intentBinding.intent).toBe('pulse');
    expect(radial.intentBinding.amount).toBeCloseTo(0.25, 5);
    expect(radial.expert.strength).toBeCloseTo(0.7, 5);
    expect(radial.expert.radius).toBeCloseTo(0.55, 5);
    expect(radial.expert.focusX).toBeCloseTo(0.2, 5);
    expect(radial.expert.focusY).toBeCloseTo(0.9, 5);
  });

  it('syncs Radial Gravity controls from project state', () => {
    const store = createStore(createInitialState());
    store.update((state: any) => {
      state.project.expressiveFx.radialGravity = {
        enabled: true,
        macro: 0.6,
        intentBinding: { enabled: true, intent: 'build', amount: 0.4 },
        expert: { strength: 0.65, radius: 0.45, focusX: 0.1, focusY: 0.8 }
      };
    });

    const panel = createFxPanel({ store, armFxDelta: () => {} });
    panel.syncFromProject();

    const enabled = document.getElementById('expressive-radial-enabled') as HTMLInputElement;
    const macro = document.getElementById('expressive-radial-macro') as HTMLInputElement;
    const intentEnabled = document.getElementById('expressive-radial-intent-enabled') as HTMLInputElement;
    const intent = document.getElementById('expressive-radial-intent') as HTMLSelectElement;
    const intentAmount = document.getElementById('expressive-radial-intent-amount') as HTMLInputElement;
    const strength = document.getElementById('expressive-radial-strength') as HTMLInputElement;
    const radius = document.getElementById('expressive-radial-radius') as HTMLInputElement;
    const focusX = document.getElementById('expressive-radial-focus-x') as HTMLInputElement;
    const focusY = document.getElementById('expressive-radial-focus-y') as HTMLInputElement;

    expect(enabled.checked).toBe(true);
    expect(Number(macro.value)).toBeCloseTo(0.6, 5);
    expect(intentEnabled.checked).toBe(true);
    expect(intent.value).toBe('build');
    expect(Number(intentAmount.value)).toBeCloseTo(0.4, 5);
    expect(Number(strength.value)).toBeCloseTo(0.65, 5);
    expect(Number(radius.value)).toBeCloseTo(0.45, 5);
    expect(Number(focusX.value)).toBeCloseTo(0.1, 5);
    expect(Number(focusY.value)).toBeCloseTo(0.8, 5);
  });
});
