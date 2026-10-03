import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'priosync_token';
export const AUTH_UNAUTHORIZED_EVENT = 'priosync:auth:unauthorized';

/** Pre-cutover dual-session key (removed — migrated to the main token at boot). */
const LEGACY_V2_TOKEN_KEY = 'priosync_v2_token';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Decode (unverified — the server is the authority) the `id` claim to tell a
 * v2 token (UUID user id, Postgres) from a stale v1 token (Mongo ObjectId).
 */
const decodeTokenId = (token) => {
  try {
    const payload = token?.split('.')[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded))?.id ?? null;
  } catch {
    return null;
  }
};

const isV2Token = (token) => UUID_RE.test(decodeTokenId(token) || '');

/**
 * One-time session migration after the client cut over from /api (Mongo) to
 * /api/v2 (Postgres):
 * - adopt a valid legacy dual-session v2 token when no main token exists;
 * - drop stale v1 tokens (their Mongo ids don't resolve in Postgres — they
 *   would only cause a confusing 401 on the first request);
 * - always clear the legacy key so only one session survives.
 */
const migrateStoredSession = () => {
  try {
    const main = localStorage.getItem(TOKEN_STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_V2_TOKEN_KEY);
    const mainOk = isV2Token(main);
    const legacyOk = isV2Token(legacy);

    if (!mainOk && legacyOk) {
      localStorage.setItem(TOKEN_STORAGE_KEY, legacy);
    } else if (!mainOk) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    localStorage.removeItem(LEGACY_V2_TOKEN_KEY);
  } catch {
    // Storage unavailable (restricted contexts) — nothing to migrate.
  }
};

migrateStoredSession();

const envBaseURL = import.meta.env.VITE_API_URL?.trim();
const baseURL = envBaseURL ? envBaseURL.replace(/\/+$/, '') : '/api';

const httpClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    httpClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  localStorage.removeItem(TOKEN_STORAGE_KEY);
  delete httpClient.defaults.headers.common.Authorization;
};

const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
if (storedToken) {
  setAuthToken(storedToken);
}

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      }
    }
    return Promise.reject(error);
  },
);

export default httpClient;
