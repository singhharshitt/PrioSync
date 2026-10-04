# API Reference

Base URL: `/api`. JSON only (`express.json` limit 10kb). Errors share one shape
from `middleware/errorHandler.js`:

```json
{ "success": false, "message": "human-readable" }
```

Success responses carry `"success": true` plus payload fields. Dev-only: error
responses include `stack` when `NODE_ENV=development`.

| Status | Meaning |
|---|---|
| `400` | Validation failed (Zod issues are in the message) or bad query value |
| `401` | Missing/invalid token |
| `403` | Token valid but not yours |
| `404` | Not found or not yours (no existence leak) |
| `409` | Stale `version` (task) or duplicate email (register) |
| `429` | Auth rate limit (60/min/IP, `RATE_LIMIT_AUTH_MAX`) |
| `502` | LLM parse failed (`LLM_TIMEOUT` / `LLM_INVALID` / `LLM_UNAVAILABLE`) — heuristic fallback offered |
| `503` | Dependency temporarily down — v1 routes without Mongo; v2 routes while Postgres is waking/unreachable ("warming up, retry shortly"); always safe to retry |

Two auth systems coexist during migration:

- **v1** (`/api/auth`, `/api/tasks`): MongoDB JWT, header `Authorization: Bearer <v1 token>`.
  Gated by `requireDatabaseConnection` (Mongo must be up → otherwise `503`).
  The SPA no longer calls these routes.
- **v2** (`/api/v2/*`): JWT with UUID `sub`-style `{ id }` claim, header
  `Authorization: Bearer <v2 token>`. This is the SPA's only API surface —
  `authService`/`taskService`/`v2.js` share ONE token (`priosync_token`).
  On boot the client migrates storage: adopts a legacy dual-session v2 token
  if present, drops stale v1 tokens (their Mongo ids cannot resolve in
  Postgres), and clears the old `priosync_v2_token` key.
  Gated by `requirePostgres`.

## Meta

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | — | `{success, message, databaseConnected (Mongo), postgresConnected, redisConnected, timestamp}` — `success` is true when **either** database is connected |
| GET | `/api/metrics` | — | Prometheus text: `http_*`, `pg_latency_ms`, `cache_*`, `jobs_*`, `ai_*` |

## v1 — Mongo (legacy, stable)

| Method | Path | Body / Notes |
|---|---|---|
| POST | `/api/auth/register` | `{name, email, password}` → `{token, user}` (bcrypt-12, rate-limited) |
| POST | `/api/auth/login` | `{email, password}` → `{token, user}` |
| GET | `/api/auth/me` | current user (password excluded) |
| PUT | `/api/auth/profile` | partial user fields |
| GET | `/api/tasks` | `?status=&sort=priority&page=&limit=` list |
| POST | `/api/tasks` | `{title, description, deadline, importance, urgency, difficulty, dependencies?}` → scores on create |
| GET | `/api/tasks/:id` | — |
| PUT | `/api/tasks/:id` | partial update → rescored |
| DELETE | `/api/tasks/:id` | — |
| GET | `/api/tasks/top?limit=10` | heap feed (caches nothing in v1) |
| GET | `/api/tasks/stats` | counts + tiers |
| GET | `/api/tasks/dag` | nodes + edges for the graph view |
| POST | `/api/tasks/focus-session` | `{taskId, startedAt, endedAt, durationSeconds}` |

## v2 — Postgres (current)

All v2 task/planner routes require a v2 token. Task writes accept optional
`version` for optimistic concurrency (mismatch → `409` with current record).

### Auth

| Method | Path | Body |
|---|---|---|
| POST | `/api/v2/auth/register` | `{name, email, password}` → `{token, user}` |
| POST | `/api/v2/auth/login` | `{email, password}` → `{token, user}` |
| GET | `/api/v2/auth/me` | current user |
| PUT | `/api/v2/auth/profile` | `{name?, ...}` |

