import httpClient from '../api/httpClient.js';

/**
 * v2 (Postgres) API layer. Additive — v1 services are untouched.
 *
 * Auth note (dual-DB transition): v1 JWTs carry Mongo ids, which do not exist
 * in Postgres. Until the Mongo→PG migration links accounts, v2 pages keep a
 * SEPARATE token (priosync_v2_token) obtained via v2 register/login with the
 * same credentials. v1 session is never disturbed.
 */

export const V2_TOKEN_KEY = 'priosync_v2_token';

export const getV2Token = () => {
  try {
    return localStorage.getItem(V2_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setV2Token = (token) => {
  try {
    if (token) localStorage.setItem(V2_TOKEN_KEY, token);
    else localStorage.removeItem(V2_TOKEN_KEY);
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
};

const v2Headers = () => {
  const token = getV2Token();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const unwrap = async (promise) => {
  const { data } = await promise;
  return data;
};

export const v2Auth = {
  async register(payload) {
    const data = await unwrap(httpClient.post('/v2/auth/register', payload, { headers: v2Headers() }));
    if (data?.token) setV2Token(data.token);
    return data;
  },
  async login(payload) {
    const data = await unwrap(httpClient.post('/v2/auth/login', payload, { headers: v2Headers() }));
    if (data?.token) setV2Token(data.token);
    return data;
  },
  async me() {
    return unwrap(httpClient.get('/v2/auth/me', { headers: v2Headers() }));
  },
  logout() {
    setV2Token(null);
  },
};

export const v2Planner = {
  async parse(payload) {
    return unwrap(httpClient.post('/v2/planner/parse', payload, { headers: v2Headers() }));
  },
  async confirm(payload) {
    return unwrap(httpClient.post('/v2/planner/confirm', payload, { headers: v2Headers() }));
  },
  async plans() {
    return unwrap(httpClient.get('/v2/plans', { headers: v2Headers() }));
  },
  async plan(id) {
    return unwrap(httpClient.get(`/v2/plans/${id}`, { headers: v2Headers() }));
  },
};

export const v2Replans = {
  async missed() {
    return unwrap(httpClient.get('/v2/replans/missed', { headers: v2Headers() }));
  },
  async propose(payload) {
    return unwrap(httpClient.post('/v2/replans/propose', payload, { headers: v2Headers() }));
  },
  async accept(payload) {
    return unwrap(httpClient.post('/v2/replans/accept', payload, { headers: v2Headers() }));
  },
  async log() {
    return unwrap(httpClient.get('/v2/replans/log', { headers: v2Headers() }));
  },
};

export const v2Recommendations = {
  async override(payload) {
    return unwrap(httpClient.post('/v2/recommendations/override', payload, { headers: v2Headers() }));
  },
  async accept(recommendedTaskId) {
    return unwrap(httpClient.post('/v2/recommendations/accept', { recommendedTaskId }, { headers: v2Headers() }));
  },
  async adherence() {
    return unwrap(httpClient.get('/v2/recommendations/adherence', { headers: v2Headers() }));
  },
};

export const v2Tasks = {
  async next({ minutes, energy } = {}) {
    const params = {};
    if (minutes) params.minutes = minutes;
    if (energy) params.energy = energy;
    return unwrap(httpClient.get('/v2/tasks/next', { params, headers: v2Headers() }));
  },
  async explain(id) {
    return unwrap(httpClient.get(`/v2/tasks/${id}/explain`, { headers: v2Headers() }));
  },
  async complete(id) {
    return unwrap(httpClient.put(`/v2/tasks/${id}`, { status: 'completed' }, { headers: v2Headers() }));
  },
  async logFocusSession(payload) {
    return unwrap(httpClient.post('/v2/tasks/focus-session', payload, { headers: v2Headers() }));
  },
};
