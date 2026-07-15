ALTER TABLE interview_sessions ADD COLUMN owner_hash TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_interview_sessions_owner_updated
  ON interview_sessions(owner_hash, updated_at DESC);
