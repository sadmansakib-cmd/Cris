import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

/**
 * Admin service — aggregates cross-module state for the Phase 15 admin surface.
 * Read-only reporting on top of existing Prisma models; no new tables required.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async logs(params: { limit?: number; outcome?: string; action?: string; userId?: string } = {}) {
    const { limit = 100, outcome, action, userId } = params;
    return this.prisma.auditLog.findMany({
      where: {
        ...(outcome ? { outcome } : {}),
        ...(action ? { action: { contains: action } } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  async errors(limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { outcome: 'error' },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  async analytics(days = 7) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [totalUsers, totalPlugins, recentAudit, denies, errors] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.plugin.count(),
      this.prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: since }, outcome: 'deny' } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: since }, outcome: 'error' } }),
    ]);
    const byAction = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: since } },
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 20,
    });
    return {
      windowDays: days,
      totals: { users: totalUsers, plugins: totalPlugins, events: recentAudit, denies, errors },
      topActions: byAction.map((r: any) => ({ action: r.action, count: r._count.action })),
    };
  }

  async apiUsage(days = 7) {
    const since = new Date(Date.now() - days * 86_400_000);
    const grouped = await this.prisma.auditLog.groupBy({
      by: ['action', 'outcome'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    return grouped.map((g: any) => ({ action: g.action, outcome: g.outcome, count: g._count._all }));
  }

  async sessions() {
    return this.prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, userId: true, ip: true, userAgent: true, createdAt: true, expiresAt: true, revokedAt: true },
    });
  }

  async revokeSession(id: string) {
    await this.prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async security() {
    const [denies24, errors24, activeSessions, mfaUsers] = await Promise.all([
      this.prisma.auditLog.count({
        where: { outcome: 'deny', createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      }),
      this.prisma.auditLog.count({
        where: { outcome: 'error', createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      }),
      this.prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.user.count({ where: { totp: { isNot: null } } }).catch(() => 0),
    ]);
    return { denies24h: denies24, errors24h: errors24, activeSessions, mfaUsers };
  }

  async backupSnapshot() {
    const [users, plugins, settings, permissions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.plugin.count(),
      this.prisma.userSetting.count().catch(() => 0),
      this.prisma.permissionGrant.count().catch(() => 0),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      counts: { users, plugins, settings, permissions },
      note: 'Logical snapshot — pair with pg_dump for physical backup.',
    };
  }
}
