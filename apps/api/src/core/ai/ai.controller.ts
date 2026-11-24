import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';
import { AiService } from './ai.service';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly svc: AiService) {}

  @Get('threads')
  list(@CurrentUser() userId: string) {
    return this.svc.listThreads(userId);
  }

  @Post('threads')
  create(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(z.object({ title: z.string().optional(), model: z.string().optional() })))
    body: { title?: string; model?: string },
  ) {
    return this.svc.createThread(userId, body.title, body.model);
  }

  @Get('threads/:id')
  get(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.svc.getThread(userId, id);
  }

  @Post('threads/:id/send')
  send(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ content: z.string().min(1), model: z.string().optional() })))
    body: { content: string; model?: string },
  ) {
    return this.svc.send(userId, id, body.content, body.model);
  }
}
