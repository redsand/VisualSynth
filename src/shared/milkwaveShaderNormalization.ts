import type { MilkwaveShaderPassKind } from './milkwaveIr';

export interface MilkwaveNormalizedShaderPass {
  kind: MilkwaveShaderPassKind;
  source: string;
  preludeLines: string[];
  bodyLines: string[];
  helperLines: string[];
  hasShaderBodyBlock: boolean;
}

const stripMilkLinePrefix = (line: string) => line.replace(/^`+/, '').trim();

export const normalizeMilkwaveShaderPass = (
  source: string,
  kind: MilkwaveShaderPassKind
): MilkwaveNormalizedShaderPass => {
  const lines = source
    .split(/\r?\n/)
    .map(stripMilkLinePrefix)
    .filter((line) => line.length > 0);

  const preludeLines: string[] = [];
  const bodyLines: string[] = [];
  let inShaderBody = false;
  let hasShaderBodyBlock = false;

  for (const line of lines) {
    if (/^shader_body\s*\{$/.test(line)) {
      inShaderBody = true;
      hasShaderBodyBlock = true;
      continue;
    }
    if (inShaderBody && line === '}') {
      inShaderBody = false;
      continue;
    }
    if (inShaderBody) {
      bodyLines.push(line);
    } else {
      preludeLines.push(line);
    }
  }

  const helperLines = preludeLines.filter((line) => /\)\s*\{/.test(line));
  const reconstructed =
    preludeLines.join('\n') +
    (hasShaderBodyBlock
      ? `${preludeLines.length > 0 ? '\n' : ''}shader_body {\n${bodyLines.join('\n')}\n}`
      : bodyLines.length > 0
        ? `${preludeLines.length > 0 ? '\n' : ''}${bodyLines.join('\n')}`
        : '');

  return {
    kind,
    source: reconstructed,
    preludeLines,
    bodyLines,
    helperLines,
    hasShaderBodyBlock
  };
};
