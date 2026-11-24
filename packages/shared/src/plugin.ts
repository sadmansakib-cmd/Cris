import { z } from 'zod';
import { permissionActionSchema } from './permissions.js';

export const pluginManifestSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  name: z.string().min(1).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i),
  description: z.string().max(500).default(''),
  author: z.string().max(120).default(''),
  license: z.string().max(60).default('MIT'),
  entry: z.object({
    server: z.string().optional(),
    web: z.string().optional(),
  }),
  permissions: z
    .array(
      z.object({
        action: permissionActionSchema,
        reason: z.string().min(1).max(240),
      }),
    )
    .default([]),
  providers: z
    .object({
      requires: z.array(z.enum(['ai', 'storage', 'email', 'vector', 'queue'])).default([]),
    })
    .default({ requires: [] }),
  settingsSchema: z.string().optional(),
  ui: z
    .object({
      sidebar: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            icon: z.string().optional(),
            route: z.string().startsWith('/'),
          }),
        )
        .default([]),
      routes: z
        .array(z.object({ path: z.string().startsWith('/'), component: z.string() }))
        .default([]),
      widgets: z
        .array(z.object({ id: z.string(), slot: z.string() }))
        .default([]),
    })
    .default({ sidebar: [], routes: [], widgets: [] }),
  jobs: z
    .array(z.object({ id: z.string(), cron: z.string() }))
    .default([]),
  dependsOn: z.array(z.string()).default([]),
  migrations: z.string().optional(),
  sandbox: z
    .object({
      network: z.array(z.string()).default([]),
      fs: z.array(z.string()).default([]),
      cpuMs: z.number().int().positive().default(5000),
      memMb: z.number().int().positive().default(256),
    })
    .default({ network: [], fs: [], cpuMs: 5000, memMb: 256 }),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
