-- Phase 3: energy-aware scheduling + commitment tracking.
-- Idempotent: safe to run multiple times (IF NOT EXISTS + constraint guards).

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS energy_morning TEXT NOT NULL DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS energy_afternoon TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS energy_evening TEXT NOT NULL DEFAULT 'low';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_energy_periods') THEN
    ALTER TABLE user_preferences ADD CONSTRAINT chk_user_energy_periods CHECK (
      energy_morning IN ('low','normal','high') AND
      energy_afternoon IN ('low','normal','high') AND
      energy_evening IN ('low','normal','high'));
  END IF;
END $$;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS commitment_type TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS stakeholder TEXT NOT NULL DEFAULT '';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_task_commitment') THEN
    ALTER TABLE tasks ADD CONSTRAINT chk_task_commitment CHECK (
      commitment_type IN ('personal','team','client','academic','deadline'));
  END IF;
END $$;
