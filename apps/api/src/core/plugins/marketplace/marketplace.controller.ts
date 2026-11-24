import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { MarketplaceService } from './marketplace.service';
import { PluginsService } from '../plugins.service';

@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly market: MarketplaceService,
    private readonly plugins: PluginsService,
  ) {}

  @Get('list') list(@Query('q') q?: string) {
    return this.market.list(q);
  }

  @Post('trust-key')
  trustKey(
    @Body(new ZodValidationPipe(z.object({ keyId: z.string().min(1), pem: z.string().min(1) })))
    body: { keyId: string; pem: string },
  ) {
    this.market.trustKey(body.keyId, body.pem);
    return { ok: true };
  }

  @Post('install')
  async install(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(z.object({
      manifestUrl: z.string().url(),
      signatureUrl: z.string().url(),
      keyId: z.string().min(1),
    })))
    body: { manifestUrl: string; signatureUrl: string; keyId: string },
  ) {
    const { manifest } = await this.market.installFromUrl(body.manifestUrl, body.signatureUrl, body.keyId);
    return this.plugins.install(manifest, 'registry' as any, userId);
  }
}
