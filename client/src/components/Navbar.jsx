import { Bell, Search, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/dependencies', label: 'Dependencies' },
  { to: '/profile', label: 'Profile' },
];

/**
 * Navbar - top bar for dashboard pages
 */
const Navbar = ({ title = 'Dashboard' }) => {
  const { user } = useAuth();
  const initials = user?.name
    ?.split(' ')
    .map((token) => token[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <nav className="sticky top-4 z-40 w-full px-4 sm:px-6 pt-4">
      <div className="max-w-7xl mx-auto rounded-2xl bg-white/80 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgba(93,7,3,0.08)] px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#FC703C] flex items-center justify-center shrink-0">
              <Zap size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#4A3A36] leading-none">PrioSync</p>
              <h1 className="text-sm sm:text-base font-semibold text-[#2B1B17] truncate">{title}</h1>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-5">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-[#4A3A36] hover:text-[#FC703C] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              className="p-2 rounded-lg text-[#4A3A36] hover:bg-[#F4F3E6] hover:text-[#FC703C] transition-colors"
              aria-label="Search"
            >
              <Search size={16} />
            </button>
            <button
              type="button"
              className="p-2 rounded-lg text-[#4A3A36] hover:bg-[#F4F3E6] hover:text-[#FC703C] transition-colors"
              aria-label="Notifications"
            >
              <Bell size={16} />
            </button>
            {user && (
              <div className="hidden sm:flex items-center gap-2.5 pl-1">
                <span className="w-8 h-8 rounded-full bg-[#FC703C] text-white text-xs font-bold flex items-center justify-center">
                  {initials || 'U'}
                </span>
                <p className="text-sm font-medium text-[#2B1B17] max-w-36 truncate">{user.name}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
