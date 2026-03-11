import type { OutputConfig } from '../shared/project';

export interface OutputSessionApi {
  getOutputConfig: () => Promise<OutputConfig>;
  isOutputOpen: () => Promise<boolean>;
  onOutputClosed: (handler: () => void) => void;
}

export interface InitializeOutputSessionDeps {
  defaultConfig: OutputConfig;
  applyState: (config: OutputConfig, outputOpen: boolean) => Promise<void> | void;
  onOutputClosed?: () => void;
}

export interface OutputSessionState {
  config: OutputConfig;
  outputOpen: boolean;
}

export const initializeOutputSession = async (
  api: OutputSessionApi,
  deps: InitializeOutputSessionDeps
): Promise<OutputSessionState> => {
  const savedConfig = await api.getOutputConfig();
  const outputOpen = await api.isOutputOpen();
  const config: OutputConfig = {
    ...deps.defaultConfig,
    ...savedConfig,
    enabled: outputOpen || savedConfig.enabled
  };

  await deps.applyState(config, outputOpen);

  api.onOutputClosed(() => {
    deps.onOutputClosed?.();
  });

  return { config, outputOpen };
};
