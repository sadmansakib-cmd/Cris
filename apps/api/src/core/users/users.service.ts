import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import type { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data: { ...data, email: data.email.toLowerCase() } });
  }

  async updatePassword(userId: string, passwordHash: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  toDto(user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
    totp?: { confirmedAt: Date | null } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      mfaEnabled: !!user.totp?.confirmedAt,
    };
  }
}
