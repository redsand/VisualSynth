export const formatSafeModeReasons = (reasons: string[]) => {
  if (!reasons.length) return 'Safe mode: OK';
  return `Safe mode: ${reasons.join(', ')}`;
};
