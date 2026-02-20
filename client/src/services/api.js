import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Axios instance with JWT Authorization header injection
 */
const api = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
});

// ── Request Interceptor — attach JWT token ────────────────────────────────
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('priosync_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response Interceptor — handle 401 globally ────────────────────────────
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('priosync_token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
