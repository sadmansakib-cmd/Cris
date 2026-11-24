/**
 * Initial seed: creates the first admin from SEED_ADMIN_EMAIL,
 * prints a temporary random password to stdout (must be changed on first login).
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
  const displayName = process.env.SEED_ADMIN_NAME ?? 'Admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] admin ${email} already exists — skipping`);
    return;
  }

  const tempPassword = randomBytes(18).toString('base64url');
  const passwordHash = await argon2.hash(tempPassword, {
    type: argon2.argon2id,
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 1,
  });

  await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      isAdmin: true,
      mustChangePassword: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('─'.repeat(60));
  console.log(`[seed] admin user created`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${tempPassword}`);
  console.log(`  ↑ change immediately on first login`);
  console.log('─'.repeat(60));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
