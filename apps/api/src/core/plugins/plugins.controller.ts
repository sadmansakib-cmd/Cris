import { Body, Controller, Delete, Get, Param, Post, UseGuards, All, Req, Query } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';
import { PluginsService } from './plugins.service';
import { PluginRuntimeService } from './plugin-runtime.service';

@UseGuards(JwtAuthGuard)
@Controller('plugins')
export class PluginsController {
  constructor(
    private readonly svc: PluginsService,
    private readonly runtime: PluginRuntimeService,
  ) {}

  @Get() list() { return this.svc.list(); }

  @Get('running') running() { return { plugins: this.runtime.running() }; }

  @Get('mine') mine(@CurrentUser() userId: string) { return this.svc.listForUser(userId); }

  @Post('install')
  install(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(z.object({ manifest: z.unknown() }))) body: { manifest: unknown },
  ) {
    return this.svc.install(body.manifest, 'local', userId);
  }

  @Post(':slug/enable')
  enable(@CurrentUser() userId: string, @Param('slug') slug: string) {
    return this.svc.setEnabled(slug, true, userId);
  }

  @Post(':slug/disable')
  async disable(@CurrentUser() userId: string, @Param('slug') slug: string) {
    await this.runtime.stop(slug).catch(() => {});
    return this.svc.setEnabled(slug, false, userId);
  }

  @Post(':slug/start') start(@Param('slug') slug: string) { return this.runtime.start(slug); }

  @Post(':slug/stop') stop(@Param('slug') slug: string) { return this.runtime.stop(slug); }

  @Post(':slug/invoke')
  invoke(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(z.object({ method: z.string(), args: z.unknown().optional() })))
    body: { method: string; args?: unknown },
  ) {
    return this.runtime.invoke(slug, body.method, body.args ?? {});
  }

  @Delete(':slug')
  async uninstall(@CurrentUser() userId: string, @Param('slug') slug: string) {
    await this.runtime.stop(slug).catch(() => {});
    await this.svc.uninstall(slug, userId);
    return { ok: true };
  }

  @Post(':slug/install-user')
  installForUser(@CurrentUser() userId: string, @Param('slug') slug: string) {
    return this.svc.installForUser(userId, slug);
  }

  @All(':slug/:method')
  async proxy(
    @Param('slug') slug: string,
    @Param('method') method: string,
    @Req() req: any,
    @Body() body: any,
    @Query() query: any
  ) {
    // If a request didn't match a specific plugin route above, proxy it to the plugin runtime.
    // E.g. GET /plugins/hault.automations/rules -> invoke('hault.automations', 'rules', query)
    // E.g. POST /plugins/hault.research-mode/run -> invoke('hault.research-mode', 'run', body)
    const args = req.method === 'GET' ? query : body;
    return this.runtime.invoke(slug, method, args ?? {});
  }
}
