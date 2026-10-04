import httpClient from '../api/httpClient.js';

const unwrap = async (promise) => {
  const { data } = await promise;
  return data;
};

const insights = {
  async risk(params = {}) {
    return unwrap(httpClient.get('/v2/insights/risk', { params }));
  },
  async criticalPath(params = {}) {
    return unwrap(httpClient.get('/v2/insights/critical-path', { params }));
  },
  async bottlenecks(params = {}) {
    return unwrap(httpClient.get('/v2/insights/bottlenecks', { params }));
  },
  async capacity(params = {}) {
    return unwrap(httpClient.get('/v2/insights/capacity', { params }));
  },
  async explain(id) {
    return unwrap(httpClient.get(`/v2/tasks/${id}/explain`));
  },
  async simulate(payload) {
    return unwrap(httpClient.post('/v2/insights/simulate', payload));
  },
  async deviations(params = {}) {
    return unwrap(httpClient.get('/v2/insights/deviations', { params }));
  },
  async drift() {
    return unwrap(httpClient.get('/v2/insights/drift'));
  },
  async autoReplan(payload = {}) {
    return unwrap(httpClient.post('/v2/insights/auto-replan', payload));
  },
  async dayPlan(params = {}) {
    return unwrap(httpClient.get('/v2/insights/day-plan', { params }));
  },
};

export default insights;
