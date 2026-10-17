-- Phase 4 (Focus 2.0): session planning metadata + AI narration consent.
-- Idempotent: safe to run multiple times (IF NOT EXISTS guards).

ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS planned_seconds INT,
  ADD COLUMN IF NOT EXISTS paused_seconds INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sessions_planned') THEN
    ALTER TABLE work_sessions ADD CONSTRAINT chk_sessions_planned CHECK (
      planned_seconds IS NULL OR planned_seconds > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sessions_paused') THEN
    ALTER TABLE work_sessions ADD CONSTRAINT chk_sessions_paused CHECK (
      paused_seconds >= 0);
  END IF;
END $$;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS ai_narration BOOLEAN NOT NULL DEFAULT true;
