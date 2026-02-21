import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, Clock, TrendingUp, Zap, Target, 
  BarChart3, CheckCircle2, AlertCircle,
  ArrowRight, Sparkles, Calendar
} from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Navbar from '../components/Navbar.jsx';
import TaskCard from '../components/TaskCard.jsx';
import TaskModal from '../components/TaskModal.jsx';
import ProductivityChart from '../components/ProductivityChart.jsx';
import CompletionChart from '../components/CompletionChart.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSkeleton, { ChartSkeleton } from '../components/LoadingSkeleton.jsx';
import useTasks from '../hooks/useTasks.js';

const Stat = ({ value, label, icon: Icon, color = "text-[#FC703C]" }) => (
  <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-1 transition-all duration-200">
    <div className={`w-10 h-10 rounded-xl ${color.replace('text-', 'bg-')}/10 flex items-center justify-center mb-3`}>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <p className="text-3xl font-bold text-[#2B1B17] mb-1">{value}</p>
    <p className="text-sm font-medium text-[#2B1B17]/50">{label}</p>
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
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    fetchTasks({ limit: 100 });
    fetchTopTasks();
    fetchStats();
  }, [fetchTasks, fetchTopTasks, fetchStats]);

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current) return;
      const scrollY = window.scrollY;
      const heroContent = heroRef.current.querySelector('.hero-content');
      if (heroContent) {
        heroContent.style.transform = `translateY(${scrollY * 0.3}px)`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleOpenCreate = () => {
    setEditTask(null);
    setModalOpen(true);
  };

  const handleEdit = (task) => {
    setEditTask(task);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;
    await deleteTask(id);
    fetchTopTasks();
    fetchStats();
  };

  const handleStatusChange = async (id, status) => {
    await updateTask(id, { status });
    fetchTopTasks();
    fetchStats();
  };

  const handleSubmit = async (formData) => {
    if (editTask) {
      await updateTask(editTask._id, formData);
    } else {
      await createTask(formData);
    }
    fetchTasks({ limit: 100 });
    fetchStats();
    fetchTopTasks();
  };

  const byStatus = stats
    ? {
        pending: stats.pending,
        'in-progress': stats.inProgress,
        completed: stats.completed,
        cancelled: stats.cancelled,
      }
    : {};

  const completionRate = stats ? Math.round((stats.completed / (stats.total || 1)) * 100) : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f7f2]">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-y-auto relative">
        <Navbar title="Dashboard" />

        {/* GSAP-Style Hero Section */}
        <section ref={heroRef} className="relative bg-[#2B1B17] pt-24 pb-32 px-4 sm:px-8 overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#FC703C]/20 rounded-full blur-[120px] animate-pulse-slow" />
            <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-[#EEA175]/15 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
            
            {/* Floating shapes */}
            <div className="absolute top-20 left-[10%] w-12 h-12 border border-[#FC703C]/30 rotate-45 animate-float" />
            <div className="absolute top-40 right-[15%] w-8 h-8 rounded-full bg-[#EEA175]/20 animate-float-slow" />
            <div className="absolute bottom-20 left-[20%] w-16 h-16 border border-white/10 rounded-full animate-float" style={{ animationDelay: '1s' }} />
            
            {/* Grid overlay */}
            <div className="absolute inset-0 opacity-[0.02]" style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }} />
          </div>

          <div className="max-w-7xl mx-auto relative z-10 hero-content">
            {/* Pinwheel Logo + Title */}
            <div className="flex items-center gap-4 mb-8">
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 100 100" className="w-full h-full animate-spin-slow">
                  <path d="M50 0C50 0 65 25 50 50C35 25 50 0 50 0Z" fill="#FC703C"/>
                  <path d="M100 50C100 50 75 65 50 50C75 35 100 50 100 50Z" fill="#EEA175"/>
                  <path d="M50 100C50 100 35 75 50 50C65 75 50 100 50 100Z" fill="#f8f7f2"/>
                  <path d="M0 50C0 50 25 35 50 50C25 65 0 50 0 50Z" fill="#FC703C"/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 bg-[#2B1B17] rounded-full" />
                </div>
              </div>
              <span className="text-white/40 text-sm uppercase tracking-widest">{`{ Dashboard }`}</span>
            </div>

            {/* Giant Typography */}
            <div className="mb-12">
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.9] tracking-tight">
                Your priorities,
              </h1>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.9] tracking-tight">
                <span className="text-[#FC703C]">scientifically</span>
              </h1>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.9] tracking-tight">
                sorted.
              </h1>
            </div>

            {/* Tagline with braces */}
            <div className="flex items-start gap-4 max-w-xl mb-12">
              <span className="text-4xl text-[#FC703C]/40 font-light">{`{`}</span>
              <p className="text-lg text-white/70 leading-relaxed pt-2">
                Our algorithm analyzes urgency, importance, and deadlines to surface what matters most right now.
              </p>
              <span className="text-4xl text-[#FC703C]/40 font-light">{`}`}</span>
            </div>

            {/* CTA Button */}
            <Link
              to="/tasks"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-[#FC703C] text-white rounded-full font-medium text-lg shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all duration-150"
            >
              View All Tasks
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Top Tasks Cards - Overlapping bottom */}
          <div className="max-w-7xl mx-auto relative z-20 mt-16">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-white/10 rounded-2xl animate-pulse" />
                ))
              ) : (
                topTasks.slice(0, 4).map((task, index) => (
                  <div 
                    key={task._id}
                    className={`bg-white rounded-2xl p-5 shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-1 transition-all duration-200 cursor-pointer group ${
                      mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                    onClick={() => handleEdit(task)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        task.priority >= 90 ? 'bg-red-100 text-red-600' : 
                        task.priority >= 75 ? 'bg-orange-100 text-orange-600' : 
                        'bg-yellow-100 text-yellow-600'
                      }`}>
                        {task.priority}
                      </span>
                      <CheckCircle2 className="w-5 h-5 text-[#2B1B17]/20 group-hover:text-[#FC703C] transition-colors" />
                    </div>
                    <h3 className="font-semibold text-[#2B1B17] mb-1 line-clamp-1 group-hover:text-[#FC703C] transition-colors">
                      {task.title}
                    </h3>
                    <p className="text-sm text-[#2B1B17]/50 line-clamp-2">{task.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 -mt-8 relative z-30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat 
              value={`${completionRate}%`} 
              label="Tasks Completed" 
              icon={CheckCircle2}
              color="text-green-600"
            />
            <Stat 
              value="2.4x" 
              label="Productivity Gain" 
              icon={TrendingUp}
              color="text-[#FC703C]"
            />
            <Stat 
              value={stats?.overdue || '0'} 
              label="Missed Deadlines" 
              icon={AlertCircle}
              color="text-red-500"
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-12 space-y-12">
          
          {/* Analytics Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm uppercase tracking-widest text-[#2B1B17]/40">{`{ Analytics }`}</span>
                <h2 className="text-2xl font-bold text-[#2B1B17]">Performance Insights</h2>
              </div>
              <button className="text-[#FC703C] hover:text-[#E85C2A] font-medium text-sm flex items-center gap-2 group">
                Full Report
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Charts Container */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {loading && !stats ? (
                    <>
                      <ChartSkeleton />
                      <ChartSkeleton />
                    </>
                  ) : stats ? (
                    <>
                      <ProductivityChart data={stats.weeklyActivity || []} />
                      <CompletionChart byTier={stats.byTier || {}} byStatus={byStatus} />
                    </>
                  ) : null}
                </div>
              </div>

              {/* AI Insight Card */}
              <div className="bg-[#2B1B17] rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-[4px_4px_0_#452215]">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-[#FC703C]/20 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-[#EEA175]/20 rounded-full blur-xl" />
                
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-xs font-semibold tracking-wide mb-6 backdrop-blur-sm border border-white/20">
                    <Sparkles size={12} className="text-[#FC703C]" /> 
                    AI INSIGHT
                  </div>
                  <h3 className="text-2xl font-bold mb-3">You're on fire! 🔥</h3>
                  <p className="text-white/70 text-sm leading-relaxed">
                    Your high-priority completion rate is up <span className="text-[#FC703C] font-semibold">24%</span> this week. Keep tackling critical tasks first to maintain this momentum.
                  </p>
                </div>
                
                <button className="mt-8 w-full py-3.5 bg-[#FC703C] text-white font-semibold rounded-xl hover:bg-[#E85C2A] transition-colors shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1">
                  View Suggestions
                </button>
              </div>
            </div>
          </section>

          {/* Focus Mode CTA */}
          <section className="relative rounded-3xl overflow-hidden bg-[#2B1B17] text-white p-8 sm:p-12 text-center shadow-[4px_4px_0_#452215]">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-[-50%] left-[-20%] w-[600px] h-[600px] bg-[#FC703C]/20 rounded-full blur-[100px] animate-pulse-slow" />
              <div className="absolute bottom-[-50%] right-[-20%] w-[500px] h-[500px] bg-[#EEA175]/15 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
              
              {/* Floating elements */}
              <div className="absolute top-10 left-10 w-8 h-8 border border-white/10 rotate-45 animate-float" />
              <div className="absolute bottom-10 right-10 w-6 h-6 rounded-full bg-white/5 animate-float-slow" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FC703C]/20 flex items-center justify-center border border-[#FC703C]/30 backdrop-blur-sm">
                <Clock size={28} className="text-[#FC703C]" />
              </div>
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-3">Deep Work Awaits</h2>
                <p className="text-white/60 text-lg">
                  Enter a distraction-free environment to knock out your top priority.
                </p>
              </div>
              <button className="px-8 py-4 bg-[#FC703C] text-white font-bold text-lg rounded-full hover:bg-[#E85C2A] transition-all shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1 inline-flex items-center gap-2">
                <Zap size={20} />
                Start Focus Session
              </button>
            </div>
          </section>

          {/* Task Backlog */}
          <section className="bg-white rounded-3xl p-8 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215]">
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-[#2B1B17]/5">
              <div className="flex items-center gap-3">
                <span className="text-sm uppercase tracking-widest text-[#2B1B17]/40">{`{ Tasks }`}</span>
                <div>
                  <h2 className="text-2xl font-bold text-[#2B1B17]">Task Backlog</h2>
                  <p className="text-[#2B1B17]/50 text-sm">Review and manage your remaining priorities.</p>
                </div>
              </div>
              <button 
                onClick={handleOpenCreate} 
                className="flex items-center gap-2 px-6 py-3 bg-[#FC703C] text-white font-medium rounded-full hover:bg-[#E85C2A] transition-all shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1"
              >
                <Plus size={18} /> New Task
              </button>
            </div>

            {loading && topTasks.length === 0 ? (
              <div className="space-y-4">
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
                action={(
                  <button 
                    onClick={handleOpenCreate} 
                    className="flex items-center gap-2 px-6 py-3 bg-[#FC703C] text-white font-medium rounded-full hover:bg-[#E85C2A] transition-all shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215]"
                  >
                    <Plus size={15} /> Create Task
                  </button>
                )}
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
      `}</style>
    </div>
  );
};

export default DashboardPage;