### Tasks

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/tasks` | `?status=&projectId=&goalId=&limit=` || POST | `/api/v2/tasks` | `{title, importance, urgency, difficulty?, friction?, estimatedMinutes?, deadline?, energyFit?, category?, commitmentType?, stakeholder?, projectId?, goalId?, parentTaskId?, dependencies?}` → `{task, events}`. `deadline` accepts any JS-parseable datetime (incl. `datetime-local` `YYYY-MM-DDTHH:mm`) and is stored as UTC ISO |
| GET | `/api/v2/tasks/:id` | — |
| PUT | `/api/v2/tasks/:id` | partial + `version?` → `{task, events}` |
| DELETE | `/api/v2/tasks/:id` | cascades deps; history rows survive (`task_id SET NULL`) |
| GET | `/api/v2/tasks/:id/explain` | score breakdown: weighted terms, blocked/held flags |
| PUT | `/api/v2/tasks/:id/dependencies` | `{dependsOn: [taskId]}` — full replace, cycle-rejecting (400) |
| GET | `/api/v2/tasks/top?limit=10` | **cached 60s**, `X-Cache: MISS\|HIT`, blocked tasks excluded |
| GET | `/api/v2/tasks/stats` | **cached 120s**, counts/tiers/overdue from SQL |
| GET | `/api/v2/tasks/dag` | nodes/edges (blocked edges flagged) |
| GET | `/api/v2/tasks/next?minutes=&energy=` | What's Next: engine picks over top-20, drops blocked/over-budget (both reported in `excluded`), energy bonus → `{recommendation, alternates, excluded}` or a friendly `recommendation: null` |
| POST | `/api/v2/tasks/recalc` | `{reason?}` → BullMQ job, or inline if no Redis (response says which) |
| POST | `/api/v2/tasks/focus-session` | `{taskId, startedAt, endedAt, durationSeconds}` (requires `endedAt > startedAt`) → `work_sessions` + cache bust |

`priorityScore` semantics (unchanged from v1): `0–100`, plus a `blocked` flag;
tiers from `getPriorityTier`: `critical` (≥80), `high` (≥60), `medium` (≥35),
`low`. The `/explain` endpoint returns the weighted breakdown behind a score.

### Planning intelligence (read-only unless noted)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/insights/risk?goalId=&projectId=` | Deterministic deadline risk: `{riskLevel LOW\|MEDIUM\|HIGH\|CRITICAL, riskScore 0-100, summary, factors[], remainingMinutes, capacityMinutes, daysLeft, deadline, blockedMinutes/Count, overdueCount, calibration}` — every point attributable to a factor |
| GET | `/api/v2/insights/critical-path?goalId=&projectId=` | Longest duration chain: `{path: [{taskId, title, estimatedMinutes, cumulativeMinutes}], totalMinutes, taskCount}` |
| GET | `/api/v2/insights/bottlenecks?goalId=&projectId=&top=` | `{primary, bottlenecks: [{taskId, title, downstreamCount, downstreamMinutes, explanation}], blockedWork: {blockedCount, blockedMinutes, tasks}}` |
| GET | `/api/v2/insights/capacity?goalId=&projectId=&days=&perDay=` | `{plannedMinutes, capacityMinutes, balanceMinutes, overloaded, overloadMinutes, options[]}` — options A-D are relief suggestions, never applied |
| POST | `/api/v2/insights/simulate` | `{goalId?, projectId?, changes: {moveDeadlines? [{taskId, deadline}], removeTaskIds?, capacityPerDay?, addDays?}}` → `{current, scenario, affected {count, minutes, freedMinutes, taskIds}, bottleneckShift {from, to}, mitigation, capacity}` — pure computation on cloned rows, never writes |
| GET | `/api/v2/tasks/:id/explain` | Extended (additive): legacy `{score, tier, breakdown, blocked, unlocks}` plus `priorityExplanation: {factors, positiveFactors, negativeFactors, info, summary}` |
| GET | `/api/v2/insights/deviations?goalId=&projectId=` | Planned-vs-actual evidence: `[{type TASK_OVERRUN\|MISSED_DEADLINE\|BLOCKED_AT_RISK, severity, taskId, title, message, ...metrics}]` — detection only, never acts |
| GET | `/api/v2/insights/drift` | Observed behavior patterns only (no psychology): `repeated_postponement` (3+ reschedules), `chronic_underestimation` (category ≥1.3x, ≥3 samples), `fragmented_sessions` (4+ sittings, still open) — each with evidence + planning suggestion |
| GET | `/api/v2/insights/calibration?groupBy=category\|project` | `{factor, samples, calibrated, groups: {label: {...}}}` — actual ÷ estimated from timed sessions, clamped [0.5, 3], minimum 3 samples per group before it engages |
| POST | `/api/v2/insights/auto-replan` | `{goalId?, projectId?, taskIds?, reason?}` → `{planId, version, trigger, reason, riskBefore, riskAfter, moves, impact, applied: false}` — creates a PROPOSED plan version (state in `health_details`) + `PLAN_CREATED` event; applying stays on `POST /replans/accept`, which records its own version |
| GET | `/api/v2/insights/context-order?goalId=&projectId=&lambda=` | Dependency-safe execution order balancing priority vs context-switch cost: `{order: [{position, taskId, title, priorityScore, estimatedMinutes, category, switchCost}], totalSwitchCost, lambda}` |
| GET | `/api/v2/insights/day-plan?goalId=&projectId=&minutes=&lambda=` | Energy-matched day thirds (morning/afternoon/evening from the user's rhythm): `{periods: [{key, label, energy, from, to, minutes, usedMinutes, tasks}], unscheduled, totalMinutes, budgetMinutes}` |
| GET | `/api/v2/insights/scope?goalId=` | Scope creep vs goal baseline (or whole workload): `{originalTasks, currentTasks, addedTasks, removedTasks, deadlineMoves, growthPct, added[], message}` |
| GET | `/api/v2/insights/commitments` | Non-personal open commitments with risk flags: `{commitments: [{taskId, title, commitmentType, stakeholder, deadline, riskFlags[], atRisk}], count, atRiskCount}` |
| GET | `/api/v2/preferences` | Planner rhythm: `{availableMinutesPerDay, workStart, workEnd, defaultEnergy, energyMorning, energyAfternoon, energyEvening}` |
| PUT | `/api/v2/preferences` | Partial update (at least one field; `HH:MM` validated, energy enums) → same shape |

Calibration: `factor = actual ÷ estimated` over timed focus sessions on
completed work, clamped to [0.5, 3]; fewer than 3 samples → factor 1.0,
`calibrated: false` (no guessing). Currently global; per-project/tag splits
are the documented Phase-2 extension.

### Planner (brain dump)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v2/planner/parse` | `{text, mode: "auto"\|"ai"\|"heuristic", constraints?}` → `{plan, source, clarifications}` — **read-only, never writes** |
| POST | `/api/v2/planner/confirm` | `{plan, constraints}` → creates goals/projects/tasks/deps, scores, schedules, snapshot → `{planId, health, counts}` (txn) |

`plan` JSON shape is pinned by `ai/plannerSchema.js`: goals, projects, tasks
(title, estimatedMinutes, energyFit, dependsOn), constraints. **No score/rank
fields are accepted by schema** — engine outputs only.

### Plans

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/plans` | user's plan versions |
| GET | `/api/v2/plans/:id` | snapshot + items + computed health |

### Replans & recommendations

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/replans/missed` | overdue/incomplete detection (read-only) |
| POST | `/api/v2/replans/propose` | `{fromDate, toDate?}` → day-packed proposal + per-day impact (**read-only**) |
| POST | `/api/v2/replans/accept` | applies proposal → `TASK_RESCHEDULED` events + plan snapshot |
| GET | `/api/v2/replans/log` | decision log from events |
| POST | `/api/v2/recommendations/accept` | `{taskId, reason?}` → `RECOMMENDATION_ACCEPTED` |
| POST | `/api/v2/recommendations/override` | `{taskId, reason}` — reason required (enum) → `RECOMMENDATION_OVERRIDDEN` |
| GET | `/api/v2/recommendations/adherence` | accepted/overridden → adherence % |

## Caching & headers

- `X-Cache: HIT|MISS` on cache-aside reads (`top`, `stats`).
- Cache is busted synchronously by every task writer for the same user.
- Writes return events created in the same transaction — clients can render
  audit trails without a second call.
