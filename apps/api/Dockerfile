# ─── build stage ─────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/sdk/package.json    packages/sdk/
COPY apps/api/package.json        apps/api/
RUN pnpm install --frozen-lockfile=false
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @hault/api prisma:generate
RUN pnpm --filter @hault/api build

# ─── runtime stage ───────────────────────────────────────────
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
  && apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/apps/api/package.json ./package.json
COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
