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
import { motion } from 'framer-motion';

const Stat = ({ value, label }) => (
    <div className="text-center md:text-left">
        <p className="text-3xl font-bold text-white mb-1">{value}</p>
        <p className="text-sm font-medium text-accent">{label}</p>
    </div>
);

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
        <div className="flex h-screen overflow-hidden bg-bg-light">

            <Sidebar />
            <main className="flex-1 flex flex-col overflow-y-auto">
                <Navbar title="Dashboard" />
                <section className="bg-primary pt-32 pb-24 px-8 relative overflow-hidden">
                    {/* Abstract Background pattern */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/40 via-primary to-primary opacity-80" />

                    <div className="max-w-7xl mx-auto relative z-10">

                        {/* Section Header */}
                        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16">
                            <div>
                                <motion.h2
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-4xl lg:text-5xl font-bold text-white leading-tight"
                                >
                                    Your priorities,
                                    <br />
                                    <span className="text-accent">scientifically sorted.</span>
                                </motion.h2>
                                <p className="mt-4 text-white/70 max-w-lg text-lg">
                                    Our algorithm analyzes urgency, importance, and deadlines to surface
                                    what matters most—right now.
                                </p>
                            </div>
                            <button className="text-white hover:text-accent font-medium flex items-center gap-2 hover:gap-3 transition-all bg-white/10 px-6 py-3 rounded-full hover:bg-white/20">
                                View All Tasks →
                            </button>
                        </div>

                        {/* Priority Task Grid - 4 columns like Seed products */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {topTasks.slice(0, 4).map((task, index) => (
                                <TaskCard
                                    key={task._id}
                                    task={task}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onStatusChange={handleStatusChange}
                                    variant={index === 0 ? 'featured' : 'default'}
                                />
                            ))}
                        </div>

                        {/* Stats Row */}
                        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-white/10 pt-12">
                            <Stat value={stats ? `${Math.round((stats.completed / (stats.total || 1)) * 100)}%` : "0%"} label="Tasks Completed" />
                            <Stat value="2.4x" label="Productivity Gain" />
                            <Stat value={stats?.overdue || "0"} label="Missed Deadlines" />
                        </div>
                    </div>
                </section>

                {/* --- MAIN CONTENT AREA --- */}
                <div className="max-w-7xl mx-auto w-full px-8 py-12 space-y-16">

                    {/* 1. Analytics Section */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h2 className="text-2xl font-bold text-primary">Performance Analytics</h2>
                                <p className="text-gray-500 text-sm">Track your productivity over time</p>
                            </div>
                            <button className="text-secondary hover:text-primary font-medium text-sm flex items-center gap-2">
                                View Full Report <TrendingUp size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Charts Container */}
                            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                                {loading && !stats ? (
                                    <><ChartSkeleton /><ChartSkeleton /></>
                                ) : stats ? (
                                    <>
                                        <ProductivityChart data={stats.weeklyActivity || []} />
                                        <CompletionChart byTier={stats.byTier || {}} byStatus={byStatus} />
                                    </>
                                ) : null}
                            </div>

                            {/* Floating Metric & Insight Card */}
                            <div className="bg-gradient-to-br from-primary to-[#2a4a2a] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
                                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold tracking-wide mb-6 backdrop-blur-md border border-white/20">
                                        <Zap size={12} className="text-accent" /> AI INSIGHT
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">You're on fire! 🔥</h3>
                                    <p className="text-white/80 text-sm leading-relaxed">
                                        Your high-priority completion rate is up by 14% this week. Keep tackling those critical tasks first.
                                    </p>
                                </div>
                                <button className="mt-8 w-full py-3 bg-accent text-primary font-semibold rounded-xl hover:bg-white transition-colors">
                                    Action Suggestions
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* 2. Focus Mode Section */}
                    <section className="relative rounded-3xl overflow-hidden bg-primary text-white p-12 md:p-16 text-center">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-secondary/50 via-primary to-primary opacity-90" />
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30" />

                        <div className="relative z-10 max-w-2xl mx-auto space-y-8">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                whileInView={{ scale: 1, opacity: 1 }}
                                className="w-20 h-20 mx-auto rounded-full bg-accent/20 flex items-center justify-center border border-accent/30 shadow-[0_0_40px_rgba(196,215,163,0.3)] backdrop-blur-md"
                            >
                                <Clock size={32} className="text-accent ml-0.5" />
                            </motion.div>
                            <div>
                                <h2 className="text-4xl font-bold mb-4">Deep Work Awaits</h2>
                                <p className="text-white/70 text-lg">
                                    Enter a distraction-free environment to knock out your top priority.
                                </p>
                            </div>
                            <button className="px-10 py-5 bg-accent text-primary font-bold text-lg rounded-full hover:bg-white hover:scale-105 transition-all shadow-[0_10px_30px_rgba(196,215,163,0.3)]">
                                Start Focus Session
                            </button>
                        </div>
                    </section>

                    {/* 3. Top Priority Tasks List */}
                    <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
                            <div>
                                <h2 className="text-2xl font-bold text-primary">Task Backlog</h2>
                                <p className="text-gray-500 text-sm mt-1">Review and manage your remaining priorities.</p>
                            </div>
                            <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2 px-5 py-2.5">
                                <Plus size={18} /> New Task
                            </button>
                        </div>

                        {loading && topTasks.length === 0 ? (
                            <div className="space-y-4">
                                <LoadingSkeleton type="task" count={3} />
                            </div>
                        ) : topTasks.length > 0 ? (
                            <div className="space-y-4">
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
                    </section>
                </div>
            </main>

            <TaskModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
                initialData={editTask}
                allTasks={tasks}
            />
        </div >
    );
};

export default DashboardPage;
