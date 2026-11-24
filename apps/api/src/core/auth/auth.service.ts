import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { LoginInput, RegisterInput } from '@hault/shared';
import { PrismaService } from '../prisma/prisma.module';
import { CryptoService } from '../crypto/crypto.module';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { TotpService } from './totp.service';

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 1,
} as const;

export interface AuthContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly crypto: CryptoService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly totp: TotpService,
  ) {}

  async register(input: RegisterInput, ctx: AuthContext) {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTS);
    const user = await this.users.create({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    });

    await this.audit.record({
      userId: user.id,
      actorType: 'user',
      action: 'auth:register',
      outcome: 'success',
      ip: ctx.ip,
    });

    return this.issueSession(user.id, ctx);
  }

  async login(input: LoginInput, ctx: AuthContext) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { totp: true },
    });

    // Argon2 verify against a dummy hash if user missing to keep timing constant
    const hash = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=1$YWFhYWFhYWFhYWFhYWFhYQ$b0PzYmU4bnBhYw';
    const ok = await argon2.verify(hash, input.password).catch(() => false);
    if (!user || !ok || user.status !== 'ACTIVE') {
      await this.audit.record({
        actorType: 'user',
        action: 'auth:login',
        outcome: 'deny',
        target: input.email,
        ip: ctx.ip,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.totp?.confirmedAt) {
      if (!input.totpCode) {
        // Signal MFA required to the client
        throw new UnauthorizedException({ message: 'MFA required', mfaRequired: true });
      }
      const valid = await this.totp.verify(user.id, input.totpCode);
      if (!valid) {
        await this.audit.record({
          userId: user.id,
          actorType: 'user',
          action: 'auth:mfa',
          outcome: 'deny',
          ip: ctx.ip,
        });
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    await this.audit.record({
      userId: user.id,
      actorType: 'user',
      action: 'auth:login',
      outcome: 'success',
      ip: ctx.ip,
    });
    return this.issueSession(user.id, ctx);
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    const refreshHash = this.crypto.sha256(refreshToken);
    await this.prisma.session.updateMany({
      where: { refreshHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async refresh(refreshToken: string, ctx: AuthContext) {
    if (!refreshToken) throw new UnauthorizedException();
    const refreshHash = this.crypto.sha256(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { refreshHash } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }
    // rotate
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issueSession(session.userId, ctx);
  }

  async changePassword(userId: string, current: string, next: string) {
    if (next.length < 12) throw new BadRequestException('Password too short');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new UnauthorizedException();
    const ok = await argon2.verify(user.passwordHash, current);
    if (!ok) throw new UnauthorizedException('Current password incorrect');
    const passwordHash = await argon2.hash(next, ARGON2_OPTS);
    await this.users.updatePassword(userId, passwordHash);
    await this.audit.record({
      userId,
      actorType: 'user',
      action: 'auth:password_change',
      outcome: 'success',
    });
  }

  async issueSession(userId: string, ctx: AuthContext) {
    const accessTtl = Number(this.config.get('JWT_ACCESS_TTL') ?? 600);
    const refreshTtl = Number(this.config.get('JWT_REFRESH_TTL') ?? 60 * 60 * 24 * 30);

    const accessToken = await this.jwt.signAsync({ sub: userId }, { expiresIn: accessTtl });
    const refreshToken = this.crypto.randomToken(32);
    const refreshHash = this.crypto.sha256(refreshToken);

    await this.prisma.session.create({
      data: {
        userId,
        refreshHash,
        userAgent: ctx.userAgent,
        ip: ctx.ip,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { totp: true },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTtl,
      refreshExpiresIn: refreshTtl,
      user: this.users.toDto(user),
    };
  }
  async upsertOAuthUser(params: { provider: string; providerId: string; email: string; name?: string }) {
    let acc = await this.prisma.oAuthAccount.findUnique({ where: { provider_providerId: { provider: params.provider, providerId: params.providerId } } });
    let userId = acc?.userId;
    if (!userId) {
      let u = await this.prisma.user.findUnique({ where: { email: params.email } });
      if (!u) {
        u = await this.prisma.user.create({ data: { email: params.email, displayName: params.name || 'User' } });
      }
      userId = u.id;
      await this.prisma.oAuthAccount.create({ data: { provider: params.provider, providerId: params.providerId, userId } });
    }
    return this.issueSession(userId, { ip: '127.0.0.1', userAgent: 'oauth' });
  }
}
