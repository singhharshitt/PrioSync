import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import taskService from '../services/taskService.js';

/**
 * useTasks — provides task CRUD, stats, DAG, and top tasks
 */
const useTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [topTasks, setTopTasks] = useState([]);
    const [stats, setStats] = useState(null);
    const [dagData, setDagData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchTasks = useCallback(async (params = {}) => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await taskService.getTasks(params);
            setTasks(data.tasks);
            return data;
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to load tasks.';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTopTasks = useCallback(async () => {
        try {
            const { data } = await taskService.getTopTasks();
            setTopTasks(data.tasks);
            return data.tasks;
        } catch {
            // silent fail for top tasks
        }
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            const { data } = await taskService.getStats();
            setStats(data.stats);
            return data.stats;
        } catch (err) {
            console.error('Stats fetch error:', err);
        }
    }, []);

    const fetchDAG = useCallback(async () => {
        try {
            const { data } = await taskService.getDAG();
            setDagData(data.graph);
            return data.graph;
        } catch {
            // silent fail
        }
    }, []);

    const createTask = useCallback(async (taskData) => {
        try {
            const { data } = await taskService.createTask(taskData);
            setTasks((prev) => [data.task, ...prev]);
            toast.success('Task created successfully! 🎯');
            return data.task;
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to create task.';
            toast.error(msg);
            throw err;
        }
    }, []);

    const updateTask = useCallback(async (id, taskData) => {
        try {
            const { data } = await taskService.updateTask(id, taskData);
            setTasks((prev) => prev.map((t) => (t._id === id ? data.task : t)));
            toast.success('Task updated! ✅');
            return data.task;
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to update task.';
            toast.error(msg);
            throw err;
        }
    }, []);

    const deleteTask = useCallback(async (id) => {
        try {
            await taskService.deleteTask(id);
            setTasks((prev) => prev.filter((t) => t._id !== id));
            toast.success('Task deleted.');
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to delete task.';
            toast.error(msg);
            throw err;
        }
    }, []);

    return {
        tasks,
        topTasks,
        stats,
        dagData,
        loading,
        error,
        fetchTasks,
        fetchTopTasks,
        fetchStats,
        fetchDAG,
        createTask,
        updateTask,
        deleteTask,
    };
};

export default useTasks;
