import { createElement, useEffect, useMemo, useState, useRef } from 'react';
import {
  Plus, Search, LayoutGrid, List, Calendar,
  ArrowUpDown, CheckCircle2, Circle, Clock, AlertCircle,
  ArrowRight, Sparkles, Target, Zap
} from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
// import Navbar from '../components/Navbar.jsx';
import TaskCard from '../components/TaskCard.jsx';
import TaskModal from '../components/TaskModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSkeleton from '../components/LoadingSkeleton.jsx';
import useTasks from '../hooks/useTasks.js';

const STATUSES = [
  { id: 'all', label: 'All Tasks', icon: LayoutGrid, color: 'bg-[#2B1B17]' },
  { id: 'pending', label: 'Pending', icon: Circle, color: 'bg-[#EEA175]' },
  { id: 'in-progress', label: 'In Progress', icon: Clock, color: 'bg-[#FC703C]' },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, color: 'bg-green-500' },
  { id: 'cancelled', label: 'Cancelled', icon: AlertCircle, color: 'bg-red-500' },
];

const SORTS = [
  { value: 'priority', label: 'Priority Score' },
  { value: 'deadline', label: 'Due Date' },
  { value: 'created', label: 'Date Created' },
  { value: 'title', label: 'Title A-Z' },
];

