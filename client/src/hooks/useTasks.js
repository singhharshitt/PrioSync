import { useCallback, useMemo, useState } from 'react';
import taskService from '../services/taskService.js';

const emptyGraph = { nodes: [], edges: [] };

const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [topTasks, setTopTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [dagData, setDagData] = useState(emptyGraph);
  const [pendingRequests, setPendingRequests] = useState(0);

  const withLoading = useCallback(async (requestFn) => {
    setPendingRequests((value) => value + 1);
    try {
      return await requestFn();
    } finally {
      setPendingRequests((value) => Math.max(0, value - 1));
    }
  }, []);

  const fetchTasks = useCallback(
    async (params = {}) => {
      const data = await withLoading(() => taskService.getTasks(params));
      setTasks(data?.tasks || []);
      return data?.tasks || [];
    },
    [withLoading],
  );

  const fetchTopTasks = useCallback(async () => {
    const data = await withLoading(() => taskService.getTopTasks());
    setTopTasks(data?.tasks || []);
    return data?.tasks || [];
  }, [withLoading]);

  const fetchStats = useCallback(async () => {
    const data = await withLoading(() => taskService.getStats());
    setStats(data?.stats || null);
    return data?.stats || null;
  }, [withLoading]);

  const fetchDAG = useCallback(async () => {
    const data = await withLoading(() => taskService.getDAG());
    setDagData(data?.graph || emptyGraph);
    return data?.graph || emptyGraph;
  }, [withLoading]);

  const createTask = useCallback(
    async (payload) => {
      const data = await withLoading(() => taskService.createTask(payload));
      const createdTask = data?.task;
      if (createdTask) {
        setTasks((current) => [createdTask, ...current]);
        setTopTasks((current) => [createdTask, ...current].slice(0, 5));
      }
      return createdTask;
    },
    [withLoading],
  );

  const updateTask = useCallback(
    async (id, payload) => {
      const data = await withLoading(() => taskService.updateTask(id, payload));
      const updatedTask = data?.task;
      if (updatedTask) {
        setTasks((current) =>
          current.map((task) => (task._id === id ? updatedTask : task)),
        );
        setTopTasks((current) =>
          current.map((task) => (task._id === id ? updatedTask : task)),
        );
      }
      return updatedTask;
    },
    [withLoading],
  );

  const deleteTask = useCallback(
    async (id) => {
      await withLoading(() => taskService.deleteTask(id));
      setTasks((current) => current.filter((task) => task._id !== id));
      setTopTasks((current) => current.filter((task) => task._id !== id));
    },
    [withLoading],
  );

  return useMemo(
    () => ({
      tasks,
      topTasks,
      stats,
      dagData,
      loading: pendingRequests > 0,
      fetchTasks,
      fetchTopTasks,
      fetchStats,
      fetchDAG,
      createTask,
      updateTask,
      deleteTask,
    }),
    [
      tasks,
      topTasks,
      stats,
      dagData,
      pendingRequests,
      fetchTasks,
      fetchTopTasks,
      fetchStats,
      fetchDAG,
      createTask,
      updateTask,
      deleteTask,
    ],
  );
};

export default useTasks;
