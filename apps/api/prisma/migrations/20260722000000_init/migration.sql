-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Session
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session"("refreshHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TotpSecret
CREATE TABLE "TotpSecret" (
    "userId" TEXT NOT NULL,
    "secretEnc" BYTEA NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "recoveryHash" TEXT[],
    CONSTRAINT "TotpSecret_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "TotpSecret" ADD CONSTRAINT "TotpSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Credential
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" BYTEA NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL,
    "transports" TEXT[],
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Credential_credentialId_key" ON "Credential"("credentialId");
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OAuthAccount
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessTokenEnc" BYTEA,
    "refreshTokenEnc" BYTEA,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OAuthAccount_provider_providerId_key" ON "OAuthAccount"("provider", "providerId");
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PermissionGrant
CREATE TABLE "PermissionGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pluginSlug" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" JSONB NOT NULL DEFAULT '{}',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "PermissionGrant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PermissionGrant_userId_pluginSlug_action_idx" ON "PermissionGrant"("userId", "pluginSlug", "action");
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserSetting
CREATE TABLE "UserSetting" (
    "userId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("userId", "namespace", "key")
);
ALTER TABLE "UserSetting" ADD CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SystemSetting
CREATE TABLE "SystemSetting" (
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("namespace", "key")
);

-- Plugin
CREATE TABLE "Plugin" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("slug")
);

-- PluginInstall
CREATE TABLE "PluginInstall" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pluginSlug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PluginInstall_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PluginInstall_userId_pluginSlug_key" ON "PluginInstall"("userId", "pluginSlug");
ALTER TABLE "PluginInstall" ADD CONSTRAINT "PluginInstall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PluginInstall" ADD CONSTRAINT "PluginInstall_pluginSlug_fkey" FOREIGN KEY ("pluginSlug") REFERENCES "Plugin"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- ChatThread
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "model" TEXT,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChatThread_userId_updatedAt_idx" ON "ChatThread"("userId", "updatedAt");

-- ChatMessage
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
