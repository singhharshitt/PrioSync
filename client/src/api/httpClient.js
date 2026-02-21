import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'priosync_token';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      setAuthToken(null);
    }
    return Promise.reject(error);
  },
);

export default httpClient;
