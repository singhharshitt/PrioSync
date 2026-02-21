import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, GitBranch, User, LogOut, Menu, X, Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/dependencies', label: 'Dependencies', icon: GitBranch },
  { to: '/profile', label: 'Profile', icon: User },
];

/**
 * Sidebar - dark left navigation panel
 */
const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`flex flex-col h-screen bg-[#2B1B17] border-r border-white/5 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      } shrink-0`}
    >
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FC703C] flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-heading font-bold text-white text-base tracking-tight">
              PrioSync
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed((value) => !value)}
          className="p-1.5 rounded-lg text-[#CCC4BE] hover:bg-white/10 hover:text-white transition-colors ml-auto"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <Menu size={18} /> : <X size={16} />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon }) => {
          const NavIcon = icon;
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              title={collapsed ? label : undefined}
            >
              <NavIcon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-2 pb-4 border-t border-white/10 pt-3 space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <p className="text-xs text-[#CCC4BE] truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-left"
          title={collapsed ? 'Logout' : undefined}
          aria-label="Logout"
        >
          <LogOut size={18} className="shrink-0 text-red-400" />
          {!collapsed && <span className="text-red-400">Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
