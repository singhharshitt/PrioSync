import { createElement, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  Plus, Clock, TrendingUp, Zap, Target, 
  BarChart3, CheckCircle2, AlertCircle,
  ArrowRight, Sparkles, Activity,
  Flame, Trophy, Brain, ChevronRight, RefreshCw
} from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import TaskCard from '../components/TaskCard.jsx';
import TaskModal from '../components/TaskModal.jsx';
import ProductivityChart from '../components/ProductivityChart.jsx';
import CompletionChart from '../components/CompletionChart.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSkeleton, { ChartSkeleton } from '../components/LoadingSkeleton.jsx';
import useTasks from '../hooks/useTasks.js';
import taskService from '../services/taskService.js';

// Real-time hook for live updates
const useRealtime = (callback, interval = 30000) => {
  useEffect(() => {
    const invoke = () => {
      Promise.resolve(callback()).catch(() => {});
    };

    invoke(); // Initial call
    const id = setInterval(invoke, interval);
    return () => clearInterval(id);
  }, [callback, interval]);
};

const MIN_FOCUS_COMPLETE_SECONDS = 60;

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const Stat = ({ value, label, icon, color = "text-[#FC703C]", trend, onClick }) => (
  <div 
    onClick={onClick}
    className={`relative bg-[#2B1B17] rounded-2xl p-6 border-2 border-[#FC703C]/10 shadow-[4px_4px_0_#FC703C]/20 hover:shadow-[6px_6px_0_#FC703C]/30 hover:-translate-y-1 transition-all duration-300 group overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
  >
    {/* Animated background gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#FC703C]/0 via-[#FC703C]/0 to-[#FC703C]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    
    <div className="relative flex items-start justify-between">
      <div>
        <div className={`w-12 h-12 rounded-xl bg-[#231612] border border-[#FC703C]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
          {createElement(icon, { className: `w-6 h-6 ${color}` })}
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black text-[#FDF8F0] tracking-tight">{value}</p>
          {trend && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-[#CCC4BE]/60 uppercase tracking-wider mt-1">{label}</p>
      </div>
      
      {/* Decorative pinwheel */}
      <div className="opacity-10 group-hover:opacity-30 transition-opacity">
        <svg viewBox="0 0 24 24" className="w-16 h-16 animate-spin-slow text-[#FC703C]" fill="currentColor">
          <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10Z" />
        </svg>
      </div>
    </div>
  </div>
);

const PerformanceInsight = ({ title, value, max, color, icon, description }) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className="bg-[#231612] rounded-xl p-4 border border-[#FC703C]/10 hover:border-[#FC703C]/30 transition-all duration-300 group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#FC703C]/10">
            {createElement(icon, { size: 14, className: 'text-[#FC703C]' })}
          </div>
          <span className="text-xs font-black text-[#CCC4BE] uppercase tracking-wider">{title}</span>
        </div>
        <span className="text-lg font-black text-[#FDF8F0]">{value}<span className="text-[#CCC4BE]/40 text-sm">/{max}</span></span>
      </div>
      
      {/* Progress bar with glow effect */}
      <div className="relative h-2 bg-[#2B1B17] rounded-full overflow-hidden">
        <div 
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out group-hover:shadow-[0_0_10px_currentColor]"
          style={{ 
            width: `${percentage}%`, 
            backgroundColor: color,
            boxShadow: `0 0 20px ${color}40`
          }}
        />
      </div>
      
      <p className="text-[10px] text-[#CCC4BE]/50 mt-2 leading-tight">{description}</p>
    </div>
  );
};

const DashboardPage = () => {
  const {
    tasks, topTasks, stats, loading,
    fetchTasks, fetchTopTasks, fetchStats,
    createTask, updateTask, deleteTask,
  } = useTasks();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [focusSessionActive, setFocusSessionActive] = useState(false);
  const [focusSessionStartedAt, setFocusSessionStartedAt] = useState(null);
  const [focusElapsedSeconds, setFocusElapsedSeconds] = useState(0);
  const [focusSessionSaving, setFocusSessionSaving] = useState(false);
  const [focusSessionTask, setFocusSessionTask] = useState(null);
  const [focusSessionSummary, setFocusSessionSummary] = useState(null);
  const heroRef = useRef(null);

  // Real-time data refresh
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchTasks({ limit: 100 }),
        fetchTopTasks(),
        fetchStats(),
      ]);
      setLastUpdated(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchTasks, fetchTopTasks, fetchStats]);

  useRealtime(refreshData, 30000); // Refresh every 30 seconds

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!focusSessionActive || !focusSessionStartedAt) return undefined;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - focusSessionStartedAt.getTime()) / 1000);
      setFocusElapsedSeconds(Math.max(0, elapsed));
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [focusSessionActive, focusSessionStartedAt]);

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
    if (!id) {
      toast.error('Unable to delete task: missing task id.');
      return;
    }
    if (!confirm('Delete this task?')) return;
    await deleteTask(id);
  };

  const handleStatusChange = async (id, status) => {
    if (!id) {
      toast.error('Unable to update task: missing task id.');
      return;
    }
    await updateTask(id, { status });
  };

  const handleSubmit = async (formData) => {
    if (editTask) {
      await updateTask(editTask._id, formData);
    } else {
      await createTask(formData);
    }
  };

  const activeFocusTask = useMemo(
    () => topTasks.find((task) => task.status !== 'completed') || null,
    [topTasks],
  );

  const handleFocusSessionToggle = async () => {
    if (focusSessionSaving) return;

    if (!focusSessionActive) {
      if (!activeFocusTask) {
        toast.error('No active task available for focus session.');
        return;
      }

      const focusTaskId = activeFocusTask._id || activeFocusTask.id;
      if (!focusTaskId) {
        toast.error('Unable to start focus session: task id is missing.');
        return;
      }

      const startTime = new Date();
      setFocusSessionTask({ _id: focusTaskId, title: activeFocusTask.title || activeFocusTask.name || 'Untitled Task' });
      setFocusSessionStartedAt(startTime);
      setFocusElapsedSeconds(0);
      setFocusSessionSummary(null);
      setFocusSessionActive(true);
      return;
    }

    if (!focusSessionStartedAt) {
      setFocusSessionActive(false);
      return;
    }

    const endTime = new Date();
    const durationSeconds = Math.max(
      1,
      Math.floor((endTime.getTime() - focusSessionStartedAt.getTime()) / 1000),
    );
    const sessionPayload = {
      taskId: focusSessionTask?._id || null,
      startedAt: focusSessionStartedAt.toISOString(),
      endedAt: endTime.toISOString(),
      durationSeconds,
    };

    setFocusSessionActive(false);
    setFocusSessionStartedAt(null);
    setFocusSessionSaving(true);
    setFocusSessionSummary({
      taskId: sessionPayload.taskId,
      taskTitle: focusSessionTask?.title || '',
      durationSeconds: sessionPayload.durationSeconds,
    });

    try {
      await taskService.logFocusSession(sessionPayload);
      await fetchStats();
      setLastUpdated(new Date());
    } catch {
      toast.error('Failed to save focus session.');
    } finally {
      setFocusSessionSaving(false);
    }
  };

  const handleMarkFocusedTaskCompleted = async () => {
    if (!focusSessionSummary?.taskId) {
      toast.error('No focus session task available to complete.');
      return;
    }

    if (focusSessionSummary.durationSeconds < MIN_FOCUS_COMPLETE_SECONDS) {
      toast.error('Warning: focus session is too short to mark task completed immediately.');
      return;
    }

    await updateTask(focusSessionSummary.taskId, { status: 'completed' });
    setLastUpdated(new Date());
    setFocusSessionSummary(null);
    setFocusSessionTask(null);
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
  
  // Calculate trends (mock - replace with real historical data)
  const completionTrend = stats ? Math.round((stats.completed / Math.max(stats.total - stats.completed, 1)) * 10 - 5) : 0;
  const focusScore = stats?.focusScore || 0;
  const streak = stats?.streak || 0;
  const velocity = stats?.velocity || 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f7f2] bpmf-huninn-regular">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-y-auto relative">
        {/* Real-time indicator */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-[#2B1B17]/90 backdrop-blur-sm rounded-full border border-[#FC703C]/20 text-xs">
          <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-[#FC703C] animate-pulse' : 'bg-green-500'}`} />
          <span className="text-[#CCC4BE] font-medium">
            {isRefreshing ? 'Syncing...' : `Updated ${lastUpdated.toLocaleTimeString()}`}
          </span>
          <button 
            onClick={refreshData}
            className={`p-1 hover:text-[#FC703C] transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={12} />
          </button>
        </div>

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
              <span className="text-white/40 text-3xl uppercase tracking-widest font-black">{`{ Dashboard }`}</span>
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
                Real-time algorithm analyzes urgency, importance, and deadlines to surface what matters most right now.
              </p>
              <span className="text-4xl text-[#FC703C]/40 font-light">{`}`}</span>
            </div>

            {/* CTA Button */}
            <Link
              to="/tasks"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-[#FC703C] text-white rounded-full font-bold text-lg shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all duration-150"
            >
              View All Tasks
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Top Tasks Cards - Overlapping bottom */}
          <div className="max-w-7xl mx-auto relative z-20 mt-16 bg-[#DBB68F] ">
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
                        task.priorityTier === 'critical' ? 'bg-red-100 text-red-600' :
                        task.priorityTier === 'high' ? 'bg-orange-100 text-orange-600' :
                        task.priorityTier === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {task.priorityScore}
                      </span>
                      <CheckCircle2 className="w-5 h-5 text-[#2B1B17]/20 group-hover:text-[#FC703C] transition-colors" />
                    </div>
                    <h3 className="font-bold text-[#2B1B17] mb-1 line-clamp-1 group-hover:text-[#FC703C] transition-colors">
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
              label="Completion Rate" 
              icon={CheckCircle2}
              color="text-green-500"
              trend={completionTrend}
              onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
            />
            <Stat 
              value={stats?.total || '0'} 
              label="Total Tasks" 
              icon={Target}
              color="text-[#FC703C]"
              trend={stats ? Math.round((stats.inProgress / Math.max(stats.total, 1)) * 100) : 0}
            />
            <Stat 
              value={stats?.overdue || '0'} 
              label="Overdue" 
              icon={AlertCircle}
              color="text-red-500"
              trend={stats?.overdue > 0 ? -10 : 0}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-12 space-y-12">
          
          {/* Enhanced Analytics Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#FC703C]/10 border border-[#FC703C]/20">
                  <Activity size={20} className="text-[#FC703C]" />
                </div>
                <div>
                  <span className="text-xs uppercase tracking-widest text-[#2B1B17]/40 font-black block">{`{ Analytics }`}</span>
                  <h2 className="text-2xl font-black text-[#2B1B17] tracking-tight">Performance Insights</h2>
                </div>
              </div>
              <button 
                onClick={refreshData}
                className="text-[#FC703C] hover:text-[#E85C2A] font-bold text-sm flex items-center gap-2 group px-4 py-2 rounded-xl hover:bg-[#FC703C]/10 transition-all"
              >
                <RefreshCw size={16} className={`${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh Data
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Charts Container */}
              <div className="lg:col-span-2 bg-[#2B1B17] rounded-3xl p-6 border border-[#FC703C]/10 shadow-[4px_4px_0_#FC703C]/10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-[#FDF8F0] uppercase tracking-wider">Activity Overview</h3>
                  <div className="flex gap-2">
                    <span className="text-xs px-3 py-1 rounded-full bg-[#FC703C]/20 text-[#FC703C] font-bold">7 Days</span>
                    <span className="text-xs px-3 py-1 rounded-full bg-[#231612] text-[#CCC4BE] font-bold hover:bg-[#FC703C]/10 cursor-pointer transition-colors">30 Days</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {loading && !stats ? (
                    <>
                      <ChartSkeleton />
                      <ChartSkeleton />
                    </>
                  ) : stats ? (
                    <>
                      <div className="bg-[#231612] rounded-2xl p-4 border border-[#FC703C]/5">
                        <ProductivityChart data={stats.weeklyActivity || []} />
                      </div>
                      <div className="bg-[#231612] rounded-2xl p-4 border border-[#FC703C]/5">
                        <CompletionChart byTier={stats.byTier || {}} byStatus={byStatus} />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Enhanced AI Insight Card */}
              <div className="bg-[#2B1B17] rounded-3xl p-6 text-white relative overflow-hidden flex flex-col border border-[#FC703C]/10 shadow-[4px_4px_0_#FC703C]/10">
                {/* Animated background */}
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-[#FC703C]/20 rounded-full blur-2xl animate-pulse-slow" />
                <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-[#EEA175]/20 rounded-full blur-xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
                
                {/* Grid pattern */}
                <div className="absolute inset-0 opacity-[0.02]" style={{
                  backgroundImage: `radial-gradient(#FC703C 1px, transparent 1px)`,
                  backgroundSize: '20px 20px'
                }} />

                <div className="relative z-10 flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FC703C]/20 rounded-full text-xs font-black tracking-wider mb-5 backdrop-blur-sm border border-[#FC703C]/30">
                    <Sparkles size={12} className="text-[#FC703C]" />
                    AI INSIGHT
                  </div>
                  
                  <div className="mb-6">
                    <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
                      You're on fire! 
                      <Flame size={24} className="text-[#FC703C] animate-pulse" />
                    </h3>
                    <p className="text-[#CCC4BE] text-sm leading-relaxed">
                      Focus score is <span className="text-[#FC703C] font-bold">{focusScore}</span> with a{' '}
                      <span className="text-[#FC703C] font-bold">{streak}-day streak</span>.
                      Keep tackling critical tasks first to maintain this momentum.
                    </p>
                  </div>

                  {/* Performance Metrics */}
                  <div className="space-y-3 mb-6">
                    <PerformanceInsight 
                      title="Focus Score"
                      value={focusScore}
                      max={100}
                      color="#FC703C"
                      icon={Brain}
                      description="Based on task completion speed and completion ratio"
                    />
                    <PerformanceInsight 
                      title="Streak"
                      value={streak}
                      max={30}
                      color="#22C55E"
                      icon={Trophy}
                      description="Consecutive days with completed tasks"
                    />
                    <PerformanceInsight 
                      title="Velocity"
                      value={velocity}
                      max={50}
                      color="#3B82F6"
                      icon={Zap}
                      description="Tasks completed in the last 7 days"
                    />
                  </div>
                </div>

                <button className="relative z-10 w-full py-3 bg-[#FC703C] text-[#2B1B17] font-black rounded-xl hover:bg-[#ff855c] transition-all shadow-[2px_2px_0_#FDF8F0] hover:shadow-[4px_4px_0_#FDF8F0] hover:-translate-y-0.5 active:shadow-none active:translate-x-0.5 active:translate-y-0.5 uppercase tracking-wider text-sm">
                  View Suggestions
                </button>
              </div>
            </div>
          </section>

          {/* Focus Mode CTA */}
          <section className="relative rounded-3xl overflow-hidden bg-[#2B1B17] text-white p-8 sm:p-12 text-center shadow-[4px_4px_0_#452215] group">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-[-50%] left-[-20%] w-[600px] h-[600px] bg-[#FC703C]/20 rounded-full blur-[100px] animate-pulse-slow" />
              <div className="absolute bottom-[-50%] right-[-20%] w-[500px] h-[500px] bg-[#EEA175]/15 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
              
              {/* Floating elements */}
              <div className="absolute top-10 left-10 w-8 h-8 border border-white/10 rotate-45 animate-float" />
              <div className="absolute bottom-10 right-10 w-6 h-6 rounded-full bg-white/5 animate-float-slow" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FC703C]/20 flex items-center justify-center border border-[#FC703C]/30 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                <Clock size={28} className="text-[#FC703C]" />
              </div>
              <div>
                <h2 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">Deep Work Awaits</h2>
                <p className="text-white/60 text-lg">
                  Enter a distraction-free environment to knock out your top priority.
                </p>
              </div>
              <button
                onClick={handleFocusSessionToggle}
                disabled={focusSessionSaving}
                className="px-8 py-4 bg-[#FC703C] text-white font-black text-lg rounded-full hover:bg-[#E85C2A] transition-all shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1 inline-flex items-center gap-2 uppercase tracking-wider disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Zap size={20} className="fill-current" />
                {focusSessionActive
                  ? `End Focus Session (${formatDuration(focusElapsedSeconds)})`
                  : focusSessionSaving
                    ? 'Saving Session...'
                    : 'Start Focus Session'}
              </button>
              {(focusSessionActive || focusSessionSummary) && (
                <p className="text-white/60 text-sm font-medium">
                  {focusSessionActive
                    ? `Live focus time: ${formatDuration(focusElapsedSeconds)}`
                    : `Last session: ${formatDuration(focusSessionSummary?.durationSeconds || 0)}${focusSessionSummary?.taskTitle ? ` on ${focusSessionSummary.taskTitle}` : ''}`}
                </p>
              )}
              {!focusSessionActive && focusSessionSummary?.taskId && (
                <button
                  onClick={handleMarkFocusedTaskCompleted}
                  className="px-6 py-3 bg-white text-[#2B1B17] font-black text-sm rounded-full hover:bg-[#f3ede4] transition-all shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1 inline-flex items-center gap-2 uppercase tracking-wider"
                >
                  <CheckCircle2 size={18} />
                  Mark as Completed
                </button>
              )}
            </div>
          </section>

          {/* Task Backlog */}
          <section className="bg-[#DBB68F]  rounded-3xl p-8 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215]">
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-[#2B1B17]/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#FC703C]/10">
                  <BarChart3 size={20} className="text-[#FC703C]" />
                </div>
                <div>
                  <span className="text-xs uppercase tracking-widest text-[#2B1B17]/40 font-black block">{`{ Tasks }`}</span>
                  <h2 className="text-2xl font-black text-[#2B1B17] tracking-tight">Task Backlog</h2>
                </div>
              </div>
              <button 
                onClick={handleOpenCreate} 
                className="flex items-center gap-2 px-6 py-3 bg-[#FC703C] text-white font-bold rounded-full hover:bg-[#E85C2A] transition-all shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1 uppercase tracking-wider text-sm"
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
                    className="flex items-center gap-2 px-6 py-3 bg-[#FC703C] text-white font-bold rounded-full hover:bg-[#E85C2A] transition-all shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215]"
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
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;
