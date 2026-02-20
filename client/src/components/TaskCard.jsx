import { useState } from 'react';
import { Calendar, Trash2, Edit2, ChevronDown, ChevronUp, Link, MoreVertical } from 'lucide-react';
import { motion } from 'framer-motion';
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
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className={`relative group bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-shadow duration-300 overflow-hidden ${overdue ? 'border-red-200 bg-red-50/10' : ''
                } ${task.status === 'completed' ? 'opacity-60 bg-gray-50' : ''}`}
        >
            {/* Gradient decoration */}
            <div className="absolute inset-0 bg-gradient-to-br from-bg-light/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative z-10">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            <PriorityBadge score={task.priorityScore} tier={task.priorityTier} />
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide ${statusColors[task.status]}`}>
                                {task.status.toUpperCase()}
                            </span>
                            {task.category && task.category !== 'General' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 tracking-wide">
                                    {task.category.toUpperCase()}
                                </span>
                            )}
                        </div>
                        <h3
                            className={`font-semibold text-primary text-base leading-snug truncate ${task.status === 'completed' ? 'line-through text-gray-400' : ''
                                }`}
                            title={task.title}
                        >
                            {task.title}
                        </h3>
                    </div>

                    {/* Action buttons - scale-up on hover */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setExpanded((v) => !v)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                            title="Expand"
                        >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button
                            onClick={() => onEdit?.(task)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                            title="Edit"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button
                            onClick={() => onDelete?.(task._id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                {/* Deadline row & Metadata */}
                <div className="flex items-center gap-4 mt-4 bg-gray-50 rounded-xl p-2.5 px-3">
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${overdue ? 'text-red-500' : 'text-gray-500'}`}>
                        <Calendar size={13} />
                        <span>{formatDate(task.deadline)}</span>
                    </div>
                    {task.dependencies?.length > 0 && (
                        <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
                            <Link size={13} />
                            <span>{task.dependencies.length} dep{task.dependencies.length !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                    {/* Priority factors */}
                    <div className="flex items-center gap-2.5 ml-auto">
                        {[
                            { label: 'U', value: task.urgency, title: 'Urgency' },
                            { label: 'I', value: task.importance, title: 'Importance' },
                            { label: 'D', value: task.difficulty, title: 'Difficulty' },
                        ].map(({ label, value, title }) => (
                            <span key={label} title={title} className="text-xs font-medium text-gray-600 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] px-1.5 py-0.5 rounded-md">
                                <span className="text-gray-400 mr-1">{label}</span>{value}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Expanded description + deps */}
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-gray-100 space-y-3"
                    >
                        {task.description && (
                            <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>
                        )}
                        {task.dependencies?.length > 0 && (
                            <div>
                                <p className="text-xs text-gray-500 font-semibold mb-2">Dependencies:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {task.dependencies.map((dep) => (
                                        <span
                                            key={dep._id || dep}
                                            className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium"
                                        >
                                            {dep.title || dep}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Quick status changer */}
                        <div className="flex gap-2 flex-wrap pt-2">
                            {['pending', 'in-progress', 'completed'].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => onStatusChange?.(task._id, s)}
                                    disabled={task.status === s}
                                    className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium ${task.status === s
                                        ? 'bg-primary text-white cursor-default shadow-md'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

export default TaskCard;
