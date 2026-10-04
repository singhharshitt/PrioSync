-- PrioSync V2 — PostgreSQL schema (Neon-compatible)
-- Applied idempotently via `node db/verify.js --apply`.
-- Decisions documented inline. UUID PKs, FKs, CHECKs, partial indexes on hot paths.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id TEXT UNIQUE, -- migration map: original Mongo ObjectId, NULL for native PG users
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  avatar_url TEXT,
  productivity_score SMALLINT NOT NULL DEFAULT 0 CHECK (productivity_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users(email);

-- ---------------------------------------------------- user_preferences
-- Holds planner constraints (availableMinutesPerDay, work window, energy default).
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available_minutes_per_day SMALLINT NOT NULL DEFAULT 240
    CHECK (available_minutes_per_day BETWEEN 15 AND 960),
  work_start TIME,
  work_end TIME,
  default_energy TEXT NOT NULL DEFAULT 'normal'
    CHECK (default_energy IN ('low','normal','high')),
  energy_morning TEXT NOT NULL DEFAULT 'high'
    CHECK (energy_morning IN ('low','normal','high')),
  energy_afternoon TEXT NOT NULL DEFAULT 'normal'
    CHECK (energy_afternoon IN ('low','normal','high')),
  energy_evening TEXT NOT NULL DEFAULT 'low'
    CHECK (energy_evening IN ('low','normal','high')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- goals
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
  description TEXT NOT NULL DEFAULT '',
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_goals_user ON goals(user_id, status);

-- -------------------------------------------------------------- projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_projects_user_goal ON projects(user_id, goal_id);

-- ----------------------------------------------------------------- tasks
-- parent_task_id covers subtasks without an extra table.
-- version enables optimistic concurrency (PUT requires version, 409 on stale).
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id TEXT UNIQUE, -- migration map
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in-progress','completed','cancelled')),
  importance SMALLINT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  urgency SMALLINT NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
  difficulty SMALLINT NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  friction SMALLINT NOT NULL DEFAULT 3 CHECK (friction BETWEEN 1 AND 5),
  estimated_minutes INT NOT NULL DEFAULT 30 CHECK (estimated_minutes BETWEEN 1 AND 10080),
  deadline TIMESTAMPTZ,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  priority_score SMALLINT NOT NULL DEFAULT 0 CHECK (priority_score BETWEEN 0 AND 100),
  priority_tier TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority_tier IN ('critical','high','medium','low')),
  energy_fit TEXT NOT NULL DEFAULT 'normal'
    CHECK (energy_fit IN ('low','normal','high')),
  category TEXT NOT NULL DEFAULT 'General',
  commitment_type TEXT NOT NULL DEFAULT 'personal'
    CHECK (commitment_type IN ('personal','team','client','academic','deadline')),
  stakeholder TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (scheduled_end IS NULL OR scheduled_start IS NULL OR scheduled_end > scheduled_start),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);
-- Hot paths only: user-scoped lists, priority feed (active only), overdue scan.
CREATE INDEX IF NOT EXISTS ix_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS ix_tasks_user_priority ON tasks(user_id, priority_score DESC)
  WHERE status IN ('pending','in-progress');
CREATE INDEX IF NOT EXISTS ix_active_task_deadlines ON tasks(deadline)
  WHERE status <> 'completed';
CREATE INDEX IF NOT EXISTS ix_tasks_project ON tasks(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- ----------------------------------------------------- task_dependencies
-- Replaces Mongo dependencies[] array. Composite PK prevents duplicate edges.
CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);
CREATE INDEX IF NOT EXISTS ix_dep_depends_on ON task_dependencies(depends_on_task_id, task_id);

-- -------------------------------------------------------------- task_tags
CREATE TABLE IF NOT EXISTS task_tags (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (char_length(tag) BETWEEN 1 AND 40),
  PRIMARY KEY (task_id, tag)
);

-- ------------------------------------------------------------ task_events
-- Append-only history powering analytics, overrides, replans. task_id SET NULL
-- so history survives task deletion.
CREATE TABLE IF NOT EXISTS task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN
    ('TASK_CREATED','TASK_UPDATED','TASK_STARTED','TASK_COMPLETED','TASK_REOPENED',
     'TASK_DELETED','PRIORITY_CHANGED','DEADLINE_CHANGED','DEPENDENCY_ADDED',
     'DEPENDENCY_REMOVED','TASK_RESCHEDULED','PLAN_CREATED','PLAN_UPDATED','PLAN_OVERRIDDEN',
     'RECOMMENDATION_SHOWN','RECOMMENDATION_ACCEPTED','RECOMMENDATION_OVERRIDDEN',
     'FOCUS_STARTED','FOCUS_COMPLETED','FOCUS_SKIPPED')),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_events_user_time ON task_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_events_task ON task_events(task_id, created_at DESC)
  WHERE task_id IS NOT NULL;

-- ---------------------------------------------------------- work_sessions
-- Normalized out of Mongo users.focusSessions[] for SQL aggregation.
CREATE TABLE IF NOT EXISTS work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_seconds INT NOT NULL CHECK (duration_seconds > 0),
  completed BOOLEAN NOT NULL DEFAULT false,
  CHECK (ended_at > started_at)
);
CREATE INDEX IF NOT EXISTS ix_sessions_user_end ON work_sessions(user_id, ended_at DESC);

-- ---------------------------------------------------------- plan_versions
-- Versioned scheduler output. health_details = {checks:[], warnings:[]} (computed, not LLM).
CREATE TABLE IF NOT EXISTS plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  health_score SMALLINT CHECK (health_score BETWEEN 0 AND 100),
  health_details JSONB NOT NULL DEFAULT '{}',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_plans_user_time ON plan_versions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS plan_items (
  plan_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  position INT NOT NULL CHECK (position >= 0),
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  PRIMARY KEY (plan_id, task_id)
);

-- NOTE: productivity_metrics intentionally NOT a table yet.
-- Serve dashboard from CTE/window views first; materialize only if
-- EXPLAIN ANALYZE proves the aggregation is slow.
