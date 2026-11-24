import { Module } from '@nestjs/common';
import { PluginsService } from './plugins.service';
import { PluginsController } from './plugins.controller';
import { PluginSandbox } from './sandbox/plugin-sandbox';
import { PluginRuntimeService } from './plugin-runtime.service';

import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PermissionsModule, AuditModule],
  controllers: [PluginsController],
  providers: [PluginsService, PluginSandbox, PluginRuntimeService],
  exports: [PluginsService, PluginSandbox, PluginRuntimeService],
})
export class PluginsModule {}
