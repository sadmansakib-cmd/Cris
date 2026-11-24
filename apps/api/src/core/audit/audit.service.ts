import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

export interface AuditRecord {
  userId?: string | null;
  actorType: 'user' | 'plugin' | 'system';
  actorId?: string | null;
  action: string;
  target?: string | null;
  outcome: 'allow' | 'deny' | 'success' | 'error';
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(rec: AuditRecord) {
    await this.prisma.auditLog.create({
      data: {
        userId: rec.userId ?? null,
        actorType: rec.actorType,
        actorId: rec.actorId ?? null,
        action: rec.action,
        target: rec.target ?? null,
        outcome: rec.outcome,
        metadata: (rec.metadata as never) ?? undefined,
        ip: rec.ip ?? null,
      },
    });
  }
}
