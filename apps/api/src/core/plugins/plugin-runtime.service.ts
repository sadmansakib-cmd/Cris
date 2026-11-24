import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { resolve } from 'node:path';
import { PluginSandbox } from './sandbox/plugin-sandbox';
import { PrismaService } from '../prisma/prisma.module';
import { PermissionsEngine } from '../permissions/permissions.engine';
import { AuditService } from '../audit/audit.service';

/**
 * Bridges the sandboxed plugin workers to host capabilities:
 *   - permissions.require   → PermissionsEngine.require
 *   - storage.get/set       → per-plugin PluginKV row
 *   - log                   → forwarded to Nest logger + audit
 *
 * All plugin-originating RPCs are gated through the permission engine.
 */
@Injectable()
export class PluginRuntimeService implements OnModuleInit {
  private readonly log = new Logger(PluginRuntimeService.name);

  constructor(
    private readonly sandbox: PluginSandbox,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsEngine,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    // Permission prompt bridge — route through PermissionsEngine
    this.sandbox.on('permissions.require', async (args, pluginId) => {
      const userId = args.userId;
      if (!userId) {
        this.log.warn(`Plugin ${pluginId} requested permission without userId — denied`);
        return { granted: false, reason: 'no_user_context' };
      }
      try {
        await this.permissions.require(userId, pluginId, args.action, args.scope ?? {});
        return { granted: true, ttlMs: 60000 };
      } catch (err: any) {
        this.log.warn(`Plugin ${pluginId} permission denied: ${args.action} — ${err?.message}`);
        return { granted: false, reason: err?.message ?? 'denied' };
      }
    });

    // Per-plugin key/value store (isolated by pluginId, no cross-plugin reads)
    this.sandbox.on('storage.get', async ({ key }, pluginId) => {
      const row = await this.prisma.systemSetting.findUnique({
        where: { namespace_key: { namespace: pluginId, key } },
      }).catch(() => null);
      return row?.value ?? null;
    });

    this.sandbox.on('storage.set', async ({ key, value }, pluginId) => {
      await this.prisma.systemSetting.upsert({
        where: { namespace_key: { namespace: pluginId, key } },
        update: { value: value as any },
        create: { namespace: pluginId, key, value: value as any },
      });
      return { ok: true };
    });

    this.sandbox.on('audit.record', async (args, pluginId) => {
      await this.audit.record({
        userId: args.userId ?? null,
        actorType: 'plugin',
        action: `plugin:${pluginId}:${args.action}`,
        target: args.target ?? null,
        outcome: args.outcome ?? 'success',
        metadata: args.metadata ?? {},
      });
      return { ok: true };
    });
  }

  async start(slug: string) {
    const plugin = await this.prisma.plugin.findUniqueOrThrow({ where: { slug } });
    if (!plugin.enabled) throw new Error(`plugin ${slug} is disabled`);
    const entry = resolve(process.cwd(), 'plugins', slug, 'dist', 'index.js');
    await this.sandbox.spawn(slug, entry, { idleMs: 5 * 60_000, heapMb: 128 });
    this.log.log(`started plugin ${slug}`);
    return { started: true };
  }

  async stop(slug: string) {
    await this.sandbox.terminate(slug, 'manual');
    return { stopped: true };
  }

  async invoke(slug: string, method: string, args: unknown) {
    if (!this.sandbox.list().includes(slug)) {
      await this.start(slug);
    }
    return this.sandbox.call(slug, method, args);
  }

  running() {
    return this.sandbox.list();
  }
}
