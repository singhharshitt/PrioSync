import { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, Zap, Clock, Target, BarChart3, Check } from 'lucide-react';

const CATEGORIES = ['General', 'Work', 'Study', 'Personal', 'Health', 'Finance', 'Urgent'];

/**
 * PinwheelIcon - Decorative spinning element
 */
const PinwheelIcon = ({ size = 16, color = '#FC703C', spinning = true, className = '' }) => (
  <div className={`relative ${className} ${spinning ? 'animate-spin' : ''}`} style={{ width: size, height: size, animationDuration: spinning ? '3s' : '0s' }}>
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
 * RetroSlider - Custom styled range input with pinwheel indicator
 */
const RetroSlider = ({ label, name, value, onChange, min = 1, max = 5, icon: Icon, color = '#FC703C' }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} style={{ color }} />}
        <label className="text-xs font-black text-[#CCC4BE] uppercase tracking-wider">{label}</label>
      </div>
      <div className="flex items-center gap-2">
        <PinwheelIcon size={12} color={color} spinning={value > 3} />
        <span className="text-sm font-black text-[#FDF8F0] min-w-[2rem] text-right">{value}</span>
      </div>
    </div>
    
    <div className="relative">
      <input
        type="range"
        min={min}
        max={max}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full h-2 bg-[#231612] rounded-full appearance-none cursor-pointer slider-retro"
        style={{
          backgroundImage: `linear-gradient(to right, ${color} 0%, ${color} ${((value - min) / (max - min)) * 100}%, #231612 ${((value - min) / (max - min)) * 100}%, #231612 100%)`
        }}
      />
      {/* Tick marks */}
      <div className="flex justify-between mt-1 px-1">
        {[...Array(max - min + 1)].map((_, i) => (
          <div key={i} className={`w-1 h-1 rounded-full transition-colors ${i + 1 <= value ? 'bg-[#FC703C]' : 'bg-[#CCC4BE]/30'}`} />
        ))}
      </div>
    </div>
    
    <div className="flex justify-between text-[10px] font-bold text-[#CCC4BE]/50 uppercase tracking-wider">
      <span>Low</span>
      <span>High</span>
    </div>
  </div>
);

