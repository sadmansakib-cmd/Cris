import { Body, Controller, Post, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { PrismaService } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

const RP_NAME = 'HAULT';

@Controller('auth/webauthn')
export class WebAuthnController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {}

  private getRpId(): string {
    return this.config.get('WEBAUTHN_RP_ID') || 'localhost';
  }

  private getOrigin(): string {
    return this.config.get('APP_URL') || 'http://localhost:5173';
  }

  @UseGuards(JwtAuthGuard)
  @Post('register/options')
  async registerOptions(@CurrentUser() userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { credentials: true } });
    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: this.getRpId(),
      userID: Buffer.from(user.id), userName: user.email,
      attestationType: 'none',
      excludeCredentials: user.credentials.map((c: any) => ({ id: c.credentialId, type: 'public-key' })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    await this.prisma.systemSetting.upsert({ where: { namespace_key: { namespace: 'webauthn', key: userId } }, update: { value: options.challenge as any }, create: { namespace: 'webauthn', key: userId, value: options.challenge as any } });
    return options;
  }

  @UseGuards(JwtAuthGuard)
  @Post('register/verify')
  async registerVerify(@CurrentUser() userId: string, @Body() body: any) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const challengeSetting = await this.prisma.systemSetting.findUnique({ where: { namespace_key: { namespace: 'webauthn', key: userId } } });
    if (!challengeSetting?.value) throw new UnauthorizedException('no challenge');
    const v = await verifyRegistrationResponse({
      response: body, expectedChallenge: challengeSetting.value as string, expectedOrigin: this.getOrigin(), expectedRPID: this.getRpId(),
    });
    if (!v.verified || !v.registrationInfo) throw new UnauthorizedException('verification failed');
    const credentialID = (v.registrationInfo as any).credentialID;
    const credentialPublicKey = (v.registrationInfo as any).credentialPublicKey;
    const counter = (v.registrationInfo as any).counter;
    await this.prisma.credential.create({
      data: {
        userId, credentialId: Buffer.from(credentialID), publicKey: Buffer.from(credentialPublicKey), counter, label: 'Passkey',
      },
    });
    await this.prisma.systemSetting.delete({ where: { namespace_key: { namespace: 'webauthn', key: userId } } });
    return { ok: true };
  }

  @Post('login/options')
  async loginOptions(@Body() body: { email: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: body.email }, include: { credentials: true } });
    if (!user) throw new UnauthorizedException();
    const options = await generateAuthenticationOptions({
      rpID: this.getRpId(), userVerification: 'preferred',
      allowCredentials: user.credentials.map((c: any) => ({ id: c.credentialId, type: 'public-key' })),
    });
    await this.prisma.systemSetting.upsert({ where: { namespace_key: { namespace: 'webauthn', key: user.id } }, update: { value: options.challenge as any }, create: { namespace: 'webauthn', key: user.id, value: options.challenge as any } });
    return options;
  }

  @Post('login/verify')
  async loginVerify(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: { email: string; response: any }) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { email: body.email }, include: { credentials: true } });
    const challengeSetting = await this.prisma.systemSetting.findUnique({ where: { namespace_key: { namespace: 'webauthn', key: user.id } } });
    if (!challengeSetting?.value) throw new UnauthorizedException('no challenge');
    const cred = user.credentials.find((c: any) => Buffer.compare(c.credentialId, Buffer.from(body.response.id, 'base64url')) === 0);
    if (!cred) throw new UnauthorizedException('unknown credential');
    const v = await verifyAuthenticationResponse({
      response: body.response, expectedChallenge: challengeSetting.value as string, expectedOrigin: this.getOrigin(), expectedRPID: this.getRpId(),
      // @ts-ignore
      authenticator: { credentialID: cred.credentialId, credentialPublicKey: cred.publicKey, counter: cred.counter },
    });
    if (!v.verified) throw new UnauthorizedException();
    await this.prisma.credential.update({ where: { id: cred.id }, data: { counter: v.authenticationInfo.newCounter } });
    const session = await this.auth.issueSession(user.id, { ip: req.ip ?? '127.0.0.1', userAgent: req.get?.('user-agent') ?? 'webauthn' });
    this.setRefreshCookie(res, session.refreshToken, session.refreshExpiresIn);
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
  }

  private setRefreshCookie(res: Response, token: string, ttlSec: number) {
    res.cookie('hault_refresh', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/api/auth',
      maxAge: ttlSec * 1000,
    });
  }
}
