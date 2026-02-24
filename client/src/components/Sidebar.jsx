import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, GitBranch, User, LogOut, Menu, Zap,
} from 'lucide-react';
import { createElement, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/dependencies', label: 'Dependencies', icon: GitBranch },
  { to: '/profile', label: 'Profile', icon: User },
];
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'priosync:sidebar:collapsed';

/**
 * PinwheelLogo - A custom SVG component that spins continuously
 */
const PinwheelLogo = ({ size = 32 }) => {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer ring for retro feel */}
      <div className="absolute inset-0 rounded-full border-2 border-[#2B1B17] opacity-20" />
      
      {/* The Spinning Blades */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-full h-full animate-[spin_4s_linear_infinite]"
        style={{ transformOrigin: 'center' }}
      >
        <path
          d="M12 2C12 2 14 6 14 8C14 10 12 12 12 12"
          stroke="#FC703C"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M22 12C22 12 18 14 16 14C14 14 12 12 12 12"
          stroke="#FC703C"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M12 22C12 22 10 18 10 16C10 14 12 12 12 12"
          stroke="#FC703C"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M2 12C2 12 6 10 8 10C10 10 12 12 12 12"
          stroke="#FC703C"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Center Cap */}
      <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-[#FC703C] rounded-full transform -translate-x-1/2 -translate-y-1/2 border border-[#2B1B17]" />
    </div>
  );
};

/**
 * Sidebar - Retro GSAP-inspired dark navigation panel
 */
const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [hoveredItem, setHoveredItem] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore storage failures in restricted browser contexts.
    }
  }, [collapsed]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Helper to check if route is active
  const isActiveRoute = (path) => location.pathname === path;

  return (
    <aside
      className={`flex flex-col h-screen bg-[#2B1B17] border-r border-[#FC703C]/20 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
        collapsed ? 'w-20' : 'w-72'
      } shrink-0 relative ${collapsed ? 'overflow-x-visible overflow-y-hidden' : 'overflow-hidden'} bpmf-huninn-regular`}
    >
      {/* Decorative Background Texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(#FC703C 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      />

      {/* Header Section */}
      <div className={`relative flex items-center transition-all duration-500 ${collapsed ? 'justify-center' : 'justify-between'} px-6 py-6 border-b border-[#FC703C]/10`}>
        {/* Logo Area */}
        <div className={`flex items-center gap-3 transition-all duration-500 ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative group cursor-pointer">
            <div className="absolute inset-0 bg-[#FC703C] blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300" />

          </div>

          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="chillax-bold font-black text-[#FDF8F0] text-4xl tracking-tighter leading-none">
                Prio<span className="text-[#FC703C]">Sync</span>
              </span>
              <span className="text-[10px] text-[#CCC4BE] tracking-[0.2em] uppercase font-bold mt-0.5">
                Task Engine
              </span>
            </div>
          )}
        </div>

        {/* Toggle Button - Collapse or Expand */}
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="w-8 h-12 bg-[#FC703C] rounded-r-lg flex items-center justify-center text-[#2B1B17] hover:bg-[#ff855c] transition-all duration-300 shadow-lg shadow-orange-900/20"
            aria-label="Expand sidebar"
          >
            <Menu size={14} strokeWidth={3} />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(true)}
            className="p-2 rounded-full text-[#CCC4BE] hover:text-[#FC703C] hover:bg-[#FC703C]/10 transition-all duration-300"
            aria-label="Collapse sidebar"
          >
            <Menu size={20} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto scrollbar-hide">
        {navItems.map(({ to, label, icon }) => {
          const isActive = isActiveRoute(to);
          const isHovered = hoveredItem === to;
          
          return (
            <NavLink
              key={to}
              to={to}
              onMouseEnter={() => setHoveredItem(to)}
              onMouseLeave={() => setHoveredItem(null)}
              className={({ isActive }) => `
                group relative flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 ease-out
                ${isActive 
                  ? 'bg-[#FC703C] text-[#2B1B17] shadow-lg shadow-orange-900/30 translate-x-1' 
                  : 'text-[#CCC4BE] hover:text-[#FDF8F0] hover:bg-white/5'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? label : undefined}
            >
              {/* Active Indicator Strip */}
              {isActive && !collapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#FDF8F0] rounded-r-full" />
              )}

              {/* Icon Container */}
              <div className={`
                relative flex items-center justify-center transition-transform duration-300
                ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:rotate-3'}
              `}>
                {createElement(icon, {
                  size: 22,
                  strokeWidth: isActive ? 2.5 : 2,
                  className: isActive ? 'text-[#2B1B17]' : 'text-[#FC703C] group-hover:text-[#FC703C]',
                })}
                {/* Zap effect on hover for inactive items */}
                {!isActive && isHovered && (
                  <Zap size={10} className="absolute -top-1 -right-1 text-[#FC703C] fill-[#FC703C] animate-pulse" />
                )}
              </div>

              {/* Label */}
              {!collapsed && (
                <span className={`
                  font-bold text-sm tracking-wide transition-all duration-300
                  ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}
                `}>
                  {label}
                </span>
              )}

              {/* Hover Glow Effect */}
              <div className={`
                absolute inset-0 rounded-xl bg-gradient-to-r from-[#FC703C]/0 via-[#FC703C]/5 to-[#FC703C]/0 
                opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none
                ${isActive ? 'hidden' : ''}
              `} />
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / User Section */}
      <div className="relative px-4 pb-6 pt-4 border-t border-[#FC703C]/10 bg-[#2B1B17]">
        {/* User Info Card */}
        {!collapsed && user && (
          <div className="mb-4 p-3 rounded-xl bg-[#231612] border border-white/5 flex items-center gap-3 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-[#FC703C]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="w-10 h-10 rounded-full bg-[#FC703C]/20 flex items-center justify-center border border-[#FC703C]/30 text-[#FC703C] font-bold">
              {user.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#FDF8F0] truncate">{user.name}</p>
              <p className="text-xs text-[#CCC4BE] truncate opacity-70">{user.email}</p>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={`
            group flex items-center gap-3 w-full px-4 py-3.5 rounded-xl 
            text-[#CCC4BE] hover:text-red-400 hover:bg-red-400/10 
            transition-all duration-300 border border-transparent hover:border-red-400/20
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Logout' : undefined}
        >
          <div className="relative">
            <LogOut size={20} className="transition-transform duration-300 group-hover:-translate-x-1" />
            <div className="absolute inset-0 blur-lg bg-red-500 opacity-0 group-hover:opacity-40 transition-opacity" />
          </div>
          
          {!collapsed && (
            <span className="font-bold text-sm tracking-wide group-hover:translate-x-1 transition-transform duration-300">
              Sign Out
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
