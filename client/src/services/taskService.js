import api from './api.js';

const taskService = {
    /** GET /api/tasks */
    getTasks: (params) => api.get('/tasks', { params }),
    /** GET /api/tasks/top */
    getTopTasks: () => api.get('/tasks/top'),
    /** GET /api/tasks/stats */
    getStats: () => api.get('/tasks/stats'),
    /** GET /api/tasks/dag */
    getDAG: () => api.get('/tasks/dag'),
    /** GET /api/tasks/:id */
    getTask: (id) => api.get(`/tasks/${id}`),
    /** POST /api/tasks */
    createTask: (data) => api.post('/tasks', data),
    /** PUT /api/tasks/:id */
    updateTask: (id, data) => api.put(`/tasks/${id}`, data),
    /** DELETE /api/tasks/:id */
    deleteTask: (id) => api.delete(`/tasks/${id}`),
};

export default taskService;
