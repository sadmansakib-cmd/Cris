import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';
import { MediaService } from './media.service';

@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('stt')
  async stt(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(z.object({ audioBase64: z.string(), language: z.string().optional() })))
    body: { audioBase64: string; language?: string },
  ) {
    return this.media.stt(userId, Buffer.from(body.audioBase64, 'base64'), body.language);
  }

  @Post('tts')
  async tts(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(z.object({ text: z.string().min(1), voice: z.string().optional(), format: z.enum(['mp3', 'wav', 'ogg']).optional() })))
    body: { text: string; voice?: string; format?: 'mp3' | 'wav' | 'ogg' },
    @Res() res: Response,
  ) {
    const buf = await this.media.tts(userId, body.text, body.voice, body.format);
    res.setHeader('content-type', `audio/${body.format ?? 'mp3'}`);
    res.send(buf);
  }

  @Post('ocr')
  async ocr(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(z.object({ imageBase64: z.string(), lang: z.string().optional() })))
    body: { imageBase64: string; lang?: string },
  ) {
    return this.media.ocr(userId, Buffer.from(body.imageBase64, 'base64'), body.lang);
  }

  @Post('detect')
  async detect(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(z.object({ imageBase64: z.string(), classes: z.array(z.string()).optional() })))
    body: { imageBase64: string; classes?: string[] },
  ) {
    return this.media.detect(userId, Buffer.from(body.imageBase64, 'base64'), body.classes);
  }
}
