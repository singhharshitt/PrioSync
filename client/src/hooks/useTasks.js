import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import taskService from '../services/taskService.js';

const emptyGraph = { nodes: [], edges: [] };
const TASKS_SYNC_EVENT = 'priosync:tasks:sync';
const TASKS_SYNC_STORAGE_KEY = 'priosync:tasks:sync-ts';

const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [topTasks, setTopTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [dagData, setDagData] = useState(emptyGraph);
  const [pendingRequests, setPendingRequests] = useState(0);
  const lastTasksParamsRef = useRef({});
  const loadedCollectionsRef = useRef({
    tasks: false,
    topTasks: false,
    stats: false,
    dag: false,
  });
  const syncRequestRef = useRef(null);
  const instanceIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
      loadedCollectionsRef.current.tasks = true;
      lastTasksParamsRef.current = params;
      const data = await withLoading(() => taskService.getTasks(params));
      setTasks(data?.tasks || []);
      return data?.tasks || [];
    },
    [withLoading],
  );

  const fetchTopTasks = useCallback(async () => {
    loadedCollectionsRef.current.topTasks = true;
    const data = await withLoading(() => taskService.getTopTasks());
    setTopTasks(data?.tasks || []);
    return data?.tasks || [];
  }, [withLoading]);

  const fetchStats = useCallback(async () => {
    loadedCollectionsRef.current.stats = true;
    const data = await withLoading(() => taskService.getStats());
    setStats(data?.stats || null);
    return data?.stats || null;
  }, [withLoading]);

  const fetchDAG = useCallback(async () => {
    loadedCollectionsRef.current.dag = true;
    const data = await withLoading(() => taskService.getDAG());
    setDagData(data?.graph || emptyGraph);
    return data?.graph || emptyGraph;
  }, [withLoading]);

  const refreshLoadedCollections = useCallback(async () => {
    if (syncRequestRef.current) {
      await syncRequestRef.current;
      return;
    }

    const loaded = loadedCollectionsRef.current;
    const requests = [];

    if (loaded.tasks) {
      requests.push(fetchTasks(lastTasksParamsRef.current));
    }
    if (loaded.topTasks) {
      requests.push(fetchTopTasks());
    }
    if (loaded.stats) {
      requests.push(fetchStats());
    }
    if (loaded.dag) {
      requests.push(fetchDAG());
    }

    if (requests.length === 0) return;

    syncRequestRef.current = Promise.allSettled(requests).finally(() => {
      syncRequestRef.current = null;
    });

    await syncRequestRef.current;
  }, [fetchDAG, fetchStats, fetchTasks, fetchTopTasks]);

  const broadcastSync = useCallback(() => {
    if (typeof window === 'undefined') return;

    const timestamp = Date.now();
    window.dispatchEvent(
      new CustomEvent(TASKS_SYNC_EVENT, {
        detail: { source: instanceIdRef.current, timestamp },
      }),
    );

    try {
      localStorage.setItem(TASKS_SYNC_STORAGE_KEY, String(timestamp));
    } catch {
      // Ignore storage errors in restricted/private browser contexts.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleSyncEvent = (event) => {
      if (event?.detail?.source === instanceIdRef.current) return;
      void refreshLoadedCollections();
    };

    const handleStorageEvent = (event) => {
      if (event.key !== TASKS_SYNC_STORAGE_KEY) return;
      void refreshLoadedCollections();
    };

    window.addEventListener(TASKS_SYNC_EVENT, handleSyncEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener(TASKS_SYNC_EVENT, handleSyncEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [refreshLoadedCollections]);

  const createTask = useCallback(
    async (payload) => {
      const data = await withLoading(() => taskService.createTask(payload));
      await refreshLoadedCollections();
      broadcastSync();
      return data?.task;
    },
    [broadcastSync, refreshLoadedCollections, withLoading],
  );

  const updateTask = useCallback(
    async (id, payload) => {
      const data = await withLoading(() => taskService.updateTask(id, payload));
      await refreshLoadedCollections();
      broadcastSync();
      return data?.task;
    },
    [broadcastSync, refreshLoadedCollections, withLoading],
  );

  const deleteTask = useCallback(
    async (id) => {
      await withLoading(() => taskService.deleteTask(id));
      await refreshLoadedCollections();
      broadcastSync();
    },
    [broadcastSync, refreshLoadedCollections, withLoading],
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
