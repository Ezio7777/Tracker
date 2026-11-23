export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Access token lives in memory only (never localStorage); refresh token is an httpOnly cookie.
let accessToken = null;
let refreshing = null;
let onAuthLost = () => {};

export const getAccessToken = () => accessToken;
export const setAccessToken = (t) => { accessToken = t; };
export const setAuthLostHandler = (fn) => { onAuthLost = fn; };

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function raw(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.message || 'Request failed', json?.error?.details);
  return json;
}

// Concurrent callers share one refresh request (the server rotates tokens, so two would collide).
export function refreshSession() {
  if (!refreshing) {
    refreshing = raw('/auth/refresh', { method: 'POST' })
      .then((j) => { accessToken = j.data.accessToken; return j.data.user; })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(path, opts) {
  try {
    return await raw(path, opts);
  } catch (err) {
    if (err.status === 401 && !path.startsWith('/auth/')) {
      try {
        await refreshSession();
      } catch {
        accessToken = null;
        onAuthLost();
        throw err;
      }
      return raw(path, opts); // retry once with the new token
    }
    throw err;
  }
}