const TasksPage = () => {
  const { tasks, loading, fetchTasks, createTask, updateTask, deleteTask } = useTasks();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sort, setSort] = useState('priority');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const params = { sort, limit: 200 };
    if (filterStatus !== 'all') params.status = filterStatus;
    fetchTasks(params);
  }, [filterStatus, sort, fetchTasks]);

  const handleEdit = (task) => {
    setEditTask(task);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      await deleteTask(id);
    }
  };

  const handleStatusChange = async (id, status) => {
    if (!id) return;
    await updateTask(id, { status });
  };

  const handleCreate = () => {
    setEditTask(null);
    setModalOpen(true);
  };

  const handleSubmit = async (formData) => {
    if (editTask) {
      await updateTask(editTask._id, formData);
    } else {
      await createTask(formData);
    }
    setModalOpen(false);
  };

  const filtered = useMemo(
    () =>
      tasks.filter((task) =>
        task.title.toLowerCase().includes(search.toLowerCase())
        || task.description?.toLowerCase().includes(search.toLowerCase())
        || task.tags?.some((tag) => tag.toLowerCase().includes(search.toLowerCase())),
      ),
    [tasks, search],
  );

  const statusCounts = useMemo(
    () =>
      tasks.reduce(
        (acc, task) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        },
        { pending: 0, 'in-progress': 0, completed: 0, cancelled: 0 },
      ),
    [tasks],
  );

  const stats = useMemo(
    () => ({
      total: tasks.length,
      completed: statusCounts.completed || 0,
      highPriority: tasks.filter((task) => task.priorityScore >= 80 && task.status !== 'completed').length,
      overdue: tasks.filter(
        (task) => task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed',
      ).length,
    }),
    [tasks, statusCounts],
  );

  const activeStatus = STATUSES.find((status) => status.id === filterStatus);

  return (
    <div className="min-h-screen bg-[#f8f7f2] bpmf-huninn-regular">
      <div className="flex h-screen overflow-hidden overflow-x-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* <Navbar title="Tasks" /> */}

          <main className="flex-1 overflow-y-auto">
            {/* GSAP-Style Hero Section */}
            <section ref={heroRef} className="relative bg-[#2B1B17] pt-16 sm:pt-20 pb-24 px-4 sm:px-6 overflow-hidden">
              {/* Animated Background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#FC703C]/20 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-[#EEA175]/15 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />

                {/* Floating shapes */}
                <div className="absolute top-16 left-[10%] w-10 h-10 border border-[#FC703C]/30 rotate-45 animate-float" />
                <div className="absolute top-32 right-[15%] w-6 h-6 rounded-full bg-[#EEA175]/20 animate-float-slow" />
                <div className="absolute bottom-16 left-[20%] w-12 h-12 border border-white/10 rounded-full animate-float" style={{ animationDelay: '1s' }} />

                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-[0.02]" style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                   linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                  backgroundSize: '60px 60px'
                }} />
              </div>

              <div className="max-w-7xl mx-auto relative z-10">
                {/* Pinwheel Logo + Title */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative w-12 h-12">
                    <svg viewBox="0 0 100 100" className="w-full h-full animate-spin-slow">
                      <path d="M50 0C50 0 65 25 50 50C35 25 50 0 50 0Z" fill="#FC703C" />
                      <path d="M100 50C100 50 75 65 50 50C75 35 100 50 100 50Z" fill="#EEA175" />
                      <path d="M50 100C50 100 35 75 50 50C65 75 50 100 50 100Z" fill="#f8f7f2" />
                      <path d="M0 50C0 50 25 35 50 50C25 65 0 50 0 50Z" fill="#FC703C" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-[#2B1B17] rounded-full" />
                    </div>
                  </div>
                  <span className="text-white/40 text-xl sm:text-3xl uppercase tracking-widest">{`{ Tasks }`}</span>
                </div>

                {/* Giant Typography */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                  <div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.9] tracking-tight">
                      Manage your
                    </h1>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[0.9] tracking-tight">
                      <span className="text-[#FC703C]">priorities</span>
                    </h1>
                  </div>

                  {/* Create Button */}
                  <button
                    onClick={handleCreate}
                    className="group flex items-center gap-2 px-8 py-4 bg-[#FC703C] text-white rounded-full font-medium text-lg shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all duration-150 whitespace-nowrap"
                  >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                    New Task
                  </button>
                </div>

                {/* Tagline with braces */}
                <div className="flex items-start gap-3 mt-6 max-w-lg">
                  <span className="text-3xl text-[#FC703C]/40 font-light">{`{`}</span>
                  <p className="text-base text-white/60 leading-relaxed pt-1">
                    Organize, prioritize, and conquer your tasks with intelligent sorting algorithms.
                  </p>
                  <span className="text-3xl text-[#FC703C]/40 font-light">{`}`}</span>
                </div>
              </div>
            </section>

            {/* Stats Cards - Overlapping */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-10 relative z-20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Total Tasks"
                  value={stats.total}
                  icon={Target}
                  color="bg-[#2B1B17]"
                  delay={0}
                  mounted={mounted}
                />
                <StatCard
                  label="Completed"
                  value={stats.completed}
                  icon={CheckCircle2}
                  color="bg-green-500"
                  suffix={`${stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%`}
                  delay={100}
                  mounted={mounted}
                />
                <StatCard
                  label="High Priority"
                  value={stats.highPriority}
                  icon={Zap}
                  color="bg-[#FC703C]"
                  alert={stats.highPriority > 0}
                  delay={200}
                  mounted={mounted}
                />
                <StatCard
                  label="Overdue"
                  value={stats.overdue}
                  icon={AlertCircle}
                  color="bg-red-500"
                  alert={stats.overdue > 0}
                  delay={300}
                  mounted={mounted}
                />
              </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
              {/* Filter & Search Card */}
              <div className="bg-white rounded-3xl p-6 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215] mb-6">
                {/* Search Row */}
                <div className="flex flex-col lg:flex-row gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2B1B17]/30" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search tasks by title, description, or tags..."
                      className="w-full h-12 pl-12 pr-4 bg-[#f8f7f2] rounded-xl border border-[#2B1B17]/10 text-[#2B1B17] text-sm focus:outline-none focus:border-[#FC703C] focus:ring-2 focus:ring-[#FC703C]/20 transition-all placeholder:text-[#2B1B17]/30"
                    />
                  </div>

                  {/* Status Filters */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                    {STATUSES.map((status) => {
                      const Icon = status.icon;
                      const isActive = filterStatus === status.id;
                      return (
                        <button
                          key={status.id}
                          onClick={() => setFilterStatus(status.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all shadow-[2px_2px_0_#452215] hover:shadow-[3px_3px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-0.5 active:translate-y-0.5 ${isActive
                            ? 'bg-[#FC703C] text-white'
                            : 'bg-[#f8f7f2] text-[#2B1B17]/70 hover:bg-white'
                            }`}
                        >
                          <Icon size={14} />
                          {status.label}
                          {status.id !== 'all' && (
                            <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${isActive ? 'bg-white/20' : 'bg-[#2B1B17]/10 text-[#2B1B17]/60'
                              }`}
                            >
                              {statusCounts[status.id] || 0}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sort & View Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[#2B1B17]/5">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-[#f8f7f2] rounded-xl px-3 py-2">
                      <ArrowUpDown size={16} className="text-[#2B1B17]/40" />
                      <select
                        value={sort}
                        onChange={(event) => setSort(event.target.value)}
                        className="bg-transparent text-sm font-medium text-[#2B1B17] focus:outline-none cursor-pointer"
                      >
                        {SORTS.map((option) => (
                          <option key={option.value} value={option.value}>
                            Sort by {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center bg-[#f8f7f2] rounded-xl p-1 shadow-[2px_2px_0_#452215]">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2.5 rounded-lg transition-all ${viewMode === 'list'
                          ? 'bg-white text-[#FC703C] shadow-sm'
                          : 'text-[#2B1B17]/40 hover:text-[#2B1B17]'
                          }`}
                        aria-label="List view"
                      >
                        <List size={18} />
                      </button>
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid'
                          ? 'bg-white text-[#FC703C] shadow-sm'
                          : 'text-[#2B1B17]/40 hover:text-[#2B1B17]'
                          }`}
                        aria-label="Grid view"
                      >
                        <LayoutGrid size={18} />
                      </button>
                    </div>
                  </div>

                  {!loading && (
                    <p className="text-sm text-[#2B1B17]/40">
                      Showing <span className="font-semibold text-[#2B1B17]">{filtered.length}</span> of {tasks.length} tasks
                    </p>
                  )}
                </div>
              </div>

              {/* Task List */}
              <div className="min-h-[300px]">
                {loading ? (
                  <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
                    <LoadingSkeleton type="task" count={6} />
                  </div>
                ) : filtered.length > 0 ? (
                  <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
                    {filtered.map((task, index) => (
                      <div
                        key={task._id}
                        className={`transition-all duration-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                        style={{ transitionDelay: `${index * 50}ms` }}
                      >
                        <TaskCard
                          task={task}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onStatusChange={handleStatusChange}
                          viewMode={viewMode}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#DBB68F] rounded-3xl p-12 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215]">
                    <EmptyState
                      icon={activeStatus.icon}
                      title={search ? 'No matching tasks' : `No ${activeStatus.label.toLowerCase()}`}
                      description={
                        search
                          ? `No tasks match "${search}". Try adjusting your search terms.`
                          : `Get started by creating your first ${activeStatus.id === 'all' ? 'task' : activeStatus.label.toLowerCase()}.`
                      }
                      action={
                        !search && (
                          <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-6 py-3 bg-[#FC703C] text-white rounded-full font-medium shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
                          >
                            <Plus size={18} />
                            Create Task
                          </button>
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        initialData={editTask}
        allTasks={tasks}
      />

      {/* Custom Styles */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 25s linear infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(3deg); }
        }
        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float 7s ease-in-out infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.05); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 6s ease-in-out infinite;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

const StatCard = ({ label, value, icon, color, suffix, alert, delay, mounted }) => (
  <div
    className={`bg-white rounded-2xl p-5 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-1 transition-all duration-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    style={{ transitionDelay: `${delay}ms` }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-[#2B1B17]/40 mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${alert ? 'text-red-500' : 'text-[#2B1B17]'}`}>
            {value}
          </span>
          {suffix && <span className="text-sm text-[#2B1B17]/40">{suffix}</span>}
        </div>
      </div>
      <div className={`w-10 h-10 rounded-xl ${color} bg-opacity-10 flex items-center justify-center`}>
        {createElement(icon, { className: `w-5 h-5 ${color.replace('bg-', 'text-')}` })}
      </div>
    </div>
  </div>
);

export default TasksPage;
