# Database

PrioSync uses **MongoDB** (via Mongoose 8) as its single database for both the
legacy v1 routes and the full v2 feature set.

## Collections

### `users`
Fields: `name`, `email` (unique, lowercase), `password` (bcrypt-12, `select:false`),
`avatar`, `productivityScore`, `tasksCompleted`, `tasksCreated`,
`preferences` (embedded sub-document — see below), `focusSessions[]` (v1
embedded log, capped at 200 in code), `lastFocusAt`, timestamps.

**Preferences sub-document** (planner rhythm):
`availableMinutesPerDay` (15–960, default 240), `workStart`/`workEnd` ("HH:MM"),
`defaultEnergy`/`energyMorning`/`energyAfternoon`/`energyEvening` (low/normal/high),
`aiNarration` (boolean, consent for AI narration).

### `tasks`
Full v2 shape. Fields: `owner` (→ users, indexed), `title` (≤150), `description` (≤2000),
`deadline` (nullable), `importance`/`urgency`/`difficulty`/`friction` (1–5),
`estimatedMinutes` (1–10080, default 30), `status` (pending/in-progress/completed/cancelled),
`dependencies[]` (ObjectId refs → tasks — the DAG edge list), `priorityScore` (0–100),
`priorityTier` (critical/high/medium/low), `category` (≤50), `energyFit` (low/normal/high),
`commitmentType` (personal/team/client/academic/deadline), `stakeholder`,
`projectId`/`goalId`/`parentTaskId` (nullable refs), `scheduledStart`/`scheduledEnd`,
`completedAt`, `version` (optimistic concurrency — PUT compares; mismatch → 409), timestamps.

Indexes: `{owner, priorityScore}`, `{owner, status}`, `{owner, deadline}`,
`{owner, goalId}`, `{owner, projectId}`.

### `goals`
Fields: `user` (→ users), `title` (≤150), `description`, `deadline`, `status`
(active/completed/cancelled), timestamps. Created by the planner confirm flow.

### `projects`
Fields: `user` (→ users), `goal` (nullable → goals), `title` (≤150), `description`,
`status`, timestamps.

### `taskevents`
Append-only audit trail. Fields: `user` (→ users), `task` (nullable → tasks — null
when the task is deleted so history survives), `eventType` (string — see list below),
`payload` (Mixed), timestamps.

Event types: `TASK_CREATED`, `TASK_UPDATED`, `TASK_COMPLETED`, `TASK_STARTED`,
`TASK_REOPENED`, `TASK_DELETED`, `PRIORITY_CHANGED`, `DEADLINE_CHANGED`,
`DEPENDENCY_ADDED`, `DEPENDENCY_REMOVED`, `TASK_RESCHEDULED`, `PLAN_CREATED`,
`PLAN_UPDATED`, `PLAN_OVERRIDDEN`, `RECOMMENDATION_SHOWN`,
`RECOMMENDATION_ACCEPTED`, `RECOMMENDATION_OVERRIDDEN`, `FOCUS_STARTED`,
`FOCUS_COMPLETED`, `FOCUS_SKIPPED`.

Index: `{user, createdAt: -1}` (hot read path for drift/log queries).

### `worksessions`
Normalized focus sessions (calibration, deviation detection, plan-debt).
Fields: `user` (→ users), `task` (nullable → tasks), `startedAt`, `endedAt`,
`durationSeconds`, `completed`, `plannedSeconds` (nullable), `pausedSeconds`
(default 0), `note`, timestamps.

Index: `{user, endedAt: -1}`.

### `planversions`
Versioned planner/replan snapshots. Fields: `user` (→ users), `goal` (nullable → goals),
`healthScore` (0–100), `healthDetails` (Mixed — computed health object; proposal state
for auto-replan), `reason`, `items[]` (`{task, position}`), timestamps.

## No schema migrations needed

Mongoose handles schema evolution with `default` values and optional fields.
New optional fields (e.g. adding `friction`, `energyFit`, `preferences`) are
automatically null/default on existing documents — no migration scripts required.

## Atlas / local setup

**Atlas (production):**
```
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/priosync?retryWrites=true&w=majority
```
No setup step — Mongoose auto-creates collections on first write.

**Local Docker:**
```bash
docker compose up --build     # starts MongoDB 7, Redis, API, web
```
MongoDB is available at `mongodb://mongo:27017/priosync` inside the compose network.

**Local dev (no Docker):**
```bash
brew install mongodb-community@7   # macOS
# or: https://www.mongodb.com/try/download/community
mongod --dbpath /data/db           # start mongo locally
# then set: MONGO_URI=mongodb://localhost:27017/priosync
```
