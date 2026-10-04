import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import PrioIcon from '../components/icons/PrioIcon.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { v2Planner } from '../services/v2.js';
import taskService from '../services/taskService.js';
import insightsService from '../services/insights.js';

const card = 'bg-[#2B1B17] rounded-3xl p-6 border border-[#FC703C]/10 text-white';
const input =
  'w-full px-4 py-3 rounded-xl bg-[#231612] border border-white/10 text-white placeholder:text-white/30 focus:border-[#FC703C] outline-none';

/**
 * What-if simulator - read-only scenario modeling on live tasks.
 * Simulation never mutates production data; applying a deadline move
 * happens through the Focus replan flow, never from here.
 */
const WhatIfPanel = () => {
  const [tasks, setTasks] = useState([]);
  const [taskId, setTaskId] = useState('');
  const [days, setDays] = useState(2);
  const [drop, setDrop] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    taskService
      .getTasks({ limit: 100 })
      .then((d) => {
        const list = (d?.tasks || []).filter((t) => t.status === 'pending' || t.status === 'in-progress');
        setTasks(list);
        if (list.length > 0) setTaskId(list[0]._id || list[0].id);
      })
      .catch(() => setTasks([]));
  }, []);

  const selected = tasks.find((t) => (t._id || t.id) === taskId);

  const simulate = async () => {
    if (!taskId) {
      toast.error('Create a task first to simulate against.');
      return;
    }
    setBusy(true);
    try {
      const changes = {};
      if (drop) {
        changes.removeTaskIds = [taskId];
      } else if (selected?.deadline) {
        changes.moveDeadlines = [
          { taskId, deadline: new Date(new Date(selected.deadline).getTime() + days * 86400000).toISOString() },
        ];
      } else {
        toast.error('That task has no deadline to move - drop it instead, or set a deadline first.');
        setBusy(false);
        return;
      }
      if (capacity !== '' && Number(capacity) >= 0) changes.capacityPerDay = Number(capacity);
      const d = await insightsService.simulate({ changes });
      setResult(d?.simulation || null);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Simulation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={card}>
      <p className="text-xs uppercase tracking-widest text-[#FC703C] font-black mb-1">What if?</p>
      <h2 className="text-xl font-black mb-4">Simulate a change - nothing moves until you say so</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Task</span>
          <select
            value={taskId}
            onChange={(e) => { setTaskId(e.target.value); setResult(null); }}
            className="mt-1 w-full px-4 py-3 rounded-xl bg-[#231612] border border-white/10 text-white outline-none focus:border-[#FC703C]"
          >
            {tasks.map((t) => (
              <option key={t._id || t.id} value={t._id || t.id}>{t.title}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Day capacity (optional)</span>
          <input
            type="number"
            min={0}
            max={1440}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="e.g. 180"
            className="mt-1 w-full px-4 py-3 rounded-xl bg-[#231612] border border-white/10 text-white outline-none focus:border-[#FC703C]"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <label className="inline-flex items-center gap-2 text-sm text-white/70 font-bold">
          <input type="checkbox" checked={drop} onChange={(e) => setDrop(e.target.checked)} className="accent-[#FC703C] w-4 h-4" />
          Drop it instead of moving
        </label>
        {!drop && (
          <div className="inline-flex items-center gap-2 text-sm font-black">
            <span className="text-white/50">Move by</span>
            <button onClick={() => setDays((d) => d - 1)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20">-</button>
            <span className="font-mono w-14 text-center">{days > 0 ? `+${days}` : days}d</span>
            <button onClick={() => setDays((d) => d + 1)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20">+</button>
          </div>
        )}
        <button
          onClick={simulate}
          disabled={busy}
          className="ml-auto px-6 py-2.5 bg-[#FC703C] text-[#2B1B17] font-black rounded-full hover:bg-[#ff855c] transition-all disabled:opacity-60"
        >
          {busy ? 'Simulating…' : 'Simulate'}
        </button>
      </div>
      {result && (
        <div className="mt-5 rounded-2xl bg-[#231612] border border-white/10 p-4 text-sm space-y-2">
          <p>
            <span className="text-white/50">Current risk:</span>{' '}
            <span className="font-black">{result.current.riskLevel} <span className="font-mono">{result.current.riskScore}</span></span>
            {' → '}
            <span className="text-white/50">Scenario:</span>{' '}
            <span className="font-black text-[#FC703C]">{result.scenario.riskLevel} <span className="font-mono">{result.scenario.riskScore}</span></span>
          </p>
          <p className="text-white/70">
            Affected <span className="font-mono font-bold">{result.affected.count}</span> tasks
            (<span className="font-mono">{(result.affected.minutes / 60).toFixed(1)}h</span>
            {result.affected.freedMinutes > 0 && <>, <span className="font-mono">{(result.affected.freedMinutes / 60).toFixed(1)}h</span> freed</>})
            {result.bottleneckShift.to && (
              <> • Bottleneck: <span className="font-bold">{result.bottleneckShift.from?.title || 'none'} → {result.bottleneckShift.to.title}</span></>
            )}
          </p>
          {result.mitigation && <p className="text-white/70">Suggested: {result.mitigation}</p>}
          <p className="text-white/40 text-xs">Simulation only - apply deadline moves from the Focus replan flow.</p>
        </div>
      )}
    </div>
  );
};

/**
 * Plan history - every significant plan as an auditable version:
 * trigger, changes, reason, timestamp, risk before/after.
 */
const PlanHistory = ({ plans }) => {
  if (!plans || plans.length === 0) return null;
  const total = plans.length;
  return (
    <div className={card}>
      <p className="text-xs uppercase tracking-widest text-[#FC703C] font-black mb-1">Plan history</p>
      <h2 className="text-xl font-black mb-4">Every version, with its reason</h2>
      <ol className="space-y-3">
        {plans.map((p, i) => {
          const h = p.health || {};
          const proposed = h.state === 'proposed';
          const version = total - i;
          return (
            <li key={p.id} className="bg-[#231612] rounded-xl px-4 py-3 border border-white/5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-black text-sm">v{version}</span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${proposed ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>
                  {proposed ? 'Proposed' : 'Applied'}
                </span>
                {h.trigger && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                    {h.trigger.replace(/_/g, ' ')}
                  </span>
                )}
                <span className="ml-auto text-xs text-white/40">
                  {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}
                </span>
              </div>
              {p.reason && <p className="text-sm text-white/70 mt-1.5 leading-relaxed">{p.reason}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-white/50">
                {h.riskBefore && h.riskAfter && (
                  <span>
                    Risk <span className="font-mono font-bold">{h.riskBefore.level} {h.riskBefore.score}</span>
                    {' → '}
                    <span className="font-mono font-bold">{h.riskAfter.level} {h.riskAfter.score}</span>
                  </span>
                )}
                {typeof p.healthScore === 'number' && (
                  <span>Health <span className="font-mono font-bold">{p.healthScore}%</span></span>
                )}
                {Array.isArray(h.moves) && h.moves.length > 0 && (
                  <span>{h.moves.length} move{h.moves.length === 1 ? '' : 's'}</span>
                )}
                {typeof p.taskCount === 'number' && p.taskCount > 0 && (
                  <span>{p.taskCount} tasks</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const PlannerFlow = () => {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [minutes, setMinutes] = useState('120');
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    try {
      const d = await v2Planner.plans();
      setHistory(d?.plans || []);
    } catch {
      /* history is enhancement - the planner works without it */
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

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
      loadHistory();
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
            <PrioIcon name="clock" size={16} className="text-[#FC703C]" />
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
            <PrioIcon name="sparkles" size={18} /> {parsing ? 'Understanding…' : 'Build My Plan'}
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && !result && (
        <div className="space-y-6">
          {preview.clarificationsNeeded?.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 text-sm">
              <p className="font-black text-yellow-200 mb-2 flex items-center gap-2">
                <PrioIcon name="alert-triangle" size={16} /> Open questions (confirm anyway or refine first)
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
              <PrioIcon name="list-check" size={14} /> Tasks ({preview.tasks.length})
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
                    <PrioIcon name="trash" size={16} />
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
              {confirming ? 'Scheduling…' : 'Confirm plan'} <PrioIcon name="arrow-right" size={18} />
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
                  <li key={i} className="flex items-center gap-2"><PrioIcon name="circle-check" size={14} /> {c}</li>
                ))}
              </ul>
            )}
            {result.health.warnings?.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-yellow-200/90">
                {result.health.warnings.map((w, i) => (
                  <li key={i} className="flex items-center gap-2"><PrioIcon name="alert-triangle" size={14} /> {w}</li>
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
                <PrioIcon name="plus" size={16} /> New dump
              </button>
            </div>
          </div>
        </div>
      )}
      <WhatIfPanel />
      <PlanHistory plans={history} />
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
