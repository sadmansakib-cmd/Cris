/**
 * @hault/sdk — the ONLY module a plugin author should import from.
 *
 * A plugin bundles a server entry (exports a `definePlugin(...)` default)
 * and/or a web entry (exports React components + route/sidebar declarations).
 * The host resolves provider handles, permission checks, storage, and event
 * bus injection at load time — plugins never `require` host internals.
 */
import type { PluginManifest } from '@hault/shared';

export type { PluginManifest, PermissionAction, PermissionScope } from '@hault/shared';

export interface PluginLogger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface PluginHttpRequest {
  body: any;
  query: Record<string, any>;
  params: Record<string, string>;
  headers: Record<string, string>;
  userId: string;
  user: { id: string; email: string };
}

export type PluginHttpHandler = (req: PluginHttpRequest) => Promise<any> | any;

export interface PluginHttp {
  get(path: string, handler: PluginHttpHandler): void;
  post(path: string, handler: PluginHttpHandler): void;
  put(path: string, handler: PluginHttpHandler): void;
  patch(path: string, handler: PluginHttpHandler): void;
  delete(path: string, handler: PluginHttpHandler): void;
}

export interface PluginWsSocket {
  id: string;
  data: { userId: string; [k: string]: any };
  emit(event: string, payload: unknown): void;
}

export interface PluginWs {
  on(event: string, handler: (msg: any, socket: PluginWsSocket) => Promise<void> | void): void;
  emit(userId: string, event: string, payload: unknown): void;
}

export interface PluginPermissions {
  /** Prompt the user (or resolve cached grant) for an action within a scope. Throws PermissionDenied on refusal. */
  require(action: string, scope: string, reason: string): Promise<void>;
  check(action: string, scope: string): Promise<boolean>;
}

export interface PluginStorage {
  get(key: string): Promise<Buffer>;
  put(key: string, data: Buffer, contentType?: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<Array<{ key: string; size: number; updatedAt: string }>>;
}

export interface PluginNet {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export interface PluginOAuth {
  /** Returns a valid access token for the connected provider account, refreshing if needed. */
  getAccessToken(provider: string): Promise<string | null>;
}

export interface PluginAudit {
  log(action: string, meta?: Record<string, unknown>): Promise<void>;
}

export interface PluginSettings {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
}

export interface PluginHost {
  /** Invoke another plugin's HTTP surface by id. */
  invoke<T = unknown>(pluginId: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T>;
  /** Host-registered providers (ocr, stt, tts, wakeword, …). */
  providers: Record<string, unknown>;
}

export interface PluginScheduler {
  /** Register a cron-style recurring job (5-field cron expression). */
  cron(expr: string, handler: () => Promise<void> | void): { cancel(): void };
  /** Run a one-shot job after N milliseconds. */
  after(ms: number, handler: () => Promise<void> | void): { cancel(): void };
}

export interface PluginEvents {
  on(event: string, handler: (payload: any) => Promise<void> | void): { off(): void };
  emit(event: string, payload: unknown): Promise<void>;
}

export interface PluginKv {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSec?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PluginContext {
  slug: string;
  log: PluginLogger;
  /** Back-compat alias for `log`. */
  logger: PluginLogger;
  http: PluginHttp;
  ws: PluginWs;
  permissions: PluginPermissions;
  /** Short alias for `permissions`. */
  perms: PluginPermissions;
  storage: PluginStorage;
  net: PluginNet;
  oauth: PluginOAuth;
  audit: PluginAudit;
  settings: PluginSettings;
  kv: PluginKv;
  host: PluginHost;
  scheduler: PluginScheduler;
  events: PluginEvents;
  provider<T = unknown>(kind: 'ai' | 'storage' | 'email' | 'vector' | 'queue'): T;
  emit(event: string, payload: unknown): void;
}

export interface PluginDefinition {
  id: string;
  manifest?: Pick<PluginManifest, 'slug' | 'name' | 'version'>;
  activate(ctx: PluginContext): Promise<void> | void;
  deactivate(ctx?: PluginContext): Promise<void> | void;
}

export function definePlugin(def: PluginDefinition): PluginDefinition {
  return def;
}