/**
 * TaskModal — Retro GSAP-inspired Add / Edit task form
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

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || '',
        description: initialData.description || '',
        deadline: initialData.deadline ? new Date(initialData.deadline).toISOString().slice(0, 16) : '',
        importance: initialData.importance || 3,
        urgency: initialData.urgency || 3,
        difficulty: initialData.difficulty || 3,
        status: initialData.status || 'pending',
        category: initialData.category || 'General',
        dependencies: (initialData.dependencies || []).map((d) => d._id ? d._id : d),
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
    setForm((prev) => ({
      ...prev,
      [name]: name.includes('importance') || name.includes('urgency') || name.includes('difficulty') ? Number(value) : value
    }));
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

  const depOptions = allTasks.filter((t) => t._id !== initialData?._id && t.status !== 'completed');

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B1B17]/90 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-[#2B1B17] border-2 border-[#FC703C]/20 shadow-2xl shadow-orange-900/30 animate-[modalPop_0.4s_ease-out]">
        
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
             style={{ backgroundImage: 'radial-gradient(#FC703C 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />

        {/* Animated Top Border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FC703C] to-transparent animate-pulse" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-[#FC703C]/10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-[#FC703C] blur-lg opacity-30" />
              <PinwheelIcon size={24} color="#FC703C" spinning={true} />
            </div>
            <div>
              <h2 className="font-black text-[#FDF8F0] text-xl tracking-tight uppercase">
                {isEdit ? 'Edit Task' : 'New Task'}
              </h2>
              <p className="text-[10px] text-[#CCC4BE] uppercase tracking-widest font-bold">
                {isEdit ? 'Modify existing entry' : 'Create priority entry'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-[#CCC4BE] hover:bg-[#FC703C]/20 hover:text-[#FC703C] transition-all duration-200 hover:rotate-90"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="relative px-6 py-5 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
          
          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 animate-shake">
              <AlertCircle size={18} className="animate-pulse" />
              <span className="text-sm font-bold">{error}</span>
            </div>
          )}

          {/* Title Input */}
          <div className="space-y-2 group">
            <label className="text-xs font-black text-[#CCC4BE] uppercase tracking-wider flex items-center gap-2">
              <Target size={12} className="text-[#FC703C]" />
              Task Title <span className="text-[#FC703C]">*</span>
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Write API documentation"
              className="w-full px-4 py-3 rounded-xl bg-[#231612] border-2 border-[#FDF8F0]/10 text-[#FDF8F0] placeholder-[#CCC4BE]/30 font-bold transition-all duration-300 focus:border-[#FC703C]/50 focus:outline-none focus:shadow-[0_0_20px_rgba(252,112,60,0.1)] hover:border-[#FDF8F0]/20"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-black text-[#CCC4BE] uppercase tracking-wider">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Optional details..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[#231612] border-2 border-[#FDF8F0]/10 text-[#FDF8F0] placeholder-[#CCC4BE]/30 text-sm resize-none transition-all duration-300 focus:border-[#FC703C]/50 focus:outline-none focus:shadow-[0_0_20px_rgba(252,112,60,0.1)] hover:border-[#FDF8F0]/20"
            />
          </div>

          {/* Deadline + Category Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-[#CCC4BE] uppercase tracking-wider flex items-center gap-2">
                <Clock size={12} className="text-[#FC703C]" />
                Deadline <span className="text-[#FC703C]">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  name="deadline"
                  value={form.deadline}
                  onChange={handleChange}
                  className="w-full px-3 py-3 rounded-xl bg-[#231612] border-2 border-[#FDF8F0]/10 text-[#FDF8F0] text-sm font-bold transition-all duration-300 focus:border-[#FC703C]/50 focus:outline-none hover:border-[#FDF8F0]/20"
                />
                <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#CCC4BE]/50 pointer-events-none" />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-black text-[#CCC4BE] uppercase tracking-wider">Category</label>
              <div className="relative">
                <select 
                  name="category" 
                  value={form.category} 
                  onChange={handleChange} 
                  className="w-full px-3 py-3 rounded-xl bg-[#231612] border-2 border-[#FDF8F0]/10 text-[#FDF8F0] text-sm font-bold appearance-none transition-all duration-300 focus:border-[#FC703C]/50 focus:outline-none hover:border-[#FDF8F0]/20 cursor-pointer"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-[#2B1B17]">{c}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <PinwheelIcon size={10} color="#CCC4BE" spinning={false} />
                </div>
              </div>
            </div>
          </div>

          {/* Status (Edit Only) */}
          {isEdit && (
            <div className="space-y-2">
              <label className="text-xs font-black text-[#CCC4BE] uppercase tracking-wider">Status</label>
              <div className="grid grid-cols-4 gap-2">
                {['pending', 'in-progress', 'completed', 'cancelled'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, status }))}
                    className={`
                      px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200
                      ${form.status === status 
                        ? 'bg-[#FC703C] text-[#2B1B17] shadow-lg shadow-orange-900/30 scale-105' 
                        : 'bg-[#231612] text-[#CCC4BE] border border-[#FDF8F0]/10 hover:border-[#FC703C]/30'}
                    `}
                  >
                    {status.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Priority Sliders Panel */}
          <div className="p-5 rounded-2xl bg-[#231612] border border-[#FC703C]/10 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#FC703C]/10 to-transparent rounded-bl-full" />
            
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-[#FC703C]" />
              <p className="text-xs font-black text-[#FDF8F0] uppercase tracking-widest">Priority Matrix</p>
              <PinwheelIcon size={14} color="#FC703C" spinning={true} className="ml-auto" />
            </div>

            <RetroSlider 
              label="Urgency" 
              name="urgency" 
              value={form.urgency} 
              onChange={handleSlider} 
              icon={Zap}
              color="#EF4444"
            />
            <RetroSlider 
              label="Importance" 
              name="importance" 
              value={form.importance} 
              onChange={handleSlider}
              icon={Target}
              color="#3B82F6"
            />
            <RetroSlider 
              label="Difficulty" 
              name="difficulty" 
              value={form.difficulty} 
              onChange={handleSlider}
              icon={BarChart3}
              color="#8B5CF6"
            />
          </div>

          {/* Dependencies */}
          {depOptions.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-black text-[#CCC4BE] uppercase tracking-wider flex items-center gap-2">
                <PinwheelIcon size={12} color="#CCC4BE" spinning={false} />
                Dependencies
              </label>
              <div className="max-h-32 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {depOptions.map((t) => (
                  <label 
                    key={t._id} 
                    className={`
                      flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
                      ${form.dependencies.includes(t._id) 
                        ? 'bg-[#FC703C]/20 border border-[#FC703C]/30' 
                        : 'bg-[#231612] border border-[#FDF8F0]/5 hover:border-[#FDF8F0]/20'}
                    `}
                  >
                    <div className={`
                      w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200
                      ${form.dependencies.includes(t._id) 
                        ? 'bg-[#FC703C] border-[#FC703C]' 
                        : 'border-[#CCC4BE]/30'}
                    `}>
                      {form.dependencies.includes(t._id) && <Check size={12} className="text-[#2B1B17]" strokeWidth={3} />}
                    </div>
                    <input
                      type="checkbox"
                      checked={form.dependencies.includes(t._id)}
                      onChange={() => toggleDep(t._id)}
                      className="hidden"
                    />
                    <span className={`text-sm font-bold truncate flex-1 ${form.dependencies.includes(t._id) ? 'text-[#FDF8F0]' : 'text-[#CCC4BE]'}`}>
                      {t.title}
                    </span>
                    {t.priorityTier && (
                      <span className={`
                        text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider
                        ${t.priorityTier === 'critical' ? 'bg-red-500/20 text-red-400' :
                          t.priorityTier === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          t.priorityTier === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'}
                      `}>
                        {t.priorityTier}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 px-4 py-3 rounded-xl bg-[#231612] border-2 border-[#FDF8F0]/10 text-[#CCC4BE] font-black text-sm uppercase tracking-wider transition-all duration-200 hover:border-[#CCC4BE]/30 hover:text-[#FDF8F0]"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting} 
              className="flex-1 px-4 py-3 rounded-xl bg-[#FC703C] text-[#2B1B17] font-black text-sm uppercase tracking-wider transition-all duration-200 hover:bg-[#ff855c] hover:shadow-lg hover:shadow-orange-900/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <PinwheelIcon size={16} color="#2B1B17" spinning={true} />
                  Saving...
                </>
              ) : (
                <>
                  <Zap size={16} className="fill-current" />
                  {isEdit ? 'Save Changes' : 'Create Task'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes modalPop {
          0% { opacity: 0; transform: scale(0.9) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        .slider-retro::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #FC703C;
          cursor: pointer;
          border: 3px solid #2B1B17;
          box-shadow: 0 0 10px rgba(252, 112, 60, 0.5);
          transition: transform 0.2s ease;
        }
        .slider-retro::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        .slider-retro::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #FC703C;
          cursor: pointer;
          border: 3px solid #2B1B17;
          box-shadow: 0 0 10px rgba(252, 112, 60, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #231612;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #FC703C;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default TaskModal;
