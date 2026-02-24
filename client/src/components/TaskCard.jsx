import { useState } from 'react';
import { 
  Calendar, 
  Trash2, 
  Edit2, 
  ChevronDown, 
  ChevronUp, 
  Link as LinkIcon,
  Zap,
  Clock,
  AlertCircle
} from 'lucide-react';

import PriorityBadge from './PriorityBadge.jsx';

const statusConfig = {
  pending: { 
    color: '#EAB308', 
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    label: 'PENDING'
  },
  'in-progress': { 
    color: '#FC703C', 
    bg: 'bg-[#FC703C]/10',
    border: 'border-[#FC703C]/20',
    label: 'IN PROGRESS'
  },
  completed: { 
    color: '#22C55E', 
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    label: 'COMPLETED'
  },
  cancelled: { 
    color: '#6B7280', 
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    label: 'CANCELLED'
  },
};

const formatDate = (date) => {
  if (!date) return '--';
  const target = new Date(date);
  const now = new Date();
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

  const base = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diff < 0) return { text: `${base}`, status: 'overdue', diff };
  if (diff === 0) return { text: `${base}`, status: 'today', diff };
  if (diff === 1) return { text: `${base}`, status: 'tomorrow', diff };
  return { text: `${base}`, status: 'upcoming', diff };
};

const isOverdue = (date, status) => {
  if (!date || status === 'completed' || status === 'cancelled') return false;
  return new Date(date) < new Date();
};

/**
 * PinwheelSpinner - Small animated loading/activity indicator
 */
const PinwheelSpinner = ({ size = 16, color = '#FC703C', spinning = true }) => (
  <div className={`relative ${spinning ? 'animate-spin' : ''}`} style={{ width: size, height: size, animationDuration: '3s' }}>
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M12 2C12 2 14 6 14 8C14 10 12 12 12 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 12C22 12 18 14 16 14C14 14 12 12 12 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 22C12 22 10 18 10 16C10 14 12 12 12 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M2 12C2 12 6 10 8 10C10 10 12 12 12 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
    <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full transform -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: color }} />
  </div>
);

/**
 * TaskCard - Retro GSAP-inspired task display with pinwheel aesthetics
 */
