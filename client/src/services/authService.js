import httpClient, { TOKEN_STORAGE_KEY, setAuthToken } from '../api/httpClient.js';

const authService = {
  async register(payload) {
    const { data } = await httpClient.post('/v2/auth/register', payload);
    if (data?.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async login(payload) {
    const { data } = await httpClient.post('/v2/auth/login', payload);
    if (data?.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async getMe() {
    const { data } = await httpClient.get('/v2/auth/me');
    return data;
  },

  async updateProfile(payload) {
    return httpClient.put('/v2/auth/profile', payload);
  },

  logout() {
    setAuthToken(null);
  },

  getStoredToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  },
};

export default authService;
