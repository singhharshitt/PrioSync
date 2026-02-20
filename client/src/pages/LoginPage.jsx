import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const LoginPage = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(form);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen hero-gradient flex items-center justify-center px-4">
            <div className="w-full max-w-md animate-fade-up">
                {/* Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#604C39] flex items-center justify-center">
                            <Zap size={20} className="text-white" />
                        </div>
                        <span className="font-heading font-bold text-2xl text-white">PrioSync</span>
                    </div>
                    <h1 className="font-heading font-bold text-3xl text-white mb-1">Welcome back</h1>
                    <p className="text-sm text-[#64748b]">Sign in to your account to continue</p>
                </div>

                {/* Card */}
                <div className="card p-8 space-y-5">
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs text-[#94a3b8] font-medium">Email Address</label>
                            <input
                                name="email" type="email" required autoComplete="email"
                                value={form.email} onChange={handleChange}
                                placeholder="you@example.com"
                                className="input-field"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs text-[#94a3b8] font-medium">Password</label>
                            <div className="relative">
                                <input
                                    name="password" type={showPass ? 'text' : 'password'} required autoComplete="current-password"
                                    value={form.password} onChange={handleChange}
                                    placeholder="••••••••"
                                    className="input-field pr-10"
                                />
                                <button
                                    type="button" onClick={() => setShowPass((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#627890] hover:text-white"
                                >
                                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-1">
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-[#64748b]">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-[#c4a882] hover:underline font-medium">
                            Create one free
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
