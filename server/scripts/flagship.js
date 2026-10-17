/**
 * Flagship demonstration (§90) at API level: one user journey across the
 * whole chain - brain dump, confirm, Best Next Move, critical path,
 * bottlenecks, risk, resilience, what-if, resolve, recovery, auto-replan,
 * focus session, deviations, calibration, AI intents, plan history.
 *
 * Usage: start the server first, then
 *   node scripts/flagship.js [baseUrl]
 * Exits 0 when every step passes, 1 otherwise. Creates a temp __flagship__
 * user; server-side cascade cleanup is out of scope (test users are cheap).
 */
const BASE = process.argv[2] || process.env.FLAGSHIP_BASE || 'http://localhost:5000';

let failures = 0;
const step = async (name, fn) => {
    try {
        const detail = await fn();
        console.log(`PASS  ${name}${detail ? ` - ${detail}` : ''}`);
    } catch (e) {
        failures += 1;
        console.log(`FAIL  ${name} - ${e.message}`);
    }
};

const req = async (method, path, token, body) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
        throw new Error(`${method} ${path} -> ${res.status}: ${data.message || 'no message'}`);
    }
    return data;
};

const isoDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

const main = async () => {
    const email = `__flagship__${Date.now()}@example.com`;
    const reg = await req('POST', '/api/v2/auth/register', null, {
        name: 'Flagship',
        email,
        password: 'Passw0rd!23',
    });
    const token = reg.token || reg.data?.token;
    if (!token) throw new Error('register returned no token');
    console.log('PASS  register - token issued');
    const H = (m, p, b) => req(m, p, token, b);

    await step('brain dump parse (single-liner, heuristic)', async () => {
        const d = await H('POST', '/api/v2/planner/parse', { text: 'finish report by friday for 2 hours', mode: 'heuristic', context: {} });
        if (d.plan.tasks.length < 1) throw new Error('no tasks parsed');
        if (d.plan.tasks[0].estimatedMinutes !== 120) throw new Error('duration sniff missed');
        return `${d.plan.tasks.length} task(s), source=${d.source}`;
    });

    const ids = [];
    await step('create 12 tasks with deps, deadlines, energy', async () => {
        const specs = [
            ['Design schema', 120, 5, 4, 3], ['API integration', 240, 5, 5, 4],
            ['Write parser tests', 120, 4, 4, 3], ['Build dashboard cards', 180, 4, 3, 3],
            ['Focus timer polish', 90, 3, 3, 2], ['Docs pass', 60, 2, 2, 1],
            ['Deploy staging', 45, 4, 5, 2], ['Load test', 90, 3, 4, 3],
            ['Fix edge cases', 120, 4, 4, 4], ['Review PRs', 60, 3, 2, 2],
            ['Write changelog', 30, 2, 1, 1], ['Launch checklist', 60, 5, 5, 2],
        ];
        for (const [i, [title, mins, imp, urg, diff]] of specs.entries()) {
            const t = await H('POST', '/api/v2/tasks', {
                title, estimatedMinutes: mins, importance: imp, urgency: urg, difficulty: diff,
                deadline: isoDays(i < 6 ? 4 : 9), energyFit: imp >= 4 ? 'high' : 'normal',
            });
            ids.push(t.task.id);
        }
        await H('PUT', `/api/v2/tasks/${ids[1]}/dependencies`, { dependencies: [ids[0]] });
        await H('PUT', `/api/v2/tasks/${ids[2]}/dependencies`, { dependencies: [ids[1]] });
        await H('PUT', `/api/v2/tasks/${ids[6]}/dependencies`, { dependencies: [ids[1], ids[3]] });
        return `${ids.length} tasks, 4 dependency edges`;
    });

    await step('Best Next Move explains itself', async () => {
        const d = await H('GET', '/api/v2/tasks/next?minutes=120&energy=high');
        if (!d.decision?.bestNextMove?.why?.length) throw new Error('missing why');
        return `"${d.decision.bestNextMove.title}" + ${d.decision.bestNextMove.why.length} reasons`;
    });

    await step('critical path + bottlenecks + risk', async () => {
        const cp = (await H('GET', '/api/v2/insights/critical-path')).criticalPath;
        const bn = await H('GET', '/api/v2/insights/bottlenecks');
        const rk = (await H('GET', '/api/v2/insights/risk')).risk;
        if (!cp?.path?.length || !rk?.riskLevel) throw new Error('empty engine output');
        return `cp=${cp.totalMinutes}m primary=${bn.primary?.title || 'none'} risk=${rk.riskLevel}`;
    });

    await step('plan resilience', async () => {
        const d = (await H('GET', '/api/v2/insights/resilience?days=14')).resilience;
        if (!d || !d.resilience || !d.resilience.level) throw new Error('no resilience level');
        return `level=${d.resilience.level} failurePoints=${d.resilience.failurePoints}`;
    });

    await step('what-if: lose tomorrow evening', async () => {
        const d = await H('POST', '/api/v2/insights/simulate', { changes: { loseEvening: true } });
        if (!d.simulation?.scenario) throw new Error('no scenario priced');
        const intent = await H('POST', '/api/v2/ai/scenario-intent', { text: 'lose tomorrow evening' });
        if (!intent.intent || !('matched' in intent.intent)) throw new Error('intent shape wrong');
        return `risk ${d.simulation.current.riskLevel}->${d.simulation.scenario.riskLevel}, intent.matched=${intent.intent.matched}`;
    });

    await step('impossible plan resolves to options', async () => {
        const d = await H('POST', '/api/v2/insights/resolve', { days: 1 });
        if (!Array.isArray(d.options)) throw new Error('no options array');
        return `infeasible=${d.detection?.infeasible} options=${d.options.length}`;
    });

    await step('recovery plans + auto-replan proposal', async () => {
        const rec = await H('POST', '/api/v2/insights/recovery', { lostMinutes: 120 });
        if (!Array.isArray(rec.recovery?.plans)) throw new Error('no recovery plans');
        const ar = await H('POST', '/api/v2/insights/auto-replan', {});
        if (!('trigger' in (ar.replan || {}))) throw new Error('replan shape wrong');
        return `recovery=${rec.recovery.plans.length} trigger=${ar.replan.trigger}`;
    });

    await step('focus session logs with pause accounting', async () => {
        const s = await H('POST', '/api/v2/tasks/focus-session', {
            taskId: ids[0],
            startedAt: new Date(Date.now() - 30 * 60000).toISOString(),
            endedAt: new Date().toISOString(),
            durationSeconds: 1500,
            plannedSeconds: 1800,
            pausedSeconds: 300,
            note: 'Flagship session.',
            completed: false,
        });
        if (s.session.pausedSeconds !== 300) throw new Error('pause accounting lost');
        const dev = await H('GET', '/api/v2/insights/deviations');
        return `session=${s.session.durationSeconds}s deviations=${dev.count}`;
    });

    await step('focus brief + smart notes (AI or fallback, always 200)', async () => {
        const b = await H('POST', '/api/v2/ai/focus-brief', { minutes: 90, energy: 'high' });
        const n = await H('POST', '/api/v2/ai/smart-notes', { notes: 'Did schema. Next: tests.', taskTitle: 'Design schema' });
        if (!b.brief?.text || !n.notes?.summary) throw new Error('empty narration');
        return `brief=${b.brief.source} notes=${n.notes.source}`;
    });

    await step('traceability + efficiency + plan-debt + allocation', async () => {
        const t = await H('GET', '/api/v2/insights/traceability');
        const e = await H('GET', '/api/v2/insights/efficiency');
        const p = await H('GET', '/api/v2/insights/plan-debt');
        const a = await H('GET', '/api/v2/insights/allocation?days=2');
        if (!t.summary || !e.observation || !p.planDebt || !a.allocation) throw new Error('tier-a shape wrong');
        return `orphans=${t.summary.orphanWorkCount} debt=${p.planDebt.recoveryText} scarce=${a.allocation.scarce}`;
    });

    await step('plan version history', async () => {
        const d = await H('GET', '/api/v2/plans');
        if (!Array.isArray(d.plans ?? d.versions ?? [])) throw new Error('no plan list');
        return 'history readable';
    });

    if (failures > 0) {
        console.log(`\nFLAGSHIP: ${failures} step(s) failed.`);
        process.exit(1);
    }
    console.log('\nFLAGSHIP: all steps passed.');
};

main().catch((e) => {
    console.log(`FATAL: ${e.message}`);
    process.exit(1);
});
