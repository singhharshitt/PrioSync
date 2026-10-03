import httpClient from '../api/httpClient.js';

/**
 * v2 (Postgres) API layer. The client is fully cut over to /api/v2 - one
 * session (priosync_token) shared with authService/taskService; the
 * Authorization header is attached by the httpClient request interceptor.
 */

const unwrap = async (promise) => {
  const { data } = await promise;
  return data;
};

export const v2Planner = {
  async parse(payload) {
    return unwrap(httpClient.post('/v2/planner/parse', payload));
  },
  async confirm(payload) {
    return unwrap(httpClient.post('/v2/planner/confirm', payload));
  },
  async plans() {
    return unwrap(httpClient.get('/v2/plans'));
  },
  async plan(id) {
    return unwrap(httpClient.get(`/v2/plans/${id}`));
  },
};

export const v2Replans = {
  async missed() {
    return unwrap(httpClient.get('/v2/replans/missed'));
  },
  async propose(payload) {
    return unwrap(httpClient.post('/v2/replans/propose', payload));
  },
  async accept(payload) {
    return unwrap(httpClient.post('/v2/replans/accept', payload));
  },
  async log() {
    return unwrap(httpClient.get('/v2/replans/log'));
  },
};

export const v2Recommendations = {
  async override(payload) {
    return unwrap(httpClient.post('/v2/recommendations/override', payload));
  },
  async accept(recommendedTaskId) {
    return unwrap(httpClient.post('/v2/recommendations/accept', { recommendedTaskId }));
  },
  async adherence() {
    return unwrap(httpClient.get('/v2/recommendations/adherence'));
  },
};

export const v2Tasks = {
  async next({ minutes, energy } = {}) {
    const params = {};
    if (minutes) params.minutes = minutes;
    if (energy) params.energy = energy;
    return unwrap(httpClient.get('/v2/tasks/next', { params }));
  },
  async explain(id) {
    return unwrap(httpClient.get(`/v2/tasks/${id}/explain`));
  },
  async complete(id) {
    return unwrap(httpClient.put(`/v2/tasks/${id}`, { status: 'completed' }));
  },
  async logFocusSession(payload) {
    return unwrap(httpClient.post('/v2/tasks/focus-session', payload));
  },
};
