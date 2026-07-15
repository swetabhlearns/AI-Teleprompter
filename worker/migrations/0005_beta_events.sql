CREATE TABLE IF NOT EXISTS beta_events (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  event_name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT '',
  route TEXT NOT NULL DEFAULT '',
  error_name TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_events_received_at
  ON beta_events(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_beta_events_name_received
  ON beta_events(event_name, received_at DESC);
