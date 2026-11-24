/**
 * ProviderRegistry — resolves a live implementation for each capability.
 * Selection is driven by env: {KIND}_DEFAULT_PROVIDER selects the default.
 * Plugins request providers via ctx.provider(kind).
 */
import { Global, Inject, Injectable, Logger, Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AIProvider } from './ai/ai.interface';
import type { StorageProvider } from './storage/storage.interface';
import type { EmailProvider } from './email/email.interface';
import { OpenAIProvider } from './ai/openai.provider';
import { AnthropicProvider } from './ai/anthropic.provider';
import { GeminiProvider } from './ai/gemini.provider';
import { LocalStorageProvider } from './storage/local.provider';
import { SmtpEmailProvider } from './email/smtp.provider';

export type ProviderKind = 'ai' | 'storage' | 'email';

@Injectable()
export class ProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger('providers');
  private readonly registry = new Map<ProviderKind, Map<string, unknown>>();
  private readonly defaults = new Map<ProviderKind, string>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    // AI
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) this.register('ai', new OpenAIProvider(openaiKey));
    const anthKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthKey) this.register('ai', new AnthropicProvider(anthKey));
    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    if (geminiKey) this.register('ai', new GeminiProvider(geminiKey));
    this.defaults.set('ai', this.config.get<string>('AI_DEFAULT_PROVIDER') ?? 'openai');

    // Storage
    if (this.config.get<string>('STORAGE_DEFAULT_PROVIDER') === 'local') {
      this.register('storage', new LocalStorageProvider(this.config.getOrThrow('STORAGE_LOCAL_ROOT')));
      this.defaults.set('storage', 'local');
    }
    // (S3 impl deferred — interface + local ready)

    // Email
    this.register(
      'email',
      new SmtpEmailProvider({
        host: this.config.getOrThrow('SMTP_HOST'),
        port: Number(this.config.get('SMTP_PORT')),
        secure: Boolean(this.config.get('SMTP_SECURE')),
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
        from: this.config.getOrThrow('EMAIL_FROM'),
      }),
    );
    this.defaults.set('email', 'smtp');

    for (const [kind, impls] of this.registry.entries()) {
      this.logger.log(`${kind}: ${[...impls.keys()].join(', ')} (default: ${this.defaults.get(kind)})`);
    }
  }

  register<T extends { id: string }>(kind: ProviderKind, impl: T) {
    if (!this.registry.has(kind)) this.registry.set(kind, new Map());
    this.registry.get(kind)!.set(impl.id, impl);
  }

  get<T = unknown>(kind: 'ai', id?: string): AIProvider;
  get<T = unknown>(kind: 'storage', id?: string): StorageProvider;
  get<T = unknown>(kind: 'email', id?: string): EmailProvider;
  get<T = unknown>(kind: ProviderKind, id?: string): T {
    const impls = this.registry.get(kind);
    if (!impls || impls.size === 0) throw new Error(`No providers registered for kind "${kind}"`);
    const key = id ?? this.defaults.get(kind);
    if (!key) throw new Error(`No default provider for kind "${kind}"`);
    const impl = impls.get(key);
    if (!impl) throw new Error(`Provider "${key}" not registered for kind "${kind}"`);
    return impl as T;
  }

  /** Return all registered implementations for a given kind. */
  getAll<T = unknown>(kind: ProviderKind): Map<string, T> {
    return (this.registry.get(kind) ?? new Map()) as Map<string, T>;
  }
}

@Global()
@Module({
  providers: [ProviderRegistry],
  exports: [ProviderRegistry],
})
export class ProvidersModule {}
