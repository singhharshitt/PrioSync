import { createElement, useEffect, useState, useRef } from 'react';
import { 
  GitBranch, RefreshCw, Zap, Target, 
  ArrowRight, Sparkles, Layers, Calculator,
  CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
// import Navbar from '../components/Navbar.jsx';
import DependencyGraph from '../components/DependencyGraph.jsx';
import useTasks from '../hooks/useTasks.js';

const DependencyPage = () => {
  const { dagData, fetchDAG, fetchTasks, loading } = useTasks();
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    fetchDAG();
    fetchTasks({ limit: 200 });
  }, [fetchDAG, fetchTasks]);

  const nodeCount = dagData?.nodes?.length || 0;
  const edgeCount = dagData?.edges?.length || 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f7f2] bpmf-huninn-regular">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* <Navbar title="Dependencies" /> */}
        
        <main className="flex-1 overflow-y-auto">
          {/* GSAP-Style Hero Section */}
          <section ref={heroRef} className="relative bg-[#2B1B17] pt-20 pb-28 px-4 sm:px-6 overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#FC703C]/20 rounded-full blur-[120px] animate-pulse-slow" />
              <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-[#EEA175]/15 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
              
              {/* Floating shapes */}
              <div className="absolute top-16 left-[10%] w-10 h-10 border border-[#FC703C]/30 rotate-45 animate-float" />
              <div className="absolute top-32 right-[15%] w-6 h-6 rounded-full bg-[#EEA175]/20 animate-float-slow" />
              <div className="absolute bottom-20 left-[20%] w-12 h-12 border border-white/10 rounded-full animate-float" style={{ animationDelay: '1s' }} />
              
              {/* Network-like decorative lines */}
              <svg className="absolute top-[20%] right-[20%] w-32 h-32 text-[#FC703C]/10 animate-pulse" viewBox="0 0 100 100">
                <circle cx="20" cy="20" r="4" fill="currentColor" />
                <circle cx="80" cy="30" r="4" fill="currentColor" />
                <circle cx="50" cy="80" r="4" fill="currentColor" />
                <line x1="20" y1="20" x2="80" y2="30" stroke="currentColor" strokeWidth="1" />
                <line x1="80" y1="30" x2="50" y2="80" stroke="currentColor" strokeWidth="1" />
                <line x1="50" y1="80" x2="20" y2="20" stroke="currentColor" strokeWidth="1" />
              </svg>
              
              {/* Grid overlay */}
              <div className="absolute inset-0 opacity-[0.02]" style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                 linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                backgroundSize: '60px 60px'
              }} />
            </div>

            <div className="max-w-6xl mx-auto relative z-10">
              {/* Pinwheel Logo + Title */}
              <div className="flex items-center gap-3 mb-6">
                <div className="relative w-12 h-12">
                  <svg viewBox="0 0 100 100" className="w-full h-full animate-spin-slow">
                    <path d="M50 0C50 0 65 25 50 50C35 25 50 0 50 0Z" fill="#FC703C"/>
                    <path d="M100 50C100 50 75 65 50 50C75 35 100 50 100 50Z" fill="#EEA175"/>
                    <path d="M50 100C50 100 35 75 50 50C65 75 50 100 50 100Z" fill="#f8f7f2"/>
                    <path d="M0 50C0 50 25 35 50 50C25 65 0 50 0 50Z" fill="#FC703C"/>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-[#2B1B17] rounded-full" />
                  </div>
                </div>
                <span className="text-white/40 text-3xl uppercase tracking-widest">{`{ Dependencies }`}</span>
              </div>

              {/* Giant Typography */}
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                <div>
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.9] tracking-tight">
                    Visualize
                  </h1>
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[0.9] tracking-tight">
                    <span className="text-[#FC703C]">Connections</span>
                  </h1>
                </div>

                {/* Stats Pills */}
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 backdrop-blur-sm rounded-full px-5 py-3 border border-white/10">
                    <span className="text-2xl font-bold text-white">{nodeCount}</span>
                    <span className="text-white/50 text-sm ml-2">Tasks</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-full px-5 py-3 border border-white/10">
                    <span className="text-2xl font-bold text-[#FC703C]">{edgeCount}</span>
                    <span className="text-white/50 text-sm ml-2">Links</span>
                  </div>
                </div>
              </div>

              {/* Tagline with braces */}
              <div className="flex items-start gap-3 mt-6 max-w-2xl">
                <span className="text-3xl text-[#FC703C]/40 font-light">{`{`}</span>
                <p className="text-base text-white/60 leading-relaxed pt-1">
                  Directed Acyclic Graph (DAG) visualization of task dependencies. 
                  Our algorithm detects cycles, ranks priorities, and schedules tasks 
                  using topological ordering.
                </p>
                <span className="text-3xl text-[#FC703C]/40 font-light">{`}`}</span>
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchDAG}
                className="mt-8 group inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-full font-medium border border-white/10 hover:bg-white/20 transition-all"
              >
                <RefreshCw size={16} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                Refresh Graph
              </button>
            </div>
          </section>

          {/* Main Content */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-12 relative z-20 pb-12 space-y-6">
            
            {/* Graph Card */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FC703C]/10 flex items-center justify-center">
                    <GitBranch className="w-5 h-5 text-[#FC703C]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#2B1B17]">Dependency Graph</h2>
                    <p className="text-sm text-[#2B1B17]/40">Interactive DAG visualization</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#2B1B17]/40">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live
                </div>
              </div>

              {loading ? (
                <div className="h-96 flex items-center justify-center bg-[#f8f7f2] rounded-2xl">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-3 border-[#FC703C] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[#2B1B17]/40 text-sm">Building graph...</p>
                  </div>
                </div>
              ) : (
                <div className="bg-[#f8f7f2] rounded-2xl border border-[#2B1B17]/5 overflow-hidden">
                  <DependencyGraph graph={dagData} />
                </div>
              )}
            </div>

            {/* DSA Engine Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  step: '01',
                  title: 'DAG Construction',
                  desc: 'Tasks and dependencies form a Directed Acyclic Graph. DFS cycle detection prevents circular dependencies.',
                  icon: Layers,
                  color: '#FC703C',
                  delay: 0
                },
                {
                  step: '02',
                  title: 'Max Heap Ranking',
                  desc: 'All tasks loaded into a Max Heap priority queue. O(log n) operations ensure fast ranking and extraction.',
                  icon: Target,
                  color: '#EEA175',
                  delay: 100
                },
                {
                  step: '03',
                  title: 'Greedy Scheduling',
                  desc: 'Algorithm selects highest-scored available task while respecting topological dependency order.',
                  icon: Zap,
                  color: '#2B1B17',
                  delay: 200
                }
              ].map(({ step, title, desc, icon, color, delay }) => (
                <div 
                  key={step}
                  className={`bg-white rounded-2xl p-6 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215] hover:shadow-[6px_6px_0_#452215] hover:-translate-y-1 transition-all duration-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: `${delay}ms` }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg mb-4 shadow-lg"
                    style={{ background: color }}
                  >
                    {step}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {createElement(icon, { className: 'w-4 h-4', style: { color } })}
                    <h3 className="font-bold text-[#2B1B17]">{title}</h3>
                  </div>
                  <p className="text-sm text-[#2B1B17]/60 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Priority Formula Card */}
            <div className="bg-[#2B1B17] rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-[4px_4px_0_#452215]">
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-[-50%] right-[-20%] w-[400px] h-[400px] bg-[#FC703C]/20 rounded-full blur-[100px] animate-pulse-slow" />
                <div className="absolute bottom-[-30%] left-[-10%] w-[300px] h-[300px] bg-[#EEA175]/15 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#FC703C]/20 flex items-center justify-center border border-[#FC703C]/30">
                    <Calculator className="w-5 h-5 text-[#FC703C]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Priority Score Formula</h3>
                    <p className="text-sm text-white/40">How we calculate task importance</p>
                  </div>
                </div>

                {/* Formula Display */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 mb-6">
                  <code className="text-lg md:text-xl text-[#FC703C] font-mono block text-center">
                    Score = (Urgency × 0.30 + Importance × 0.25 + Deadline × 0.25 + Ease × 0.20) × 20
                  </code>
                </div>

                {/* Weight Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Urgency', weight: '30%', color: '#ef4444', icon: AlertCircle },
                    { label: 'Importance', weight: '25%', color: '#f97316', icon: Target },
                    { label: 'Deadline', weight: '25%', color: '#eab308', icon: Clock },
                    { label: 'Ease', weight: '20%', color: '#22c55e', icon: CheckCircle2 }
                  ].map(({ label, weight, color, icon }) => (
                    <div key={label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        {createElement(icon, { size: 14, style: { color } })}
                        <span className="text-sm text-white/60">{label}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl font-bold text-white">{weight}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: weight, background: color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Algorithm Complexity Info */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#EEA175]/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#EEA175]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#2B1B17]">Algorithm Complexity</h3>
                  <p className="text-sm text-[#2B1B17]/40">Performance characteristics</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { op: 'Cycle Detection', complexity: 'O(V + E)', desc: 'DFS traversal' },
                  { op: 'Priority Insert', complexity: 'O(log n)', desc: 'Max Heap' },
                  { op: 'Topological Sort', complexity: 'O(V + E)', desc: 'Kahn\'s algorithm' }
                ].map(({ op, complexity, desc }) => (
                  <div key={op} className="flex items-center gap-4 p-4 bg-[#f8f7f2] rounded-xl">
                    <div className="w-12 h-12 rounded-xl bg-[#2B1B17] flex items-center justify-center">
                      <span className="text-[#FC703C] font-mono font-bold text-sm">{complexity}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-[#2B1B17] text-sm">{op}</p>
                      <p className="text-xs text-[#2B1B17]/40">{desc}</p>
                    </div>
                  </div>
                ))}
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

export default DependencyPage;
