import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';
import { PermissionsEngine } from './permissions.engine';
import { permissionActionSchema, permissionScopeSchema } from '@hault/shared';

const grantSchema = z.object({
  pluginSlug: z.string().min(1),
  action: permissionActionSchema,
  scope: permissionScopeSchema.optional(),
  expiresAt: z.string().datetime().optional(),
});

@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly engine: PermissionsEngine) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.engine.listForUser(userId);
  }

  @Post('grant')
  grant(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(grantSchema)) body: z.infer<typeof grantSchema>,
  ) {
    return this.engine.grant({
      userId,
      pluginSlug: body.pluginSlug,
      action: body.action,
      scope: body.scope,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });
  }

  @Delete(':id')
  async revoke(@CurrentUser() userId: string, @Param('id') id: string) {
    await this.engine.revoke(userId, id);
    return { ok: true };
  }

  @Post('panic')
  async panic(@CurrentUser() userId: string) {
    await this.engine.panic(userId);
    return { ok: true };
  }
}
