import { Bell, Search, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Navbar — top bar for dashboard layout
 */
const Navbar = ({ title = 'Dashboard' }) => {
    const { user } = useAuth();

    return (
        // Glass-morphism floating nav
        <nav className="sticky top-6 z-50 w-full flex justify-center px-4 mb-10 transition-all duration-300">
            <div className="flex items-center gap-8 px-8 py-3.5 rounded-full bg-white/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/40">

                {/* Logo - Circular dot mark */}
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-xl font-semibold text-primary tracking-tight">
                        PRIOSYNC
                    </span>
                </div>

                {/* Nav Links */}
                <div className="hidden md:flex items-center gap-6">
                    <a href="/dashboard" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                        Dashboard
                    </a>
                    <a href="/tasks" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                        Tasks
                    </a>
                    <a href="/analytics" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                        Analytics
                    </a>
                    <a href="/focus" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                        Focus Mode
                    </a>
                </div>

                {/* Auth Buttons */}
                <div className="flex items-center gap-3">
                    <button className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                        Log in
                    </button>
                    <button className="px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-full hover:bg-secondary transition-all hover:scale-105 shadow-md">
                        Get Started
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
