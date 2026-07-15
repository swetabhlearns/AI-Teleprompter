CREATE TABLE IF NOT EXISTS interview_sessions (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'live',
  source TEXT NOT NULL DEFAULT 'interview',
  status TEXT NOT NULL DEFAULT 'active',
  college TEXT NOT NULL DEFAULT '',
  interview_type TEXT NOT NULL DEFAULT 'general',
  interview_mode TEXT NOT NULL DEFAULT 'live',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ended_at TEXT,
  completed_at TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  processing_json TEXT NOT NULL DEFAULT '{}',
  questions_json TEXT NOT NULL DEFAULT '[]',
  answers_json TEXT NOT NULL DEFAULT '[]',
  evaluations_json TEXT NOT NULL DEFAULT '[]',
  turn_log_json TEXT NOT NULL DEFAULT '[]',
  conversation_timeline_json TEXT NOT NULL DEFAULT '[]',
  conversation_ledger_json TEXT NOT NULL DEFAULT '[]',
  transcript_timeline_json TEXT NOT NULL DEFAULT '[]',
  turn_ledger_json TEXT NOT NULL DEFAULT '[]',
  live_diagnostics_json TEXT,
  session_summary_json TEXT NOT NULL DEFAULT '{}',
  error_json TEXT,
  raw_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_updated_at
  ON interview_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_created_at
  ON interview_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_status
  ON interview_sessions(status);
