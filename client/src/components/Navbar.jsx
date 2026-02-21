import { Bell, Search, Zap, Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/dependencies', label: 'Dependencies' },
  { to: '/profile', label: 'Profile' },
];

/**
 * Navbar - top bar for dashboard pages with GSAP-inspired design
 */
const Navbar = ({ title = 'Dashboard' }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const initials = user?.name
    ?.split(' ')
    .map((token) => token[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav className="sticky top-4 z-50 w-full px-4 sm:px-6 pt-4">
        <div className="max-w-7xl mx-auto">
          {/* Main Navbar Container with Retro Shadow */}
          <div className="rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-[4px_4px_0_#452215] px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              
              {/* Logo Section */}
              <Link to="/dashboard" className="flex items-center gap-3 min-w-0 group">
                {/* Animated Pinwheel Logo */}
                <div className="relative w-9 h-9 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full animate-spin-slow group-hover:animate-spin">
                    <path d="M50 0C50 0 65 25 50 50C35 25 50 0 50 0Z" fill="#FC703C"/>
                    <path d="M100 50C100 50 75 65 50 50C75 35 100 50 100 50Z" fill="#EEA175"/>
                    <path d="M50 100C50 100 35 75 50 50C65 75 50 100 50 100Z" fill="#2B1B17"/>
                    <path d="M0 50C0 50 25 35 50 50C25 65 0 50 0 50Z" fill="#FC703C"/>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                </div>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#2B1B17] text-sm">Prio</span>
                    <span className="font-bold text-[#FC703C] text-sm">Sync</span>
                  </div>
                  <h1 className="text-xs text-[#2B1B17]/50 font-medium truncate">{title}</h1>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center gap-1 bg-[#f8f7f2] rounded-full p-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      isActive(link.to)
                        ? 'bg-[#FC703C] text-white shadow-[2px_2px_0_#452215]'
                        : 'text-[#2B1B17]/60 hover:text-[#2B1B17] hover:bg-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Right Section */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Search Button */}
                <button
                  type="button"
                  className="w-9 h-9 rounded-xl bg-[#f8f7f2] text-[#2B1B17]/60 hover:text-[#FC703C] hover:bg-white transition-all flex items-center justify-center shadow-[2px_2px_0_#452215] hover:shadow-[3px_3px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
                  aria-label="Search"
                >
                  <Search size={16} />
                </button>

                {/* Notifications Button */}
                <button
                  type="button"
                  className="relative w-9 h-9 rounded-xl bg-[#f8f7f2] text-[#2B1B17]/60 hover:text-[#FC703C] hover:bg-white transition-all flex items-center justify-center shadow-[2px_2px_0_#452215] hover:shadow-[3px_3px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
                  aria-label="Notifications"
                >
                  <Bell size={16} />
                  {/* Notification Badge */}
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FC703C] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                    3
                  </span>
                </button>

                {/* User Profile */}
                {user && (
                  <Link 
                    to="/profile"
                    className="hidden sm:flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full bg-[#f8f7f2] hover:bg-white transition-all shadow-[2px_2px_0_#452215] hover:shadow-[3px_3px_0_#452215] hover:-translate-y-0.5 active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <div 
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #FC703C, #EEA175)' }}
                    >
                      {initials || 'U'}
                    </div>
                    <span className="text-sm font-medium text-[#2B1B17] max-w-24 truncate">
                      {user.name}
                    </span>
                  </Link>
                )}

                {/* Mobile Menu Toggle */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden w-9 h-9 rounded-xl bg-[#f8f7f2] text-[#2B1B17]/60 hover:text-[#FC703C] transition-all flex items-center justify-center shadow-[2px_2px_0_#452215] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          <div className={`lg:hidden mt-2 transition-all duration-300 ${mobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
            <div className="rounded-2xl bg-white/95 backdrop-blur-xl border border-white/60 shadow-[4px_4px_0_#452215] p-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive(link.to)
                      ? 'bg-[#FC703C] text-white shadow-[2px_2px_0_#452215]'
                      : 'text-[#2B1B17]/60 hover:text-[#2B1B17] hover:bg-[#f8f7f2]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              {/* Mobile User Info */}
              {user && (
                <div className="pt-2 mt-2 border-t border-[#2B1B17]/10 flex items-center gap-3 px-4 py-2">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #FC703C, #EEA175)' }}
                  >
                    {initials || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-[#2B1B17]">{user.name}</p>
                    <p className="text-xs text-[#2B1B17]/40">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Custom Styles */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </>
  );
};

export default Navbar;