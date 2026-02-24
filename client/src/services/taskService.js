import httpClient from '../api/httpClient.js';

const taskService = {
  async getTasks(params = {}) {
    const { data } = await httpClient.get('/tasks', { params });
    return data;
  },

  async getTask(id) {
    const { data } = await httpClient.get(`/tasks/${id}`);
    return data;
  },

  async getTopTasks() {
    const { data } = await httpClient.get('/tasks/top');
    return data;
  },

  async getStats() {
    const { data } = await httpClient.get('/tasks/stats');
    return data;
  },

  async getDAG() {
    const { data } = await httpClient.get('/tasks/dag');
    return data;
  },

  async createTask(payload) {
    const { data } = await httpClient.post('/tasks', payload);
    return data;
  },

  async updateTask(id, payload) {
    const { data } = await httpClient.put(`/tasks/${id}`, payload);
    return data;
  },

  async deleteTask(id) {
    const { data } = await httpClient.delete(`/tasks/${id}`);
    return data;
  },

  async logFocusSession(payload) {
    const { data } = await httpClient.post('/tasks/focus-session', payload);
    return data;
  },
};

export default taskService;
