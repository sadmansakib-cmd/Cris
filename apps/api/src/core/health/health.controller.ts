import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.redis = new Redis(config.getOrThrow<string>('REDIS_URL'), { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  @Get()
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('db unavailable');
    }
    try {
      await this.redis.connect().catch(() => undefined);
      const pong = await this.redis.ping();
      if (pong !== 'PONG') throw new Error('bad pong');
    } catch {
      throw new ServiceUnavailableException('redis unavailable');
    }
    return { status: 'ready' };
  }
}
