import { createElement, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Eye, EyeOff, Zap, AlertCircle, ArrowRight, 
  Github, Twitter, Mail, User, Lock, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  
  // Toggle between login and register
  const [isLogin, setIsLogin] = useState(location.pathname !== '/register');
  
  // Form states
  const [form, setForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirm: '' 
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  // Animation on mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsLogin(location.pathname !== '/register');
  }, [location.pathname]);

  // Reset form when switching modes
  useEffect(() => {
    setError('');
    setForm({ name: '', email: '', password: '', confirm: '' });
    setShowPass(false);
  }, [isLogin]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validateForm = () => {
    if (!isLogin) {
      if (form.password !== form.confirm) {
        setError('Passwords do not match.');
        return false;
      }
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters.');
        return false;
      }
      if (!form.name.trim()) {
        setError('Please enter your full name.');
        return false;
      }
    }
    if (!form.email.trim()) {
      setError('Please enter your email address.');
      return false;
    }
    if (!form.password) {
      setError('Please enter your password.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      if (isLogin) {
        await login({ email: form.email, password: form.password });
      } else {
        await register({ 
          name: form.name, 
          email: form.email, 
          password: form.password 
        });
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 
        (isLogin ? 'Login failed. Please check your credentials.' : 'Registration failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (pass) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 6) strength++;
    if (pass.length >= 10) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[0-9]/.test(pass)) strength++;
    if (/[^A-Za-z0-9]/.test(pass)) strength++;
    return Math.min(strength, 4);
  };

  const strength = getPasswordStrength(form.password);
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

  return (
    <div className="h-screen bg-[#f8f7f2] relative overflow-hidden flex items-center justify-center px-4">
      
      {/* Animated Background Elements - GSAP Style */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        
        {/* Large gradient orbs - lighter tones */}
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-[#EEA175]/30 rounded-full blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-[#FC703C]/20 rounded-full blur-[130px] animate-pulse-slow" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[40%] left-[60%] w-[400px] h-[400px] bg-[#2B1B17]/10 rounded-full blur-[100px] animate-float-slow" />
        
        {/* Floating geometric shapes - more variety */}
        <div className="absolute top-[10%] left-[8%] w-16 h-16 border-4 border-[#FC703C]/30 rotate-45 animate-float" />
        <div className="absolute top-[20%] right-[12%] w-12 h-12 rounded-full bg-[#EEA175]/40 animate-float-slow" />
        <div className="absolute bottom-[25%] left-[15%] w-20 h-20 border-2 border-[#2B1B17]/20 rounded-full animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[15%] right-[8%] w-10 h-10 bg-[#FC703C]/30 rotate-12 animate-float-slow" />
        <div className="absolute top-[60%] left-[5%] w-8 h-8 bg-[#EEA175]/50 rotate-45 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[30%] right-[5%] w-14 h-14 border-2 border-dashed border-[#2B1B17]/30 rounded-full animate-spin-slow" />
        
        {/* Decorative stars/sparkles */}
        <div className="absolute top-[15%] left-[25%] text-[#FC703C]/40 animate-pulse">
          <Sparkles size={24} />
        </div>
        <div className="absolute bottom-[30%] right-[20%] text-[#EEA175]/50 animate-pulse" style={{ animationDelay: '1s' }}>
          <Sparkles size={20} />
        </div>
        <div className="absolute top-[70%] right-[30%] text-[#2B1B17]/20 animate-pulse" style={{ animationDelay: '2s' }}>
          <Sparkles size={16} />
        </div>
        
        {/* Animated squiggle lines */}
        <svg className="absolute top-[5%] left-[30%] w-32 h-32 text-[#FC703C]/20 animate-float" viewBox="0 0 100 100">
          <path d="M10 50 Q30 20 50 50 T90 50" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <svg className="absolute bottom-[10%] right-[25%] w-24 h-24 text-[#EEA175]/30 animate-float-slow" viewBox="0 0 100 100">
          <path d="M10 50 Q30 80 50 50 T90 50" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(#2B1B17 1px, transparent 1px),
                           linear-gradient(90deg, #2B1B17 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Main Content Container - No scroll, centered */}
      <div className={`w-full max-w-md relative z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        
        {/* Logo Section */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-3 mb-4 group">
            <div className="relative w-12 h-12">
              {/* Animated Pinwheel */}

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-[#f8f7f2] rounded-full" />
              </div>
            </div>
            <span className="font-bold text-3xl text-[#2B1B17] tracking-tight chillax-extrabold">
              Prio<span className="text-[#FC703C]">Sync</span>
            </span>
          </Link>
          
          {/* Curly Brace Tagline */}
          <div className="flex items-start justify-center gap-3">
            <span className="text-3xl text-[#FC703C]/60 font-light mt-1">{`{`}</span>
            <div className="text-center">
              <h1 className="text-2xl md:text-xl font-bold text-[#2B1B17] leading-tight tracking-tight">
                {isLogin ? 'Welcome back' : 'Get Started'}
              </h1>
              <p className="text-[#2B1B17]/50 mt-1 text-sm">
                {isLogin ? 'Sign in to your account' : 'Create your free account'}
              </p>
            </div>
            <span className="text-3xl text-[#FC703C]/60 font-light mt-1">{`}`}</span>
          </div>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="flex gap-2 mb-4 p-1 bg-[#2B1B17]/5 rounded-full w-fit mx-auto">
          <button
            onClick={() => navigate('/login')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              isLogin 
                ? 'bg-[#2B1B17] text-white shadow-md' 
                : 'text-[#2B1B17]/60 hover:text-[#2B1B17]'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/register')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              !isLogin 
                ? 'bg-[#FC703C] text-white shadow-md' 
                : 'text-[#2B1B17]/60 hover:text-[#2B1B17]'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Glassmorphism Form Card with Retro Shadow */}
        <div 
          className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/60"
          style={{
            boxShadow: '4px 4px 0 #452215'
          }}
        >
          
          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm animate-shake">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Full Name - Register Only */}
            <div className={`space-y-1.5 transition-all duration-300 ${isLogin ? 'h-0 opacity-0 overflow-hidden' : 'h-auto opacity-100'}`}>
              <label className="text-xs uppercase tracking-widest text-[#2B1B17]/50 font-medium ml-1 flex items-center gap-2">
                <User size={12} />
                Full Name
              </label>
              <input
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="John Doe"
                disabled={isLogin}
                className="w-full h-12 px-4 bg-white/50 border border-[#2B1B17]/10 rounded-xl text-[#2B1B17] placeholder:text-[#2B1B17]/20 focus:outline-none focus:border-[#FC703C] focus:ring-2 focus:ring-[#FC703C]/20 transition-all"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-[#2B1B17]/50 font-medium ml-1 flex items-center gap-2">
                <Mail size={12} />
                Email Address
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full h-12 px-4 bg-white/50 border border-[#2B1B17]/10 rounded-xl text-[#2B1B17] placeholder:text-[#2B1B17]/20 focus:outline-none focus:border-[#FC703C] focus:ring-2 focus:ring-[#FC703C]/20 transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-[#2B1B17]/50 font-medium ml-1 flex items-center gap-2">
                <Lock size={12} />
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full h-12 px-4 pr-12 bg-white/50 border border-[#2B1B17]/10 rounded-xl text-[#2B1B17] placeholder:text-[#2B1B17]/20 focus:outline-none focus:border-[#FC703C] focus:ring-2 focus:ring-[#FC703C]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2B1B17]/30 hover:text-[#2B1B17]/60 transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {/* Password Strength - Register Only */}
              {!isLogin && form.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-300 ${
                          i < strength ? strengthColors[strength - 1] : 'bg-[#2B1B17]/10'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    strength > 0 ? 'text-[#2B1B17]/60' : 'text-[#2B1B17]/30'
                  }`}>
                    {strength > 0 ? strengthLabels[strength - 1] : 'Enter password'}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password - Register Only */}
            <div className={`space-y-1.5 transition-all duration-300 ${isLogin ? 'h-0 opacity-0 overflow-hidden' : 'h-auto opacity-100'}`}>
              <label className="text-xs uppercase tracking-widest text-[#2B1B17]/50 font-medium ml-1">
                Confirm Password
              </label>
              <input
                name="confirm"
                type={showPass ? 'text' : 'password'}
                value={form.confirm}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={isLogin}
                className={`w-full h-12 px-4 bg-white/50 border rounded-xl text-[#2B1B17] placeholder:text-[#2B1B17]/20 focus:outline-none focus:border-[#FC703C] focus:ring-2 focus:ring-[#FC703C]/20 transition-all ${
                  !isLogin && form.confirm && form.password !== form.confirm 
                    ? 'border-red-400/50' 
                    : 'border-[#2B1B17]/10'
                }`}
              />
              {!isLogin && form.confirm && form.password !== form.confirm && (
                <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
              )}
            </div>

            {/* Forgot Password - Login Only */}
            {isLogin && (
              <div className="flex justify-end">
                <Link 
                  to="/forgot-password" 
                  className="text-xs text-[#2B1B17]/40 hover:text-[#FC703C] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            {/* Submit Button with Retro Shadow */}
            <button
              type="submit"
              disabled={loading}
              className={`
                group w-full h-12 mt-2 
                ${isLogin ? 'bg-[#2B1B17] hover:bg-[#3d2823]' : 'bg-[#FC703C] hover:bg-[#E85C2A]'} 
                text-white rounded-full font-medium 
                shadow-[4px_4px_0_#452215]
                hover:shadow-[6px_6px_0_#452215] 
                hover:-translate-y-0.5
                active:shadow-none active:translate-x-1 active:translate-y-1
                disabled:opacity-50 disabled:cursor-not-allowed 
                disabled:hover:shadow-[4px_4px_0_#452215] disabled:hover:translate-y-0
                transition-all duration-150
                flex items-center justify-center gap-2
              `}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  {isLogin ? 'Signing in...' : 'Creating...'}
                </span>
              ) : (
                <>
                  {isLogin ? 'Continue' : 'Create Account'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2B1B17]/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs text-[#2B1B17]/40 bg-white/50 backdrop-blur-sm">
                or
              </span>
            </div>
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Mail, label: 'Google', color: 'hover:bg-red-50 hover:border-red-200' },
              { icon: Github, label: 'GitHub', color: 'hover:bg-gray-100 hover:border-gray-300' },
              { icon: Twitter, label: 'Twitter', color: 'hover:bg-blue-50 hover:border-blue-200' }
            ].map(({ icon, label, color }) => (
              <button
                key={label}
                type="button"
                className={`
                  h-10 flex items-center justify-center gap-1.5 
                  bg-white/50 border border-[#2B1B17]/10 
                  rounded-xl text-[#2B1B17]/70 
                  ${color}
                  hover:text-[#2B1B17] hover:shadow-[2px_2px_0_#452215]
                  active:shadow-none active:translate-x-0.5 active:translate-y-0.5
                  transition-all duration-150 group
                `}
              >
                {createElement(icon, { className: 'w-4 h-4 group-hover:scale-110 transition-transform' })}
                <span className="text-xs hidden sm:inline font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Links */}
        
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
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.1); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 5s ease-in-out infinite;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
          20%, 40%, 60%, 80% { transform: translateX(3px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
