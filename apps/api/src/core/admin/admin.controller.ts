import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  @Get('logs')
  logs(
    @Query('limit') limit?: string,
    @Query('outcome') outcome?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ) {
    return this.svc.logs({ limit: limit ? +limit : 100, outcome, action, userId });
  }

  @Get('errors') errors(@Query('limit') limit?: string) {
    return this.svc.errors(limit ? +limit : 100);
  }

  @Get('analytics') analytics(@Query('days') days?: string) {
    return this.svc.analytics(days ? +days : 7);
  }

  @Get('api-usage') apiUsage(@Query('days') days?: string) {
    return this.svc.apiUsage(days ? +days : 7);
  }

  @Get('sessions') sessions() {
    return this.svc.sessions();
  }

  @Delete('sessions/:id') revoke(@Param('id') id: string) {
    return this.svc.revokeSession(id);
  }

  @Get('security') security() {
    return this.svc.security();
  }

  @Get('backup/snapshot') snapshot() {
    return this.svc.backupSnapshot();
  }
}
