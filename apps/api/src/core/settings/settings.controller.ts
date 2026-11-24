import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';
import { SettingsService } from './settings.service';

const setSchema = z.object({
  namespace: z.string().regex(/^[a-z0-9._-]{1,64}$/),
  key: z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),
  value: z.unknown(),
});

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get()
  all(@CurrentUser() userId: string) {
    return this.svc.getUserAll(userId);
  }

  @Put()
  async set(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(setSchema)) body: z.infer<typeof setSchema>,
  ) {
    await this.svc.setUser(userId, body.namespace, body.key, body.value);
    return { ok: true };
  }
}
