import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { RequestIdMiddleware } from './core/common/request-id.middleware';

import { PrismaModule } from './core/prisma/prisma.module';
import { CryptoModule } from './core/crypto/crypto.module';
import { AuthModule } from './core/auth/auth.module';
import { UsersModule } from './core/users/users.module';
import { PermissionsModule } from './core/permissions/permissions.module';
import { AuditModule } from './core/audit/audit.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { SettingsModule } from './core/settings/settings.module';
import { PluginsModule } from './core/plugins/plugins.module';
import { MarketplaceModule } from './core/plugins/marketplace/marketplace.module';
import { ProvidersModule } from './core/providers/providers.module';
import { HealthModule } from './core/health/health.module';
import { AiModule } from './core/ai/ai.module';
import { MediaModule } from './core/media/media.module';
import { AdminModule } from './core/admin/admin.module';
import { envSchema } from './core/config/env.schema';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => envSchema.parse(raw),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get('RATE_LIMIT_TTL_MS') ?? 60_000),
          limit: Number(config.get('RATE_LIMIT_MAX') ?? 60),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    ProvidersModule,
    AuditModule,
    UsersModule,
    AuthModule,
    PermissionsModule,
    NotificationsModule,
    SettingsModule,
    PluginsModule,
    MarketplaceModule,
    AiModule,
    MediaModule,
    AdminModule,
    HealthModule,

  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
