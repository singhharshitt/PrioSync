import { Link } from 'react-router-dom';
import { 
  Zap, Target, BarChart2, GitBranch, ArrowRight, 
  CheckCircle, Github, Twitter, Linkedin, Clock, 
  Calendar, TrendingUp, Shield 
} from 'lucide-react';
import { useEffect, useRef } from 'react';

const LandingPage = () => {
  const heroRef = useRef(null);
  
  useEffect(() => {
    // Scroll-triggered parallax effect for hero elements
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const hero = heroRef.current;
      if (!hero) return;
      
      const title = hero.querySelector('.hero-title');
      const tagline = hero.querySelector('.hero-tagline');
      const visual = hero.querySelector('.hero-visual');
      
      if (title) title.style.transform = `translateY(${scrollY * 0.3}px)`;
      if (tagline) tagline.style.transform = `translateY(${scrollY * 0.2}px)`;
      if (visual) visual.style.transform = `translateY(${scrollY * -0.1}px)`;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Target,
      title: 'Smart Priority Engine',
      desc: 'DSA-powered Max Heap calculates real-time 0–100 priority scores using urgency, importance, and deadlines.',
      stat: 'O(1)',
      statLabel: 'Access Time'
    },
    {
      icon: GitBranch,
      title: 'Dependency Graph',
      desc: 'Visualize task dependencies as a directed acyclic graph with topological ordering and cycle detection.',
      stat: 'DAG',
      statLabel: 'Structure'
    },
    {
      icon: BarChart2,
      title: 'Analytics Dashboard',
      desc: 'Visual charts for completion rates, priority distribution, and weekly productivity trends.',
      stat: '98%',
      statLabel: 'Accuracy'
    },
    {
      icon: Zap,
      title: 'Greedy Scheduling',
      desc: 'Automatic task ordering using greedy algorithm — always work on the highest-impact tasks first.',
      stat: '2.4x',
      statLabel: 'Efficiency Gain'
    },
  ];

  const tasks = [
    { 
      priority: 98, 
      title: "Launch Marketing Site", 
      desc: "Critical path item blocking all progress",
      deadline: "Today",
      time: "4h",
      tags: ["Critical", "Design"]
    },
    { 
      priority: 84, 
      title: "Review Pull Requests", 
      desc: "3 pending reviews from team",
      deadline: "Tomorrow",
      time: "2h",
      tags: ["High", "Dev"]
    },
    { 
      priority: 67, 
      title: "Weekly Sync Prep", 
      desc: "Update slide deck and metrics",
      deadline: "Wed",
      time: "1h",
      tags: ["Medium", "Planning"]
    }
  ];

  const chartHeights = [76, 58, 83, 64, 91, 47, 70];

  return (
    <div className="min-h-screen bg-[#f8f7f2] bpmf-huninn-regular">
      
      {/* Floating Navigation */}
      <nav className="top-0 left-0 right-0 z-50 px-6 pt-6">
        <div className="min-w-full mx-auto">
          <div className="flex items-center justify-between px-6 py-4 ">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              {/* <div className="relative w-8 h-8">
                <svg viewBox="0 0 40 40" className="w-full h-full animate-spin-slow">
                  <path d="M20 0C20 0 25 10 20 20C15 10 20 0 20 0Z" fill="#FC703C"/>
                  <path d="M40 20C40 20 30 25 20 20C30 15 40 20 40 20Z" fill="#EEA175"/>
                  <path d="M20 40C20 40 15 30 20 20C25 30 20 40 20 40Z" fill="#2B1B17"/>
                  <path d="M0 20C0 20 10 15 20 20C10 25 0 20 0 20Z" fill="#FC703C"/>
                </svg>
              </div> */}
              <span className="font-semibold text-4xl text-[#2B1B17] tracking-tight chillax-bold">
                Prio<span className="text-[#FC703C]">Sync</span>
              </span>
            </Link>

            {/* Nav Links */}
          

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="hidden sm:block text-lg font-medium text-[#4A3A36] hover:text-[#2B1B17] transition-colors px-4 py-2"
              >
                Log in
              </Link>

              <Link
                to="/register"
                className="text-lg font-medium text-white bg-[#FC703C] px-5 py-2.5 rounded-full hover:bg-[#E85C2A] transition-all hover:scale-105 hover:shadow-lg"
              >
                Get Started
              </Link>
            </div>

          </div>
        </div>
      </nav>

      {/* Hero Section - GSAP Style */}
      <section ref={heroRef} className="min-h-screen pt-32 pb-20 px-6 flex flex-col justify-center relative overflow-hidden">
        
        {/* Background decorative elements */}
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#EEA175]/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-[#FC703C]/10 rounded-full blur-2xl" />
        
        <div className="max-w-7xl mx-auto w-full relative z-10">
          
          
          {/* Main Hero Content - GSAP Style Typography */}
          <div className="relative mb-16">
            {/* Pinwheel Logo Mark */}
            <div className="absolute -top-4 left-0 md:left-8">
              <div className="w-16 h-16 md:w-24 md:h-24 relative">
                <svg viewBox="0 0 100 100" className="w-full h-full animate-spin-slow">
                  <path d="M50 0C50 0 65 25 50 50C35 25 50 0 50 0Z" fill="#FC703C"/>
                  <path d="M100 50C100 50 75 65 50 50C75 35 100 50 100 50Z" fill="#EEA175"/>
                  <path d="M50 100C50 100 35 75 50 50C65 75 50 100 50 100Z" fill="#2B1B17"/>
                  <path d="M0 50C0 50 25 35 50 50C25 65 0 50 0 50Z" fill="#FC703C"/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 bg-[#2B1B17] rounded-full" />
                </div>
              </div>
            </div>

            {/* Massive Typography */}
            <div className="hero-title pt-12 md:pt-8">
              <h1 className="text-[12vw] md:text-[10vw] lg:text-[9vw] font-bold text-[#2B1B17] leading-[0.9] tracking-tighter chillax-bold">
                Prioritize
              </h1>
              <h1 className="text-[12vw] md:text-[10vw] lg:text-[9vw] font-bold leading-[0.9] tracking-tighter chillax-bold">
                <span className="text-[#FC703C]">Every</span>thing
              </h1>
            </div>

            {/* Animated squiggle decoration */}
            <div className="absolute right-4 md:right-20 top-1/2 w-16 md:w-24 h-32 md:h-48">
              <svg viewBox="0 0 60 120" className="w-full h-full">
                <path 
                  d="M30 0 Q50 30 30 60 Q10 90 30 120" 
                  fill="none" 
                  stroke="#EEA175" 
                  strokeWidth="8" 
                  strokeLinecap="round"
                  className="animate-draw"
                />
                <path 
                  d="M30 0 Q50 30 30 60 Q10 90 30 120" 
                  fill="none" 
                  stroke="#FC703C" 
                  strokeWidth="4" 
                  strokeLinecap="round"
                  className="animate-draw"
                  style={{ animationDelay: '0.2s' }}
                />
              </svg>
            </div>
          </div>

          {/* Tagline Section */}
          <div className="hero-tagline flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <div className="max-w-md">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-4xl text-[#2B1B17] font-light">{`{`}</span>
                <p className="text-lg md:text-xl text-[#4A3A36] leading-relaxed pt-2">
                  PrioSync — A wildly robust task prioritization engine built for professionals who demand focus.
                </p>
                <span className="text-4xl text-[#2B1B17] font-light">{`}`}</span>
              </div>
            </div>

            <Link
              to="/register"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-[#FC703C] text-white rounded-full font-medium hover:bg-[#E85C2A] transition-all hover:scale-105 hover:shadow-xl whitespace-nowrap"
            >
              Get PrioSync
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-60">
            <span className="text-xs uppercase tracking-widest text-[#4A3A36]">Scroll</span>
            <div className="w-px h-12 bg-gradient-to-b from-[#FC703C] to-transparent" />
          </div>
        </div>
      </section>

      {/* Why PrioSync Section - Scroll Triggered */}
      <section className="py-32 px-6 bg-[#f8f7f2] relative overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-16">
            <span className="text-sm uppercase tracking-widest text-[#4A3A36]">{`{ Why PrioSync }`}</span>
          </div>

          <div className="space-y-8">
            <p className="text-3xl md:text-5xl lg:text-6xl font-medium text-[#2B1B17] leading-tight max-w-5xl">
              PrioSync allows you to <span className="text-[#FC703C]">effortlessly</span> prioritize anything on your plate. Delivering silky-smooth performance and unmatched support so you can focus on the <span className="text-[#EEA175]">fun stuff</span>.
            </p>
          </div>
        </div>

        {/* Decorative floating elements */}
        <div className="absolute top-20 right-10 w-20 h-20 border-4 border-[#EEA175]/30 rounded-full animate-float" />
        <div className="absolute bottom-20 left-10 w-12 h-12 bg-[#FC703C]/20 rotate-45 animate-float-slow" />
      </section>

      {/* Animate Anything Section - Interactive Cards */}
      <section className="py-32 px-6 bg-[#f8f7f2]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <div className="inline-flex flex-col gap-2 mb-8">
              <span className="px-4 py-2 bg-[#EEA175]/20 text-[#2B1B17] rounded-lg text-lg font-medium">Prioritize Anything</span>
              <span className="px-4 py-2 bg-[#FC703C] text-white rounded-lg text-lg font-medium ml-8">That's right, Anything</span>
            </div>
            <p className="text-xl text-[#4A3A36] max-w-2xl">
              Whether you're managing tasks, projects, or team workflows, PrioSync has your back with intelligent algorithms.
            </p>
          </div>

          {/* Floating Cards Animation */}
          <div className="relative h-[400px] md:h-[500px]">
            <div className="absolute top-0 left-0 md:left-20 animate-float">
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 max-w-xs">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#FC703C]/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-[#FC703C]" />
                  </div>
                  <span className="font-semibold text-[#2B1B17]">Nice and</span>
                </div>
                <span className="text-3xl font-bold text-[#2B1B17]">Easy</span>
              </div>
            </div>

            <div className="absolute top-20 right-0 md:right-32 animate-float-slow">
              <div className="bg-[#2B1B17] rounded-2xl p-6 shadow-xl max-w-xs">
                <span className="text-2xl font-bold text-white">Add personality</span>
                <p className="text-white/70 mt-2">to your workflows</p>
                <div className="mt-4 flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#FC703C]" />
                  <div className="w-8 h-8 rounded-full bg-[#EEA175]" />
                  <div className="w-8 h-8 rounded-full bg-white/20" />
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-1/4 animate-float">
              <div className="bg-[#EEA175] rounded-2xl p-6 shadow-xl">
                <span className="text-2xl font-bold text-white">Super</span>
                <p className="text-white/80 text-sm mt-1">Fast Prioritization</p>
              </div>
            </div>

            {/* Decorative shapes */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#FC703C]/20 to-[#EEA175]/20 blur-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* GSAP Tools Style Section */}
      <section className="py-24 px-6 bg-[#f8f7f2]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-16">
            <span className="text-sm uppercase tracking-widest text-[#4A3A36]">{`{ PrioSync Tools }`}</span>
          </div>

          <div className="space-y-24">
            {/* Scroll Feature */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1">
                <h3 className="text-4xl md:text-5xl font-bold text-[#EEA175] mb-4">Scroll</h3>
                <p className="text-xl text-[#2B1B17] mb-6">Turn task management into silky-smooth storytelling.</p>
                <Link to="/features/scroll" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#2B1B17] rounded-full text-[#2B1B17] font-medium hover:bg-[#2B1B17] hover:text-white transition-all">
                  Explore Scroll
                </Link>
              </div>
              <div className="order-1 md:order-2 relative">
                <div className="w-48 h-48 mx-auto relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#EEA175] to-[#FC703C] rounded-full opacity-20 blur-xl" />
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <path d="M20 50 Q50 20 80 50 Q50 80 20 50" fill="#EEA175" opacity="0.3" />
                    <circle cx="50" cy="50" r="30" fill="none" stroke="#EEA175" strokeWidth="4" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Graph Feature */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="relative">
                <div className="w-48 h-48 mx-auto relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FC703C] to-[#EEA175] rounded-3xl opacity-20 blur-xl" />
                  <div className="w-full h-full bg-gradient-to-br from-[#FC703C] to-[#EEA175] rounded-3xl flex items-center justify-center">
                    <GitBranch className="w-16 h-16 text-white" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-4xl md:text-5xl font-bold text-[#FC703C] mb-4">Graph</h3>
                <p className="text-xl text-[#2B1B17] mb-6">Move, morph and visualize dependencies with our DAG engine.</p>
                <Link to="/features/graph" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#2B1B17] rounded-full text-[#2B1B17] font-medium hover:bg-[#2B1B17] hover:text-white transition-all">
                  Explore Graph
                </Link>
              </div>
            </div>

            {/* Text/Priority Feature */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1">
                <h3 className="text-4xl md:text-5xl font-bold text-[#2B1B17] mb-4">Priority</h3>
                <p className="text-xl text-[#4A3A36] mb-6">Leave them lost for words with seamless priority scoring.</p>
                <Link to="/features/priority" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#2B1B17] rounded-full text-[#2B1B17] font-medium hover:bg-[#2B1B17] hover:text-white transition-all">
                  Explore Priority
                </Link>
              </div>
              <div className="order-1 md:order-2 relative">
                <div className="flex items-center justify-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-[#2B1B17]/10 flex items-center justify-center">
                    <span className="text-3xl font-bold text-[#2B1B17]">98</span>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-[#FC703C]/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-[#FC703C]">84</span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-[#EEA175]/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-[#EEA175]">67</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Priority Stack Demo */}
      <section className="py-24 px-6 bg-[#f8f7f2]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Left Content */}
            <div className="space-y-8">
              <h2 className="text-5xl lg:text-6xl font-bold text-[#2B1B17] leading-[1.05] tracking-tight chillax-semibold">
                Your priorities,
                <br />
                <span className="text-[#FC703C]">scientifically sorted.</span>
              </h2>
              
              <p className="text-lg text-[#4A3A36] leading-relaxed max-w-lg">
                Our Max Heap algorithm analyzes urgency, importance, and deadlines to surface what matters most—right now.
              </p>
              
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to="/register"
                  className="group inline-flex items-center gap-2 px-8 py-4 bg-[#FC703C] text-white rounded-full font-medium hover:bg-[#E85C2A] transition-all hover:scale-105 hover:shadow-xl"
                >
                  Start Prioritizing
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Right Visual - Priority Stack */}
            <div className="relative hero-visual">
              {/* Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#EEA175]/40 via-[#FC703C]/20 to-[#2B1B17]/10 rounded-[2.5rem] blur-3xl scale-110" />
              
              {/* Glass Card Container */}
              <div className="relative bg-white/70 backdrop-blur-2xl rounded-[2.5rem] p-8 shadow-2xl border border-white/60">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-[#2B1B17]">Today's Priorities</h3>
                    <p className="text-sm text-gray-500">Sorted by impact score</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2B1B17]/5 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-[#2B1B17]">Live</span>
                  </div>
                </div>

                {/* Task Stack */}
                <div className="space-y-3">
                  {tasks.map((task, i) => (
                    <div 
                      key={i}
                      className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`
                            text-xs font-bold px-2.5 py-1 rounded-full
                            ${task.priority >= 90 ? 'bg-red-50 text-red-600' : 
                              task.priority >= 75 ? 'bg-orange-50 text-orange-600' : 
                              'bg-yellow-50 text-yellow-600'}
                          `}>
                            {task.priority}
                          </span>
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            {task.tags[0]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={12} />
                          {task.time}
                        </div>
                      </div>
                      
                      <h4 className="font-semibold text-[#2B1B17] mb-1 group-hover:text-[#FC703C] transition-colors">
                        {task.title}
                      </h4>
                      <p className="text-sm text-gray-500 mb-3">{task.desc}</p>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Calendar size={12} />
                        <span>Due {task.deadline}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Action */}
                <button className="w-full mt-6 py-3 bg-[#2B1B17]/5 hover:bg-[#2B1B17]/10 rounded-xl text-sm font-medium text-[#2B1B17] transition-colors">
                  View All Tasks →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dark Section - Features Grid */}
      <section className="bg-[#2B1B17] py-24 px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Section Header */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16">
            <div className="max-w-2xl">
              <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
                Algorithm-powered
                <br />
                productivity.
              </h2>
              <p className="mt-4 text-white/60 text-lg leading-relaxed">
                Built on computer science fundamentals for maximum efficiency.
              </p>
            </div>
            <Link 
              to="/science" 
              className="text-white/70 hover:text-white font-medium flex items-center gap-2 hover:gap-3 transition-all whitespace-nowrap"
            >
              Explore the Science →
            </Link>
          </div>

          {/* Feature Cards - 4 Column Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative bg-[#FC703C] rounded-3xl p-8 text-white overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
              >
                {/* Badge */}
                <div className="absolute top-6 left-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold text-white/90">
                    <feature.icon size={12} />
                    {feature.stat}
                  </span>
                </div>

                {/* Content */}
                <div className="mt-12 space-y-3">
                  <h3 className="text-xl font-semibold leading-tight">{feature.title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed line-clamp-3">
                    {feature.desc}
                  </p>
                </div>

                {/* Stat Footer */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <span className="text-xs text-white/50 uppercase tracking-wider">
                    {feature.statLabel}
                  </span>
                </div>

                {/* Hover Glow */}
                <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              </div>
            ))}
          </div>

          {/* Bottom Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-white/10 pt-12">
            {[
              { value: '50K+', label: 'Tasks Prioritized' },
              { value: '98%', label: 'On-Time Completion' },
              { value: '2.4x', label: 'Productivity Gain' },
              { value: '0', label: 'Missed Deadlines' },
            ].map((stat) => (
              <div key={stat.label} className="text-center md:text-left">
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-white/50">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Analytics Section */}
      <section className="py-24 px-6 bg-[#f8f7f2]">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Content */}
          <div className="order-2 lg:order-1">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#EEA175]/30 text-[#2B1B17] rounded-full text-sm font-medium mb-6">
              <TrendingUp size={16} />
              Smart Analytics
            </span>

            <h2 className="text-4xl lg:text-5xl font-bold text-[#2B1B17] leading-tight mb-6">
              Understand your productivity patterns.
            </h2>
            
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              Visualize your focus trends, identify peak performance hours, and 
              optimize your schedule with data-driven insights.
            </p>

            <ul className="space-y-4 mb-8">
              {[
                'Weekly productivity heatmaps',
                'Priority distribution analysis',
                'Focus time tracking',
                'Deadline prediction accuracy'
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-[#EEA175]/30 flex items-center justify-center">
                    <CheckCircle size={12} className="text-[#2B1B17]" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
            
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-[#FC703C] text-white rounded-full font-medium hover:bg-[#E85C2A] transition-all hover:scale-105"
            >
              View Dashboard
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Right Visual */}
          <div className="order-1 lg:order-2 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#EEA175]/30 to-[#FC703C]/20 rounded-3xl blur-2xl" />
            <div className="relative bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
              {/* Mock Chart */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[#2B1B17]">Weekly Focus Score</h4>
                  <span className="text-sm text-green-600 font-medium">+12%</span>
                </div>
                
                {/* Chart Bars */}
                <div className="flex items-end justify-between h-48 gap-3">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <div key={`${day}-${i}`} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-[#2B1B17] rounded-t-lg transition-all hover:bg-[#FC703C]"
                        style={{ height: `${chartHeights[i]}%` }}
                      />
                      <span className="text-xs text-gray-400 font-medium">{day}</span>
                    </div>
                  ))}
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-100">
                  <div>
                    <div className="text-2xl font-bold text-[#2B1B17]">87</div>
                    <div className="text-xs text-gray-500">Focus Score</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[#2B1B17]">6.5h</div>
                    <div className="text-xs text-gray-500">Deep Work</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[#2B1B17]">12</div>
                    <div className="text-xs text-gray-500">Tasks Done</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Focus Mode CTA */}
      <section className="relative bg-[#2B1B17] py-32 px-6 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#EEA175]/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#FC703C]/30 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm text-white/80 mb-8">
            <Shield size={16} />
            Distraction-Free Environment
          </div>
          
          <h2 className="text-4xl lg:text-6xl font-bold text-white leading-tight mb-8">
            Deep work requires
            <br />
            <span className="text-[#EEA175]">deep focus.</span>
          </h2>
          
          <p className="text-xl text-white/70 max-w-2xl mx-auto mb-12 leading-relaxed">
            Activate Focus Mode to eliminate notifications and guide you through 
            your highest-priority tasks one at a time.
          </p>
          
          <button className="group inline-flex items-center gap-3 px-10 py-5 bg-white text-[#2B1B17] rounded-full font-semibold text-lg hover:bg-[#f8f7f2] transition-all hover:scale-105 shadow-2xl">
            <Zap className="w-5 h-5" />
            Enter Focus Mode
          </button>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-[#f8f7f2]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-[#2B1B17] leading-tight mb-6">
            Ready to maximize your focus?
          </h2>
          
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#FC703C] text-white rounded-full font-medium hover:bg-[#E85C2A] transition-all hover:scale-105 hover:shadow-xl"
            >
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#2B1B17] text-white py-20 px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Top Section */}
          <div className="grid lg:grid-cols-2 gap-16 pb-16 border-b border-white/10">
            
            {/* Brand & Newsletter */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-2xl">PrioSync</span>
              </div>
              
              <p className="text-white/60 max-w-md leading-relaxed">
                Pioneering intelligent task management through algorithmic 
                prioritization. Built for humans who want to achieve more.
              </p>
              
              <div className="flex gap-3 max-w-md">
                <input 
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-5 py-3 bg-white/10 border border-white/20 rounded-full text-white placeholder:text-white/40 focus:outline-none focus:border-white/40 transition-colors"
                />
                <button className="px-6 py-3 bg-white text-[#2B1B17] rounded-full font-medium hover:bg-[#f8f7f2] transition-colors">
                  Subscribe
                </button>
              </div>
            </div>

            {/* Links Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h4 className="font-semibold mb-4 text-white/40 text-xs uppercase tracking-wider">Product</h4>
                <ul className="space-y-3">
                  <li><Link to="/features" className="text-white/70 hover:text-white transition-colors text-sm">Features</Link></li>
                  <li><Link to="/pricing" className="text-white/70 hover:text-white transition-colors text-sm">Pricing</Link></li>
                  <li><Link to="/integrations" className="text-white/70 hover:text-white transition-colors text-sm">Integrations</Link></li>
                  <li><Link to="/changelog" className="text-white/70 hover:text-white transition-colors text-sm">Changelog</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4 text-white/40 text-xs uppercase tracking-wider">Company</h4>
                <ul className="space-y-3">
                  <li><Link to="/about" className="text-white/70 hover:text-white transition-colors text-sm">About</Link></li>
                  <li><Link to="/blog" className="text-white/70 hover:text-white transition-colors text-sm">Blog</Link></li>
                  <li><Link to="/careers" className="text-white/70 hover:text-white transition-colors text-sm">Careers</Link></li>
                  <li><Link to="/contact" className="text-white/70 hover:text-white transition-colors text-sm">Contact</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4 text-white/40 text-xs uppercase tracking-wider">Legal</h4>
                <ul className="space-y-3">
                  <li><Link to="/privacy" className="text-white/70 hover:text-white transition-colors text-sm">Privacy</Link></li>
                  <li><Link to="/terms" className="text-white/70 hover:text-white transition-colors text-sm">Terms</Link></li>
                  <li><Link to="/security" className="text-white/70 hover:text-white transition-colors text-sm">Security</Link></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/40 text-sm">
              © {new Date().getFullYear()} PrioSync. Built with MERN stack & Tailwind CSS.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Twitter size={18} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Github size={18} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Linkedin size={18} />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Custom Styles */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float 8s ease-in-out infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.4; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        @keyframes draw {
          from { stroke-dasharray: 300; stroke-dashoffset: 300; }
          to { stroke-dasharray: 300; stroke-dashoffset: 0; }
        }
        .animate-draw {
          animation: draw 2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
