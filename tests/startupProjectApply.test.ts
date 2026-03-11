import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import type { VisualSynthProject } from '../src/shared/project';
import type { StartupProjectSelection } from '../src/renderer/startupProject';
import { applyStartupSelection } from '../src/renderer/startupProjectApply';

const createProject = (name: string): VisualSynthProject => ({
  ...DEFAULT_PROJECT,
  name
});

describe('applyStartupSelection', () => {
  it('applies recovery projects and emits status/log', async () => {
    const project = createProject('Recovered');
    const selection: StartupProjectSelection = {
      kind: 'recovery',
      project,
      status: 'Recovery session loaded.',
      logLabel: 'Recovery project applied'
    };
    const applyProject = vi.fn().mockResolvedValue(undefined);
    const setStatus = vi.fn();
    const log = vi.fn();

    await applyStartupSelection(selection, { applyProject, setStatus, log });

    expect(applyProject).toHaveBeenCalledWith(project);
    expect(setStatus).toHaveBeenCalledWith('Recovery session loaded.');
    expect(log).toHaveBeenCalledWith('Recovery project applied');
  });

  it('sets fallback status for invalid recovery selection', async () => {
    const selection: StartupProjectSelection = {
      kind: 'invalid-recovery',
      status: null,
      errorDetail: 'Invalid JSON'
    };
    const applyProject = vi.fn().mockResolvedValue(undefined);
    const setStatus = vi.fn();
    const warn = vi.fn();

    await applyStartupSelection(selection, {
      applyProject,
      setStatus,
      warn,
      invalidRecoveryFallbackStatus: 'Recovery session found but failed to load.'
    });

    expect(applyProject).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Recovery project invalid', 'Invalid JSON');
    expect(setStatus).toHaveBeenCalledWith('Recovery session found but failed to load.');
  });

  it('does not set status for invalid showcase without status text', async () => {
    const selection: StartupProjectSelection = {
      kind: 'invalid-showcase',
      status: null,
      errorDetail: 'Missing payload'
    };
    const setStatus = vi.fn();
    const warn = vi.fn();

    await applyStartupSelection(selection, {
      applyProject: vi.fn().mockResolvedValue(undefined),
      setStatus,
      warn
    });

    expect(warn).toHaveBeenCalledWith('Showcase project invalid', 'Missing payload');
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('logs when no startup override exists', async () => {
    const selection: StartupProjectSelection = { kind: 'none', status: null };
    const log = vi.fn();
    const setStatus = vi.fn();

    await applyStartupSelection(selection, {
      applyProject: vi.fn().mockResolvedValue(undefined),
      setStatus,
      log
    });

    expect(log).toHaveBeenCalledWith('No startup project override found');
    expect(setStatus).not.toHaveBeenCalled();
  });
});
