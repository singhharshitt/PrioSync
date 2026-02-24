import { useState } from 'react';
import { Zap } from 'lucide-react';

/**
 * StatCard — Retro GSAP-inspired dashboard metric card
 * Features: Pinwheel loader, warm palette, tactile hover states, counter animation
 */
const StatCard = ({ label, value, icon: Icon, color = '#FC703C', sublabel, trend }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Format large numbers with commas
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div 
      className="group relative overflow-hidden rounded-2xl bg-[#2B1B17] border border-[#FC703C]/10 p-6 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.02] hover:border-[#FC703C]/30 hover:shadow-2xl hover:shadow-orange-900/20"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FC703C]/0 via-[#FC703C]/0 to-[#FC703C]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      {/* Retro Dot Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(#FC703C 1px, transparent 1px)', backgroundSize: '16px 16px' }}
      />

      {/* Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FC703C] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative flex items-start gap-4">
        {/* Icon Container with Pinwheel Spin Effect */}
        <div
          className={`
            relative w-14 h-14 rounded-xl flex items-center justify-center shrink-0
            transition-all duration-500 ease-out
            ${isHovered ? 'rotate-3 scale-110' : ''}
          `}
          style={{ 
            background: `${color}15`, 
            border: `2px solid ${color}40`,
            boxShadow: isHovered ? `0 0 20px ${color}30` : 'none'
          }}
        >
          {/* Spinning Pinwheel Background (Subtle) */}
          <div className={`
            absolute inset-0 rounded-xl opacity-20
            transition-all duration-700
            ${isHovered ? 'animate-[spin_3s_linear_infinite]' : ''}
          `}>
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-2">
              <path d="M12 2L12 12M12 12L22 12M12 12L12 22M12 12L2 12" stroke={color} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          
          {Icon && (
            <Icon 
              size={24} 
              style={{ color }} 
              className="relative z-10 transition-transform duration-300 group-hover:scale-110"
              strokeWidth={2.5}
            />
          )}

          {/* Zap indicator on hover */}
          {isHovered && (
            <Zap 
              size={10} 
              className="absolute -top-1 -right-1 text-[#FC703C] fill-[#FC703C] animate-pulse" 
            />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Value with Counter Effect */}
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-[#FDF8F0] tracking-tighter leading-none transition-all duration-300 group-hover:translate-x-1">
              {formattedValue}
            </p>
            
            {/* Trend Indicator */}
            {trend && (
              <span className={`
                text-xs font-bold px-2 py-0.5 rounded-full
                ${trend > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
              `}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            )}
          </div>

          {/* Label */}
          <p className="mt-1 text-sm font-bold uppercase tracking-wider" style={{ color }}>
            {label}
          </p>

          {/* Sublabel */}
          {sublabel && (
            <p className="text-xs mt-1.5 text-[#CCC4BE] font-medium opacity-70 group-hover:opacity-100 transition-opacity">
              {sublabel}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Decorative Element */}
      <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-[#FC703C]/10 to-transparent rounded-tl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
};

export default StatCard;