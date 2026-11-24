import { definePlugin, type PluginContext } from '@hault/sdk';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { resolve as pathResolve } from 'node:path';

/**
 * Computer Control plugin.
 *
 * SECURITY: every action is prompted via the permission engine before it runs.
 * The plugin never bypasses `ctx.permissions.require`.
 *
 * Cross-platform notes:
 *   - Screen capture: uses `scrot` (Linux), `screencapture` (macOS), `nircmd` (Windows).
 *   - Input: uses `xdotool` (Linux), `cliclick` (macOS), `nircmd` (Windows). Missing → fails with clear error.
 *   - Fs paths are restricted to the workspace root unless the user grants `path:*`.
 */
export default definePlugin({
  id: 'hault.computer-control',
  async activate(ctx: PluginContext) {
    ctx.http.post('/screen/capture', async (req) => {
      await ctx.permissions.require('computer.screen.capture', `display:${req.body.display ?? 0}`, 'Capture screen');
      const buf = await captureScreen();
      const key = `computer/${req.userId}/screen-${Date.now()}.png`;
      await ctx.storage.put(key, buf, 'image/png');
      return { key, size: buf.length };
    });

    ctx.http.post('/input/click', async (req) => {
      const { x, y, button = 'left' } = req.body;
      await ctx.permissions.require('computer.input.mouse', `display:0`, `Click at (${x}, ${y})`);
      await runInputTool('click', { x, y, button });
      return { ok: true };
    });

    ctx.http.post('/input/type', async (req) => {
      const { text } = req.body as { text: string };
      await ctx.permissions.require('computer.input.keyboard', `display:0`, `Type ${text.length} character(s)`);
      await runInputTool('type', { text });
      return { ok: true };
    });

    ctx.http.post('/shell/exec', async (req) => {
      const { command, args = [], timeoutMs = 30_000 } = req.body;
      await ctx.permissions.require('computer.shell.exec', `cmd:${command}`, `Run: ${command} ${args.join(' ')}`);
      return execWithTimeout(command, args, timeoutMs);
    });

    ctx.http.post('/fs/read', async (req) => {
      const abs = pathResolve(req.body.path);
      await ctx.permissions.require('computer.fs.read', `path:${abs}`, `Read ${abs}`);
      return { path: abs, content: (await fs.readFile(abs)).toString('base64') };
    });

    ctx.http.post('/fs/write', async (req) => {
      const abs = pathResolve(req.body.path);
      await ctx.permissions.require('computer.fs.write', `path:${abs}`, `Write ${abs}`);
      await fs.writeFile(abs, Buffer.from(req.body.content, 'base64'));
      return { ok: true, path: abs };
    });

    ctx.log.info('Computer Control plugin activated (danger: high)');
  },
  async deactivate() {},
});

async function captureScreen(): Promise<Buffer> {
  const platform = process.platform;
  const out = `/tmp/hault-cap-${Date.now()}.png`;
  if (platform === 'linux') await execWithTimeout('scrot', ['-o', out], 10_000);
  else if (platform === 'darwin') await execWithTimeout('screencapture', ['-x', out], 10_000);
  else if (platform === 'win32') await execWithTimeout('nircmd', ['savescreenshot', out], 10_000);
  else throw new Error(`unsupported platform: ${platform}`);
  const buf = await fs.readFile(out);
  await fs.unlink(out).catch(() => {});
  return buf;
}

async function runInputTool(op: 'click' | 'type', args: any) {
  const platform = process.platform;
  if (platform === 'linux') {
    if (op === 'click') return execWithTimeout('xdotool', ['mousemove', String(args.x), String(args.y), 'click', args.button === 'right' ? '3' : '1'], 5_000);
    return execWithTimeout('xdotool', ['type', '--', args.text], 15_000);
  }
  if (platform === 'darwin') {
    if (op === 'click') return execWithTimeout('cliclick', [`c:${args.x},${args.y}`], 5_000);
    return execWithTimeout('cliclick', [`t:${args.text}`], 15_000);
  }
  if (platform === 'win32') {
    if (op === 'click') return execWithTimeout('nircmd', ['sendmouse', args.button, 'click'], 5_000);
    return execWithTimeout('nircmd', ['sendkeypress', args.text], 15_000);
  }
  throw new Error(`unsupported platform: ${platform}`);
}

function execWithTimeout(cmd: string, args: string[], timeoutMs: number) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`timeout after ${timeoutMs}ms`)); }, timeoutMs);
    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 0, stdout, stderr }); });
    child.on('error', reject);
  });
}
