import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  Get,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { loginSchema, registerSchema } from '@hault/shared';
import { ZodValidationPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { z } from 'zod';
import { TotpService } from './totp.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.module';

const REFRESH_COOKIE = 'hault_refresh';

const changePasswordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(12),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly totp: TotpService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { ttl: 3600_000, limit: 100 } })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: z.infer<typeof registerSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.register(body, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
    this.setRefreshCookie(res, session.refreshToken, session.refreshExpiresIn);
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 900_000, limit: 5 } })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(body, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
    this.setRefreshCookie(res, session.refreshToken, session.refreshExpiresIn);
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.refresh(token, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
    this.setRefreshCookie(res, session.refreshToken, session.refreshExpiresIn);
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { totp: true },
    });
    return this.users.toDto(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('password/change')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>,
  ) {
    await this.auth.changePassword(userId, body.current, body.next);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  async mfaSetup(@CurrentUser() userId: string) {
    return this.totp.beginSetup(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/confirm')
  @HttpCode(200)
  async mfaConfirm(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(z.object({ code: z.string().regex(/^\d{6}$/) })))
    body: { code: string },
  ) {
    return this.totp.confirm(userId, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/disable')
  @HttpCode(204)
  async mfaDisable(@CurrentUser() userId: string) {
    await this.totp.disable(userId);
  }

  private setRefreshCookie(res: Response, token: string, ttlSec: number) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/api/auth',
      maxAge: ttlSec * 1000,
    });
  }
}

