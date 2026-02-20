import { useState } from 'react';
import { Calendar, Trash2, Edit2, ChevronDown, ChevronUp, Link } from 'lucide-react';
import PriorityBadge from './PriorityBadge.jsx';

const statusColors = {
    pending: 'text-yellow-400 bg-yellow-400/10',
    'in-progress': 'text-blue-400 bg-blue-400/10',
    completed: 'text-green-400 bg-green-400/10',
    cancelled: 'text-gray-400 bg-gray-400/10',
};

const formatDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    const now = new Date();
    const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));

    const base = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (diff < 0) return `${base} (overdue)`;
    if (diff === 0) return `${base} (today)`;
    if (diff === 1) return `${base} (tomorrow)`;
    return `${base} (${diff}d)`;
};

const isOverdue = (date, status) => {
    if (status === 'completed' || status === 'cancelled') return false;
    return new Date(date) < new Date();
};

/**
 * TaskCard — displays a task with priority badge, status, deadline, and action buttons
 */
const TaskCard = ({ task, onEdit, onDelete, onStatusChange }) => {
    const [expanded, setExpanded] = useState(false);
    const overdue = isOverdue(task.deadline, task.status);

    return (
        <div
            className={`card p-4 transition-all duration-200 hover:-translate-y-0.5 ${overdue ? 'border-red-500/30' : ''
                } ${task.status === 'completed' ? 'opacity-60' : ''}`}
        >
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <PriorityBadge score={task.priorityScore} tier={task.priorityTier} />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[task.status]}`}>
                            {task.status}
                        </span>
                        {task.category && task.category !== 'General' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#627890]/20 text-[#627890]">
                                {task.category}
                            </span>
                        )}
                    </div>
                    <h3
                        className={`font-semibold text-white text-sm leading-tight ${task.status === 'completed' ? 'line-through text-gray-400' : ''
                            }`}
                    >
                        {task.title}
                    </h3>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="p-1.5 rounded-lg text-[#627890] hover:bg-white/5 hover:text-white transition-colors"
                        title="Expand"
                    >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                        onClick={() => onEdit?.(task)}
                        className="p-1.5 rounded-lg text-[#627890] hover:bg-white/5 hover:text-white transition-colors"
                        title="Edit"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => onDelete?.(task._id)}
                        className="p-1.5 rounded-lg text-[#627890] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Deadline row */}
            <div className="flex items-center gap-4 mt-2">
                <div className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-red-400' : 'text-[#64748b]'}`}>
                    <Calendar size={12} />
                    <span>{formatDate(task.deadline)}</span>
                </div>
                {task.dependencies?.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-[#64748b]">
                        <Link size={12} />
                        <span>{task.dependencies.length} dep{task.dependencies.length !== 1 ? 's' : ''}</span>
                    </div>
                )}
                {/* Priority factors */}
                <div className="flex items-center gap-2 ml-auto">
                    {[
                        { label: 'U', value: task.urgency, title: 'Urgency' },
                        { label: 'I', value: task.importance, title: 'Importance' },
                        { label: 'D', value: task.difficulty, title: 'Difficulty' },
                    ].map(({ label, value, title }) => (
                        <span key={label} title={title} className="text-xs text-[#64748b]">
                            <span className="text-[#627890] font-medium">{label}</span>{value}
                        </span>
                    ))}
                </div>
            </div>

            {/* Expanded description + deps */}
            {expanded && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-2 animate-fade-in">
                    {task.description && (
                        <p className="text-xs text-[#94a3b8] leading-relaxed">{task.description}</p>
                    )}
                    {task.dependencies?.length > 0 && (
                        <div>
                            <p className="text-xs text-[#64748b] font-medium mb-1">Dependencies:</p>
                            <div className="flex flex-wrap gap-1">
                                {task.dependencies.map((dep) => (
                                    <span
                                        key={dep._id || dep}
                                        className="text-xs px-2 py-0.5 rounded-full bg-[#273751] border border-white/5 text-[#94a3b8]"
                                    >
                                        {dep.title || dep}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Quick status changer */}
                    <div className="flex gap-2 flex-wrap">
                        {['pending', 'in-progress', 'completed'].map((s) => (
                            <button
                                key={s}
                                onClick={() => onStatusChange?.(task._id, s)}
                                disabled={task.status === s}
                                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${task.status === s
                                        ? 'bg-[#604C39]/30 text-[#c4a882] cursor-default'
                                        : 'bg-white/5 text-[#94a3b8] hover:bg-white/10'
                                    }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskCard;
