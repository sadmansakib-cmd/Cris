import { Global, Module } from '@nestjs/common';
import { PermissionsEngine } from './permissions.engine';
import { PermissionsController } from './permissions.controller';

import { PermissionsGateway } from './permissions.gateway';

@Global()
@Module({
  controllers: [PermissionsController],
  providers: [PermissionsEngine, PermissionsGateway],
  exports: [PermissionsEngine, PermissionsGateway],
})
export class PermissionsModule {}
