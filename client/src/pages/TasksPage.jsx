import { useEffect, useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Navbar from '../components/Navbar.jsx';
import TaskCard from '../components/TaskCard.jsx';
import TaskModal from '../components/TaskModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSkeleton from '../components/LoadingSkeleton.jsx';
import useTasks from '../hooks/useTasks.js';

const STATUSES = ['all', 'pending', 'in-progress', 'completed', 'cancelled'];
const SORTS = ['priority', 'deadline', 'created', 'title'];

const TasksPage = () => {
    const { tasks, loading, fetchTasks, createTask, updateTask, deleteTask } = useTasks();
    const [modalOpen, setModalOpen] = useState(false);
    const [editTask, setEditTask] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [sort, setSort] = useState('priority');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const params = { sort, limit: 200 };
        if (filterStatus !== 'all') params.status = filterStatus;
        fetchTasks(params);
    }, [filterStatus, sort]);

    const handleEdit = (task) => { setEditTask(task); setModalOpen(true); };
    const handleDelete = (id) => { if (confirm('Delete this task?')) deleteTask(id); };
    const handleStatusChange = (id, status) => updateTask(id, { status });

    const handleCreate = () => { setEditTask(null); setModalOpen(true); };
    const handleSubmit = async (formData) => {
        if (editTask) await updateTask(editTask._id, formData);
        else await createTask(formData);
    };

    const filtered = tasks.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-dashboard)' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Navbar title="All Tasks" />
                <main className="flex-1 overflow-y-auto p-6">

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 mb-5">
                        {/* Search */}
                        <div className="relative flex-1 min-w-48">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                            <input
                                value={search} onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search tasks…" className="input-field pl-8"
                            />
                        </div>

                        {/* Status filter */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {STATUSES.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setFilterStatus(s)}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${filterStatus === s
                                            ? 'bg-[#604C39] text-white'
                                            : 'bg-white/5 text-[#94a3b8] hover:bg-white/10'
                                        }`}
                                >
                                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
                                </button>
                            ))}
                        </div>

                        {/* Sort */}
                        <div className="flex items-center gap-1.5">
                            <Filter size={13} className="text-[#64748b]" />
                            <select
                                value={sort} onChange={(e) => setSort(e.target.value)}
                                className="input-field text-xs py-1.5 w-auto"
                            >
                                {SORTS.map((s) => (
                                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                ))}
                            </select>
                        </div>

                        <button onClick={handleCreate} className="btn-primary flex items-center gap-2 text-sm py-2">
                            <Plus size={15} /> New Task
                        </button>
                    </div>

                    {/* Count */}
                    {!loading && (
                        <p className="text-xs text-[#64748b] mb-4">
                            {filtered.length} task{filtered.length !== 1 ? 's' : ''} found
                        </p>
                    )}

                    {/* Task list */}
                    {loading ? (
                        <div className="space-y-3">
                            <LoadingSkeleton type="task" count={5} />
                        </div>
                    ) : filtered.length > 0 ? (
                        <div className="space-y-3">
                            {filtered.map((task) => (
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
                            title={search ? 'No matching tasks' : 'No tasks in this category'}
                            description={search ? `No tasks match "${search}".` : 'Create a task to get started.'}
                            action={
                                !search && (
                                    <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
                                        <Plus size={15} /> Create Task
                                    </button>
                                )
                            }
                        />
                    )}
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

export default TasksPage;
