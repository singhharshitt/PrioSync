import { createElement, useEffect, useMemo, useState, useRef } from 'react';
import {
  Zap, CheckCircle, Clock, Target, Save,
  Sparkles, TrendingUp, Calendar, Award,
  ArrowRight, User
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Sidebar from '../components/Sidebar.jsx';
// import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import authService from '../services/authService.js';
import useTasks from '../hooks/useTasks.js';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const { stats, fetchStats } = useTasks();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    fetchStats();
    setName(user?.name || '');
  }, [user, fetchStats]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await authService.updateProfile({ name: name.trim() });
      updateUser(data.user);
      toast.success('Profile updated successfully!');
    } catch {
      toast.error('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name
    ?.split(' ')
    .map((token) => token[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const points = stats?.productivityScore || user?.productivityScore || 0;
  const safePoints = Math.min(Math.max(points, 0), 100);

  const tier = useMemo(() => {
    if (points >= 80) return { label: 'Expert', color: 'text-[#FC703C]', bg: 'bg-[#FC703C]/10' };
    if (points >= 60) return { label: 'Advanced', color: 'text-[#EEA175]', bg: 'bg-[#EEA175]/10' };
    if (points >= 40) return { label: 'Intermediate', color: 'text-blue-500', bg: 'bg-blue-500/10' };
    return { label: 'Beginner', color: 'text-green-500', bg: 'bg-green-500/10' };
  }, [points]);

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'N/A';

  const tierInfo = tier;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f7f2] bpmf-huninn-regular">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* <Navbar title="Profile" /> */}

        <main className="flex-1 overflow-y-auto">
          {/* GSAP-Style Hero Section */}
          <section ref={heroRef} className="relative bg-[#2B1B17] pt-16 sm:pt-20 pb-28 px-4 sm:px-6 overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#FC703C]/20 rounded-full blur-[120px] animate-pulse-slow" />
              <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-[#EEA175]/15 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />

              {/* Floating shapes */}
              <div className="absolute top-16 left-[15%] w-8 h-8 border border-[#FC703C]/30 rotate-45 animate-float" />
              <div className="absolute top-32 right-[20%] w-6 h-6 rounded-full bg-[#EEA175]/20 animate-float-slow" />
              <div className="absolute bottom-20 left-[25%] w-10 h-10 border border-white/10 rounded-full animate-float" style={{ animationDelay: '1s' }} />

              {/* Sparkles */}
              <div className="absolute top-[20%] right-[30%] text-[#FC703C]/40 animate-pulse">
                <Sparkles size={20} />
              </div>

              {/* Grid overlay */}
              <div className="absolute inset-0 opacity-[0.02]" style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                 linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                backgroundSize: '60px 60px'
              }} />
            </div>

            <div className="max-w-4xl mx-auto relative z-10">
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
                <span className="text-white/40 text-sm uppercase tracking-widest">{`{ Profile }`}</span>
              </div>

              {/* Giant Typography */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-6">
                <div className="flex-1">
                  <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.9] tracking-tight">
                    Your
                  </h1>
                  <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[0.9] tracking-tight">
                    <span className="text-[#FC703C]">Productivity</span>
                  </h1>
                  <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.9] tracking-tight">
                    Profile
                  </h1>
                </div>

                {/* Avatar Card - Overlapping */}
                <div
                  className={`relative bg-white rounded-3xl p-6 shadow-[4px_4px_0_#452215] w-full sm:w-auto min-w-[200px] transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0 shadow-inner"
                      style={{
                        background: 'linear-gradient(135deg, #FC703C, #EEA175)',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      {initials}
                    </div>
                    <div>
                      <p className="text-[#2B1B17] font-semibold text-lg">{user?.name || 'User'}</p>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${tierInfo.bg} ${tierInfo.color}`}>
                        <Award size={12} />
                        {tierInfo.label}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tagline with braces */}
              <div className="flex items-start gap-3 mt-6 max-w-lg">
                <span className="text-3xl text-[#FC703C]/40 font-light">{`{`}</span>
                <p className="text-base text-white/60 leading-relaxed pt-1">
                  Track your progress, analyze your productivity patterns, and level up your task management skills.
                </p>
                <span className="text-3xl text-[#FC703C]/40 font-light">{`}`}</span>
              </div>
            </div>
          </section>

          {/* Main Content */}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-12 relative z-20 pb-12 space-y-6">

            {/* Profile Edit Card */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#FC703C]/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-[#FC703C]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#2B1B17]">Profile Information</h2>
                  <p className="text-sm text-[#2B1B17]/40">Update your personal details</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Name Input */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#2B1B17]/40 font-medium ml-1">
                    Display Name
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="flex-1 h-14 px-5 bg-[#f8f7f2] border border-[#2B1B17]/10 rounded-xl text-[#2B1B17] placeholder:text-[#2B1B17]/20 focus:outline-none focus:border-[#FC703C] focus:ring-2 focus:ring-[#FC703C]/20 transition-all"
                      placeholder="Your name"
                    />
                    <button
                      onClick={handleSave}
                      disabled={saving || name === user?.name}
                      className="h-14 px-6 bg-[#FC703C] text-white rounded-xl font-medium shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0_#452215] disabled:hover:translate-y-0 transition-all duration-150 flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto"
                    >
                      <Save size={18} />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                {/* Email Display */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#2B1B17]/40 font-medium ml-1">
                    Email Address
                  </label>
                  <div className="h-14 px-5 bg-[#2B1B17]/5 border border-[#2B1B17]/10 rounded-xl flex items-center text-[#2B1B17]/60">
                    {user?.email || '-'}
                  </div>
                </div>

                {/* Member Info */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-[#2B1B17]/5">
                  <div className="flex items-center gap-2 text-sm text-[#2B1B17]/50">
                    <Calendar size={16} />
                    <span>Member since {memberSince}</span>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${tierInfo.bg} ${tierInfo.color}`}>
                    <Award size={14} />
                    {tierInfo.label} Tier
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Productivity"
                value={safePoints}
                suffix="/100"
                icon={Zap}
                color="text-[#FC703C]"
                bg="bg-[#FC703C]/10"
                delay={0}
                mounted={mounted}
              />
              <StatCard
                label="Created"
                value={stats?.total || user?.tasksCreated || 0}
                icon={Target}
                color="text-[#EEA175]"
                bg="bg-[#EEA175]/10"
                delay={100}
                mounted={mounted}
              />
              <StatCard
                label="Completed"
                value={stats?.completed || user?.tasksCompleted || 0}
                icon={CheckCircle}
                color="text-green-500"
                bg="bg-green-500/10"
                delay={200}
                mounted={mounted}
              />
              <StatCard
                label="In Progress"
                value={stats?.inProgress || 0}
                icon={Clock}
                color="text-blue-500"
                bg="bg-blue-500/10"
                delay={300}
                mounted={mounted}
              />
            </div>

            {/* Productivity Score Card */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FC703C]/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[#FC703C]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#2B1B17]">Productivity Score</h3>
                    <p className="text-sm text-[#2B1B17]/40">Based on completion rate & volume</p>
                  </div>
                </div>
                <span className="text-4xl font-bold text-[#FC703C]">{safePoints}</span>
              </div>

              {/* Progress Bar */}
              <div className="relative h-4 bg-[#f8f7f2] rounded-full overflow-hidden mb-3">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${safePoints}%`,
                    background: 'linear-gradient(90deg, #FC703C, #EEA175)',
                  }}
                />
              </div>

              <div className="flex justify-between text-xs text-[#2B1B17]/40">
                <span>Beginner</span>
                <span className="hidden sm:inline">Score = completion rate × 0.7 + task volume × 0.3</span>
                <span>Expert</span>
              </div>
            </div>

            {/* Completion Rate Card */}
            {stats?.completionRate !== undefined && (
              <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#2B1B17]">Completion Rate</h3>
                      <p className="text-sm text-[#2B1B17]/40">Tasks finished vs created</p>
                    </div>
                  </div>
                  <span className="text-4xl font-bold text-green-500">{stats.completionRate}%</span>
                </div>

                <div className="flex items-end gap-4 mb-3">
                  <div className="flex-1">
                    <div className="relative h-3 bg-[#f8f7f2] rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(Math.max(stats.completionRate, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-sm text-[#2B1B17]/50">
                  <span className="font-semibold text-[#2B1B17]">{stats.completed}</span> of{' '}
                  <span className="font-semibold text-[#2B1B17]">{stats.total}</span> tasks completed
                </p>
              </div>
            )}

            {/* Achievement Banner */}
            <div className="relative bg-[#2B1B17] rounded-3xl p-6 md:p-8 overflow-hidden shadow-[4px_4px_0_#452215]">
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-[-50%] right-[-20%] w-[300px] h-[300px] bg-[#FC703C]/20 rounded-full blur-[80px] animate-pulse-slow" />
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#FC703C]/20 flex items-center justify-center border border-[#FC703C]/30">
                  <Award className="w-7 h-7 text-[#FC703C]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">Keep up the great work!</h3>
                  <p className="text-white/60 text-sm">
                    You're in the top {Math.max(5, Math.round((100 - safePoints) / 10))}% of productive users.
                  </p>
                </div>
                <ArrowRight className="w-6 h-6 text-white/40" />
              </div>
            </div>
          </div>
        </main>
      </div>

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

const StatCard = ({ label, value, suffix, icon, color, bg, delay, mounted }) => (
  <div
    className={`bg-white rounded-2xl p-5 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-1 transition-all duration-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    style={{ transitionDelay: `${delay}ms` }}
  >
    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
      {createElement(icon, { className: `w-5 h-5 ${color}` })}
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-bold text-[#2B1B17]">{value}</span>
      {suffix && <span className="text-sm text-[#2B1B17]/40">{suffix}</span>}
    </div>
    <p className="text-xs uppercase tracking-wider text-[#2B1B17]/40 mt-1">{label}</p>
  </div>
);

export default ProfilePage;
