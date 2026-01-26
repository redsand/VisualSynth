import { z } from 'zod';

export const pluginManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  author: z.string().default('Unknown'),
  kind: z.enum(['generator', 'effect']),
  entry: z.string()
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
