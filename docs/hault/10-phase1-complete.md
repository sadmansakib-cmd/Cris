# Phase 1 — completion notes

Files added in this milestone:

## API
- `apps/api/src/core/permissions/permissions.gateway.ts` — Socket.IO gateway for real-time
  permission prompts (`permission:prompt` / `permission:decision` / `permission:panic`).
- `apps/api/src/core/auth/oauth.controller.ts` — Google + GitHub OAuth2 with PKCE.
- `apps/api/src/core/auth/webauthn.controller.ts` — Passkey registration + assertion via
  `@simplewebauthn/server`. Requires new Prisma model `WebAuthnCredential` and
  `User.webauthnChallenge` field.
- `apps/api/src/core/providers/storage/s3.storage.ts` — S3-compatible storage provider
  (AWS, R2, MinIO, B2, Wasabi). Configured via `S3_*` env vars.

## Plugins (Phase 2 — computer control)
- `plugins/ai-chat/` — reference AI Chat plugin (manifest + streaming completions).
- `plugins/computer-control/` — screen capture, mouse/keyboard, shell exec, fs read/write.
  Every action is gated by an explicit permission prompt. Uses OS-native tools
  (`scrot` / `screencapture` / `nircmd`, `xdotool` / `cliclick` / `nircmd`).

## Plugin Sandbox
- `apps/api/src/core/plugins/sandbox/plugin-sandbox.ts` — Worker-thread supervisor with
  resource limits, idle timeout, and RPC message bus.
- `apps/api/src/core/plugins/sandbox/plugin-worker.js` — Worker entry that loads a plugin's
  entry file, exposes a `PluginContext` shim, and routes all I/O back to the host.

## New dependencies (add via `pnpm add` in the relevant workspace)
- `apps/api`: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`,
  `@simplewebauthn/server`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
- `plugins/computer-control` requires OS binaries: `scrot`+`xdotool` on Linux,
  `cliclick` on macOS, `nircmd` on Windows.

## Prisma migration required
Add to `schema.prisma`:
```prisma
model WebAuthnCredential {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  credentialId Bytes    @unique
  publicKey    Bytes
  counter      Int      @default(0)
  createdAt    DateTime @default(now())
}
model User {
  // ...existing fields
  webauthnChallenge String?
  credentials       WebAuthnCredential[]
}
```
Then: `pnpm --filter @hault/api prisma:migrate`.
