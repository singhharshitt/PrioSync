import { Bell, Search, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Navbar — top bar for dashboard layout
 */
const Navbar = ({ title = 'Dashboard' }) => {
    const { user } = useAuth();

    return (
        <header className="h-16 bg-[#1e2d42] border-b border-white/5 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-3">
                {/* Page title */}
                <h1 className="font-heading font-bold text-white text-xl">{title}</h1>
            </div>

            <div className="flex items-center gap-3">
                {/* Productivity Score pill */}
                {user?.productivityScore > 0 && (
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#604C39]/20 border border-[#604C39]/30">
                        <Zap size={13} className="text-[#c4a882]" />
                        <span className="text-xs font-semibold text-[#c4a882]">
                            {user.productivityScore} pts
                        </span>
                    </div>
                )}

                {/* User avatar */}
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: '#604C39' }}
                    title={user?.name}
                >
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
