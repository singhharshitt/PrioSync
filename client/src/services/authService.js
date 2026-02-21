import httpClient, { TOKEN_STORAGE_KEY, setAuthToken } from '../api/httpClient.js';

const authService = {
  async register(payload) {
    const { data } = await httpClient.post('/auth/register', payload);
    if (data?.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async login(payload) {
    const { data } = await httpClient.post('/auth/login', payload);
    if (data?.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async getMe() {
    const { data } = await httpClient.get('/auth/me');
    return data;
  },

  async updateProfile(payload) {
    return httpClient.put('/auth/profile', payload);
  },

  logout() {
    setAuthToken(null);
  },

  getStoredToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  },
};

export default authService;
