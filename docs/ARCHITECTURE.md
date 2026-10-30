# Architecture

## System map

```mermaid
flowchart TB
    Browser["Browser — React 19\nDashboard / Tasks / Dependencies\nPlanner / Focus (v2)"]
    API["Express API\nv1 Mongo routes + v2 PG routes\nZod validation · JWT · rate-limit · Helmet"]
    DSA["DSA engine\npriorityEngine · MaxHeap · DAG\nscheduler — decides scores & order"]
    AI["AI parser (isolated)\nLLM or heuristic → Zod JSON\nsuggests only, never writes"]
    Mongo[("MongoDB\nusers · tasks · goals · projects\ntaskEvents · workSessions · planVersions")]
    Redis[("Redis (optional)\ntop/stats cache · BullMQ")]
    Worker["BullMQ worker\nrecalc scores async"]

    Browser -->|"/api/* + /api/v2/*"| API
    API --> DSA
    API -->|validated JSON only| AI
    API --> Mongo
    API <--> Redis
    Redis --> Worker
    Worker --> Mongo
```

## Layering (server)

```
routes/        ── thin: auth guard → Zod validate → controller
controllers/   ── thin: shape HTTP in/out, map service results to status codes
services/      ── orchestration + events (mongoTaskService, mongoPlannerService, mongoReplanService)
repositories/  ── Mongoose queries only (mongoUsers, mongoTasks, mongoSessions, mongoEvents)
dsa-engine/    ── pure deterministic algorithms, no I/O
ai/ planner/   ── understanding (LLM/heuristic) + computed health
cache/ jobs/   ── Redis + BullMQ, both optional with inline fallback
models/        ── Mongoose schemas (User, Task, Goal, Project, TaskEvent, WorkSession, PlanVersion)
```

Controllers never touch queries; repositories never touch the engine; the engine
never touches I/O. Mutations record a `TaskEvent` document alongside every write.

## Request flows

**Brain dump → plan** (`docs/API.md § planner`):
parse (read-only, AI→Zod→clarifications) → user reviews/edits → confirm
(transactional create → DAG cycle check → deterministic scores → greedy schedule
→ computed health → `plan_versions` snapshot). Priority/schedule/health are
engine outputs; the AI output contains no scores by schema design.

**What's next** (`GET /tasks/next`): top-20 engine candidates → drop blocked
(reported, never recommended) → drop over-budget → energy bonus → rank →
pick + alternates with `why[]`. Acceptance/override recorded with reason enums.

**Missed work** (`/replans/*`): detect overdue → greedy day-packing proposal
(read-only, per-day impact) → user accepts/edits → `TASK_RESCHEDULED` events +
plan snapshot. Nothing moves silently.

## DSA engine (identity, kept)

| Structure | Use | Complexity |
|---|---|---|
| Weighted scorer | `urgency×.30 + importance×.25 + deadline×.25 + ease×.20`, ×20, −20 if blocked | O(1) |
| MaxHeap | Top-N retrieval | insert/extract O(log n) |
| DAG | Deps, DFS cycle guard, Kahn topo sort, unlock-impact BFS | O(V+E) |
| Greedy scheduler | Heap order over engine scores | O(V log V + E) |

Known history: `topologicalSort` shipped with inverted in-degrees (dropped
nodes); fixed and covered in `tests/dag.test.js`. The scheduler previously
claimed topo ordering it didn't enforce — now honest: heap order over
dependency-penalized scores.

## Planning intelligence (Phase 1)

Pure deterministic engines in `server/planner/`, orchestrated read-only by
`services/insightService.js`, exposed at `/api/v2/insights/*`. No new tables:
everything computes from tasks, dependencies, work sessions, and preferences.

```mermaid
flowchart LR
    subgraph scope["Scope load (insightService)"]
        T["tasks + deps\n(allForScoring)"]
        C["capacity\n(user_preferences)"]
        K["calibration\n(work_sessions)"]
    end
    T --> RISK["riskEngine\nassessDeadlineRisk()"]
    C --> RISK
    K --> RISK
    T --> CP["criticalPath\ncalculateCriticalPath()\nfindBottlenecks()\ncalculateBlockedWork()\ncalculateDelayPropagation()"]
    T --> CAP["capacity\nanalyzeCapacity()"]
    C --> CAP
    K --> CAP
    RISK --> API["/insights/risk"]
    CP --> API2["/insights/critical-path\n/insights/bottlenecks"]
    CAP --> API3["/insights/capacity"]
    T --> SIM["scenario\nsimulateScenario()\n(cloned rows only)"]
    SIM --> API4["POST /insights/simulate"]
```

**Risk model** (`riskEngine.js`, documented in-code): load points 0-55 from
remaining/capacity ratio with kink points at 0.7x and 1.0x, +0-10 blocked
share, +3 per overdue task (cap 12), +0-8 downstream concentration, floor
MEDIUM on any overdue item, cap MEDIUM with no in-scope deadline. Levels:
<30 LOW, <55 MEDIUM, <75 HIGH, else CRITICAL. The summary sentence is
generated from the top factors - never templated optimism.

