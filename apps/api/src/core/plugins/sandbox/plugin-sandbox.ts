import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Worker-thread plugin sandbox.
 *
 * Each plugin instance runs in its own Worker with:
 *   - No shared memory with the host (transferable messages only)
 *   - resourceLimits (maxOldGenerationSizeMb, maxYoungGenerationSizeMb, codeRangeSizeMb)
 *   - No filesystem or network access — all I/O is proxied via the host through RPC
 *   - Idle timeout: worker terminated after N ms with no messages
 *
 * The worker script (`plugin-worker.js`) loads the plugin's entry file, wires up
 * a `PluginContext` shim whose methods post messages back to the host, and waits
 * for the host to route them (permissions, storage, ai, http, ws).
 */
type PendingRpc = { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout };

@Injectable()
export class PluginSandbox {
  private readonly log = new Logger(PluginSandbox.name);
  private readonly workers = new Map<string, Worker>();
  private readonly pending = new Map<string, PendingRpc>();
  private readonly bus = new EventEmitter();

  /**
   * Host-side handler for RPC calls originating in a plugin worker.
   * Register once per capability with `sandbox.on('permissions.require', async (args) => …)`.
   */
  on(method: string, handler: (args: any, pluginId: string) => Promise<any> | any) {
    this.bus.on(method, async (payload) => {
      try {
        const result = await handler(payload.args, payload.pluginId);
        payload.reply({ ok: true, result });
      } catch (err: any) {
        payload.reply({ ok: false, error: String(err?.message || err) });
      }
    });
  }

  async spawn(pluginId: string, entryPath: string, opts: { idleMs?: number; heapMb?: number } = {}) {
    if (this.workers.has(pluginId)) throw new Error(`plugin ${pluginId} already running`);
    const worker = new Worker(resolve(__dirname, 'plugin-worker.js'), {
      workerData: { pluginId, entryPath },
      env: {},
      resourceLimits: {
        maxOldGenerationSizeMb: opts.heapMb ?? 128,
        maxYoungGenerationSizeMb: 16,
        codeRangeSizeMb: 16,
      },
    });

    let idleTimer: NodeJS.Timeout | null = null;
    const bumpIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => this.terminate(pluginId, 'idle'), opts.idleMs ?? 5 * 60_000);
    };
    bumpIdle();

    worker.on('message', (m: any) => {
      bumpIdle();
      if (m.kind === 'rpc:call') {
        this.bus.emit(m.method, {
          args: m.args, pluginId,
          reply: (r: any) => worker.postMessage({ kind: 'rpc:reply', id: m.id, ...r }),
        });
      } else if (m.kind === 'rpc:reply') {
        const p = this.pending.get(m.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(m.id);
        m.ok ? p.resolve(m.result) : p.reject(new Error(m.error));
      } else if (m.kind === 'log') {
        this.log.log(`[${pluginId}] ${m.level}: ${m.message}`);
      }
    });

    worker.on('error', (e) => this.log.error(`plugin ${pluginId} crashed`, e));
    worker.on('exit', (code) => {
      this.log.warn(`plugin ${pluginId} exited (code ${code})`);
      this.workers.delete(pluginId);
      if (idleTimer) clearTimeout(idleTimer);
    });

    this.workers.set(pluginId, worker);
    await this.call(pluginId, 'activate', {});
  }

  /** Call a method inside a plugin worker (host → plugin). */
  call(pluginId: string, method: string, args: any, timeoutMs = 30_000) {
    const worker = this.workers.get(pluginId);
    if (!worker) throw new Error(`plugin ${pluginId} not running`);
    return new Promise<any>((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`plugin rpc timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      worker.postMessage({ kind: 'rpc:call', id, method, args });
    });
  }

  async terminate(pluginId: string, reason: string) {
    const w = this.workers.get(pluginId);
    if (!w) return;
    this.log.log(`terminating plugin ${pluginId} (${reason})`);
    try { await this.call(pluginId, 'deactivate', {}, 5_000); } catch {}
    await w.terminate();
    this.workers.delete(pluginId);
  }

  list() { return [...this.workers.keys()]; }
}
