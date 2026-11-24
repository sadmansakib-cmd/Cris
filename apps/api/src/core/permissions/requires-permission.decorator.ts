import { SetMetadata } from '@nestjs/common';
import type { PermissionAction, PermissionScope } from '@hault/shared';

export const PERMISSION_META = 'hault:permission';

export interface RequiredPermission {
  pluginSlug: string;
  action: PermissionAction;
  scope?: (req: unknown) => PermissionScope;
}

/** Attach to a controller method to require a permission before entry. */
export const RequiresPermission = (
  pluginSlug: string,
  action: PermissionAction,
  scope?: (req: unknown) => PermissionScope,
) => SetMetadata(PERMISSION_META, { pluginSlug, action, scope } satisfies RequiredPermission);
