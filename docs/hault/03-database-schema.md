# 03 — Database Schema (Phase 1 Core)

PostgreSQL 16 via Prisma. Plugin tables are added by plugin migrations at install time, always prefixed `plugin_<slug>_`.

```prisma
// prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "postgresql" url = env("DATABASE_URL") }

// ── Users & Auth ────────────────────────────────────────────────
model User {
  id             String   @id @default(cuid())
  email          String   @unique
  emailVerifiedAt DateTime?
  passwordHash   String?              // argon2id; null if only OAuth/passkey
  displayName    String
  avatarUrl      String?
  locale         String   @default("en")
  timezone       String   @default("UTC")
  status         UserStatus @default(ACTIVE)
  isAdmin        Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  sessions       Session[]
  credentials    Credential[]         // WebAuthn passkeys
  totp           TotpSecret?
  oauthAccounts  OAuthAccount[]
  grants         PermissionGrant[]
  auditLogs      AuditLog[]
  notifications  Notification[]
  settings       UserSetting[]
  pluginInstalls PluginInstall[]
}
enum UserStatus { ACTIVE SUSPENDED DELETED }

model Session {
  id             String   @id @default(cuid())
  userId         String
  refreshHash    String   @unique     // sha256 of refresh token
  userAgent      String?
  ip             String?
  expiresAt      DateTime
  revokedAt      DateTime?
  createdAt      DateTime @default(now())
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model TotpSecret {
  userId       String   @id
  secretEnc    Bytes                  // AES-256-GCM, key from KMS/env
  confirmedAt  DateTime?
  recoveryHash String[]               // hashed recovery codes
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Credential {                    // WebAuthn / passkeys
  id             String   @id @default(cuid())
  userId         String
  credentialId   Bytes    @unique
  publicKey      Bytes
  counter        BigInt
  transports     String[]
  label          String
  createdAt      DateTime @default(now())
  lastUsedAt     DateTime?
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model OAuthAccount {
  id           String @id @default(cuid())
  userId       String
  provider     String              // "google" | "github" | "microsoft" | ...
  providerId   String
  accessTokenEnc  Bytes?
  refreshTokenEnc Bytes?
  expiresAt    DateTime?
  user         User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerId])
}

// ── Permissions ─────────────────────────────────────────────────
model PermissionGrant {
  id          String   @id @default(cuid())
  userId      String
  pluginSlug  String                 // "core" for core actions
  action      String                 // e.g. "files:read", "email:send"
  scope       Json                   // { path: "/notes/*" } etc.
  grantedAt   DateTime @default(now())
  expiresAt   DateTime?
  revokedAt   DateTime?
  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, pluginSlug, action])
}

model AuditLog {
  id          String   @id @default(cuid())
  userId      String?
  actorType   String                 // "user" | "plugin" | "system"
  actorId     String?
  action      String
  target      String?
  outcome     String                 // "allow" | "deny" | "success" | "error"
  metadata    Json?
  ip          String?
  createdAt   DateTime @default(now())
  user        User? @relation(fields: [userId], references: [id])
  @@index([userId, createdAt])
  @@index([action, createdAt])
}

// ── Notifications & Settings ────────────────────────────────────
model Notification {
  id         String   @id @default(cuid())
  userId     String
  kind       String
  title      String
  body       String?
  data       Json?
  readAt     DateTime?
  createdAt  DateTime @default(now())
  user       User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, readAt])
}

model UserSetting {
  userId    String
  namespace String                   // "core.theme" | "plugin.<slug>"
  key       String
  value     Json
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, namespace, key])
}

model SystemSetting {
  namespace String
  key       String
  value     Json
  updatedAt DateTime @updatedAt
  @@id([namespace, key])
}

// ── Plugin Registry ─────────────────────────────────────────────
model Plugin {
  slug        String   @id
  name        String
  version     String
  source      String                 // "builtin" | "local" | "registry"
  manifest    Json
  enabled     Boolean  @default(true)
  installedAt DateTime @default(now())
  installs    PluginInstall[]
}

model PluginInstall {
  id         String @id @default(cuid())
  userId     String
  pluginSlug String
  enabled    Boolean @default(true)
  settings   Json    @default("{}")
  installedAt DateTime @default(now())
  user       User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  plugin     Plugin @relation(fields: [pluginSlug], references: [slug], onDelete: Cascade)
  @@unique([userId, pluginSlug])
}
```

## Migrations & seed

- `prisma migrate dev` in dev, `prisma migrate deploy` in prod.
- `seed.ts` creates: first admin user (from `SEED_ADMIN_EMAIL` env, temp password printed to stdout), default system settings, built-in plugin registrations.
- Plugin migrations live in `plugins/<slug>/prisma/migrations/` and are applied by the Plugin Runtime during install.

## Encryption at rest

- Fields ending in `Enc` are AES-256-GCM ciphertext.
- Key comes from `ENCRYPTION_KEY` (32-byte base64). Rotate via a re-encrypt job.
