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
| GET | `/api/v2/tasks` | `?status=&projectId=&goalId=&limit=` |
| POST | `/api/v2/tasks` | `{title, importance, urgency, difficulty?, friction?, estimatedMinutes?, deadline?, energyFit?, projectId?, goalId?, parentTaskId?, dependencies?}` → `{task, events}`. `deadline` accepts any JS-parseable datetime (incl. `datetime-local` `YYYY-MM-DDTHH:mm`) and is stored as UTC ISO |
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
tiers from `getPriorityTier`: `critical` (≥80), `high` (≥60), `medium` (≥40),
`low`. The `/explain` endpoint returns the weighted breakdown behind a score.

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
