import httpClient from '../api/httpClient.js';

const unwrap = async (promise) => {
  const { data } = await promise;
  return data;
};

const ai = {
  async status() {
    return unwrap(httpClient.get('/v2/ai/status'));
  },
  async scenarioIntent(payload) {
    return unwrap(httpClient.post('/v2/ai/scenario-intent', payload));
  },
  async focusBrief(payload = {}) {
    return unwrap(httpClient.post('/v2/ai/focus-brief', payload));
  },
  async sessionReflection(payload) {
    return unwrap(httpClient.post('/v2/ai/session-reflection', payload));
  },
  async smartNotes(payload) {
    return unwrap(httpClient.post('/v2/ai/smart-notes', payload));
  },
  async traceability() {
    return unwrap(httpClient.get('/v2/insights/traceability'));
  },
  async efficiency(params = {}) {
    return unwrap(httpClient.get('/v2/insights/efficiency', { params }));
  },
  async planDebt() {
    return unwrap(httpClient.get('/v2/insights/plan-debt'));
  },
  async allocation(params = {}) {
    return unwrap(httpClient.get('/v2/insights/allocation', { params }));
  },
  async resilience(params = {}) {
    return unwrap(httpClient.get('/v2/insights/resilience', { params }));
  },
  async resolve(payload = {}) {
    return unwrap(httpClient.post('/v2/insights/resolve', payload));
  },
  async recovery(payload = {}) {
    return unwrap(httpClient.post('/v2/insights/recovery', payload));
  },
};

export default ai;
