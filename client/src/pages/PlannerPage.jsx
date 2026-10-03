import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Sparkles, ArrowRight, Trash2, Plus, CheckCircle2,
  AlertTriangle, Clock, ListChecks,
} from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import { v2Planner } from '../services/v2.js';

const card = 'bg-[#2B1B17] rounded-3xl p-6 border border-[#FC703C]/10 text-white';
const input =
  'w-full px-4 py-3 rounded-xl bg-[#231612] border border-white/10 text-white placeholder:text-white/30 focus:border-[#FC703C] outline-none';

const PlannerFlow = () => {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [minutes, setMinutes] = useState('120');
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);

  const handleParse = async () => {
    if (text.trim().length < 3) {
      toast.error('Write a few words about what you need to do.');
      return;
    }
    setParsing(true);
    setResult(null);
    try {
      const data = await v2Planner.parse({
        text,
        mode: 'auto',
        context: {
          availableMinutesPerDay: minutes ? Number(minutes) : null,
        },
      });
      setPreview(data.plan);
      if (data.plan.clarificationsNeeded?.length > 0) {
        toast('Review the plan - a couple of details are still open.', { icon: '🔍' });
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not understand that yet.');
    } finally {
      setParsing(false);
    }
  };

  const updateTask = (key, patch) => {
    setPreview((p) => ({
      ...p,
      tasks: p.tasks.map((t) => (t.key === key ? { ...t, ...patch } : t)),
    }));
  };

  const removeTask = (key) => {
    setPreview((p) => ({
      ...p,
      tasks: p.tasks.filter((t) => t.key !== key),
      dependencies: p.dependencies.filter((d) => d.task !== key && d.dependsOn !== key),
    }));
  };

  const handleConfirm = async () => {
    if (!preview || preview.tasks.length === 0) {
      toast.error('Nothing to plan - add at least one task.');
      return;
    }
    setConfirming(true);
    try {
      const data = await v2Planner.confirm({
        goal: preview.goal,
        projects: preview.projects || [],
        tasks: preview.tasks.map(({ key, title, estimatedMinutes, importance, urgency, difficulty, friction, deadline, projectKey }) => ({
          key, title, estimatedMinutes, importance, urgency, difficulty, friction, deadline, projectKey,
        })),
        dependencies: preview.dependencies || [],
        constraints: { availableMinutesPerDay: minutes ? Number(minutes) : null },
        reason: 'planner page confirm',
      });
      setResult(data);
      toast.success(`Plan created - health ${data.health.score}%`);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Plan creation failed.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 space-y-6">
      <div>
        <span className="text-xs uppercase tracking-widest text-[#2B1B17]/40 font-black block">{`{ Planner }`}</span>
        <h1 className="text-3xl sm:text-4xl font-black text-[#2B1B17] tracking-tight">
          Turn chaos into your <span className="text-[#FC703C]">next move</span>
        </h1>
        <p className="text-[#2B1B17]/60 mt-2">Dump everything. PrioSync structures it, scores it, schedules it.</p>
      </div>

      {/* Input */}
      <div className={card}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="I need to prepare for my placement. I have SQL, DSA and frontend left. My assessment is next week…"
          className={`${input} resize-y min-h-[120px]`}
        />
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <label className="flex items-center gap-2 text-sm text-white/60 font-bold">
            <Clock size={16} className="text-[#FC703C]" />
            <input
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="min/day"
              inputMode="numeric"
              className="w-24 px-3 py-2 rounded-xl bg-[#231612] border border-white/10 text-white focus:border-[#FC703C] outline-none"
            />
            min/day
          </label>
          <button
            onClick={handleParse}
            disabled={parsing}
            className="ml-auto inline-flex items-center gap-2 px-6 py-3 bg-[#FC703C] text-[#2B1B17] font-black rounded-full hover:bg-[#ff855c] transition-all disabled:opacity-60"
          >
            <Sparkles size={18} /> {parsing ? 'Understanding…' : 'Build My Plan'}
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && !result && (
        <div className="space-y-6">
          {preview.clarificationsNeeded?.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 text-sm">
              <p className="font-black text-yellow-200 mb-2 flex items-center gap-2">
                <AlertTriangle size={16} /> Open questions (confirm anyway or refine first)
              </p>
              <ul className="space-y-1 text-yellow-100/80">
                {preview.clarificationsNeeded.map((c, i) => (
                  <li key={i}>• {c.question}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={card}>
            <p className="text-xs uppercase tracking-widest text-[#FC703C] font-black">Goal</p>
            <h2 className="text-2xl font-black mt-1">{preview.goal.title}</h2>
            {preview.goal.deadline && (
              <p className="text-sm text-white/50 mt-1">
                Due {new Date(preview.goal.deadline).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className={card}>
            <p className="text-xs uppercase tracking-widest text-[#FC703C] font-black mb-4 flex items-center gap-2">
              <ListChecks size={14} /> Tasks ({preview.tasks.length})
            </p>
            <div className="space-y-3">
              {preview.tasks.map((t) => (
                <div key={t.key} className="flex flex-wrap items-center gap-3 bg-[#231612] rounded-xl p-3 border border-white/5">
                  <input
                    value={t.title}
                    onChange={(e) => updateTask(t.key, { title: e.target.value })}
                    className="flex-1 min-w-[180px] bg-transparent text-white font-bold outline-none border-b border-transparent focus:border-[#FC703C]"
                  />
                  <label className="flex items-center gap-1 text-xs text-white/50">
                    <input
                      type="number"
                      value={t.estimatedMinutes}
                      min={5}
                      max={10080}
                      onChange={(e) => updateTask(t.key, { estimatedMinutes: Number(e.target.value) })}
                      className="w-16 px-2 py-1 rounded-lg bg-[#2B1B17] border border-white/10 text-white text-xs outline-none"
                    />
                    min
                  </label>
                  {t.deadline && (
                    <span className="text-xs text-white/40">{new Date(t.deadline).toLocaleDateString()}</span>
                  )}
                  <button onClick={() => removeTask(t.key)} className="text-white/40 hover:text-red-400 transition-colors" aria-label="Remove task">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            {preview.dependencies?.length > 0 && (
              <div className="mt-4 text-sm text-white/60">
                <p className="font-bold text-white/80 mb-1">Detected dependencies</p>
                {preview.dependencies.map((d, i) => (
                  <p key={i}>• {d.task} waits for {d.dependsOn}</p>
                ))}
              </div>
            )}
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#FC703C] text-[#2B1B17] font-black rounded-full hover:bg-[#ff855c] transition-all disabled:opacity-60"
            >
              {confirming ? 'Scheduling…' : 'Confirm plan'} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-6">
          <div className={card}>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-black text-[#FC703C]">{result.health.score}%</div>
              <div>
                <p className="font-black text-lg">Plan health</p>
                <p className="text-sm text-white/50">{result.schedule.length} tasks scheduled deterministically</p>
              </div>
            </div>
            {result.health.checks?.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm text-green-300/90">
                {result.health.checks.map((c, i) => (
                  <li key={i} className="flex items-center gap-2"><CheckCircle2 size={14} /> {c}</li>
                ))}
              </ul>
            )}
            {result.health.warnings?.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-yellow-200/90">
                {result.health.warnings.map((w, i) => (
                  <li key={i} className="flex items-center gap-2"><AlertTriangle size={14} /> {w}</li>
                ))}
              </ul>
            )}
          </div>

          <div className={card}>
            <p className="text-xs uppercase tracking-widest text-[#FC703C] font-black mb-4">Execution order</p>
            <ol className="space-y-2">
              {result.schedule.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 bg-[#231612] rounded-xl px-4 py-3">
                  <span className="w-7 h-7 rounded-full bg-[#FC703C]/20 text-[#FC703C] font-black text-sm flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-bold truncate">{t.title}</span>
                  <span className="text-xs text-white/50">{t.estimatedMinutes} min</span>
                  <span className="text-xs font-black px-2 py-1 rounded-full bg-[#FC703C]/20 text-[#FC703C]">
                    {t.priorityScore}
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-3 mt-6">
              <button
                onClick={() => navigate('/focus')}
                className="px-6 py-3 bg-[#FC703C] text-[#2B1B17] font-black rounded-full hover:bg-[#ff855c] transition-all"
              >
                Open in Focus
              </button>
              <button
                onClick={() => { setPreview(null); setResult(null); setText(''); }}
                className="px-6 py-3 bg-white/10 text-white font-bold rounded-full hover:bg-white/15 transition-all inline-flex items-center gap-2"
              >
                <Plus size={16} /> New dump
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PlannerPage = () => (
  <div className="flex h-dvh overflow-hidden bg-[#f8f7f2] overflow-x-hidden">
    <Sidebar />
    <main className="flex-1 overflow-y-auto">
      <PlannerFlow />
    </main>
  </div>
);

export default PlannerPage;
