# Architecture

## System map

```mermaid
flowchart TB
    Browser["Browser — React 19\nDashboard / Tasks / Dependencies\nPlanner / Focus (v2)"]
    API["Express API\nv1 Mongo routes + v2 PG routes\nZod validation · JWT · rate-limit · Helmet"]
    DSA["DSA engine\npriorityEngine · MaxHeap · DAG\nscheduler — decides scores & order"]
    AI["AI parser (isolated)\nLLM or heuristic → Zod JSON\nsuggests only, never writes"]
    PG[("PostgreSQL\n11 tables · events · plans")]
    Mongo[("MongoDB (legacy)\nusers · tasks")]
    Redis[("Redis (optional)\ntop/stats cache · BullMQ")]
    Worker["BullMQ worker\nrecalc scores async"]

    Browser -->|"/api/* + /api/v2/*"| API
    API --> DSA
    API -->|validated JSON only| AI
    API --> PG
    API --> Mongo
    API <--> Redis
    Redis --> Worker
    Worker --> PG
```

## Layering (server)

```
routes/        ── thin: auth guard → Zod validate → controller
controllers/   ── thin: shape HTTP in/out, map service results to status codes
services/      ── orchestration + transactions + events (pgTaskService, plannerService, replanService)
repositories/  ── raw SQL only (pgUsers, pgTasks, pgSessions)
dsa-engine/    ── pure deterministic algorithms, no I/O
ai/ planner/   ── understanding (LLM/heuristic) + computed health
cache/ jobs/   ── Redis + BullMQ, both optional with inline fallback
db/            ── pgClient (pooled, instrumented), schema.sql, verify, migration
```

Controllers never touch SQL; repositories never touch the engine; the engine
never touches I/O. Mutations write a `task_events` row in the same transaction.

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

## AI / determinism split (mandatory)

```
User → Brain dump → AI Parser → {goals, tasks, constraints} (Zod-validated)
                                        ↓
              Dependency engine → Priority engine → Scheduler → Plan + health
```

The model may not emit scores, ranks, schedules, SQL, or commands; user text is
data (prompt-injection clause in `ai/plannerPrompt.js`). Failures are typed
502s with a heuristic fallback path — never silent degradation.

## Cache & jobs

- Cache-aside on `GET top` (60s) / `stats` (120s), `X-Cache: HIT/MISS`,
  synchronous bust on every writer. Miss/down → Postgres directly.
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
| PG round-trip | ~250ms | Neon from dev sandbox (`priosync_db_latency_ms_sum`) |
| Register latency | ~1.5s | bcrypt-12 dominates (honestly flagged `slow`) |
| Unit suite | ~3s | 25 tests, no network |
| PG integration | ~50s | 4 flows, latency-bound |
| `vite build` | ~13s | 2453 modules |
| Images | api 292MB, web 97MB | `npm ci --omit=dev`, nginx static |

No invented benchmarks; re-measure with `EXPLAIN ANALYZE` + `/api/metrics`
before optimizing.

## Tradeoffs

| Decision | Why | Cost |
|---|---|---|
| Raw `pg` over Prisma | CTE/window control, no codegen churn mid-migration | Hand-written SQL, no generated types |
| v1+v2 coexist, no flag | Zero regression, explicit contract (§46) | Legacy routes idle (SPA is v2-only, single session) until decommission |
| Heuristic parser default | Works with no key/cost/latency | Dumber than LLM; LLM upgrades without contract change |
| In-memory rate limit | Zero infra, stops casual abuse | Per-process; needs Redis when scaled out |
| No `productivity_metrics` table | CTEs suffice until proven slow | Recompute per read (cached 120s) |
| Hand-rolled `/metrics` | Zero deps for what we measure | Adopt `prom-client` if histograms/alerts outgrow it |

## Roadmap

1. Migration cutover where Atlas is reachable (script + runbook exist)
2. ~~Unified auth~~ — done: SPA uses one v2 session (`V2SessionGate` retired);
   next is decommissioning legacy routes once migration parity is signed off
3. Time-aware scheduling (clock-time slots in `plan_items`)
4. Redis sliding-window limits, reminder jobs, planner-AI background path
5. Component tests once UI logic outgrows fetch wrappers
