import { Link } from 'react-router-dom';
import { Zap, Target, BarChart2, GitBranch, ArrowRight, CheckCircle } from 'lucide-react';

const features = [
    {
        icon: Target, color: '#604C39',
        title: 'Smart Priority Engine',
        desc: 'DSA-powered Max Heap + DAG calculates real-time 0–100 priority scores using urgency, importance, deadline, and difficulty.',
    },
    {
        icon: BarChart2, color: '#99A285',
        title: 'Analytics Dashboard',
        desc: 'Visual charts for completion rates, priority distribution, and weekly productivity trends.',
    },
    {
        icon: GitBranch, color: '#627890',
        title: 'Dependency Graph',
        desc: 'Visualize task dependencies as a directed acyclic graph with cycle detection and topological ordering.',
    },
    {
        icon: Zap, color: '#c4a882',
        title: 'Greedy Scheduling',
        desc: 'Automatic task ordering using greedy algorithm — always work on the highest-impact tasks first.',
    },
];

const LandingPage = () => (
    <div className="min-h-screen hero-gradient text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* Navbar */}
        <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#604C39] flex items-center justify-center">
                    <Zap size={16} className="text-white" />
                </div>
                <span className="font-heading font-bold text-xl">PrioSync</span>
            </div>
            <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm text-[#94a3b8] hover:text-white transition-colors px-4 py-2">
                    Sign In
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                    Get Started Free
                </Link>
            </div>
        </nav>

        {/* Hero */}
        <section className="min-h-screen bg-[#f8f7f2] pt-32 pb-20 px-6">
  <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
    
    {/* Left Content */}
    <div className="space-y-8">
      <h1 className="text-5xl lg:text-7xl font-bold text-[#1a3a1a] leading-[1.1]">
        Stop managing time.
        <br />
        <span className="text-[#4a6741]">Start managing focus.</span>
      </h1>
      
      <p className="text-lg text-gray-600 max-w-lg leading-relaxed">
        PRIOSYNC uses intelligent algorithms to prioritize your tasks automatically. 
        Focus on what truly matters while we handle the decision-making.
      </p>
      
      <div className="flex flex-wrap gap-4">
        <button className="group flex items-center gap-2 px-8 py-4 bg-[#1a3a1a] text-white rounded-full font-medium hover:bg-[#2d5a2d] transition-all hover:scale-105">
          Start Prioritizing
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
        <button className="px-8 py-4 text-[#1a3a1a] font-medium hover:underline underline-offset-4">
          See How It Works →
        </button>
      </div>
    </div>

    {/* Right Visual - Priority Score Visualization */}
    <div className="relative">
      <div className="absolute inset-0 bg-linear-to-br from-[#c4d7a3]/30 to-[#1a3a1a]/10 rounded-3xl blur-3xl" />
      <div className="relative bg-white/60 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50">
        {/* Animated Priority Cards Stack */}
        <PriorityCardStack />
      </div>
    </div>
  </div>
</section>

        {/* Feature cards */}
        <section className="max-w-5xl mx-auto px-6 pb-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {features.map(({ icon: Icon, color, title, desc }) => (
                    <div key={title} className="card p-6 group hover:-translate-y-1 transition-transform animate-fade-up">
                        <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                            style={{ background: `${color}22`, border: `1px solid ${color}44` }}
                        >
                            <Icon size={20} style={{ color }} />
                        </div>
                        <h3 className="font-semibold text-white mb-2">{title}</h3>
                        <p className="text-sm text-[#64748b] leading-relaxed">{desc}</p>
                    </div>
                ))}
            </div>
        </section>

        {/* CTA Banner */}
        <section className="max-w-3xl mx-auto text-center px-6 pb-24 animate-fade-up">
            <div className="card p-10">
                <h2 className="font-heading font-bold text-3xl mb-3">Ready to maximize your focus?</h2>
                <p className="text-[#94a3b8] mb-6">Join smart teams who prioritize smarter, not harder.</p>
                <Link to="/register" className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-base">
                    Create Free Account <ArrowRight size={16} />
                </Link>
            </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-6 text-center text-xs text-[#64748b]">
            © 2024 PrioSync. Built with ❤️ using MERN stack.
        </footer>
    </div>
);

export default LandingPage;
