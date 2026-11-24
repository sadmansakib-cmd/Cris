import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { PluginsModule } from '../plugins.module';

@Module({
  imports: [PluginsModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
