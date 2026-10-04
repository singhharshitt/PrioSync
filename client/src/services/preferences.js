import httpClient from '../api/httpClient.js';

const unwrap = async (promise) => {
  const { data } = await promise;
  return data;
};

const preferences = {
  async get() {
    return unwrap(httpClient.get('/v2/preferences'));
  },
  async update(payload) {
    return unwrap(httpClient.put('/v2/preferences', payload));
  },
};

export default preferences;
