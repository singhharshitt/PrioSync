import { useState } from 'react';
import { Calendar, Trash2, Edit2, ChevronDown, ChevronUp, Link as LinkIcon } from 'lucide-react';

import PriorityBadge from './PriorityBadge.jsx';

const statusColors = {
  pending: 'text-yellow-600 bg-yellow-50',
  'in-progress': 'text-[#FC703C] bg-orange-50',
  completed: 'text-green-600 bg-green-50',
  cancelled: 'text-gray-600 bg-gray-50',
};

const formatDate = (date) => {
  if (!date) return '--';
  const target = new Date(date);
  const now = new Date();
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

  const base = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diff < 0) return `${base} (overdue)`;
  if (diff === 0) return `${base} (today)`;
  if (diff === 1) return `${base} (tomorrow)`;
  return `${base} (${diff}d)`;
};

const isOverdue = (date, status) => {
  if (!date || status === 'completed' || status === 'cancelled') return false;
  return new Date(date) < new Date();
};

/**
 * TaskCard - displays task metadata and controls
 */
const TaskCard = ({ task, onEdit, onDelete, onStatusChange }) => {
  const [expanded, setExpanded] = useState(false);
  const overdue = isOverdue(task.deadline, task.status);

  return (
    <div
      className={`relative group bg-white p-5 rounded-2xl shadow-[0_1px_3px_rgba(93,7,3,0.08)] border border-orange-100/30 hover:shadow-[0_4px_6px_rgba(93,7,3,0.1)] transition-all hover:-translate-y-1 duration-300 overflow-hidden ${
        overdue ? 'border-red-200 bg-red-50/5' : ''
      } ${task.status === 'completed' ? 'opacity-70 bg-[#F4F3E6]' : ''}`}
    >
      <div className="absolute inset-0 bg-linear-to-br from-[#F4F3E6]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <PriorityBadge score={task.priorityScore} tier={task.priorityTier} />
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide ${statusColors[task.status] || statusColors.pending}`}
              >
                {task.status.toUpperCase()}
              </span>
              {task.category && task.category !== 'General' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F4F3E6] text-[#4A3A36] tracking-wide">
                  {task.category.toUpperCase()}
                </span>
              )}
            </div>
            <h3
              className={`font-semibold text-[#2B1B17] text-base leading-snug truncate ${
                task.status === 'completed' ? 'line-through text-gray-400' : ''
              }`}
              title={task.title}
            >
              {task.title}
            </h3>
          </div>

          <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
            <button
              onClick={() => setExpanded((value) => !value)}
              className="p-1.5 rounded-lg text-[#6B5B56] hover:bg-[#F4F3E6] hover:text-[#FC703C] transition-colors"
              title={expanded ? 'Collapse task details' : 'Expand task details'}
              aria-label={expanded ? 'Collapse task details' : 'Expand task details'}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              onClick={() => onEdit?.(task)}
              className="p-1.5 rounded-lg text-[#6B5B56] hover:bg-[#F4F3E6] hover:text-[#FC703C] transition-colors"
              title="Edit task"
              aria-label="Edit task"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => onDelete?.(task._id)}
              className="p-1.5 rounded-lg text-[#6B5B56] hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Delete task"
              aria-label="Delete task"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 bg-[#F4F3E6] rounded-xl p-2.5 px-3">
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${overdue ? 'text-red-500' : 'text-[#4A3A36]'}`}>
            <Calendar size={13} />
            <span>{formatDate(task.deadline)}</span>
          </div>
          {task.dependencies?.length > 0 && (
            <div className="flex items-center gap-1 text-xs font-medium text-[#4A3A36]">
              <LinkIcon size={13} />
              <span>{task.dependencies.length} dep{task.dependencies.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 ml-auto">
            {[
              { label: 'U', value: task.urgency, title: 'Urgency' },
              { label: 'I', value: task.importance, title: 'Importance' },
              { label: 'D', value: task.difficulty, title: 'Difficulty' },
            ].map(({ label, value, title }) => (
              <span key={label} title={title} className="text-xs font-medium text-[#4A3A36] bg-white shadow-[0_1px_2px_rgba(93,7,3,0.05)] px-1.5 py-0.5 rounded-md">
                <span className="text-[#6B5B56] mr-1">{label}</span>
                {value}
              </span>
            ))}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-orange-100/30 space-y-3">
            {task.description && (
              <p className="text-sm text-[#4A3A36] leading-relaxed">{task.description}</p>
            )}
            {task.dependencies?.length > 0 && (
              <div>
                <p className="text-xs text-[#4A3A36] font-semibold mb-2">Dependencies:</p>
                <div className="flex flex-wrap gap-1.5">
                  {task.dependencies.map((dependency) => (
                    <span
                      key={dependency._id || dependency}
                      className="text-xs px-2.5 py-1 rounded-full bg-[#F4F3E6] text-[#4A3A36] font-medium"
                    >
                      {dependency.title || dependency}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 flex-wrap pt-2">
              {['pending', 'in-progress', 'completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => onStatusChange?.(task._id, status)}
                  disabled={task.status === status}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium ${
                    task.status === status
                      ? 'bg-[#FC703C] text-white cursor-default shadow-[0_1px_3px_rgba(93,7,3,0.12)]'
                      : 'bg-[#F4F3E6] text-[#4A3A36] hover:bg-[#EEA175] hover:text-[#2B1B17]'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
