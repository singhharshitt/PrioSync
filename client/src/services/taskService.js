import httpClient from '../api/httpClient.js';

const taskService = {
  async getTasks(params = {}) {
    const { data } = await httpClient.get('/v2/tasks', { params });
    return data;
  },

  async getTask(id) {
    const { data } = await httpClient.get(`/v2/tasks/${id}`);
    return data;
  },

  async getTopTasks() {
    const { data } = await httpClient.get('/v2/tasks/top');
    return data;
  },

  async getStats() {
    const { data } = await httpClient.get('/v2/tasks/stats');
    return data;
  },

  async getDAG() {
    const { data } = await httpClient.get('/v2/tasks/dag');
    return data;
  },

  async createTask(payload) {
    const { data } = await httpClient.post('/v2/tasks', payload);
    return data;
  },

  async updateTask(id, payload) {
    const { data } = await httpClient.put(`/v2/tasks/${id}`, payload);
    return data;
  },

  async deleteTask(id) {
    const { data } = await httpClient.delete(`/v2/tasks/${id}`);
    return data;
  },

  async logFocusSession(payload) {
    const { data } = await httpClient.post('/v2/tasks/focus-session', payload);
    return data;
  },
};

export default taskService;
