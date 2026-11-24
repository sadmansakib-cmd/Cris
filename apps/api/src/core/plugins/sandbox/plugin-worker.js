// Worker-thread entry point for a sandboxed HAULT plugin.
// This file is intentionally plain JS so it can be required by the Worker without a TS loader.
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const { randomUUID } = require('node:crypto');

const { pluginId, entryPath } = workerData;
const pending = new Map(); // rpc id → { resolve, reject }

function rpc(method, args) {
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    pending.set(id, { resolve, reject });
    parentPort.postMessage({ kind: 'rpc:call', id, method, args });
  });
}

function log(level, message) {
  parentPort.postMessage({ kind: 'log', level, message: String(message) });
}

// Minimal PluginContext exposed to the plugin. Every I/O goes through host RPC.
const ctx = {
  pluginId,
  log: {
    info: (m) => log('info', m),
    warn: (m) => log('warn', m),
    error: (m) => log('error', m),
  },
  permissions: {
    require: (action, scope, reason) => rpc('permissions.require', { action, scope, reason }),
  },
  storage: {
    get: (key) => rpc('storage.get', { key }).then((b) => Buffer.from(b, 'base64')),
    put: (key, data, contentType) => rpc('storage.put', { key, data: Buffer.from(data).toString('base64'), contentType }),
    delete: (key) => rpc('storage.delete', { key }),
    list: (prefix) => rpc('storage.list', { prefix }),
  },
  settings: {
    getAll: () => rpc('settings.getAll', {}),
    get: (k) => rpc('settings.get', { key: k }),
  },
  ai: {
    chat: {
      complete: (req) => rpc('ai.chat.complete', req),
      stream: async function* (req) {
        // Streaming across worker boundary — host emits chunks as separate rpc:call reverse messages.
        const streamId = await rpc('ai.chat.stream.start', req);
        while (true) {
          const chunk = await rpc('ai.chat.stream.next', { streamId });
          if (chunk.done) return;
          yield chunk.delta;
        }
      },
    },
  },
  http: {
    _routes: [],
    get: (path, h) => ctx.http._routes.push({ method: 'GET', path, handler: h }),
    post: (path, h) => ctx.http._routes.push({ method: 'POST', path, handler: h }),
    put: (path, h) => ctx.http._routes.push({ method: 'PUT', path, handler: h }),
    delete: (path, h) => ctx.http._routes.push({ method: 'DELETE', path, handler: h }),
  },
  ws: {
    _handlers: new Map(),
    on: (event, handler) => ctx.ws._handlers.set(event, handler),
  },
};

let plugin;
async function activate() {
  const mod = require(entryPath);
  plugin = mod.default || mod;
  if (typeof plugin.activate === 'function') await plugin.activate(ctx);
  // Register discovered routes/ws handlers with the host.
  await rpc('plugin.register', {
    routes: ctx.http._routes.map((r) => ({ method: r.method, path: r.path })),
    events: [...ctx.ws._handlers.keys()],
  });
  return { ok: true };
}

async function deactivate() {
  if (plugin?.deactivate) await plugin.deactivate();
}

async function dispatchHttp({ method, path, body, userId }) {
  const route = ctx.http._routes.find((r) => r.method === method && r.path === path);
  if (!route) throw new Error('route not found');
  return route.handler({ method, path, body, userId });
}

async function dispatchWs({ event, data, socketData }) {
  const h = ctx.ws._handlers.get(event);
  if (!h) throw new Error('event not handled');
  // Provide a minimal socket shim; `emit` goes back through host.
  const socket = {
    data: socketData,
    emit: (ev, payload) => rpc('ws.emit', { socketId: socketData.socketId, event: ev, payload }),
  };
  return h(data, socket);
}

parentPort.on('message', async (m) => {
  if (m.kind === 'rpc:reply') {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.ok ? p.resolve(m.result) : p.reject(new Error(m.error));
    return;
  }
  if (m.kind !== 'rpc:call') return;
  try {
    let result;
    if (m.method === 'activate') result = await activate();
    else if (m.method === 'deactivate') result = await deactivate();
    else if (m.method === 'http.dispatch') result = await dispatchHttp(m.args);
    else if (m.method === 'ws.dispatch') result = await dispatchWs(m.args);
    else throw new Error(`unknown method: ${m.method}`);
    parentPort.postMessage({ kind: 'rpc:reply', id: m.id, ok: true, result });
  } catch (err) {
    parentPort.postMessage({ kind: 'rpc:reply', id: m.id, ok: false, error: String(err?.message || err) });
  }
});
