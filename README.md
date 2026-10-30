<div align="center">

# PrioSync

### Turn chaos into your next move

**"You don't organize the chaos. PrioSync does."**

An adaptive planning engine that continuously recalculates what should happen
next as real-world execution deviates from the original plan.

[![CI](https://img.shields.io/badge/CI-passing-brightgreen?style=for-the-badge&logo=github)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Tests](https://img.shields.io/badge/Tests-168%20passing-success?style=for-the-badge)](#tests)

<p>
  <a href="#quickstart">Quickstart</a> •
  <a href="#features">Features</a> •
  <a href="#how-to-use">How to Use</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#the-dsa-engine">DSA Engine</a> •
  <a href="#api-reference">API</a> •
  <a href="#deployment">Deployment</a>
</p>

</div>

---

## What is PrioSync?

PrioSync is an intelligent task planning and prioritization platform. Dump a
messy goal — *"placement prep, SQL + DSA left, assessment next week"* — and
PrioSync understands it, structures it into goals/projects/tasks, detects
dependencies, scores priorities **deterministically**, schedules the work, and
adapts when life happens.

The core principle: **AI understands the chaos; algorithms decide; MongoDB
remembers.** The LLM never sets priority, writes to the DB directly, or
schedules. It extracts; the engine decides.

### The problem it solves

Modern workers face an unprecedented volume of tasks. Studies show the
average knowledge worker juggles 50+ tasks and spends ~30% of their time just
deciding what to work on next. Traditional to-do lists fail because:

| Limitation | Problem | PrioSync's Solution |
|---|---|---|
| Manual priority | User assigns priority (subjective) | Algorithm calculates objectively |
| No time awareness | Deadline treated same as urgency | Deadline proximity weighted heavily |
| Ignores dependencies | Tasks attempted before prerequisites | DAG enforces dependency order |
| No complexity consideration | All tasks treated equally | Difficulty factor in scoring |
| No analytics | "Feels productive" without data | Dashboard with 10+ metrics |
| Static ranking | Priority set once, never updates | Real-time recalculation |

### Target users

| User | Benefit |
|---|---|
| Students | Manage assignments, exams, projects with automatic prioritization |
| Professionals | Organize daily work tasks, respect project dependencies |
| Project managers | Understand task criticality, manage team dependencies |
| Knowledge workers | Track productivity metrics, identify bottlenecks |
| Entrepreneurs | Prioritize business tasks without analysis paralysis |

---

## Features

### Smart Task Prioritization

Every task gets a deterministic priority score (0–100) computed from four
weighted factors. Scores update in real time whenever task parameters change.
Blocked tasks get a −20 penalty so they never surface as "do next."

- Priority tiers: **Critical** (80–100), **High** (60–79), **Medium** (35–59), **Low** (0–34)
- Every score ships an explanation object with signed factors ("Deadline pressure (+25) drives this score…")

### Dependency Management (DAG)

Tasks can depend on each other. A Directed Acyclic Graph (DAG) prevents
circular dependencies, finds valid execution order via topological sort, and
visualizes the full network as an interactive graph with critical-path and
bottleneck overlays.

### Brain Dump → Structured Plan

Type or paste a messy goal. The AI parser (or deterministic heuristic
fallback) extracts goals, projects, tasks, estimates, and constraints into a
Zod-validated structure. You review and confirm — the engine does the rest:
cycle-check dependencies, compute scores, run the greedy scheduler, snapshot
a plan version with computed health.

### Planning Intelligence

Beyond raw priority scores, PrioSync answers the decisions ordinary task
managers punt on — all computed, all explainable, no LLM in the loop:

- **Deadline risk** — LOW/MEDIUM/HIGH/CRITICAL with a 0–100 score where every point traces to a named factor
- **Critical path + bottlenecks** — longest duration chain, ranked gates with downstream hours, blocked-work ledger
- **Capacity** — planned vs usable hours with four priced relief options (never applied silently)
- **What-if simulation** — move deadlines, drop tasks, or change capacity on cloned rows; reports current vs scenario risk
- **Calibration** — actual ÷ estimated from timed focus sessions (min 3 samples, clamped 0.5–3x), feeding risk, capacity, and path durations
- **Deviation detection** — overruns, missed deadlines, and near-term blocked work as evidence objects
- **Auto-replan proposals** — top deviation becomes a trigger, recovery moves are priced (risk before/after), stored as a PROPOSED plan version; applying stays an explicit user action
- **Reality drift** — repeated postponement, chronic per-category underestimation, fragmented sessions, each with evidence and one concrete adjustment
- **Context-aware ordering** — Kahn's algorithm over dependencies balancing priority against switching cost
- **Energy-matched day plans** — work thirds mapped to your rhythm, overflow listed not crammed
- **Scope control** — original vs current, added/removed/deadline moves with growth math
- **Commitments** — typed promises with an at-risk listing
- **Best Next Move** — feasibility filter plus 8-factor deterministic impact over the dependency graph, with why-this / why-not tradeoffs
- **Plan resilience** — 6 perturbations, recovery margin, delay tolerance, sensitivity ladder, named failure points
- **Constraint resolution** — impossible-plan detection with priced escapes (advice only, never applied)
- **Recovery plans** — interruption/deadline/dependency triggers priced into compared recoveries
- **Goal traceability** — Goal → Project → Task → Subtask tree with orphan work, starved goals, low-impact completions
- **Progress efficiency** — completed volume vs goal-critical contribution, stated factually
- **Plan debt** — postponed work, repeated skips, compressed sessions, unresolved dependencies
- **Uncertainty ranges** — p25/p75 estimate ranges from your own timed history
- **Multi-project allocation** — daily capacity split by deadline demand, risk, and continuity (advice only)

### Focus Mode

A dedicated focus environment with a state machine timer (idle → running ↔
paused → done), planned-length pills, session notes, fullscreen timer,
Space/F keyboard shortcuts, visibility auto-pause, and Skip/Snooze next to
Start. Sessions feed calibration and plan-debt tracking.

### Real-Time Dashboard

Top priority tasks, productivity metrics, completion charts, productivity
trends, and an "Am I on track?" strip (risk, bottleneck, capacity, plan debt)
— all updating live.

### Advanced Analytics

- Productivity score (60% completion + 20% task creation + 20% focus time)
- Completion velocity (tasks completed per week)
- Streak (consecutive days with completed tasks)
- Focus sessions (total hours spent in deep work)
- Category performance and priority distribution

---

## How to Use

This section walks through using PrioSync end to end, from signup to advanced
planning.

### 1. Sign Up / Sign In

Create an account with your email and password. Passwords are hashed with
bcrypt (cost factor 12). After login you land on the Dashboard.

- The auth page has a Sign In / Sign Up toggle
- Password strength indicator shows during registration
- Forgot password link for login mode

### 2. Dashboard — "Am I on track?"

The dashboard is your command center:

- **Top tasks** — the 5 highest-priority pending tasks, fetched from the Max Heap
- **Stat cards** — completion rate, overdue count, focus hours, productivity score
- **Charts** — weekly activity (bar), completion rate (donut), productivity trend (line)
- **Risk strip** — deadline risk level, primary bottleneck, capacity status, plan debt — each clicking through to details

### 3. Tasks — Create and Manage

- Click **Add Task** to create a task with title, importance (1–5), urgency
  (1–5), difficulty (1–5), deadline, estimated minutes, energy fit, category,
  and commitment type
- The engine computes the priority score instantly on create
- Edit, complete, or delete tasks — changes trigger rescore and cache bust
- Each task card shows its priority tier badge and can expand to show the
  signed factor breakdown behind its score
- Blocked tasks show a "blocked" chip computed from dependency statuses

### 4. Dependencies — Visualize Your Work

- The dependency graph renders all tasks as nodes with directed edges
- Critical-path nodes get a dashed ring; the primary bottleneck gets a red
  ring + tag
- Add dependencies between tasks (cycle-rejecting — circular deps are blocked)
- The legend explains the overlays

### 5. Planner — Brain Dump to Plan

- Type or paste a messy goal in natural language
- The AI parser (or heuristic fallback) extracts goals, projects, tasks,
  estimates, and constraints into a structured, validated plan
- Review the extracted plan, edit anything, then confirm
- The engine creates everything transactionally: DAG cycle check →
  deterministic scores → greedy schedule → computed health → plan version
  snapshot
- View auditable plan history (version, proposed/applied state, trigger,
  reason, risk before/after, moves)
- Use the read-only what-if panel to simulate scenarios (move deadlines, drop
  tasks, change capacity) and see affected sets, bottleneck shifts, and
  mitigations

### 6. Focus — Deep Work Sessions

- **What's Next?** recommends the single best task right now based on
  feasibility (not blocked, within your time budget), energy match, and the
  8-factor deterministic impact over the dependency graph — with why-this /
  why-not tradeoffs on the winner and every alternate
- **Start** a focus session on the recommended (or any) task
- **Pause/Resume** — pause time is excluded from elapsed duration
- **Skip** promotes the first alternate (recorded as prefer-first)
- **Snooze** pushes the deadline 24h and re-ranks
- **Day plan** section orders the selected window into energy periods
  (morning/afternoon/evening from your rhythm)
- **Deviations card** proposes recovery plans that the replan banner applies
- Session notes, fullscreen timer, and Space/F keyboard shortcuts
- Sessions feed calibration (actual ÷ estimated) and plan-debt tracking

### 7. Profile — Follow-Through

- **Planning rhythm editor** — set your daily capacity (minutes/day), work
  start/end, and energy levels for morning/afternoon/evening
- **AI narration consent** — toggle AI narration on or off (deterministic
  text is always served regardless)
- **Follow-through card** — recommendation adherence from accepted/overridden
  history (hidden until data exists)

### 8. Missed Work — Replan

When life happens and work slips:

- The system detects overdue/incomplete tasks
- It proposes a day-packed recovery with per-day impact (read-only)
- You accept or edit the proposal — accepting writes `TASK_RESCHEDULED` events
  and a new plan snapshot
- Nothing moves silently; the decision log records every accept/override

---

## Product Loop

```
Brain dump → AI parse (structured, validated) → confirm → dependency graph
→ deterministic priority → schedule + plan health → Focus ("What's Next?",
available-time, energy) → execute → miss? propose replan (you accept)
→ events logged → decision log + adherence → analytics
```

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Brain Dump  │────▶│  AI Parser    │────▶│  Confirm    │
│  (messy text)│     │  (Zod-validated)│    │  (you edit) │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
┌─────────────┐     ┌──────────────┐            ▼
│   Execute   │◀────│   Replan     │◀───┌───────────────┐
│  (Focus)    │     │  (you accept)│    │  Engine Decides │
└──────┬──────┘     └──────────────┘    │  Scores+Schedule│
       │                                 └───────────────┘
       ▼
┌─────────────┐     ┌──────────────┐
│   Events    │────▶│  Analytics    │
│  (logged)   │     │  + Adherence  │
└─────────────┘     └──────────────┘
```

---

## Architecture

### System map

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER (Client)                     │
│  React 19 + Vite 7 + Tailwind 4                              │
│  Dashboard / Tasks / Dependencies / Planner / Focus / Profile │
│  AuthContext (global auth state) · useTasks hook              │
│  Axios HTTP client with JWT interceptor                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (JWT Bearer token)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              NODE.JS / EXPRESS SERVER (Backend)               │
│  Express 4 · Zod 3 · Helmet 8 · JWT + bcryptjs                │
│                                                               │
│  routes/     ── thin: auth guard → Zod validate → controller  │
│  controllers/── thin: shape HTTP in/out                       │
│  services/  ── orchestration + events                         │
│  repositories/── Mongoose queries only                        │
│  dsa-engine/── pure deterministic algorithms, no I/O           │
│  ai/ planner/── understanding (LLM/heuristic) + computed health │
│  cache/ jobs/── Redis + BullMQ (optional, inline fallback)     │
│  models/     ── Mongoose schemas (User, Task, Goal, Project,   │
│               ·  TaskEvent, WorkSession, PlanVersion)          │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│   MongoDB (Atlas     │
│   or local)          │
│   users · tasks      │
│   goals · projects   │
│   taskEvents         │
│   workSessions       │
│   planVersions       │
└─────────────────────┘
           │
           ▼ (optional)
┌─────────────────────┐
│   Redis (optional)   │
│   cache-aside +      │
│   BullMQ recalc queue │
└─────────────────────┘
```

### Layering rules

Controllers never touch queries; repositories never touch the engine; the engine
never touches I/O. Mutations record a `TaskEvent` document alongside every write.

---

## The DSA Engine

The deterministic engine is the heart of PrioSync. Four data structures and
algorithms work together to turn a chaotic task list into an executable plan.

### Priority Scoring Algorithm

```
Priority Score (0–100) =
  (Urgency × 0.30 + Importance × 0.25 + DeadlineBonus × 0.25 + EaseBonus × 0.20) × 20

  - 20 if task has incomplete blocking dependencies
```

| Factor | Weight | Rationale |
|---|---|---|
| Urgency | 30% | Time-sensitive tasks must be prioritized |
| Importance | 25% | Long-term value matters but less than urgency |
| Deadline proximity | 25% | Objective time factor prevents information loss |
| Ease (6 − difficulty) | 20% | Small tasks clear blockers and build momentum |

**Deadline bonus scoring:**

| Time to deadline | Bonus score |
|---|---|
| Overdue or < 6 hours | 5.0 (critical) |
| < 24 hours | 4.5 (very high) |
| < 72 hours | 4.0 (high) |
| < 1 week | 3.0 (medium) |
| < 2 weeks | 2.0 (low) |
| < 1 month | 1.5 (very low) |
| else | 1.0 (minimal) |

**Worked example:**

> Task: "Prepare presentation for client meeting"
> Urgency=5, Importance=4, Deadline=24h away, Difficulty=4

```
Urgency:      5 × 0.30 = 1.50
Importance:   4 × 0.25 = 1.00
Deadline:     4.5 × 0.25 = 1.125
Ease (6−4):   2 × 0.20 = 0.40
Subtotal:     4.025
Final score:  4.025 × 20 = 80.5  →  CRITICAL
```

### Max Heap — Priority Queue

A binary Max Heap gives O(1) retrieval of the top-priority task and O(log n)
insert/extract. When a user asks "What should I do now?", the heap root is the
answer instantly.

| Operation | Complexity |
|---|---|
| `peek()` | O(1) |
| `insert()` | O(log n) |
| `extractMax()` | O(log n) |
| `heapify()` | O(n) |
| `extractAll()` | O(n log n) |

### DAG — Dependency Management

A Directed Acyclic Graph prevents circular dependencies and finds valid
execution order. When a user adds a dependency, DFS-based cycle detection
runs from the target to see if it can reach the source — if so, the edge is
rejected. Topological sort (Kahn's algorithm) produces a valid execution
order in O(V+E).

### Greedy Scheduler

Combines priority scores with dependency constraints: build the DAG, run
topological sort, compute scores with dependency penalties, heap the tasks,
and extract in priority order while filtering to executable (non-blocked)
tasks. The greedy choice property holds: choosing the top priority now leads
to the optimal work order given constraints.

| Structure | Use | Complexity |
|---|---|---|
| Weighted scorer | Multi-factor score, −20 if blocked | O(1) |
| MaxHeap | Top-N retrieval | insert/extract O(log n) |
| DAG | Deps, DFS cycle guard, Kahn topo sort, unlock-impact BFS | O(V+E) |
| Greedy scheduler | Heap order over engine scores | O(V log V + E) |

---

## AI Layer (Optional, Narrates — Never Decides)

The AI layer understands your messy input; it never makes decisions.

```
User → Brain dump → AI Parser → {goals, tasks, constraints} (Zod-validated)
                                        ↓
              Dependency engine → Priority engine → Scheduler → Plan + health
```

The model may not emit scores, ranks, schedules, SQL, or commands; user text
is data (prompt-injection clause in the parser prompt). Failures are typed
502s with a heuristic fallback path — never silent degradation.

**Pollinations** backs four endpoints under `/api/v2/ai`:
- `status` — AI configuration status
- `scenario-intent` — NL → validated scenario mutations (never applied)
- `focus-brief` — fact-locked 2–3 sentence brief
- `session-reflection` — fact-locked reflection on one session
- `smart-notes` — rough notes → summary + action items

Every narration is fact-locked against engine numbers (any mismatch falls back
to a deterministic template). Without a key, everything degrades to the
deterministic path — verified by test and by live failure drill.

---

## Quickstart

### Option A — Full Stack with Docker (recommended, runs offline)

```bash
docker compose up --build
# web → http://localhost:8081
# api → http://localhost:5000/api/health
```

Docker Compose spins up:
- **MongoDB 7** (local container, not Atlas)
- **Redis 7** (local container)
- **API** (Node.js Express server)
- **Web** (Vite-built React app served by nginx)

### Option B — Local Dev

**Server:**

```bash
cd server
cp .env.example .env   # fill MONGO_URI (Atlas or local), JWT_SECRET
npm install
npm run dev            # starts on :5000
```

**Client (second terminal):**

```bash
cd client
npm install
npm run dev            # http://localhost:5173 (proxies /api to :5000)
```

> Set `VITE_API_URL` in `client/.env.local` to override the proxy target.

### Tests

<a id="tests"></a>

```bash
# Server
cd server
npm test          # unit only — no network, always safe (161 tests)

# Client
cd client
npm test          # 7 client lib tests (vitest, node env)
npm run lint      # ESLint
npm run build     # production build (~10s, 2453 modules)
```

**Test results:** 161 unit + 7 client = **168 passing**.

---

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | API port (default 5000) |
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | No | Token expiry (default 7d) |
| `NODE_ENV` | No | `production` / `development` |
| `CLIENT_URL` | Yes | Allowed frontend origins (comma-separated) |
| `REDIS_URL` | No | Redis connection (optional, degrades gracefully) |
| `RATE_LIMIT_AUTH_MAX` | No | Auth rate limit per minute per IP (default 60) |
| `LLM_API_KEY` | No | OpenAI-compatible key for brain-dump parsing |
| `LLM_MODEL` | No | Model name (e.g. `gpt-4o-mini`) |
| `LLM_BASE_URL` | No | OpenAI-compatible endpoint |
| `POLLINATIONS_API_KEY` | No | Pollinations key for AI narration layer |
| `POLLEN_API` | No | Shorthand for Pollinations key |
| `POLLINATIONS_BASE_URL` | No | Pollinations endpoint |
| `AI_MODEL` | No | Pollinations model (must be in allowlist) |
| `LOG_LEVEL` | No | Pino log level (default info) |
| `SLOW_REQUEST_MS` | No | Slow request threshold (default 1000) |

### Client (`client/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api` | API base URL |
| `VITE_PROXY_TARGET` | `http://localhost:5000` | Dev proxy target |

---

## API Reference

Base URL: `/api`. JSON only. Two auth systems coexist during migration:

- **v1** (`/api/auth`, `/api/tasks`): MongoDB JWT — the SPA no longer calls these
- **v2** (`/api/v2/*`): MongoDB JWT — the SPA's only API surface

### v2 Auth

| Method | Path | Body |
|---|---|---|
| POST | `/api/v2/auth/register` | `{name, email, password}` → `{token, user}` |
| POST | `/api/v2/auth/login` | `{email, password}` → `{token, user}` |
| GET | `/api/v2/auth/me` | current user |
| PUT | `/api/v2/auth/profile` | partial user fields |

### v2 Tasks

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/tasks` | list with filters |
| POST | `/api/v2/tasks` | create with auto-scored priority |
| GET | `/api/v2/tasks/:id` | single task |
| PUT | `/api/v2/tasks/:id` | update (with optimistic concurrency via `version`) |
| DELETE | `/api/v2/tasks/:id` | cascade deps; history rows survive |
| GET | `/api/v2/tasks/:id/explain` | score breakdown with signed factors |
| PUT | `/api/v2/tasks/:id/dependencies` | full-replace deps (cycle-rejecting) |
| GET | `/api/v2/tasks/top` | cached 60s, blocked excluded |
| GET | `/api/v2/tasks/stats` | cached 120s, counts/tiers/overdue |
| GET | `/api/v2/tasks/dag` | nodes/edges for graph view |
| GET | `/api/v2/tasks/next` | What's Next recommendation + alternates |
| POST | `/api/v2/tasks/recalc` | BullMQ job or inline recalc |
| POST | `/api/v2/tasks/focus-session` | log a focus session |

### v2 Planner

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v2/planner/parse` | brain dump → structured plan (read-only) |
| POST | `/api/v2/planner/confirm` | create everything transactionally |

### v2 Insights (read-only unless noted)

20+ endpoints under `/api/v2/insights/*` covering risk, critical-path,
bottlenecks, capacity, simulation, deviations, drift, calibration,
auto-replan, context-order, day-plan, scope, commitments, resilience,
resolve, recovery, traceability, efficiency, plan-debt, allocation.

### v2 AI

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/ai/status` | configuration status |
| POST | `/api/v2/ai/scenario-intent` | NL → validated scenario mutations |
| POST | `/api/v2/ai/focus-brief` | fact-locked brief |
| POST | `/api/v2/ai/session-reflection` | fact-locked reflection |
| POST | `/api/v2/ai/smart-notes` | rough notes → summary + action items |

Full API reference: see [`docs/API.md`](docs/API.md).

---

## Database

### MongoDB (MERN stack)

Seven collections via Mongoose (`server/models/`):

- **`users`** — auth credentials, profile, preferences sub-document (planner rhythm), embedded `focusSessions[]` (v1 compatibility).
- **`tasks`** — full v2 task shape: importance/urgency/difficulty/friction 1–5, `estimatedMinutes`, `deadline`, `status`, `dependencies[]` (ObjectId refs), `priorityScore/Tier`, `energyFit`, `commitmentType`, `stakeholder`, `version` (optimistic concurrency), `goalId`, `projectId`, `parentTaskId`.
- **`goals`** — high-level outcomes created by the planner, scoped to a user.
- **`projects`** — task groupings under optional goals.
- **`taskevents`** — append-only audit trail powering analytics, adherence, drift, and the decision log.
- **`worksessions`** — normalized focus sessions (calibration, deviation detection, plan-debt).
- **`planversions`** — versioned planner/replan snapshots with computed health and ordered item list.

Hot indexes on `tasks`: `{owner, priorityScore}`, `{owner, status}`, `{owner, deadline}`, `{owner, goalId}`, `{owner, projectId}`.

Full database docs: see [`docs/DATABASE.md`](docs/DATABASE.md).

---

## Project Structure

```
PrioSync/
├── client/                  # React 19 + Vite 7 frontend
│   ├── src/
│   │   ├── api/             # HTTP client
│   │   ├── components/      # UI components (TaskCard, charts, graphs, icons)
│   │   ├── context/        # AuthContext (global auth state)
│   │   ├── hooks/          # useTasks hook
│   │   ├── lib/            # focusSession + notificationPolicy (tested)
│   │   ├── pages/          # Landing, Auth, Dashboard, Tasks, Dependencies,
│   │   │                   #   Planner, Focus, Profile, NotFound
│   │   ├── services/       # API services (auth, tasks, v2, ai, insights)
│   │   ├── fonts/          # Chillax (brand wordmark only)
│   │   └── index.css      # Tailwind 4 + design tokens
│   ├── Dockerfile          # multi-stage build → nginx
│   ├── nginx.conf          # SPA routing + API proxy
│   └── vite.config.js      # dev proxy to :5000
│
├── server/                  # Node.js Express 4 backend
│   ├── ai/                 # AI layer (provider, narrator, intents, parser)
│   ├── cache/              # Redis cache-aside (optional)
│   ├── config/             # DB config
│   ├── controllers/        # thin HTTP shaping
│   ├── db/                 # (empty — no SQL layer)
│   ├── models/             # Mongoose schemas (User, Task, Goal, Project,
│   │                       #   TaskEvent, WorkSession, PlanVersion)
│   ├── dsa-engine/         # pure algorithms: priority, heap, DAG, scheduler
│   ├── jobs/               # BullMQ workers (optional)
│   ├── middleware/         # auth, errorHandler, observability, rateLimit
│   ├── models/             # Mongoose models (v1 legacy)
│   ├── planner/            # 18 planning-intelligence engines
│   ├── repositories/       # raw SQL only
│   ├── routes/             # v1 + v2 route definitions
│   ├── services/           # orchestration + transactions
│   ├── tests/              # 24 test files (161 unit + PG integration)
│   ├── validators/         # Zod schemas
│   ├── utils/              # logger (Pino), metrics
│   └── index.js            # entry point
│
├── docs/                    # Architecture, API, Database, Design System docs
├── .github/workflows/       # CI (server unit tests + client lint/build)
├── docker-compose.yml       # full local stack (MongoDB + Redis + API + web)
└── README.md                # this file
```

---

## Design System

PrioSync follows a calm, dark, focused aesthetic with high information
density and minimal decoration.

### Typography

| Role | Font | Usage |
|---|---|---|
| UI / body | Inter 400–800 | Dashboards, tables, numbers, forms |
| Headings | Plus Jakarta Sans 600–800 | Page titles, feature headings |
| Technical data | IBM Plex Mono 400–600 | Scores, timers, IDs, durations |
| Brand only | Chillax | The "PrioSync" wordmark. Nothing else. |

### Color

- **Brand:** Orange `#FC703C`, Cherry `#5D0703`
- **Surfaces:** Cream `#F4F3E6`, Dark `#2B1B17`, Ink `#1F1F1F`
- **Priority tiers:** Critical `#ef4444`, High `#f97316`, Medium `#eab308`, Low `#22c55e`
- **Status:** Completed `#22c55e`, In-progress `#FC703C`, Pending `#EEA175`

### Principles

One screen answers one decision. No giant gradients, no glassmorphism piles,
no neon, no sparkle confetti. Icons come only through `PrioIcon.jsx` (locally
vendored Tabler/Simple Icons). Copy follows numbers over adjectives.

Full design system: see [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

---

## Tech Stack

### Server

- **Runtime:** Node.js ≥20, ESM
- **Framework:** Express 4
- **Database:** MongoDB via Mongoose 8 (Atlas in prod, local container with Docker)
- **Cache/Jobs:** Redis 7 via `ioredis` 5 + BullMQ 5 (both optional)
- **Validation:** Zod 3
- **Security:** Helmet 8, JWT, bcryptjs
- **Logging:** Pino 9 + pino-http
- **Dev:** Nodemon, Vitest, cross-env

### Client

- **Framework:** React 19
- **Build:** Vite 7
- **Styling:** Tailwind CSS 4
- **Routing:** React Router 7
- **HTTP:** Axios
- **Charts:** Recharts 3
- **Notifications:** react-hot-toast
- **Icons:** Locally vendored Tabler icons behind `PrioIcon`
- **Fonts:** Inter, Plus Jakarta Sans, IBM Plex Mono, Chillax (local)

### Infrastructure

- **Database:** MongoDB 7 (Atlas in prod, local container with Docker)
- **Cache:** Redis 7 (optional)
- **Containerization:** Docker + Docker Compose
- **CI:** GitHub Actions (server unit tests, client lint + build)
- **Web server:** nginx (production client serving + API proxy)

---

## Deployment

### Docker (production-parity)

```bash
docker compose up --build
docker compose exec api node db/verify.js --apply
```

Services: Postgres 16, Redis 7, API (Node), Web (nginx).

### Manual deployment

**Server** (Render, Railway, Fly.io, or any Node host):
- Set environment variables from `server/.env.example`
- `npm ci --omit=dev && npm start`

**Client** (Vercel, Netlify, or any static host):
- Set `VITE_API_URL` to your API URL
- `npm ci && npm run build`
- Serve the `dist/` folder
- The included `nginx.conf` handles SPA routing + API proxy for self-hosting

---

## Observability

- **Pino JSON logs** with secret redaction
- Per-route latency/error counters
- MongoDB query latency (slow >200ms logged)
- Cache hit/miss, job outcomes, AI calls
- All metrics at `GET /api/metrics` (Prometheus text format)

### Observed performance (measured, not claimed)

| Measurement | Value | Context |
|---|---|---|
| MongoDB round-trip | ~50ms | Atlas M0 free tier |
| Register latency | ~1.5s | bcrypt-12 dominates (honestly flagged `slow`) |
| Unit suite | ~4s | 161 tests, no network |
| Client lib tests | <1s | 7 tests |
| `vite build` | ~10s | 2453 modules |
| Docker images | api 292MB, web 97MB | `npm ci --omit=dev`, nginx static |

---

## Roadmap

1. Time-aware scheduling (clock-time slots in plan items)
2. Redis sliding-window limits, reminder jobs, planner-AI background path
3. Component tests once UI logic outgrows fetch wrappers
4. Per-project/tag calibration splits
5. Planning risk snapshots collection fed by the BullMQ recalc worker

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes following the design system and layering rules
4. Run tests: `cd server && npm test` and `cd client && npm run lint && npm run build`
5. Commit with a clear message
6. Open a pull request

**Layering rules:** Controllers never touch queries; repositories never touch the
engine; the engine never touches I/O. Mutations record a TaskEvent alongside every write.

**Design rules:** Follow `docs/DESIGN_SYSTEM.md`. Icons only through
`PrioIcon.jsx`. Copy follows `docs/PRODUCT_WRITING_GUIDELINES.md` (numbers over
adjectives).

---

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, flows, DSA engine, AI/deterministic split, tradeoffs, performance
- [`docs/DATABASE.md`](docs/DATABASE.md) — Mongo schema (legacy), Postgres schema + ER diagram, indexes, migration runbook
- [`docs/API.md`](docs/API.md) — full v1 + v2 endpoint reference
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — typography, color, shape, principles
- [`docs/EXTERNAL_TOOLS.md`](docs/EXTERNAL_TOOLS.md) — external tool audit and decisions
- [`docs/PRODUCT_WRITING_GUIDELINES.md`](docs/PRODUCT_WRITING_GUIDELINES.md) — copy guidelines
- [`docs/OPEN_SOURCE_NOTICES.md`](docs/OPEN_SOURCE_NOTICES.md) — open source license notices
- [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) — original academic write-up (historical; code is source of truth)

---

## License

MIT — see [LICENSE](LICENSE).
