import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@CurrentUser() userId: string, @Query('unread') unread?: string) {
    return this.svc.list(userId, { unreadOnly: unread === '1' });
  }

  @Post(':id/read')
  async read(@CurrentUser() userId: string, @Param('id') id: string) {
    await this.svc.markRead(userId, id);
    return { ok: true };
  }
}
