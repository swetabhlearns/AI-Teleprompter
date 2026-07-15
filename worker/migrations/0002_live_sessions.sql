CREATE TABLE IF NOT EXISTS interview_live_sessions (
  id TEXT PRIMARY KEY,
  archive_session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  phase TEXT NOT NULL DEFAULT 'interview',
  analysis_status TEXT NOT NULL DEFAULT 'idle',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  last_event_at TEXT,
  error_json TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  live_state_json TEXT NOT NULL DEFAULT '{}',
  turn_log_json TEXT NOT NULL DEFAULT '[]',
  raw_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS interview_live_turns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  phase TEXT NOT NULL DEFAULT 'interview',
  role TEXT NOT NULL DEFAULT 'system',
  event_type TEXT NOT NULL DEFAULT 'event',
  turn_index INTEGER,
  question_index INTEGER,
  text TEXT NOT NULL DEFAULT '',
  transcript TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES interview_live_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interview_live_sessions_updated_at
  ON interview_live_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_live_sessions_status
  ON interview_live_sessions(status);

CREATE INDEX IF NOT EXISTS idx_interview_live_turns_session_sequence
  ON interview_live_turns(session_id, sequence ASC);