**Critical path**: longest estimated-minutes chain over open tasks via DP on
the existing DAG's topological order (cycle edges are rejected by `addEdge`,
so hostile input degrades to a shorter path, never a hang).

**Calibration**: global actual/estimated factor from timed sessions on
completed work, clamped [0.5, 3], minimum 3 samples before it engages.
Feeds risk, capacity, and critical path durations.

**Explanation object**: engine breakdown mapped to signed factors plus
honestly-marked non-score context (downstream unlocks). Additive on the
existing `/explain` response - old fields untouched.

**Simulation**: synthetic deadline moves, removals, capacity overrides, and
day shifts applied to cloned rows; reports current vs scenario risk,
affected set (traversed on the ORIGINAL graph so removals don't hide stranded
dependents), freed minutes, bottleneck shift, and a mitigation drawn from the
scenario's capacity options. Proven read-only by test (row re-read equality).

## Adaptive loop (Phase 2)

Detection proposes; only explicit acceptance applies. No new tables - versions
are `plan_versions` rows (proposal state in `health_details`), history is
`task_events`, learning reads `work_sessions`.

```mermaid
flowchart LR
    OBS["execute\nwork_sessions\ntask_events"] --> DEV["deviations\nTASK_OVERRUN\nMISSED_DEADLINE\nBLOCKED_AT_RISK"]
    OBS --> DRIFT["drift\nrepeated_postponement\nchronic_underestimation\nfragmented_sessions"]
    OBS --> CAL["calibration\nglobal + per-category/project\nmin 3 samples, clamp 0.5-3"]
    DEV --> AUTO["autoReplan()\ntrigger + moves\nrisk before/after"]
    CAL --> AUTO
    AUTO -->|"PROPOSED version\n(applied: false)"| HV["plan_versions\n+ PLAN_CREATED"]
    HV -->|"user accepts"| ACC["/replans/accept\nAPPLIED version"]
```

- **Deviation thresholds** (in-code, conservative): overrun = actual ≥150% of
  estimate with ≥15 min excess; postponement = 3+ reschedules; fragmentation =
  4+ sittings on still-open work; underestimation = category factor ≥1.3.
- **Auto-replan** picks the top deviation as trigger, builds day-packed moves
  with the existing proposer, prices risk before/after through the same risk
  + simulation engines, and persists trigger, reasons, moves, and both risk
  readings. Nothing moves until `/replans/accept`, which writes its own
  version - the audit trail shows proposed vs applied.
- **Drift** reports observed patterns with evidence strings and one concrete
  planning adjustment each. No psychological claims, ever.

## Product experience (Phase 4 - UI over existing APIs, no new endpoints)

- **Planner**: auditable plan history (version, proposed/applied state,
  trigger, reason, risk before/after, moves) reloading after each confirm;
  read-only what-if panel (move/drop/capacity scenarios with affected set,
  bottleneck shift, mitigation).
- **Dependencies**: critical-path chain + bottleneck explanation banner;
  dashed-ring critical nodes and red-ring bottleneck node with tag on the SVG
  graph, with a legend for the overlays.
- **Task cards**: blocked chip computed locally from populated dependency
  statuses; one explain call per card expansion renders the signed factor
  bars and the generated summary sentence.
- **Focus**: Skip promotes the first alternate (recorded as prefer-first);
  Snooze pushes the deadline 24h and re-ranks; day-plan section orders the
  selected window into energy periods; deviations card proposes recovery
  plans that the replan banner applies.
- **Profile**: planning-rhythm editor (capacity + energy map) feeding
  scheduling/risk/day-plan; follow-through card from recommendation
  adherence (hidden until data exists).

## Advanced planning (Phase 3)

- **Context switching** (`planner/contextSwitch.js`): 0-7 cost per transition
  (category +2, distinct projects +3, energy distance +0-2). `scheduleWithContext`
  runs Kahn's algorithm over the DAG picking `priorityScore - lambda x cost`
  among ready tasks - dependencies always beat grouping; cycles drain by
  priority instead of hanging.
- **Energy-aware day plan** (`planner/dayPlan.js`): the work window
  (user `work_start`/`work_end`, default 09:00-18:00) split into
  morning/afternoon/evening thirds carrying the user's chosen energy levels
  (`PUT /preferences`). Tasks land where energy matches exactly first,
  nearest otherwise; overflow is listed as unscheduled, never overfilled.
  A user-controlled preference, not a diagnosis.
- **Scope creep** (`planner/scope.js`): original vs current counts, added
  tasks, `TASK_DELETED` removals and `TASK_RESCHEDULED` moves from the event
  trail, growth %, against a goal baseline or the whole workload.
- **Commitments**: nullable-by-design columns (`commitment_type`,
  `stakeholder`, both defaulted) accepted on create/update, surfaced in
  `presentTask`, with an at-risk listing (overdue / blocked / due < 48h) for
  non-personal types at `/insights/commitments`.
