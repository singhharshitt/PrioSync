import { Link } from 'react-router-dom';
import { Zap, Target, BarChart2, GitBranch, ArrowRight, CheckCircle, Github, Twitter, Linkedin } from 'lucide-react';
import { motion } from 'framer-motion';

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
        <nav className="flex items-center justify-between px-8 py-5 border-b border-primary/5 bg-white/50 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <Zap size={16} className="text-white" />
                </div>
                <span className="font-heading font-bold text-xl text-primary">PrioSync</span>
            </div>
            <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors px-4 py-2">
                    Sign In
                </Link>
                <Link to="/register" className="btn-primary text-sm shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5">
                    Get Started Free
                </Link>
            </div>
        </nav>

        {/* Hero */}
        <section className="min-h-screen bg-bg-light pt-32 pb-20 px-6">
            <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">

                {/* Left Content */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="space-y-8"
                >
                    <h1 className="text-5xl lg:text-7xl font-bold text-primary leading-[1.1]">
                        Stop managing time.
                        <br />
                        <span className="text-secondary">Start managing focus.</span>
                    </h1>

                    <p className="text-lg text-gray-600 max-w-lg leading-relaxed">
                        PRIOSYNC uses intelligent algorithms to prioritize your tasks automatically.
                        Focus on what truly matters while we handle the decision-making.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <button className="group flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-full font-medium hover:bg-secondary transition-all hover:shadow-lg hover:-translate-y-1">
                            Start Prioritizing
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button className="px-8 py-4 text-primary font-medium hover:underline underline-offset-4">
                            See How It Works →
                        </button>
                    </div>
                </motion.div>

                {/* Right Visual - Priority Card Container */}
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="relative"
                >
                    <div className="absolute inset-0 bg-linear-to-br from-accent/40 to-primary/10 rounded-[2.5rem] blur-3xl" />
                    <div className="relative bg-white/70 backdrop-blur-2xl rounded-[2.5rem] p-8 shadow-2xl border border-white/60">

                        {/* Mock Task Cards Stack */}
                        <div className="space-y-4">
                            {[
                                { tag: "CRITICAL", title: "Launch Marketing Site", desc: "Due today block all other progress", color: "bg-red-100 text-red-600" },
                                { tag: "HIGH", title: "Review Pull Requests", desc: "3 PRs pending review", color: "bg-orange-100 text-orange-600" },
                                { tag: "MEDIUM", title: "Weekly Sync Prep", desc: "Update slide deck", color: "bg-yellow-100 text-yellow-700" }
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${item.color} tracking-wider`}>
                                            {item.tag}
                                        </span>
                                        <span className="text-xs font-semibold text-gray-400">Score: {98 - (i * 15)}</span>
                                    </div>
                                    <h3 className="font-semibold text-primary">{item.title}</h3>
                                    <p className="text-sm text-gray-500">{item.desc}</p>
                                </motion.div>
                            ))}
                        </div>

                    </div>
                </motion.div>
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
        <footer className="bg-primary text-white/80 py-16 px-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 relative z-10">

                {/* Brand & Newsletter */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                            <Zap size={16} className="text-primary" />
                        </div>
                        <span className="font-heading font-bold text-2xl text-white">PrioSync</span>
                    </div>
                    <p className="text-white/60 max-w-sm">
                        Stay updated with our latest productivity insights and feature releases.
                    </p>
                    <div className="flex items-center gap-2 max-w-md">
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 flex-1 text-white placeholder:text-white/40 focus:outline-none focus:border-accent transition-colors"
                        />
                        <button className="bg-accent text-primary px-6 py-3 rounded-xl font-medium hover:bg-white transition-colors">
                            Subscribe
                        </button>
                    </div>
                </div>

                {/* Links Grid & Socials */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                        <h4 className="font-semibold text-white">Product</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#" className="hover:text-accent transition-colors">Features</a></li>
                            <li><a href="#" className="hover:text-accent transition-colors">Pricing</a></li>
                            <li><a href="#" className="hover:text-accent transition-colors">Changelog</a></li>
                        </ul>
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-semibold text-white">Company</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#" className="hover:text-accent transition-colors">About Us</a></li>
                            <li><a href="#" className="hover:text-accent transition-colors">Careers</a></li>
                            <li><a href="#" className="hover:text-accent transition-colors">Contact</a></li>
                        </ul>
                    </div>
                    <div className="space-y-4 col-span-2 md:col-span-1 border-t border-white/10 md:border-0 pt-6 md:pt-0">
                        <h4 className="font-semibold text-white mb-4">Connect</h4>
                        <div className="flex items-center gap-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent hover:text-primary transition-all">
                                <Twitter size={18} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent hover:text-primary transition-all">
                                <Github size={18} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent hover:text-primary transition-all">
                                <Linkedin size={18} />
                            </a>
                        </div>
                    </div>
                </div>

            </div>
            <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/10 text-center text-xs text-white/40">
                © {new Date().getFullYear()} PrioSync. Built with MERN stack & Tailwind CSS.
            </div>
        </footer>
    </div>
);

export default LandingPage;
