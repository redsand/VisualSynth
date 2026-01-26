export const toFileUrl = (filePath: string) => {
  const normalized = filePath.replace(/\\/g, '/');
  const encoded = encodeURI(normalized);
  if (normalized.startsWith('/')) {
    return `file://${encoded}`;
  }
  return `file:///${encoded}`;
};
