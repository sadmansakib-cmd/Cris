import { z } from 'zod';

/**
 * Canonical permission action string: `<domain>:<verb>[:<qualifier>]`.
 * Never construct arbitrary strings — declare them in a plugin manifest.
 */
export const permissionActionSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(:[a-z0-9*_-]+){1,3}$/i, 'Invalid permission action');

export type PermissionAction = z.infer<typeof permissionActionSchema>;

export const permissionScopeSchema = z.record(z.string(), z.unknown()).default({});
export type PermissionScope = z.infer<typeof permissionScopeSchema>;

export interface PermissionRequestDto {
  id: string;
  pluginSlug: string;
  action: PermissionAction;
  scope: PermissionScope;
  reason: string;
  requestedAt: string;
}

export type PermissionDecision = 'allow_once' | 'allow_always' | 'deny';

export interface PermissionGrantDto {
  id: string;
  pluginSlug: string;
  action: PermissionAction;
  scope: PermissionScope;
  grantedAt: string;
  expiresAt: string | null;
}
