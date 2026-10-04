import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import PrioIcon from '../components/icons/PrioIcon.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { v2Tasks, v2Replans, v2Recommendations } from '../services/v2.js';
import taskService from '../services/taskService.js';
import insightsService from '../services/insights.js';


const toLocalInput = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const ReplanBanner = ({ onApplied }) => {
  const [missed, setMissed] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [moves, setMoves] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    v2Replans.missed().then((d) => setMissed(d.missed || [])).catch(() => setMissed([]));
  }, []);

  if (!missed || missed.length === 0) return null;

  const suggest = async () => {
    setBusy(true);
    try {
      const data = await v2Replans.propose({ taskIds: missed.map((t) => t.id) });
      setProposal(data);
      setMoves(data.moves || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not build a proposal.');
    } finally {
      setBusy(false);
    }
  };

  const acceptProposal = async () => {
    setBusy(true);
    try {
      const data = await v2Replans.accept({
        moves: moves.map((m) => ({ taskId: m.taskId, newDeadline: new Date(m.newDeadline).toISOString() })),
        reason: 'accepted from Focus replan banner',
      });
      toast.success(`Plan updated - ${data.applied.length} task${data.applied.length === 1 ? '' : 's'} moved.`);
      setMissed([]);
      setProposal(null);
      onApplied?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not apply the plan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-3xl p-6 text-sm">
      <p className="font-black text-yellow-200 flex items-center gap-2 text-base">
        <PrioIcon name="calendar-cog" size={18} /> Plan updated? You missed {missed.length} task{missed.length === 1 ? '' : 's'}
      </p>
      <ul className="mt-2 space-y-1 text-yellow-100/80">
        {missed.map((t) => (
          <li key={t.id}>• {t.title} <span className="opacity-60">(was {new Date(t.deadline).toLocaleDateString()})</span></li>
        ))}
      </ul>
      {!proposal ? (
        <button
          onClick={suggest}
          disabled={busy}
          className="mt-4 px-6 py-2.5 bg-yellow-500 text-[#2B1B17] font-black rounded-full hover:bg-yellow-400 transition-all disabled:opacity-60"
        >
          {busy ? 'Finding slots…' : 'Suggest new slots'}
        </button>
      ) : (
        <div className="mt-4 space-y-2">
          {moves.map((m, i) => (
            <div key={m.taskId} className="flex flex-wrap items-center gap-3 bg-[#2B1B17]/60 rounded-xl px-4 py-2.5">
              <span className="flex-1 font-bold text-white min-w-[140px]">{m.title}</span>
              <span className="text-yellow-100/60 text-xs">+{m.estimatedMinutes} min on {m.day}</span>
              <input
                type="datetime-local"
                value={toLocalInput(m.newDeadline)}
                onChange={(e) => setMoves((ms) => ms.map((x, j) => (j === i ? { ...x, newDeadline: new Date(e.target.value).toISOString() } : x)))}
                className="px-2 py-1.5 rounded-lg bg-[#231612] border border-white/10 text-white text-xs outline-none"
              />
            </div>
          ))}
          {proposal.impact?.length > 0 && (
            <p className="text-yellow-100/60 text-xs">
              Impact: {proposal.impact.map((x) => `${x.day} +${x.addedMinutes} min`).join(' • ')}
              {proposal.assumedCapacity ? ' (assuming 240 min/day - set availability in Planner)' : ''}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              onClick={acceptProposal}
              disabled={busy}
              className="px-6 py-2.5 bg-yellow-500 text-[#2B1B17] font-black rounded-full hover:bg-yellow-400 transition-all disabled:opacity-60"
            >
              Accept
            </button>
            <button
              onClick={() => setProposal(null)}
              className="px-6 py-2.5 bg-white/10 text-white font-bold rounded-full hover:bg-white/15 transition-all"
            >
              Edit later
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const card = 'bg-[#2B1B17] rounded-3xl p-6 border border-[#FC703C]/10 text-white';

/**
 * Today's order - dependency-safe sequence grouped for low context switching,
 * placed into the user's energy periods. "What should I do" as a day, not
 * just a next task.
 */
const DayPlanCard = ({ minutes }) => {
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    let live = true;
    insightsService
      .dayPlan({ minutes })
      .then((d) => {
        if (live) setPlan(d?.dayPlan || null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [minutes]);

  if (!plan || plan.totalMinutes === 0) return null;
  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-[#FC703C] font-black">Today&apos;s order</p>
        <span className="text-xs text-white/40 font-mono">
          {plan.totalMinutes} / {plan.budgetMinutes} min
        </span>
      </div>
      <div className="space-y-3">
        {plan.periods.map((p) => (
          <div key={p.key}>
            <p className="text-xs font-black text-white/50 uppercase tracking-wider mb-1">
              {p.label} <span className="normal-case font-bold">({p.energy} energy · {p.from}-{p.to})</span>
            </p>
            {p.tasks.length === 0 ? (
              <p className="text-xs text-white/30 italic">Open - pick anything light.</p>
            ) : (
              <ol className="space-y-1">
                {p.tasks.map((x, i) => (
                  <li key={x.taskId} className="flex items-center gap-2 text-sm bg-[#231612] rounded-lg px-3 py-2">
                    <span className="text-white/30 font-mono text-xs w-5">{i + 1}</span>
                    <span className="flex-1 font-bold truncate">{x.title}</span>
                    <span className="text-xs text-white/40 font-mono">{x.estimatedMinutes}m</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
      {plan.unscheduled.length > 0 && (
        <p className="text-xs text-white/40 mt-3">
          +{plan.unscheduled.length} more don&apos;t fit this window.
        </p>
      )}
    </div>
  );
};

/**
 * Reality check - what deviated from the plan, with evidence. One button
 * generates a recovery-plan proposal (versioned, never silently applied);
 * applying stays in the replan banner below.
 */
const DeviationsCard = () => {
  const [deviations, setDeviations] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await insightsService.deviations();
      setDeviations(d?.deviations || []);
    } catch {
      setDeviations([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recover = async () => {
    setBusy(true);
    try {
      const d = await insightsService.autoReplan({});
      const r = d?.replan;
      if (!r?.planId) {
        toast(r?.message || 'Nothing to recover - the plan stands.');
      } else {
        toast.success(
          `Recovery plan v${r.version} proposed: ${r.riskBefore.level} ${r.riskBefore.score} → ${r.riskAfter.level} ${r.riskAfter.score} (${r.moves.length} moves). Review it in the replan banner.`,
          { duration: 6000 }
        );
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not build a recovery plan.');
    } finally {
      setBusy(false);
    }
  };

  if (!deviations || deviations.length === 0) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 text-sm">
      <p className="font-black text-red-200 flex items-center gap-2 text-base">
        <PrioIcon name="alert-triangle" size={18} /> Reality check - {deviations.length} deviation{deviations.length === 1 ? '' : 's'}
      </p>
      <ul className="mt-2 space-y-1 text-red-100/80">
        {deviations.slice(0, 3).map((d, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${d.severity === 'high' ? 'bg-red-400' : 'bg-yellow-400'}`} />
            {d.message}
          </li>
        ))}
      </ul>
      <button
        onClick={recover}
        disabled={busy}
        className="mt-4 px-6 py-2.5 bg-red-500 text-white font-black rounded-full hover:bg-red-400 transition-all disabled:opacity-60"
      >
        {busy ? 'Analyzing…' : 'Generate recovery plan'}
      </button>
    </div>
  );
};
const pill = (active) =>
  `px-4 py-2 rounded-full text-sm font-black transition-all ${
    active ? 'bg-[#FC703C] text-[#2B1B17]' : 'bg-white/10 text-white/70 hover:bg-white/15'
  }`;

const format = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(r).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
};

const MINUTES = [10, 30, 60, 120];
const ENERGIES = ['low', 'normal', 'high'];

const FocusFlow = () => {
  const [minutes, setMinutes] = useState(30);
  const [energy, setEnergy] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [rec, setRec] = useState(null);
  const [alternates, setAlternates] = useState([]);
  const [excluded, setExcluded] = useState(null);
  const [message, setMessage] = useState('');

  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [overrideFor, setOverrideFor] = useState(null);
  const [explanation, setExplanation] = useState(null);

  const OVERRIDE_REASONS = [
    { value: 'more_energy', label: 'More energy for this' },
    { value: 'not_urgent', label: 'Top pick not urgent' },
    { value: 'prefer_first', label: 'Prefer this first' },
    { value: 'other', label: 'Other' },
  ];

  const acceptAndStart = (task) => {
    if (rec?.task && task.id === rec.task.id) {
      v2Recommendations.accept(task.id).catch(() => {});
    }
    startFocus(task);
  };

  /** Skip the top pick: promote the first alternate (recorded as prefer-first). */
  const skipRec = () => {
    const [nextAlt, ...rest] = alternates;
    if (!rec?.task) return;
    if (!nextAlt) {
      setRec(null);
      setMessage('Nothing else fits right now - clear a blocker or add a shorter task.');
      return;
    }
    v2Recommendations
      .override({ recommendedTaskId: rec.task.id, chosenTaskId: nextAlt.task.id, reason: 'prefer_first' })
      .catch(() => {});
    setRec({ task: nextAlt.task, why: nextAlt.why || [] });
    setAlternates(rest);
  };

  /** Snooze the top pick by pushing its deadline 24h out, then re-rank. */
  const snoozeRec = async () => {
    if (!rec?.task) return;
    try {
      const base = rec.task.deadline ? new Date(rec.task.deadline).getTime() : Date.now();
      await taskService.updateTask(rec.task.id, { deadline: new Date(base + 86400000).toISOString() });
      toast.success('Snoozed to tomorrow.');
      fetchNext();
    } catch {
      toast.error('Could not snooze this task.');
    }
  };

  const overrideAndStart = (task, reason) => {
    if (rec?.task) {
      v2Recommendations.override({ recommendedTaskId: rec.task.id, chosenTaskId: task.id, reason }).catch(() => {});
    }
    setOverrideFor(null);
    startFocus(task);
  };

  useEffect(() => {
    if (!running || !startedAt) return undefined;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, startedAt]);

  const fetchNext = async () => {
    setLoading(true);
    try {
      const data = await v2Tasks.next({ minutes, energy });
      setRec(data.recommendation || null);
      setAlternates(data.alternates || []);
      setExcluded(data.excluded || null);
      setMessage(data.message || '');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not get a recommendation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One explain call for the top pick - the sentence behind the score.
  useEffect(() => {
    let live = true;
    setExplanation(null);
    if (!rec?.task?.id) return undefined;
    insightsService
      .explain(rec.task.id)
      .then((d) => {
        if (live) setExplanation(d?.explanation?.priorityExplanation || null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [rec?.task?.id]);

  const startFocus = (task) => {
    if (!task) return;
    setRec({ task, why: rec?.task?.id === task.id ? rec.why : [] });
    setStartedAt(new Date());
    setElapsed(0);
    setRunning(true);
  };

  const stopAndLog = async (completed) => {
    if (!rec?.task || !startedAt) {
      setRunning(false);
      return;
    }
    const end = new Date();
    const durationSeconds = Math.max(1, Math.floor((end - startedAt) / 1000));
    setRunning(false);
    setSaving(true);
    try {
      await v2Tasks.logFocusSession({
        taskId: rec.task.id,
        startedAt: startedAt.toISOString(),
        endedAt: end.toISOString(),
        durationSeconds,
      });
      if (completed) {
        await v2Tasks.complete(rec.task.id);
        toast.success(`Done - ${rec.task.title} completed in ${format(durationSeconds)}.`);
        setRec(null);
      } else {
        toast.success(`Session logged - ${format(durationSeconds)}.`);
      }
      fetchNext();
    } catch {
      toast.error('Failed to save focus session.');
    } finally {
      setSaving(false);
      setStartedAt(null);
      setElapsed(0);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 space-y-6">
      <div>
        <span className="text-xs uppercase tracking-widest text-[#2B1B17]/40 font-black block">{`{ Focus }`}</span>
        <h1 className="text-3xl sm:text-4xl font-black text-[#2B1B17] tracking-tight">
          What should you do <span className="text-[#FC703C]">right now?</span>
        </h1>
      </div>

      <ReplanBanner onApplied={fetchNext} />

      <DeviationsCard />

      {/* Controls */}
      <div className={card}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white/50 mr-1">I have</span>
          {MINUTES.map((m) => (
            <button key={m} onClick={() => setMinutes(m)} className={pill(minutes === m)}>
              {m >= 60 ? `${m / 60}h` : `${m}m`}
            </button>
          ))}
          <span className="text-sm font-bold text-white/50 ml-3 mr-1">Energy</span>
          {ENERGIES.map((e) => (
            <button key={e} onClick={() => setEnergy(e)} className={pill(energy === e)}>
              {e}
            </button>
          ))}
          <button
            onClick={fetchNext}
            disabled={loading}
            className="ml-auto px-6 py-2 bg-[#FC703C] text-[#2B1B17] font-black rounded-full hover:bg-[#ff855c] transition-all disabled:opacity-60 inline-flex items-center gap-2"
          >
            <PrioIcon name="energy" size={16} /> {loading ? 'Thinking…' : "What's Next?"}
          </button>
        </div>
      </div>

      {/* Recommendation */}
      {rec ? (
        <div className={card}>
          <p className="text-xs uppercase tracking-widest text-[#FC703C] font-black">Do this now</p>
          <h2 className="text-2xl sm:text-3xl font-black mt-1">{rec.task.title}</h2>
          <p className="text-sm text-white/50 mt-1">
            {rec.task.estimatedMinutes} min • Priority {rec.task.priorityScore}
          </p>
          {rec.why?.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-white/70">
              {rec.why.map((w, i) => (
                <li key={i} className="flex items-center gap-2">
                  <PrioIcon name="circle-check" size={14} className="text-green-400 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}
          {explanation?.summary && (
            <p className="mt-3 text-sm text-white/50 italic leading-relaxed">
              Score {rec.task.priorityScore}: {explanation.summary}
            </p>
          )}

          {/* Timer */}
          <div className="mt-6 text-center bg-[#231612] rounded-2xl py-8 border border-white/5">
            <div className="flex items-center justify-center gap-2 text-white/40 text-xs font-black uppercase tracking-widest mb-2">
              <PrioIcon name="stopwatch" size={14} /> {running ? 'Focusing' : 'Ready'}
            </div>
            <div className="text-6xl font-black font-mono tabular-nums tracking-tight">{format(elapsed)}</div>
            <div className="flex items-center justify-center gap-3 mt-6">
              {!running ? (
                <>
                  <button
                    onClick={() => acceptAndStart(rec.task)}
                    className="px-8 py-3 bg-[#FC703C] text-[#2B1B17] font-black rounded-full hover:bg-[#ff855c] transition-all inline-flex items-center gap-2"
                  >
                    <PrioIcon name="player-play" size={18} /> Start Focus
                  </button>
                  <button
                    onClick={skipRec}
                    className="px-5 py-3 bg-white/10 font-bold rounded-full hover:bg-white/15 transition-all inline-flex items-center gap-2 text-sm"
                  >
                    <PrioIcon name="player-skip-forward" size={16} /> Skip
                  </button>
                  <button
                    onClick={snoozeRec}
                    className="px-5 py-3 bg-white/10 font-bold rounded-full hover:bg-white/15 transition-all inline-flex items-center gap-2 text-sm"
                  >
                    <PrioIcon name="clock" size={16} /> Snooze
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setRunning(false)}
                    className="px-6 py-3 bg-white/10 font-bold rounded-full hover:bg-white/15 transition-all inline-flex items-center gap-2"
                  >
                    <PrioIcon name="player-pause" size={16} /> Pause
                  </button>
                  <button
                    onClick={() => { setStartedAt(new Date()); setElapsed(0); setRunning(true); }}
                    className="p-3 bg-white/10 rounded-full hover:bg-white/15 transition-all"
                    aria-label="Restart timer"
                  >
                    <PrioIcon name="rotate-clockwise" size={16} />
                  </button>
                </>
              )}
            </div>
            {(running || (!running && startedAt)) && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => stopAndLog(true)}
                  disabled={saving}
                  className="px-6 py-2.5 bg-green-500 text-[#2B1B17] font-black rounded-full hover:bg-green-400 transition-all disabled:opacity-60 inline-flex items-center gap-2 text-sm"
                >
                  <PrioIcon name="circle-check" size={16} /> {saving ? 'Saving…' : 'Complete'}
                </button>
                <button
                  onClick={() => stopAndLog(false)}
                  disabled={saving}
                  className="px-6 py-2.5 bg-white/10 font-bold rounded-full hover:bg-white/15 transition-all disabled:opacity-60 inline-flex items-center gap-2 text-sm"
                >
                  <PrioIcon name="player-skip-forward" size={16} /> Log & skip
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={card}>
          <p className="text-white/70">{message || 'No recommendation yet.'}</p>
          {excluded && (
            <p className="text-sm text-white/40 mt-2">
              Excluded: {excluded.blocked} blocked • {excluded.tooLong} too long for {minutes} min
            </p>
          )}
        </div>
      )}

      {/* Alternates */}
      {alternates.length > 0 && (
        <div className={card}>
          <p className="text-xs uppercase tracking-widest text-[#FC703C] font-black mb-3">Also fits</p>
          <div className="space-y-2">
            {alternates.map((a) => (
              <div key={a.task.id} className="bg-[#231612] rounded-xl px-4 py-3 border border-transparent">
                <button
                  onClick={() => setOverrideFor(overrideFor === a.task.id ? null : a.task.id)}
                  className="w-full text-left hover:border-[#FC703C]/40"
                >
                  <span className="font-bold">{a.task.title}</span>
                  <span className="text-xs text-white/40 ml-3">
                    {a.task.estimatedMinutes} min • {a.task.priorityScore}
                  </span>
                </button>
                {overrideFor === a.task.id && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs text-white/50 w-full">Why override the top pick?</span>
                    {OVERRIDE_REASONS.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => overrideAndStart(a.task, o.value)}
                        className="px-3 py-1.5 rounded-full bg-white/10 text-xs font-bold hover:bg-[#FC703C] hover:text-[#2B1B17] transition-all"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <DayPlanCard minutes={minutes} />
    </div>
  );
};

const FocusPage = () => (
  <div className="flex h-dvh overflow-hidden bg-[#f8f7f2] overflow-x-hidden">
    <Sidebar />
    <main className="flex-1 overflow-y-auto">
      <FocusFlow />
    </main>
  </div>
);

export default FocusPage;
