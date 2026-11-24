/// <reference types="vite/client" />
/**
 * Minimal fetch client with automatic access-token attach + refresh.
 * The refresh token lives in an httpOnly cookie; we never see it.
 */
const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3000';
export const API_BASE = API_URL;


let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown) {
    super(`HTTP ${status}`);
  }
}

async function refresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean; data?: { accessToken: string }; accessToken?: string };
    const unwrapped = data.success && data.data ? data.data : data;
    accessToken = unwrapped.accessToken ?? null;
    return accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiFetch<T = any>(
  path: string,
  init: RequestInit & { skipRefresh?: boolean } = {},
): Promise<T> {
  const doFetch = async (token: string | null): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    
    // Ensure path starts with /api/ if it doesn't already
    let normalized = path.startsWith('/') ? path : `/${path}`;
    if (!normalized.startsWith('/api/')) {
      normalized = `/api${normalized}`;
    }
    
    return fetch(`${API_URL}${normalized}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  };

  let res = await doFetch(accessToken);
  if (res.status === 401 && !init.skipRefresh) {
    const fresh = await refresh();
    if (fresh) res = await doFetch(fresh);
  }

  const text = await res.text();
  let payload = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, payload);
  if (payload && typeof payload === 'object' && 'success' in (payload as any) && 'data' in (payload as any)) {
    payload = (payload as any).data;
  }
  return payload as T;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
