import { useEffect, useState } from 'react';
import { User, Zap, CheckCircle, Clock, Target, Save } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Navbar from '../components/Navbar.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import authService from '../services/authService.js';
import useTasks from '../hooks/useTasks.js';
import { toast } from 'react-toastify';

const ProfilePage = () => {
    const { user, updateUser } = useAuth();
    const { stats, fetchStats } = useTasks();
    const [name, setName] = useState(user?.name || '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchStats();
        setName(user?.name || '');
    }, [user]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data } = await authService.updateProfile({ name });
            updateUser(data.user);
            toast.success('Profile updated!');
        } catch {
            toast.error('Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const initials = user?.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';

    // Productivity tier
    const pts = stats?.productivityScore || user?.productivityScore || 0;
    const tier = pts >= 80 ? '🏆 Expert' : pts >= 60 ? '⚡ Advanced' : pts >= 40 ? '📈 Intermediate' : '🌱 Beginner';

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-dashboard)' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Navbar title="Profile" />
                <main className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl mx-auto w-full">

                    {/* Profile Card */}
                    <div className="card p-6 flex flex-col sm:flex-row items-start gap-6">
                        <div
                            className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shrink-0"
                            style={{ background: 'linear-gradient(135deg, #604C39, #7a6248)' }}
                        >
                            {initials}
                        </div>
                        <div className="flex-1 space-y-3">
                            <div>
                                <p className="text-xs text-[#64748b] mb-1">Display Name</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        value={name} onChange={(e) => setName(e.target.value)}
                                        className="input-field flex-1"
                                        placeholder="Your name"
                                    />
                                    <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5 py-2.5 px-4 shrink-0">
                                        <Save size={14} />
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-[#64748b] mb-0.5">Email</p>
                                <p className="text-sm text-white">{user?.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#c4a882]">{tier}</span>
                                <span className="text-xs text-[#64748b]">
                                    Member since {new Date(user?.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Productivity Score" value={pts} icon={Zap} color="#604C39" />
                        <StatCard label="Tasks Created" value={stats?.total || user?.tasksCreated || 0} icon={Target} color="#627890" />
                        <StatCard label="Completed" value={stats?.completed || user?.tasksCompleted || 0} icon={CheckCircle} color="#22c55e" />
                        <StatCard label="In Progress" value={stats?.inProgress || 0} icon={Clock} color="#99A285" />
                    </div>

                    {/* Productivity bar */}
                    <div className="card p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-white text-sm">Productivity Score</h3>
                            <span className="text-2xl font-bold font-heading text-[#c4a882]">{pts}</span>
                        </div>
                        <div className="h-3 rounded-full bg-[#1e2d42] overflow-hidden mb-2">
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${pts}%`,
                                    background: 'linear-gradient(90deg, #604C39, #99A285)',
                                }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-[#64748b]">
                            <span>0</span>
                            <span>Score = completion rate × 0.7 + task volume × 0.3</span>
                            <span>100</span>
                        </div>
                    </div>

                    {/* Completion rate */}
                    {stats?.completionRate !== undefined && (
                        <div className="card p-5">
                            <h3 className="font-semibold text-white text-sm mb-3">Completion Rate</h3>
                            <div className="flex items-end gap-4">
                                <span className="text-4xl font-bold font-heading text-white">
                                    {stats.completionRate}%
                                </span>
                                <div className="flex-1 mb-2">
                                    <div className="h-2 rounded-full bg-[#1e2d42]">
                                        <div
                                            className="h-full rounded-full bg-[#22c55e] transition-all duration-700"
                                            style={{ width: `${stats.completionRate}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-[#64748b] mt-1">
                                {stats.completed} of {stats.total} tasks completed
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ProfilePage;