const TaskCard = ({ task, onEdit, onDelete, onStatusChange }) => {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const taskId = task?._id || task?.id;
  const taskTitle = task?.title || task?.name || 'Untitled Task';
  const overdue = isOverdue(task.deadline, task.status);
  const dateInfo = formatDate(task.deadline);
  const statusStyle = statusConfig[task.status] || statusConfig.pending;

  return (
    <div
      title={taskTitle}
      className={`
        relative group rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${overdue ? 'bg-red-950/20' : 'bg-[#2B1B17]'}
        border-2 ${overdue ? 'border-red-500/30' : 'border-[#FC703C]/10'}
        hover:border-[#FC703C]/40 hover:shadow-2xl hover:shadow-orange-900/20
        ${task.status === 'completed' ? 'opacity-60' : ''}
        ${isHovered ? 'scale-[1.01] -translate-y-1' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated Background Texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none rounded-2xl"
           style={{ backgroundImage: 'radial-gradient(#FC703C 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      />

      {/* Top Energy Bar */}
      <div className={`
        absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FC703C] to-transparent 
        transition-all duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}
      `} />

      <div className="relative p-5">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Badges Row */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <PriorityBadge score={task.priorityScore} tier={task.priorityTier} />
              
              {/* Status Badge with Pinwheel */}
              <div className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider
                ${statusStyle.bg} ${statusStyle.border} border
              `}>
                {task.status === 'in-progress' && (
                  <PinwheelSpinner size={10} color={statusStyle.color} />
                )}
                <span style={{ color: statusStyle.color }}>{statusStyle.label}</span>
              </div>

              {task.category && task.category !== 'General' && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-[#FDF8F0]/10 text-[#CCC4BE] tracking-wider border border-[#FDF8F0]/10">
                  {task.category.toUpperCase()}
                </span>
              )}

              {overdue && (
                <span className="flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                  <AlertCircle size={10} />
                  OVERDUE
                </span>
              )}
            </div>

            {/* Title */}
            <h3
              className={`
                font-black text-lg leading-tight tracking-tight transition-all duration-300
                ${task.status === 'completed' ? 'line-through text-[#CCC4BE]/50' : 'text-[#FDF8F0]'}
                ${isHovered ? 'translate-x-1' : ''}
              `}
              title={taskTitle}
            >
              {taskTitle}
            </h3>
          </div>

          {/* Action Buttons */}
          <div className={`
            flex items-center gap-1 shrink-0 
            transition-all duration-300
            ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
          `}>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-2 rounded-xl text-[#CCC4BE] hover:bg-[#FC703C]/20 hover:text-[#FC703C] transition-all duration-200 hover:scale-110"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            <button
              onClick={() => onEdit?.(task)}
              className="p-2 rounded-xl text-[#CCC4BE] hover:bg-[#FC703C]/20 hover:text-[#FC703C] transition-all duration-200 hover:scale-110"
              title="Edit"
            >
              <Edit2 size={18} />
            </button>
            <button
              onClick={() => taskId && onDelete?.(taskId)}
              className="p-2 rounded-xl text-[#CCC4BE] hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 hover:scale-110"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Metadata Bar */}
        <div className={`
          flex items-center gap-4 mt-4 p-3 rounded-xl bg-[#231612] border border-[#FC703C]/5
          transition-all duration-300 ${isHovered ? 'border-[#FC703C]/20' : ''}
        `}>
          {/* Date */}
          <div className={`
            flex items-center gap-2 text-xs font-bold
            ${overdue ? 'text-red-400' : dateInfo.status === 'today' ? 'text-[#FC703C]' : 'text-[#CCC4BE]'}
          `}>
            <div className={`
              p-1.5 rounded-lg ${overdue ? 'bg-red-500/20' : 'bg-[#FC703C]/10'}
            `}>
              {overdue ? <AlertCircle size={14} /> : <Calendar size={14} />}
            </div>
            <span>
              {typeof dateInfo === 'object' ? dateInfo.text : dateInfo}
              {dateInfo.status === 'today' && <span className="ml-1 text-[10px] uppercase">(Today)</span>}
            </span>
          </div>

          {/* Dependencies */}
          {task.dependencies?.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-[#CCC4BE]">
              <div className="p-1.5 rounded-lg bg-[#FC703C]/10">
                <LinkIcon size={14} className="text-[#FC703C]" />
              </div>
              <span>{task.dependencies.length} dep{task.dependencies.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* UID Scores */}
          <div className="flex items-center gap-2 ml-auto">
            {[
              { label: 'U', value: task.urgency, color: '#EF4444' },
              { label: 'I', value: task.importance, color: '#3B82F6' },
              { label: 'D', value: task.difficulty, color: '#8B5CF6' },
            ].map(({ label, value, color }) => (
              <div 
                key={label} 
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#2B1B17] border border-[#FDF8F0]/5"
                title={`${label === 'U' ? 'Urgency' : label === 'I' ? 'Importance' : 'Difficulty'}: ${value}/10`}
              >
                <span className="text-[10px] font-black" style={{ color }}>{label}</span>
                <span className="text-xs font-bold text-[#FDF8F0]">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expanded Content */}
        <div className={`
          overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${expanded ? 'max-h-96 opacity-100 mt-4 pt-4 border-t border-[#FC703C]/10' : 'max-h-0 opacity-0'}
        `}>
          {task.description && (
            <p className="text-sm text-[#CCC4BE] leading-relaxed mb-4 font-medium">
              {task.description}
            </p>
          )}

          {task.dependencies?.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-black text-[#FDF8F0] uppercase tracking-wider mb-2 flex items-center gap-2">
                <PinwheelSpinner size={12} color="#FC703C" spinning={false} />
                Dependencies
              </div>
              <div className="flex flex-wrap gap-2">
                {task.dependencies.map((dep) => (
                  <span
                    key={dep._id || dep}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#231612] text-[#CCC4BE] font-bold border border-[#FC703C]/20 hover:border-[#FC703C]/40 transition-colors cursor-pointer"
                  >
                    {dep.title || dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Status Actions */}
          <div className="flex gap-2 flex-wrap">
            {['pending', 'in-progress', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => taskId && onStatusChange?.(taskId, status)}
                disabled={task.status === status || !taskId}
                className={`
                  relative overflow-hidden px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300
                  ${task.status === status
                    ? 'bg-[#FC703C] text-[#2B1B17] cursor-default'
                    : 'bg-[#231612] text-[#CCC4BE] border border-[#FDF8F0]/10 hover:border-[#FC703C]/50 hover:text-[#FC703C] hover:scale-105'
                  }
                `}
              >
                {task.status === status && (
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                )}
                {status === 'in-progress' ? 'In Progress' : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Corner Decoration */}
      <div className={`
        absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-[#FC703C]/10 to-transparent rounded-tl-full
        transition-opacity duration-500 pointer-events-none
        ${isHovered ? 'opacity-100' : 'opacity-0'}
      `} />
    </div>
  );
};

export default TaskCard;
