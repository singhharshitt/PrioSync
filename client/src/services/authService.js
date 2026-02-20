import api from './api.js';

const authService = {
    /** POST /api/auth/register */
    register: (data) => api.post('/auth/register', data),
    /** POST /api/auth/login */
    login: (data) => api.post('/auth/login', data),
    /** GET /api/auth/me */
    getMe: () => api.get('/auth/me'),
    /** PUT /api/auth/profile */
    updateProfile: (data) => api.put('/auth/profile', data),
};

export default authService;
