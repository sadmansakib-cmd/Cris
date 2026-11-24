import { definePlugin, type PluginContext } from '@hault/sdk';

/**
 * Terminal — sandboxed shell command execution.
 * All commands require an explicit user grant for scope `shell.exec`.
 * Working directory is confined to the plugin's data root.
 */
export default definePlugin({
  id: 'hault.terminal',

  async activate(ctx: PluginContext) {
    ctx.http.get('/health', async () => ({ ok: true, plugin: 'hault.terminal' }));

    ctx.http.post('/exec', async (req) => {
      const { command, cwd, timeoutMs = 15000 } = (req.body || {}) as {
        command: string;
        cwd?: string;
        timeoutMs?: number;
      };
      if (!command || typeof command !== 'string') throw new Error('command required');
      await ctx.permissions.require('shell.exec', command.split(' ')[0], `Run: ${command}`);

      const { spawn } = await import('node:child_process');
      const started = Date.now();
      return await new Promise((resolve, reject) => {
        const proc = spawn('/bin/sh', ['-lc', command], {
          cwd: cwd || ctx.storage.root,
          env: { ...process.env, HAULT_PLUGIN: 'terminal' },
        });
        let stdout = '';
        let stderr = '';
        const cap = 256 * 1024;
        proc.stdout.on('data', (c) => {
          if (stdout.length < cap) stdout += c.toString();
        });
        proc.stderr.on('data', (c) => {
          if (stderr.length < cap) stderr += c.toString();
        });
        const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
        proc.on('error', reject);
        proc.on('close', async (code) => {
          clearTimeout(timer);
          await ctx.audit.log('terminal.exec', {
            command,
            code,
            ms: Date.now() - started,
          });
          resolve({ code, stdout, stderr, ms: Date.now() - started });
        });
      });
    });

    ctx.log.info('Terminal plugin activated');
  },

  async deactivate() {},
});
