import { AssetItem, AssetKind, AssetColorSpace } from './project';

export type AssetTextureSampling = 'linear' | 'nearest';

export interface AssetMetadata {
  hash?: string;
  mime?: string;
  width?: number;
  height?: number;
  colorSpace?: AssetColorSpace;
  size?: number;
  thumbnail?: string;
}

export interface AssetImportResult {
  canceled?: boolean;
  filePath?: string;
  hash?: string;
  mime?: string;
  width?: number;
  height?: number;
  colorSpace?: AssetColorSpace;
  size?: number;
  thumbnail?: string;
}

export interface AssetCreationOptions {
  name: string;
  kind: AssetKind;
  path?: string;
  tags?: string[];
  metadata?: AssetMetadata;
  options?: AssetItem['options'];
}

export const normalizeAssetTags = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

export const normalizeAssetPath = (path: string | undefined): string | undefined => {
  if (!path) return path;
  // Use forward slashes for consistency across platforms
  return path.replace(/\\/g, '/');
};

export const createAssetItem = (input: AssetCreationOptions): AssetItem => ({
  id: `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  name: input.name,
  kind: input.kind,
  path: normalizeAssetPath(input.path),
  tags: input.tags ?? [],
  addedAt: new Date().toISOString(),
  hash: input.metadata?.hash,
  mime: input.metadata?.mime,
  width: input.metadata?.width,
  height: input.metadata?.height,
  colorSpace: input.metadata?.colorSpace ?? 'srgb',
  options: input.options,
  thumbnail: input.metadata?.thumbnail
});

export interface AssetRef {
  id: string;
  kind: AssetItem['kind'];
  resolvedPath: string;
  originalPath?: string;
  missing: boolean;
  status: 'resolved' | 'remapped' | 'missing';
}
