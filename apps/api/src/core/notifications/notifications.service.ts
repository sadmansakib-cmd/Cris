import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, opts: { unreadOnly?: boolean } = {}) {
    return this.prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async create(userId: string, kind: string, title: string, body?: string, data?: Record<string, unknown>) {
    return this.prisma.notification.create({
      data: { userId, kind, title, body, data: (data as never) ?? undefined },
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
