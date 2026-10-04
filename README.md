# PrioSync — Turn chaos into your next move

> **"You don't organize the chaos. PrioSync does."**
>
> PrioSync is an adaptive planning engine that continuously recalculates what
> should happen next as real-world execution deviates from the original plan.

PrioSync is an intelligent task planning and prioritization platform. Dump a messy
goal — *"placement prep, SQL + DSA left, assessment next week"* — and PrioSync
understands it, structures it into goals/projects/tasks, detects dependencies,
scores priorities **deterministically**, schedules the work, and adapts when life
happens. AI understands the chaos; algorithms decide; PostgreSQL remembers.

## Where the project stands

PrioSync is mid-migration from **MERN to PERN**, deliberately and incrementally:

| Layer | Legacy (v1, stable) | Current (v2, active development) |
|---|---|---|
| Database | MongoDB + Mongoose (`users`, `tasks`) | **PostgreSQL** — 11 tables, UUIDs, FKs, CHECKs, partial indexes |
| API | `POST/GET /api/auth/*`, `/api/tasks/*` | Additive `/api/v2/*`: auth, tasks, planner, plans, replans, recommendations |
| Engine | Priority score + MaxHeap + DAG + greedy scheduler | Same engine, extended: explainable breakdowns, unlock-impact, version concurrency |
| Cache/Jobs | — | Redis cache-aside (`X-Cache`) + BullMQ recalc queue, both degrade gracefully |
| Frontend | — | **Fully cut over to `/api/v2`**: Dashboard, Tasks, Dependencies, Profile, Planner, Focus — one session token, no Mongo dependency |
| Observability | Morgan | Pino JSON logs, `/api/metrics` (Prometheus format) |
| Tests | — | Vitest: 25 unit + 4 gated PG integration (`29/29`) |

v1 routes remain mounted for the migration contract (they 503 without MongoDB);
the SPA no longer calls them. Redis/BullMQ are optional (the API runs fully
without them), and MongoDB is optional too — without it only the legacy
`/api/*` routes are unavailable. The Mongo→Postgres data migration script
(`server/db/migrate-mongo-to-postgres.js`) exists but still needs a host that
can reach Atlas before existing Mongo data can be moved.

## Quickstart

### Option A — full stack with Docker (recommended, runs offline)

```bash
docker compose up --build
docker compose exec api node db/verify.js --apply   # create the 11 tables
# web → http://localhost:8081   api → http://localhost:5000/api/health
```

### Option B — local dev

```bash
# server
cd server
cp .env.example .env   # fill POSTGRES_URI (Neon), JWT_SECRET; MONGO_URI for v1
npm install
node db/verify.js --apply
npm run dev

# client (second terminal)
cd client
npm install
npm run dev   # http://localhost:5173 (proxies /api to :5000 — set VITE_API_URL to override)
```

### Tests

```bash
cd server
npm test        # unit only — no network, always safe
npm run test:pg # + Postgres integration (RUN_PG_TESTS=1, temp users, cascade cleanup)
cd ../client && npm run lint && npm run build
```

## Product loop

```
Brain dump → AI parse (structured, validated) → confirm → dependency graph
→ deterministic priority → schedule + plan health → Focus ("What's Next?",
available-time, energy) → execute → miss? propose replan (you accept)
→ events logged → decision log + adherence → analytics
```

The LLM **never** sets priority, writes to the DB directly, or schedules. It
extracts; the engine decides. Without an `LLM_API_KEY`, a deterministic
heuristic parser serves the same contract.

## Planning intelligence (deterministic, explainable)

Beyond raw priority scores, `/api/v2/insights/*` answers the decisions ordinary
task managers punt on - all computed, all explainable, no LLM in the loop:

- **Deadline risk** (`GET /risk`) - LOW/MEDIUM/HIGH/CRITICAL with a 0-100
  score where every point traces to a named factor (load ratio, blocked work,
  overdue items, downstream concentration, calibration state)
- **Critical path + bottlenecks** (`GET /critical-path`, `/bottlenecks`) -
  longest duration chain, ranked gates with downstream hours, blocked-work
  ledger, delay-propagation primitive
- **Capacity** (`GET /capacity`) - planned vs usable hours with four priced
  relief options (move low-impact, extend deadline, raise capacity, cut scope)
  returned as data, never applied silently
- **What-if simulation** (`POST /simulate`) - move deadlines, drop tasks, or
  change capacity on cloned rows; reports current vs scenario risk, affected
  set, bottleneck shift, and a mitigation. Proven read-only by test.
- **Explainable priority** - every score ships a
  `{factors, positiveFactors, negativeFactors, info, summary}` object
  ("Deadline pressure (+25) drives this score…")
- **Calibration** - actual ÷ estimated from timed focus sessions (min
  3 samples, clamped 0.5-3x), feeding risk, capacity, and path durations
- **Deviation detection** (`GET /insights/deviations`) - overruns, missed
  deadlines, and near-term blocked work as evidence objects with severity
- **Auto-replan proposals** (`POST /insights/auto-replan`) - top deviation
  becomes a trigger, recovery moves are priced (risk before/after) and stored
  as a PROPOSED plan version; applying stays an explicit user action with its
  own version. Nothing is ever silently overwritten.
- **Reality drift** (`GET /insights/drift`) - repeated postponement, chronic
  per-category underestimation, fragmented sessions - each with evidence and
  one concrete adjustment, never psychological claims
- **Context-aware ordering** (`GET /insights/context-order`) - Kahn's algorithm
  over dependencies balancing priority against switching cost (lambda-tuned)
- **Energy-matched day plans** (`GET /insights/day-plan`) - work thirds mapped
  to your rhythm (`PUT /preferences`), overflow listed not crammed
- **Scope control** (`GET /insights/scope`) - original vs current, added /
  removed / deadline moves with growth math, per goal or workload
- **Commitments** - typed promises (team/client/academic/deadline + optional
  stakeholder) with an at-risk listing (`GET /insights/commitments`)

The Dashboard's "Am I on track?" strip (risk, bottleneck, capacity) and the
Focus recommendation's score sentence are the UI surface. The Dependencies
graph highlights the critical path (dashed ring) and the primary bottleneck
(red ring + tag); task cards expand to show the factor bars behind their
score; the Planner keeps an auditable plan history and a read-only what-if
panel; Focus adds Skip/Snooze next to Start; Profile shows follow-through.
See `docs/ARCHITECTURE.md` for the risk model and algorithms.

## Docs

- `docs/ARCHITECTURE.md` — layers, flows, DSA engine, AI/deterministic split, tradeoffs, observed performance
- `docs/DATABASE.md` — Mongo schema (legacy), Postgres schema + ER diagram, indexes, migration runbook
- `docs/API.md` — v1 + v2 endpoint reference
- `PROJECT_DOCUMENTATION.md` — original academic write-up (historical; code is source of truth)

## Stack

**Server** (Node ≥20, ESM): Express 4, `pg` 8, Mongoose 8, BullMQ 5 + `ioredis` 5,
Pino 9, Zod 3 (server), Helmet 8, JWT + bcryptjs.
**Client:** React 19, Vite 7, Tailwind 4, React Router 7, Axios, Recharts,
`react-hot-toast`, locally vendored Tabler icons behind `PrioIcon`.
**Infra:** Postgres 16 (Neon in prod, container locally), Redis 7 (optional),
Docker + Compose, GitHub Actions CI (unit tests, lint, build).

## License

MIT — see [LICENSE](LICENSE).
