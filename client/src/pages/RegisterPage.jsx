import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const RegisterPage = () => {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.password !== form.confirm) {
            return setError('Passwords do not match.');
        }
        if (form.password.length < 6) {
            return setError('Password must be at least 6 characters.');
        }
        setLoading(true);
        try {
            await register({ name: form.name, email: form.email, password: form.password });
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen hero-gradient flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md animate-fade-up">
                {/* Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#604C39] flex items-center justify-center">
                            <Zap size={20} className="text-white" />
                        </div>
                        <span className="font-heading font-bold text-2xl text-white">PrioSync</span>
                    </div>
                    <h1 className="font-heading font-bold text-3xl text-white mb-1">Create your account</h1>
                    <p className="text-sm text-[#64748b]">Start prioritizing smarter today — it's free</p>
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
                            <label className="text-xs text-[#94a3b8] font-medium">Full Name</label>
                            <input
                                name="name" required autoComplete="name"
                                value={form.name} onChange={handleChange}
                                placeholder="John Doe"
                                className="input-field"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs text-[#94a3b8] font-medium">Email Address</label>
                            <input
                                name="email" type="email" required autoComplete="email"
                                value={form.email} onChange={handleChange}
                                placeholder="you@example.com"
                                className="input-field"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs text-[#94a3b8] font-medium">Password</label>
                                <div className="relative">
                                    <input
                                        name="password" type={showPass ? 'text' : 'password'} required autoComplete="new-password"
                                        value={form.password} onChange={handleChange}
                                        placeholder="••••••••"
                                        className="input-field pr-9"
                                    />
                                    <button
                                        type="button" onClick={() => setShowPass((v) => !v)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#627890] hover:text-white"
                                    >
                                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs text-[#94a3b8] font-medium">Confirm</label>
                                <input
                                    name="confirm" type={showPass ? 'text' : 'password'} required autoComplete="new-password"
                                    value={form.confirm} onChange={handleChange}
                                    placeholder="••••••••"
                                    className="input-field"
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-1">
                            {loading ? 'Creating account…' : 'Create Account →'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-[#64748b]">
                        Already have an account?{' '}
                        <Link to="/login" className="text-[#c4a882] hover:underline font-medium">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
