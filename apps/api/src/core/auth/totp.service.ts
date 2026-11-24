import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { authenticator } from 'otplib';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.module';
import { CryptoService } from '../crypto/crypto.module';

@Injectable()
export class TotpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async beginSetup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'HAULT', secret);

    // Store unconfirmed; overwrites any prior unconfirmed setup
    await this.prisma.totpSecret.upsert({
      where: { userId },
      update: {
        secretEnc: this.crypto.encrypt(secret, `totp:${userId}`),
        confirmedAt: null,
        recoveryHash: [],
      },
      create: {
        userId,
        secretEnc: this.crypto.encrypt(secret, `totp:${userId}`),
      },
    });

    return { otpauth, secret };
  }

  async confirm(userId: string, code: string) {
    const row = await this.prisma.totpSecret.findUnique({ where: { userId } });
    if (!row) throw new NotFoundException('No pending TOTP setup');
    const secret = this.crypto.decrypt(Buffer.from(row.secretEnc), `totp:${userId}`).toString('utf8');
    if (!authenticator.check(code, secret)) throw new BadRequestException('Invalid code');

    const recovery = Array.from({ length: 10 }, () => randomBytes(6).toString('hex'));
    const recoveryHash = recovery.map((r) => createHash('sha256').update(r).digest('hex'));

    await this.prisma.totpSecret.update({
      where: { userId },
      data: { confirmedAt: new Date(), recoveryHash },
    });

    return { recoveryCodes: recovery };
  }

  async verify(userId: string, code: string): Promise<boolean> {
    const row = await this.prisma.totpSecret.findUnique({ where: { userId } });
    if (!row?.confirmedAt) return false;
    const secret = this.crypto.decrypt(Buffer.from(row.secretEnc), `totp:${userId}`).toString('utf8');
    if (authenticator.check(code, secret)) return true;

    // recovery code fallback
    const codeHash = createHash('sha256').update(code).digest('hex');
    if (row.recoveryHash.includes(codeHash)) {
      await this.prisma.totpSecret.update({
        where: { userId },
        data: { recoveryHash: row.recoveryHash.filter((h: any) => h !== codeHash) },
      });
      return true;
    }
    return false;
  }

  async disable(userId: string) {
    await this.prisma.totpSecret.deleteMany({ where: { userId } });
  }
}
