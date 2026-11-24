/**
 * Native bridge — detects Tauri (desktop) or React Native (mobile) hosts and
 * exposes a single async API to the web app. Falls back to HTTP-only mode in
 * the browser. Computer Control and Voice & Vision plugins use this bridge to
 * prefer native capabilities when available.
 */
type Platform = 'web' | 'desktop' | 'mobile';

interface TauriGlobal {
  core?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
    __HAULT_MOBILE__?: {
      invoke: (cmd: string, args?: unknown) => Promise<unknown>;
    };
  }
}

export function platform(): Platform {
  if (typeof window === 'undefined') return 'web';
  if (window.__TAURI__) return 'desktop';
  if (window.__HAULT_MOBILE__) return 'mobile';
  return 'web';
}

export const isNative = () => platform() !== 'web';

export async function invokeNative<T = unknown>(cmd: string, args?: unknown): Promise<T> {
  const p = platform();
  if (p === 'desktop' && window.__TAURI__?.core?.invoke) {
    return (await window.__TAURI__.core.invoke(cmd, args as Record<string, unknown>)) as T;
  }
  if (p === 'mobile' && window.__HAULT_MOBILE__) {
    return (await window.__HAULT_MOBILE__.invoke(cmd, args)) as T;
  }
  throw new Error(`native command '${cmd}' unavailable in ${p}`);
}

export async function nativeInfo() {
  if (!isNative()) return { platform: 'web' as const };
  return invokeNative<{ platform: string; version: string }>('native_info');
}
