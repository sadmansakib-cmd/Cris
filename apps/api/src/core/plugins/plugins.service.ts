import { Injectable } from '@nestjs/common';
import { pluginManifestSchema, type PluginManifest } from '@hault/shared';
import { PrismaService } from '../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PluginsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Install (or upsert) a plugin. Runtime loading of untrusted plugin code
   * happens through the PluginRuntime (worker_threads sandbox) — this service
   * only manages registry state + manifest validation.
   */
  async install(rawManifest: unknown, source: 'builtin' | 'local' | 'registry', actorUserId: string) {
    const manifest: PluginManifest = pluginManifestSchema.parse(rawManifest);
    const plugin = await this.prisma.plugin.upsert({
      where: { slug: manifest.slug },
      update: {
        name: manifest.name,
        version: manifest.version,
        source,
        manifest: manifest as never,
      },
      create: {
        slug: manifest.slug,
        name: manifest.name,
        version: manifest.version,
        source,
        manifest: manifest as never,
      },
    });
    await this.audit.record({
      userId: actorUserId,
      actorType: 'user',
      action: 'plugin:install',
      target: manifest.slug,
      outcome: 'success',
      metadata: { version: manifest.version },
    });
    return plugin;
  }

  list() {
    return this.prisma.plugin.findMany({ orderBy: { installedAt: 'asc' } });
  }

  async setEnabled(slug: string, enabled: boolean, actorUserId: string) {
    const plugin = await this.prisma.plugin.update({ where: { slug }, data: { enabled } });
    await this.audit.record({
      userId: actorUserId,
      actorType: 'user',
      action: enabled ? 'plugin:enable' : 'plugin:disable',
      target: slug,
      outcome: 'success',
    });
    return plugin;
  }

  async uninstall(slug: string, actorUserId: string) {
    await this.prisma.plugin.delete({ where: { slug } });
    await this.audit.record({
      userId: actorUserId,
      actorType: 'user',
      action: 'plugin:uninstall',
      target: slug,
      outcome: 'success',
    });
  }

  async installForUser(userId: string, slug: string) {
    return this.prisma.pluginInstall.upsert({
      where: { userId_pluginSlug: { userId, pluginSlug: slug } },
      update: { enabled: true },
      create: { userId, pluginSlug: slug, enabled: true },
    });
  }

  listForUser(userId: string) {
    return this.prisma.pluginInstall.findMany({
      where: { userId },
      include: { plugin: true },
    });
  }
}
