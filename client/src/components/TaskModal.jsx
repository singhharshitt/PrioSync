import { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';

const CATEGORIES = ['General', 'Work', 'Study', 'Personal', 'Health', 'Finance', 'Urgent'];

const SliderField = ({ label, name, value, onChange, min = 1, max = 5 }) => (
    <div className="space-y-1">
        <div className="flex justify-between text-xs">
            <label className="text-[#94a3b8] font-medium">{label}</label>
            <span className="text-white font-bold">{value}/5</span>
        </div>
        <input
            type="range" min={min} max={max} name={name} value={value}
            onChange={onChange}
            className="w-full h-1.5 accent-primary"
        />
        <div className="flex justify-between text-[10px] text-[#64748b]">
            <span>Low</span><span>High</span>
        </div>
    </div>
);

/**
 * TaskModal — Add / Edit task form modal
 */
const TaskModal = ({ isOpen, onClose, onSubmit, initialData = null, allTasks = [] }) => {
    const isEdit = Boolean(initialData);
    const [form, setForm] = useState({
        title: '',
        description: '',
        deadline: '',
        importance: 3,
        urgency: 3,
        difficulty: 3,
        status: 'pending',
        category: 'General',
        dependencies: [],
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Pre-fill form for edit mode
    useEffect(() => {
        if (initialData) {
            setForm({
                title: initialData.title || '',
                description: initialData.description || '',
                deadline: initialData.deadline
                    ? new Date(initialData.deadline).toISOString().slice(0, 16)
                    : '',
                importance: initialData.importance || 3,
                urgency: initialData.urgency || 3,
                difficulty: initialData.difficulty || 3,
                status: initialData.status || 'pending',
                category: initialData.category || 'General',
                dependencies: (initialData.dependencies || []).map((d) =>
                    d._id ? d._id : d
                ),
            });
        } else {
            setForm({
                title: '', description: '', deadline: '',
                importance: 3, urgency: 3, difficulty: 3,
                status: 'pending', category: 'General', dependencies: [],
            });
        }
        setError('');
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: name.includes('importance') || name.includes('urgency') || name.includes('difficulty') ? Number(value) : value }));
    };

    const handleSlider = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: Number(value) }));
    };

    const toggleDep = (id) => {
        setForm((prev) => ({
            ...prev,
            dependencies: prev.dependencies.includes(id)
                ? prev.dependencies.filter((d) => d !== id)
                : [...prev.dependencies, id],
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) { setError('Title is required.'); return; }
        if (!form.deadline) { setError('Deadline is required.'); return; }
        setError('');
        setSubmitting(true);
        try {
            await onSubmit({ ...form });
            onClose();
        } catch {
            setError('Failed to save task. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Exclude self from dependency options
    const depOptions = allTasks.filter(
        (t) => t._id !== initialData?._id && t.status !== 'completed'
    );

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                    <h2 className="font-heading font-bold text-white text-xl">
                        {isEdit ? 'Edit Task' : 'New Task'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-lg text-[#9E7C73] hover:bg-white/5 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    {/* Title */}
                    <div className="space-y-1.5">
                        <label className="text-xs text-[#94a3b8] font-medium">Task Title *</label>
                        <input
                            name="title" value={form.title} onChange={handleChange}
                            placeholder="e.g. Write API documentation"
                            className="input-field"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-xs text-[#94a3b8] font-medium">Description</label>
                        <textarea
                            name="description" value={form.description} onChange={handleChange}
                            placeholder="Optional description..."
                            rows={3}
                            className="input-field resize-none"
                        />
                    </div>

                    {/* Deadline + Category row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs text-[#94a3b8] font-medium flex items-center gap-1.5">
                                <Calendar size={12} /> Deadline *
                            </label>
                            <input
                                type="datetime-local" name="deadline" value={form.deadline}
                                onChange={handleChange}
                                className="input-field"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs text-[#94a3b8] font-medium">Category</label>
                            <select name="category" value={form.category} onChange={handleChange} className="input-field">
                                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Status (edit only) */}
                    {isEdit && (
                        <div className="space-y-1.5">
                            <label className="text-xs text-[#94a3b8] font-medium">Status</label>
                            <select name="status" value={form.status} onChange={handleChange} className="input-field">
                                <option value="pending">Pending</option>
                                <option value="in-progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    )}

                    {/* Priority sliders */}
                    <div className="p-4 rounded-xl bg-[#3D2B26] space-y-4">
                        <p className="text-xs text-[#94a3b8] font-semibold uppercase tracking-wider">Priority Factors</p>
                        <SliderField label="Urgency" name="urgency" value={form.urgency} onChange={handleSlider} />
                        <SliderField label="Importance" name="importance" value={form.importance} onChange={handleSlider} />
                        <SliderField label="Difficulty" name="difficulty" value={form.difficulty} onChange={handleSlider} />
                    </div>

                    {/* Dependencies */}
                    {depOptions.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-xs text-[#94a3b8] font-medium">Dependencies (must be completed before this task)</label>
                            <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                                {depOptions.map((t) => (
                                    <label key={t._id} className="flex items-center gap-2.5 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={form.dependencies.includes(t._id)}
                                            onChange={() => toggleDep(t._id)}
                                            className="accent-primary w-3.5 h-3.5"
                                        />
                                        <span className="text-xs text-[#94a3b8] group-hover:text-white transition-colors truncate">
                                            {t.title}
                                        </span>
                                        <span className={`ml-auto text-[10px] badge-${t.priorityTier} px-1.5 py-0.5 rounded-full`}>
                                            {t.priorityTier}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer buttons */}
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                        <button type="submit" disabled={submitting} className="btn-primary flex-1">
                            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskModal;
