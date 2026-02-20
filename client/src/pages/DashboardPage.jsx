import { useEffect, useState } from 'react';
import { Plus, CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Navbar from '../components/Navbar.jsx';
import StatCard from '../components/StatCard.jsx';
import TaskCard from '../components/TaskCard.jsx';
import TaskModal from '../components/TaskModal.jsx';
import ProductivityChart from '../components/ProductivityChart.jsx';
import CompletionChart from '../components/CompletionChart.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSkeleton, { StatSkeleton, ChartSkeleton } from '../components/LoadingSkeleton.jsx';
import useTasks from '../hooks/useTasks.js';

const DashboardPage = () => {
    const {
        tasks, topTasks, stats, loading,
        fetchTasks, fetchTopTasks, fetchStats,
        createTask, updateTask, deleteTask,
    } = useTasks();

    const [modalOpen, setModalOpen] = useState(false);
    const [editTask, setEditTask] = useState(null);

    useEffect(() => {
        fetchTasks({ limit: 100 });
        fetchTopTasks();
        fetchStats();
    }, []);

    const handleOpenCreate = () => { setEditTask(null); setModalOpen(true); };
    const handleEdit = (task) => { setEditTask(task); setModalOpen(true); };
    const handleDelete = (id) => { if (confirm('Delete this task?')) deleteTask(id); };
    const handleStatusChange = (id, status) => updateTask(id, { status });

    const handleSubmit = async (formData) => {
        if (editTask) {
            await updateTask(editTask._id, formData);
        } else {
            await createTask(formData);
        }
        fetchStats();
        fetchTopTasks();
    };

    const byStatus = stats
        ? { pending: stats.pending, 'in-progress': stats.inProgress, completed: stats.completed, cancelled: stats.cancelled }
        : {};

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-dashboard)' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Navbar title="Dashboard" />
                <main className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {loading && !stats ? (
                            Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
                        ) : stats ? (
                            <>
                                <StatCard label="Total Tasks" value={stats.total} icon={Clock} color="#627890" />
                                <StatCard label="Completed" value={stats.completed} icon={CheckCircle} color="#22c55e"
                                    sublabel={`${stats.completionRate}% rate`} />
                                <StatCard label="In Progress" value={stats.inProgress} icon={TrendingUp} color="#604C39" />
                                <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} color="#ef4444" />
                            </>
                        ) : null}
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        {loading && !stats ? (
                            <><ChartSkeleton /><ChartSkeleton /></>
                        ) : stats ? (
                            <>
                                <ProductivityChart data={stats.weeklyActivity || []} />
                                <CompletionChart byTier={stats.byTier || {}} byStatus={byStatus} />
                            </>
                        ) : null}
                    </div>

                    {/* Top Priority Tasks */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-heading font-bold text-white text-lg">Top Priority Tasks</h2>
                            <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2 text-sm py-2">
                                <Plus size={15} /> New Task
                            </button>
                        </div>

                        {loading && topTasks.length === 0 ? (
                            <div className="space-y-3">
                                <LoadingSkeleton type="task" count={3} />
                            </div>
                        ) : topTasks.length > 0 ? (
                            <div className="space-y-3">
                                {topTasks.map((task) => (
                                    <TaskCard
                                        key={task._id}
                                        task={task}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        onStatusChange={handleStatusChange}
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                title="No tasks yet"
                                description="Create your first task to see your priority ranking."
                                action={
                                    <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
                                        <Plus size={15} /> Create Task
                                    </button>
                                }
                            />
                        )}
                    </div>
                </main>
            </div>

            <TaskModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
                initialData={editTask}
                allTasks={tasks}
            />
        </div>
    );
};

export default DashboardPage;
