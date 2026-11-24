import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserAll(userId: string) {
    const rows = await this.prisma.userSetting.findMany({ where: { userId } });
    const out: Record<string, Record<string, unknown>> = {};
    for (const r of rows) {
      out[r.namespace] ??= {};
      (out[r.namespace] as Record<string, unknown>)[r.key] = r.value;
    }
    return out;
  }

  async setUser(userId: string, namespace: string, key: string, value: unknown) {
    await this.prisma.userSetting.upsert({
      where: { userId_namespace_key: { userId, namespace, key } },
      update: { value: value as never },
      create: { userId, namespace, key, value: value as never },
    });
  }

  async getSystem(namespace: string): Promise<Record<string, unknown>> {
    const rows = await this.prisma.systemSetting.findMany({ where: { namespace } });
    return Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  }
}
