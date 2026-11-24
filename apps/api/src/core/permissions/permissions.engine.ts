import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { PermissionAction, PermissionScope } from '@hault/shared';

@Injectable()
export class PermissionsEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Central authorization check. Returns silently on allow, throws on deny.
   * Prompt-based grants (WS interactive prompts) are handled by
   * PermissionPromptService; this engine only reads persisted grants.
   */
  async require(
    userId: string,
    pluginSlug: string,
    action: PermissionAction,
    scope: PermissionScope = {},
  ): Promise<void> {
    const grants = await this.prisma.permissionGrant.findMany({
      where: {
        userId,
        pluginSlug,
        action,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    const match = grants.find((g) => scopeContains(g.scope as PermissionScope, scope));
    if (!match) {
      await this.audit.record({
        userId,
        actorType: 'plugin',
        actorId: pluginSlug,
        action,
        outcome: 'deny',
        metadata: { scope, reason: 'no_grant' },
      });
      throw new ForbiddenException({
        message: 'Permission required',
        permission: { pluginSlug, action, scope },
      });
    }

    await this.audit.record({
      userId,
      actorType: 'plugin',
      actorId: pluginSlug,
      action,
      outcome: 'allow',
      metadata: { scope, grantId: match.id },
    });
  }

  async grant(input: {
    userId: string;
    pluginSlug: string;
    action: PermissionAction;
    scope?: PermissionScope;
    expiresAt?: Date | null;
  }) {
    const grant = await this.prisma.permissionGrant.create({
      data: {
        userId: input.userId,
        pluginSlug: input.pluginSlug,
        action: input.action,
        scope: (input.scope ?? {}) as never,
        expiresAt: input.expiresAt ?? null,
      },
    });
    await this.audit.record({
      userId: input.userId,
      actorType: 'user',
      action: 'permission:grant',
      target: `${input.pluginSlug}:${input.action}`,
      outcome: 'success',
      metadata: { grantId: grant.id, scope: input.scope ?? {} },
    });
    return grant;
  }

  async revoke(userId: string, grantId: string) {
    const grant = await this.prisma.permissionGrant.update({
      where: { id: grantId },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      userId,
      actorType: 'user',
      action: 'permission:revoke',
      target: `${grant.pluginSlug}:${grant.action}`,
      outcome: 'success',
    });
  }

  async listForUser(userId: string) {
    return this.prisma.permissionGrant.findMany({
      where: { userId, revokedAt: null },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /** Panic: revoke all non-core grants. */
  async panic(userId: string) {
    await this.prisma.permissionGrant.updateMany({
      where: { userId, revokedAt: null, pluginSlug: { not: 'core' } },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      userId,
      actorType: 'user',
      action: 'permission:panic',
      outcome: 'success',
    });
  }
}

/** Grant scope contains request scope when every request key/value is covered by the grant. */
function scopeContains(grant: PermissionScope, request: PermissionScope): boolean {
  if (!grant || Object.keys(grant).length === 0) return true; // wildcard grant
  for (const [k, v] of Object.entries(request)) {
    if (grant[k] === undefined) return false;
    if (grant[k] === '*' || grant[k] === v) continue;
    if (typeof grant[k] === 'string' && typeof v === 'string' && matchGlob(grant[k] as string, v)) continue;
    return false;
  }
  return true;
}

function matchGlob(pattern: string, value: string): boolean {
  const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
  return re.test(value);
}
