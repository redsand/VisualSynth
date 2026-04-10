export const toFileUrl = (filePath: string) => {
  if (filePath.startsWith('data:') || filePath.startsWith('blob:') || filePath.startsWith('file:') || filePath.startsWith('http')) {
    return filePath;
  }
  const normalized = filePath.replace(/\\/g, '/');
  const encoded = encodeURI(normalized);
  if (normalized.startsWith('/')) {
    return `file://${encoded}`;
  }
  return `file:///${encoded}`;
};