- **Migration discipline**: `db/migrations/*.sql` (idempotent ALTERs +
  constraint guards) applied by `db/migrate.js` with a `schema_migrations`
  ledger; `schema.sql` updated in lockstep so fresh installs converge.
  Verified by running twice (second run is a no-op).

## AI / determinism split (mandatory)

```
User → Brain dump → AI Parser → {goals, tasks, constraints} (Zod-validated)
                                        ↓
              Dependency engine → Priority engine → Scheduler → Plan + health
```

The model may not emit scores, ranks, schedules, SQL, or commands; user text is
data (prompt-injection clause in `ai/plannerPrompt.js`). Failures are typed
502s with a heuristic fallback path — never silent degradation.

### Pollinations layer (optional narrators + intents)

- `ai/aiModels.js`: model allowlist, `POLLINATIONS_API_KEY` with `POLLEN_API`
  fallback, safe model resolution (requested → env → default).
- `ai/provider.js`: native-fetch OpenAI-compatible client; every failure is a
  typed `AiUnavailableError` (`not_configured|auth|rate_limited|upstream|
  timeout|network|bad_json|bad_output`) so callers fall back deterministically.
  Guarantees the word "json" in messages for `json_object` response mode
  (Azure-backed gateways 400 otherwise - found live, regression-tested).
- `ai/narrator.js`: fact-lock narration - the model must return
  `{"text": ...}` (shape pinned) and every engine fact must survive in the
  text (numbers verbatim, titles word-level); any mismatch → deterministic
  template. AI explains, numbers come from the engines.
- `ai/aiIntents.js`: NL → validated scenario mutations (strict schema, unknown
  keys reject the whole result), smart notes, focus briefs, session
  reflections. Nothing applies changes; the client still confirms.
- Served at `/api/v2/ai/*` (`status`, `scenario-intent`, `focus-brief`,
  `session-reflection`, `smart-notes`); consent via
  `user_preferences.ai_narration`.

### Focus 2.0 (client)

- `client/src/lib/focusSession.js`: pure idle → running ↔ paused → done
  machine (injected clock, pause excluded from elapsed, emits the
  focus-session payload with `plannedSeconds`/`pausedSeconds`).
- `client/src/lib/notificationPolicy.js`: every toast flows through one
  policy (severity durations, future mute/queue point). Tested with vitest
  (`npm test` in `client/`).
- FocusPage: pause/resume, visibility auto-pause, planned-length pills,
  session notes, fullscreen timer, Space/F shortcuts.

## Cache & jobs

- Cache-aside on `GET top` (60s) / `stats` (120s), `X-Cache: HIT/MISS`,
  synchronous bust on every writer. Miss/down → MongoDB directly.
- `POST /tasks/recalc` enqueues score recalculation (deadline pressure drifts);
  without Redis the same handler runs inline — response states which.
- Rate limiting is in-memory fixed-window on auth (per-process; Redis sliding
  window is the documented scale-up).

## Observability

Pino JSON logs (secret redaction), per-route latency/error counters, PG latency
(slow >200ms logged with SQL prefix), cache hit/miss, job outcomes, AI calls —
all at `GET /api/metrics` (unauthenticated by scraper convention; firewall it
in prod).

## Observed performance (measured, not claimed)

| Measurement | Value | Context |
|---|---|---|
| MongoDB round-trip | ~50ms | Atlas M0 free tier || Register latency | ~1.5s | bcrypt-12 dominates (honestly flagged `slow`) |
| Unit suite | ~4s | 161 tests, no network |
| Client lib tests | <1s | 7 tests (`vitest run --environment node`) |
| `vite build` | ~10s | 2453 modules |
| Images | api 292MB, web 97MB | `npm ci --omit=dev`, nginx static |

No invented benchmarks; re-measure with `EXPLAIN ANALYZE` + `/api/metrics`
before optimizing.

## Tradeoffs

| Decision | Why | Cost |
|---|---|---|
| Raw Mongoose over Prisma | Familiar ODM, flexible schema | No generated types |
| v1+v2 same DB | Single Atlas connection, no dual-DB overhead | Legacy routes still mounted until decommission |
| Heuristic parser default | Works with no key/cost/latency | Dumber than LLM; LLM upgrades without contract change |
| In-memory rate limit | Zero infra, stops casual abuse | Per-process; needs Redis when scaled out |
| No `productivity_metrics` table | CTEs suffice until proven slow | Recompute per read (cached 120s) |
| Hand-rolled `/metrics` | Zero deps for what we measure | Adopt `prom-client` if histograms/alerts outgrow it |

## Roadmap

1. Time-aware scheduling (clock-time slots in plan items)
2. ~~Unified auth~~ — done: SPA uses one session; next is decommissioning legacy v1 routes
3. Redis sliding-window limits, reminder jobs, planner-AI background path
4. Component tests once UI logic outgrows fetch wrappers
