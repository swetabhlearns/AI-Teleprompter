CREATE TABLE IF NOT EXISTS beta_feedback (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  kind TEXT NOT NULL,
  sentiment TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  mode TEXT NOT NULL DEFAULT '',
  activity_id TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  page_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_received_at
  ON beta_feedback(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_owner_received
  ON beta_feedback(owner_hash, received_at DESC);
