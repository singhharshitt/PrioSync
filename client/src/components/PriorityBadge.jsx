import { Zap, AlertCircle, Target, Circle } from 'lucide-react';

/**
 * PriorityBadge - displays score (0-100) with color-coded tier label
 * GSAP-inspired design with retro shadows and improved visuals
 */

const tierConfig = {
  critical: { 
    label: 'Critical', 
    color: '#ef4444',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: AlertCircle,
    shadow: '#7f1d1d'
  },
  high: { 
    label: 'High', 
    color: '#FC703C',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: Zap,
    shadow: '#9a3412'
  },
  medium: { 
    label: 'Medium', 
    color: '#eab308',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: Target,
    shadow: '#854d0e'
  },
  low: { 
    label: 'Low', 
    color: '#22c55e',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: Circle,
    shadow: '#166534'
  },
};

const PriorityBadge = ({ score = 0, tier = 'medium', showScore = true, size = 'md' }) => {
  const config = tierConfig[tier] || tierConfig.medium;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2'
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14
  };

  return (
    <span 
      className={`
        inline-flex items-center rounded-full font-semibold
        ${config.bg} ${config.border} border
        shadow-[2px_2px_0_${config.shadow}]
        ${sizeClasses[size]}
        transition-all duration-150
        hover:shadow-[3px_3px_0_${config.shadow}] hover:-translate-y-0.5
      `}
      style={{ color: config.color }}
    >
      <Icon 
        size={iconSizes[size]} 
        className={tier === 'critical' ? 'animate-pulse' : ''} 
      />
      <span>{config.label}</span>
      {showScore && (
        <span className="opacity-60 font-mono">
          · {score}
        </span>
      )}
    </span>
  );
};

export default PriorityBadge;