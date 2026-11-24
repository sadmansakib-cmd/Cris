const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
async function main() {
  const users = await prisma.user.findMany();
  console.log(users);
}
main();
